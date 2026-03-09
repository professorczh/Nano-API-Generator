export const MODELS = {
    'Gemini': {
        textModels: [
            { name: 'gemini-3-flash-preview', protocol: 'gemini' },
            { name: 'gemini-3-pro-preview', protocol: 'gemini' },
            { name: 'gemini-2.5-flash', protocol: 'gemini' }
        ],
        imageModels: [
            { name: 'gemini-3.1-flash-image-preview', protocol: 'gemini' },
            { name: 'gemini-3-pro-image-preview', protocol: 'gemini' },
            { name: 'gemini-2.5-flash-image', protocol: 'gemini' }
        ],
        videoModels: [
            { name: 'veo-3.1-generate-preview', protocol: 'gemini' },
            { name: 'veo-3.1-fast-generate-preview', protocol: 'gemini' },
            { name: 'veo-2.0-generate-001', protocol: 'gemini' }
        ]
    },
    '12AI': {
        textModels: [
            { name: 'gemini-3-pro-preview', protocol: 'gemini' },
            { name: 'gpt-5.1', protocol: 'openai' }
        ],
        imageModels: [
            { name: 'gemini-3.1-flash-image-preview', protocol: 'gemini' },
            { name: 'gemini-3-pro-image-preview', protocol: 'gemini' },
            { name: 'gemini-2.5-flash-image', protocol: 'gemini' }
        ],
        videoModels: [
            { name: 'seedance2-5s', protocol: 'openai' },
            { name: 'seedance2-10s', protocol: 'openai' },
            { name: 'seedance2-15s', protocol: 'openai' },
            { name: 'veo-3.1-fast-generate-preview', protocol: 'gemini' }
        ]
    },
    'OpenAI': {
        textModels: [],
        imageModels: [],
        videoModels: []
    },
    'Claude': {
        textModels: [],
        imageModels: [],
        videoModels: []
    }
};

export function getModelsByProvider(providerId) {
    return MODELS[providerId] || { textModels: [], imageModels: [], videoModels: [] };
}

export function getAllModels() {
    return MODELS;
}
