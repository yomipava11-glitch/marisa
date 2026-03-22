import fs from 'fs';

async function test() {
    try {
        const formData = new FormData();
        formData.append('file', new Blob(['dummy'], { type: 'audio/webm' }), 'audio.webm');
        formData.append('currentDate', '2026-03-24');
        formData.append('membersList', '[]');

        const res = await fetch('https://etzqdhmvswmzeanlpliy.supabase.co/functions/v1/assistant-vocal-tache', {
            method: 'POST',
            body: formData
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response:', text);
    } catch (e) {
        console.error(e);
    }
}

test();
