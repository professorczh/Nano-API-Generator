const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

async function test31() {
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

        // 尝试两种不同的 ID 格式
        const idsToTest = [
            'gemini-3.1-flash-lite-preview',
            'publishers/google/models/gemini-3.1-flash-lite-preview'
        ];

        for (const id of idsToTest) {
            console.log(`\nTesting ID: ${id}`);
            try {
                const response = await client.models.generateContent({
                    model: id,
                    contents: [{ text: 'hi' }]
                });
                console.log(`✅ Success with ID: ${id}`);
                console.log(`Response: ${response.text}`);
                return; // 成功一个就退出
            } catch (err) {
                console.log(`❌ Failed with ID: ${id}`);
                console.log(`Error: ${err.message}`);
            }
        }
    } catch (e) {
        console.error("Critical Error:", e.message);
    }
}

test31();
