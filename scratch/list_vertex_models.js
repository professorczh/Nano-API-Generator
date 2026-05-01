const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

async function list() {
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

        console.log("Fetching available models for Vertex AI (us-central1)...");
        const response = await client.models.list();
        
        // 打印模型名称
        if (response && response.models) {
            console.log("\nAvailable Models:");
            response.models.forEach(m => {
                console.log(`- ${m.name}`);
            });
        } else {
            console.log("No models found or unexpected response structure.");
            console.log(JSON.stringify(response, null, 2));
        }
    } catch (e) {
        console.error("Error listing models:", e.message);
    }
}

list();
