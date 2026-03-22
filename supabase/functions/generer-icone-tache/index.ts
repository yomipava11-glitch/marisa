import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { description } = await req.json();

        if (!description) {
           return new Response(JSON.stringify({ icone_url: 'task' }), {
               headers: { ...corsHeaders, 'Content-Type': 'application/json' }
           });
        }

        const prompt = `Tu es un expert en design d'UI.
En te basant sur cette description de tâche professionnelle: "${description}",
détermine l'icône Google Material Symbols la plus appropriée pour représenter cette tâche.
Réponds UNIQUEMENT par le nom exact de l'icône en anglais, en minuscules, sans saut de ligne et sans rien d'autre.
Options fréquentes : "home", "building", "bug_report", "code", "group", "campaign", "router", "restaurant", "local_shipping", "engineering", "monetization_on", "health_and_safety", "gavel", "palette", "science", "design_services", "construction", "event", "calculate", "school", "sports_esports".

Si tu hésites, choisis l'icône la plus générique mais pertinente comme "task", "work" ou "assignment".`;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.1,
                max_tokens: 15,
            })
        });

        if (!groqResponse.ok) {
           throw new Error('Groq API Error');
        }

        const groqData = await groqResponse.json();
        let iconName = groqData.choices[0].message.content.trim().toLowerCase();
        
        // Remove any unwanted characters like quotes or periods
        iconName = iconName.replace(/[^a-z_]/g, '');

        if (!iconName) {
            iconName = 'task';
        }

        return new Response(JSON.stringify({ icone_url: iconName }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
