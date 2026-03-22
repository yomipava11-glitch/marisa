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
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // Get user from explicit token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired token" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Fetch user's tasks and collaborative tasks to give context to the AI
        let { data: userTasks, error: tasksError } = await supabase
            .from('taches')
            .select(`
                id, titre, description, date_echeance, est_collectif, est_important, createur_id,
                membres_tache ( utilisateur_id, profils (nom, avatar_url) )
            `);

        if (tasksError) {
            throw new Error(`Database Error: ${tasksError.message}`);
        }

        // Filter in memory to avoid PostgREST foreign table .or() parse error
        userTasks = userTasks?.filter((t: any) => 
            t.createur_id === user.id || 
            (t.membres_tache && t.membres_tache.some((m: any) => m.utilisateur_id === user.id))
        ) || [];

        if (tasksError) {
            throw new Error(`Database Error: ${tasksError.message}`);
        }

        // Compute stats locally to save AI tokens and ensure accuracy
        const stats = {
            totalTasks: userTasks.length,
            individualTasks: userTasks.filter((t: any) => !t.est_collectif).length,
            collectiveTasks: userTasks.filter((t: any) => t.est_collectif).length,
            importantTasks: userTasks.filter((t: any) => t.est_important).length,
            overdueTasks: userTasks.filter((t: any) => t.date_echeance && new Date(t.date_echeance) < new Date()).length,
            completedSubs: 0 // Would need subtasks data to be accurate
        };

        // Prepare context
        const contextData = JSON.stringify(userTasks?.slice(0, 10) || []); // Limit to 10 to avoid token limits

        const prompt = `Tu es un Scrum Master / Coach Agile expert pour une équipe.
        Voici la liste des tâches actuelles du projet :
        ${contextData}

        Génère un rapport agile au format JSON pur et valide (pas de code markdown, commence par {).
        Structure EXACTE attendue :
        {
          "health_score": 75,
          "health_summary": "Résumé de l'état global du projet en 1 phrase",
          "alerts": [
            { "type": "warning", "text": "Alerte sur une tâche en retard", "icon": "warning" }
          ],
          "task_analyses": [
            { "titre": "Titre", "type": "collectif", "sante": "bon", "progression_pct": 50, "risque": "Risque éventuel", "conseil": "Action recommandée" }
          ],
          "daily_focus": [
            { "id": 1, "title": "Tâche prioritaire", "priority": "High", "status": "Todo", "reason": "Pourquoi la faire" }
          ],
          "smart_assignments": [
             { "taskTitle": "Tâche", "suggestedUser": { "name": "Prénom", "avatar": "" }, "reason": "Pourquoi" }
          ],
          "recommendations": [
             { "category": "productivite", "text": "Conseil d'amélioration", "icon": "trending_up" }
          ]
        }
        Fournis 1 health_score pertinent, 1 à 2 alertes (type: danger/warning/info), 2 analyses de tâches (sante valides: bon/correct/a_risque/critique), 2 daily_focus, 1 smart_assignment et 2 recommandations. Reste concis pour économiser les tokens.`;

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
                max_tokens: 1500,
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
        
        // Attach locally computed stats
        parsedResponse.stats = stats;

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
