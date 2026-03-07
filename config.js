export const CONFIG = {
    API_KEY: getEnvValue('GEMINI_API_KEY') || "YOUR_API_KEY_HERE",
    MODEL_NAME: getEnvValue('GEMINI_MODEL_NAME') || "gemini-3-flash-preview",
    MODEL_PROVIDER: getEnvValue('GEMINI_MODEL_PROVIDER') || "google",
    IMAGE_MODEL_NAME: getEnvValue('GEMINI_IMAGE_MODEL_NAME') || "gemini-3.1-flash-image-preview",
    IMAGE_MODEL_PROVIDER: getEnvValue('GEMINI_IMAGE_MODEL_PROVIDER') || "google",
    VIDEO_MODEL_NAME: getEnvValue('GEMINI_VIDEO_MODEL_NAME') || "veo-3.1-generate",
    VIDEO_MODEL_PROVIDER: getEnvValue('GEMINI_VIDEO_MODEL_PROVIDER') || "google",
    TWELVE_AI_API_KEY: getEnvValue('12AI_API_KEY') || "",
    TWELVE_AI_BASE_URL_1: "https://cdn.12ai.org",
    TWELVE_AI_BASE_URL_2: "https://new.12ai.org",
    TWELVE_AI_SELECTED_LINE: 1
};

export const TWELVE_AI_LINES = [
    { id: 1, name: "线路一", url: "https://cdn.12ai.org" },
    { id: 2, name: "线路二", url: "https://new.12ai.org" }
];

function getEnvValue(key) {
    if (typeof window !== 'undefined' && window.ENV && key in window.ENV) {
        return window.ENV[key];
    }
    return null;
}

export const TEXT_MODELS = [
    { name: "gemini-3-flash-preview(google)", value: "gemini-3-flash-preview", provider: "google", group: "Google" },
    { name: "gemini-3-pro-preview(google)", value: "gemini-3-pro-preview", provider: "google", group: "Google" },
    { name: "gemini-2.5-flash(google)", value: "gemini-2.5-flash", provider: "google", group: "Google" },
    { name: "gemini-3-pro-preview(12ai)", value: "gemini-3-pro-preview", provider: "12ai", group: "12AI" },
    { name: "gpt-5.1(12ai)", value: "gpt-5.1", provider: "12ai", group: "12AI" }
];

export const IMAGE_MODELS = [
    { name: "gemini-3.1-flash-image-preview(google)", value: "gemini-3.1-flash-image-preview", provider: "google", group: "Google" },
    { name: "gemini-3-pro-image-preview(google)", value: "gemini-3-pro-image-preview", provider: "google", group: "Google" },
    { name: "gemini-2.5-flash-image(google)", value: "gemini-2.5-flash-image", provider: "google", group: "Google" },
    { name: "gemini-3.1-flash-image-preview(12ai)", value: "gemini-3.1-flash-image-preview", provider: "12ai", group: "12AI" },
    { name: "gemini-3-pro-image-preview(12ai)", value: "gemini-3-pro-image-preview", provider: "12ai", group: "12AI" },
    { name: "gemini-2.5-flash-image(12ai)", value: "gemini-2.5-flash-image", provider: "12ai", group: "12AI" }
];

