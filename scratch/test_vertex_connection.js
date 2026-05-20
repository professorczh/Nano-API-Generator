
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function testVertex() {
    console.log('--- Vertex AI Connection Test ---');
    console.log('Project:', process.env.GOOGLE_CLOUD_PROJECT);
    console.log('Location:', process.env.GOOGLE_CLOUD_LOCATION);
    console.log('ADC Path:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        console.log('ADC file found.');
    } else {
        console.warn('ADC file NOT found at specified path.');
        // Try fallback
        const homeDir = process.env.USERPROFILE || process.env.HOME || '';
        const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
        const adcPath = path.join(appData, 'gcloud', 'application_default_credentials.json');
        if (fs.existsSync(adcPath)) {
            console.log('ADC file found at fallback path:', adcPath);
            process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
        }
    }

    try {
        const client = new GoogleGenAI({
            vertexai: true,
            project: process.env.GOOGLE_CLOUD_PROJECT || 'maphi-2026',
            location: process.env.GOOGLE_CLOUD_LOCATION || 'global'
        });

        console.log('Attempting to list models...');
        const models = await client.models.list();
        console.log('Successfully connected to Vertex AI!');
        console.log('Found', models.length, 'models.');
        // console.log('Models:', models.map(m => m.name).join(', '));
    } catch (error) {
        console.error('Connection failed:', error.message);
    }
}

testVertex();
