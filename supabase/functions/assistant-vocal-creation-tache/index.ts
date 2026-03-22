import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const groqApiKey = Deno.env.get('GROQ_API_KEY');
        if (!groqApiKey) throw new Error('GROQ_API_KEY is not set');

        const formData = await req.formData();
        const file = formData.get('file');
        const currentDate = formData.get('currentDate') || new Date().toISOString();
        const membersList = formData.get('membersList') || "[]";

        if (!file) {
            return new Response(JSON.stringify({ error: 'Aucun fichier audio' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        // 1. Transcription with Whisper
        const audioFormData = new FormData();
        audioFormData.append('file', file);
        audioFormData.append('model', 'whisper-large-v3-turbo');
        audioFormData.append('language', 'fr');
        audioFormData.append('response_format', 'json');

        const audioRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqApiKey}` },
            body: audioFormData
        });

        if (!audioRes.ok) throw new Error(`Whisper Error: ${await audioRes.text()}`);
        const audioData = await audioRes.json();
        const transcript = audioData.text;

        // 2. Data Extraction with LLaMA 3
        const systemPrompt = `Tu es un assistant expert en productivité et product owner.
L'utilisateur te dicte la création d'une NOUVELLE TÂCHE PRINCIPALE.
Aujourd'hui nous sommes le : ${currentDate}.
Les utilisateurs enregistrés sur la plateforme sont : ${membersList} (liste contenant nom et id).

Règles d'extraction:
- "titre": une phrase courte et d'action claire.
- "description": tout contexte supplémentaire, objectifs, et livrables mentionnés. Mets "null" si vide.
- "est_collectif": un booléen (true/false). Si l'utilisateur mentionne vouloir inviter des gens (comme "ajoute Samy"), ou précise la tâche comme "collective" ou "de groupe", mets true. Sinon false.
- "est_prioritaire": un booléen. True si l'utilisateur dit "urgent", "prioritaire", "très important". Sinon false.
- "date_debut": la date de lancement calculée, au format complet "YYYY-MM-DDTHH:MM". Si non précisée, mets "null". Exemple "demain", calcule par rapport à aujourd'hui à 09:00.
- "date_fin": la date d'échéance / limite au format "YYYY-MM-DD". Si non précisée, mets "null".
- "heure_fin": l'heure d'échéance "HH:MM". Par défaut "18:00" ou "null" si date_fin nulle.
- "membres_assignes": un tableau [ ] contenant UNIQUEMENT les chaînes de caractères (UUIDs) des utilisateurs nommés s'ils existent dans la liste ci-dessus. Compare phonétiquement les prénoms de la voix avec la liste. Si aucun membre valide n'est identifié, retourne [].

Retourne UNIQUEMENT un objet JSON valide, sans introduction, sans balise markdown ni autre texte, avec cette structure stricte formatée comme ceci:
{
  "titre": "string",
  "description": "string ou null",
  "est_collectif": true,
  "est_prioritaire": false,
  "date_debut": "YYYY-MM-DDTHH:MM ou null",
  "date_fin": "YYYY-MM-DD ou null",
  "heure_fin": "HH:MM ou null",
  "membres_assignes": ["UUID1", "UUID2"]
}`;

        const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: transcript }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1
            })
        });

        if (!chatRes.ok) throw new Error(`LLaMA Error: ${await chatRes.text()}`);
        const chatData = await chatRes.json();
        
        if (!chatData || !chatData.choices || !chatData.choices[0] || !chatData.choices[0].message) {
             throw new Error("L'IA n'a retourné aucune réponse valide: " + JSON.stringify(chatData));
        }

        const resultString = chatData.choices[0].message.content;
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(resultString);
        } catch(e) {
            console.error("JSON parse error:", resultString);
            throw new Error("L'IA n'a pas renvoyé un JSON valide.");
        }

        return new Response(
            JSON.stringify({
                 transcript: transcript,
                 task_draft: parsedResult
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Analysis error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
})
