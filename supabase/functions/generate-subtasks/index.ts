import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
        if (!GROQ_API_KEY) {
            return new Response(JSON.stringify({ error: "GROQ_API_KEY non configurée." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Get task info from request
        const { titre, description, tache_id } = await req.json();

        if (!titre) {
            return new Response(JSON.stringify({ error: "Le titre de la tâche est requis." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Prepare prompt for Groq
        const prompt = `Voici une fonctionnalité ou tâche à réaliser : 
        Titre: ${titre}
        Description: ${description || 'Aucune description'}

        Ton objectif est de la découper en petites sous-tâches concrètes et réalisables. 
        Génère une réponse EXCLUSIVEMENT au format JSON (pas de markdown, pas de prologue, pas d'épilogue, utilise bien les guillemets). 
        La structure doit obligatoirement être un objet contenant un tableau "subtasks" contenant les sous-tâches:
        {
          "subtasks": [
            { "titre": "...", "description": "..." },
            { "titre": "...", "description": "..." }
          ]
        }`;

        console.log('Calling Groq API for task:', titre);

        // Call Groq API (Llama 3 8b)
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5,
            })
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error('Groq API Error:', errorText);
            throw new Error(`Groq API error: ${errorText}`);
        }

        const data = await groqResponse.json();
        const responseText = data.choices[0].message.content;

        console.log('Groq Response Text:', responseText);

        // Parse JSON response
        let subtasks = [];
        try {
            let parsed;
            try {
                parsed = JSON.parse(responseText.trim());
            } catch (jsonErr) {
                // Formatting fallback when LLM wraps json with codeblocks or text
                const firstBrace = responseText.indexOf('{');
                const lastBrace = responseText.lastIndexOf('}');

                const firstBracket = responseText.indexOf('[');
                const lastBracket = responseText.lastIndexOf(']');

                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    parsed = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
                } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                    parsed = JSON.parse(responseText.substring(firstBracket, lastBracket + 1));
                } else {
                    throw new Error('Aucun conteneur JSON détecté.');
                }
            }

            // Support both formats: an array or { "subtasks": [...] }
            subtasks = Array.isArray(parsed) ? parsed : (parsed.subtasks || parsed.taches || Object.values(parsed)[0]);

            if (!Array.isArray(subtasks)) {
                throw new Error('L\'intelligence artificielle n\'a pas généré de sous-tâches valides.');
            }
        } catch (e) {
            console.error('Error parsing Groq response:', e);
            console.error('Raw Response:', responseText);
            throw new Error(`Le format renvoyé par l'IA n'est pas valide. Brut: ${responseText}`);
        }

        if (subtasks.length === 0) {
            throw new Error('Aucune sous-tâche n\'a été générée.');
        }

        // Initialize Supabase Admin Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Insert into database
        const tasksToInsert = subtasks.map((st: any) => ({
            tache_id: tache_id,
            titre: st.titre,
            statut: 'en_attente', // Default status matching DB constraint
        }));

        console.log('Inserting subtasks into DB:', tasksToInsert);

        const { data: insertedData, error: dbError } = await supabase
            .from('sous_taches')
            .insert(tasksToInsert)
            .select();

        if (dbError) {
            console.error('Database Error:', dbError);
            throw new Error(`Erreur lors de l'insertion dans la base de données: ${dbError.message}`);
        }

        console.log('Successfully inserted subtasks:', insertedData);

        return new Response(JSON.stringify({ success: true, data: insertedData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
