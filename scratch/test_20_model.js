const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

async function test20() {
    try {
        const adcPath = path.join(process.env.APPDATA || '/root/.config', 'gcloud', 'application_default_credentials.json');
        if (fs.existsSync(adcPath)) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
        }

        const client = new GoogleGenAI({
            vertexai: true,
            project: 'maphi-2026',
            location: 'us-central1'
        });

        console.log(`\nTesting ID: gemini-2.0-flash-001`);
        try {
            const response = await client.models.generateContent({
                model: 'gemini-2.0-flash-001',
                contents: [{ text: 'hi' }]
            });
            console.log(`✅ Success with ID: gemini-2.0-flash-001`);
            console.log(`Response: ${response.text}`);
        } catch (err) {
            console.log(`❌ Failed with ID: gemini-2.0-flash-001`);
            console.log(`Error: ${err.message}`);
        }
    } catch (e) {
        console.error("Critical Error:", e.message);
    }
}

test20();
