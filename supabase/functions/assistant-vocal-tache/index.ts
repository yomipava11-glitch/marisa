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
        const systemPrompt = `Tu es un assistant intelligent de gestion de projet.
Ta tâche est d'analyser la demande vocale de l'utilisateur et d'en extraire les informations pour créer une sous-tâche.
Aujourd'hui nous sommes le : ${currentDate}.
Les membres affectés au projet sont : ${membersList} (liste contenant nom, email, et ID).

Règles d'extraction:
- "titre": une description courte et claire de la sous-tâche (sans inclure d'informations sur l'assignation ou les dates).
- "assigne_a": l'ID exact de la personne si son nom ou prénom est explicitement mentionné dans le vocal ET qu'il/elle est dans la liste des membres du projet. Si la personne n'est pas dans la liste, ou s'il n'y a pas d'assignation, mets "null".
- "date_debut": la date de début au format YYYY-MM-DD. Si absente, mets "null".
- "date_fin": la date limite/de fin au format YYYY-MM-DD. Si absente, mets "null".

Retourne UNIQUEMENT un objet JSON valide, sans introduction, sans balise markdown ni autre texte, avec cette structure:
{
  "titre": "string",
  "assigne_a": "UUID string ou null",
  "date_debut": "YYYY-MM-DD ou null",
  "date_fin": "YYYY-MM-DD ou null"
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
                 subtask: parsedResult
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Analysis error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
})
