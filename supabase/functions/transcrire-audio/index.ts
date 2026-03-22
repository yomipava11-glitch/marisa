import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const groqApiKey = Deno.env.get('GROQ_API_KEY')
        if (!groqApiKey) {
            throw new Error('GROQ_API_KEY is not set')
        }

        // The request body should be multipart/form-data containing the audio file
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return new Response(
                JSON.stringify({ error: 'Aucun fichier audio fourni.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // Prepare the request to Groq OpenAI compatible Audio API
        const groqFormData = new FormData();
        groqFormData.append('file', file);
        groqFormData.append('model', 'whisper-large-v3-turbo');
        groqFormData.append('language', 'fr'); // Assuming French, or let it auto-detect by removing this
        groqFormData.append('response_format', 'json');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`
            },
            body: groqFormData
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error('Groq API Error:', errBody);
            throw new Error(`Groq API responded with status ${response.status}`);
        }

        const data = await response.json();
        
        return new Response(
            JSON.stringify({ texte: data.text }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Transcription error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
