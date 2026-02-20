export const CONFIG = {
    API_KEY: getEnvValue('GEMINI_API_KEY') || "YOUR_API_KEY_HERE",
    MODEL_NAME: getEnvValue('GEMINI_MODEL_NAME') || "gemini-3-flash-preview",
    IMAGE_MODEL_NAME: getEnvValue('GEMINI_IMAGE_MODEL_NAME') || "gemini-3-pro-image-preview"
};

function getEnvValue(key) {
    if (typeof window !== 'undefined' && window.ENV && key in window.ENV) {
        return window.ENV[key];
    }
    return null;
}

export const TEXT_MODELS = [
    { name: "Gemini 3 Flash", value: "gemini-3-flash-preview" },
    { name: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
    { name: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
    { name: "Gemini 1.5 Pro", value: "gemini-1.5-pro" }
];

export const IMAGE_MODELS = [
    { name: "Gemini 3 Pro Image", value: "gemini-3-pro-image-preview" },
    { name: "Gemini 2.5 Flash Image", value: "gemini-2.5-flash-image-preview" }
];