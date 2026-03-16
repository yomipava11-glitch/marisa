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
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

        if (!GROQ_API_KEY || !supabaseUrl || !supabaseAnonKey) {
            throw new Error('Missing required environment variables');
        }

        // We use the authorization header from the client to execute queries with their permissions (RLS)
        const authHeader = req.headers.get('Authorization')!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // Get user from token
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Fetch user's tasks and collaborative tasks to give context to the AI
        const { data: userTasks, error: tasksError } = await supabase
            .from('taches')
            .select(`
                id, titre, description, date_echeance, est_collectif, est_important,
                membres_tache ( utilisateur_id, profils (nom, avatar_url) )
            `)
            .or(`createur_id.eq.${user.id},membres_tache.utilisateur_id.eq.${user.id}`);

        if (tasksError) {
            throw new Error(`Database Error: ${tasksError.message}`);
        }

        // Prepare context
        const contextData = JSON.stringify(userTasks?.slice(0, 20) || []); // Limit to 20 to avoid token limits

        const prompt = `Tu es un Scrum Master / Coach Agile expert pour une équipe.
        Voici la liste des tâches actuelles du projet (contenant les titres, descriptions, statuts, et membres assignés) :
        ${contextData}

        Analyse ces données et génère un rapport de coaching agile au format JSON pur et valide (pas de code markdown, commence directement par {).
        La structure doit OBLIGATOIREMENT être :
        {
          "daily_focus": [
            { "id": 1, "title": "Titre tâche urgente", "priority": "High/Medium/Low", "status": "Todo/In Progress" }
          ],
          "smart_assignments": [
             { "taskTitle": "Titre tâche non assignée", "suggestedUser": { "name": "Prénom", "avatar": "url_ou_vide" }, "reason": "Pourquoi cette personne" }
          ],
          "agile_insights": [
             { "type": "bottleneck|velocity|tip", "text": "Un conseil agile ou une alerte", "icon": "warning|trending_up|lightbulb" }
          ]
        }
        Fournis 3 daily_focus, 2 smart_assignments (invente si besoin en te basant sur les membres) et 2 agile_insights pertinents.`;

        console.log('Calling Groq API for Agile Coach...');

        // Call Groq API (Llama 3 8b)
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.6,
                max_tokens: 2000,
                response_format: { type: "json_object" }
            })
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            throw new Error(`Groq API error: ${errorText}`);
        }

        const groqData = await groqResponse.json();
        const responseText = groqData.choices[0].message.content;

        const parsedResponse = JSON.parse(responseText);

        return new Response(JSON.stringify(parsedResponse), {
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