export const VIDEO_MODELS = [
    { name: "veo-3.1-generate-preview(google)", value: "veo-3.1-generate-preview", provider: "google", group: "Google",
      params: {
        durations: ["4", "6", "8"],
        aspectRatios: ["16:9", "9:16"],
        resolutions: {
          "4": ["720p"],
          "6": ["720p"],
          "8": ["720p", "1080p", "4k"]
        },
        supportsReferenceImages: true,
        supportsVideoExtension: true
      }
    },
    { name: "veo-3.1-fast-generate-preview(google)", value: "veo-3.1-fast-generate-preview", provider: "google", group: "Google",
      params: {
        durations: ["4", "6", "8"],
        aspectRatios: ["16:9", "9:16"],
        resolutions: {
          "4": ["720p"],
          "6": ["720p"],
          "8": ["720p", "1080p", "4k"]
        },
        supportsReferenceImages: false,
        supportsVideoExtension: true
      }
    },
    { name: "veo-2.0-generate-001(google)", value: "veo-2.0-generate-001", provider: "google", group: "Google",
      params: {
        durations: ["5", "6", "8"],
        aspectRatios: ["16:9", "9:16"],
        resolutions: {},
        supportsReferenceImages: false,
        supportsVideoExtension: false
      }
    },
    { name: "seedance2-5s(12ai)", value: "seedance2-5s", provider: "12ai", group: "12AI" },
    { name: "seedance2-10s(12ai)", value: "seedance2-10s", provider: "12ai", group: "12AI" },
    { name: "seedance2-15s(12ai)", value: "seedance2-15s", provider: "12ai", group: "12AI" },
    { name: "veo-3.1-fast-generate-preview(12ai)", value: "veo-3.1-fast-generate-preview", provider: "12ai", group: "12AI" }
];

export const VIDEO_RATIOS = [
    { name: "16:9", value: "16:9" },
    { name: "9:16", value: "9:16" }
];

export const IMAGE_RATIOS = [
    { name: "1:1 正方形", value: "1:1" },
    { name: "16:9 宽屏", value: "16:9" },
    { name: "9:16 竖屏", value: "9:16" },
    { name: "4:3", value: "4:3" },
    { name: "3:4", value: "3:4" },
    { name: "3:2", value: "3:2" },
    { name: "2:3", value: "2:3" },
    { name: "5:4", value: "5:4" },
    { name: "4:5", value: "4:5" },
    { name: "21:9 超宽", value: "21:9" },
    { name: "8:1 超宽", value: "8:1" },
    { name: "4:1 超宽", value: "4:1" },
    { name: "1:4 超高", value: "1:4" },
    { name: "1:8 超高", value: "1:8" }
];

export const IMAGE_SIZES = [
    { name: "0.5K (512×512)", value: "512px" },
    { name: "1K (1024×1024)", value: "1K" },
    { name: "2K (1920×1080)", value: "2K" },
    { name: "4K (3840×2160)", value: "4K" }
];

export function getProviderByModelId(modelId) {
    if (!modelId) return 'google';
    const allModels = [...TEXT_MODELS, ...IMAGE_MODELS, ...VIDEO_MODELS];
    const model = allModels.find(m => m.value === modelId);
    return model?.provider || 'google';
}

export function getModelDisplayName(modelId, provider) {
    if (!modelId) return { name: '', provider: '' };
    const allModels = [...TEXT_MODELS, ...IMAGE_MODELS, ...VIDEO_MODELS];
    const model = allModels.find(m => m.value === modelId && m.provider === provider);
    if (model) {
        const name = model.name.replace(/\s*\(Google\)|\s*\(12AI\)/g, '');
        const providerName = provider === 'google' ? 'Google' : '12AI';
        return { name, provider: providerName };
    }
    return { name: modelId, provider: '' };
}

export function migrateOldStorageFormat() {
    const keys = [
        { name: 'GEMINI_MODEL_NAME', providerKey: 'GEMINI_MODEL_PROVIDER' },
        { name: 'GEMINI_IMAGE_MODEL_NAME', providerKey: 'GEMINI_IMAGE_MODEL_PROVIDER' },
        { name: 'GEMINI_VIDEO_MODEL_NAME', providerKey: 'GEMINI_VIDEO_MODEL_PROVIDER' }
    ];
    
    keys.forEach(({ name, providerKey }) => {
        const oldValue = localStorage.getItem(name);
        if (oldValue && oldValue.includes(':')) {
            const [provider, modelId] = oldValue.split(':');
            localStorage.setItem(name, modelId);
            localStorage.setItem(providerKey, provider);
        }
    });
}
