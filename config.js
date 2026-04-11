export const CONFIG = {
    API_KEY: getEnvValue('GEMINI_API_KEY') || "YOUR_API_KEY_HERE",
    MODEL_NAME: getEnvValue('GEMINI_MODEL_NAME') || "gemini-3-flash-preview",
    MODEL_PROVIDER: getEnvValue('GEMINI_MODEL_PROVIDER') || "google",
    IMAGE_MODEL_NAME: getEnvValue('GEMINI_IMAGE_MODEL_NAME') || "gemini-3.1-flash-image-preview",
    IMAGE_MODEL_PROVIDER: getEnvValue('GEMINI_IMAGE_MODEL_PROVIDER') || "google",
    VIDEO_MODEL_NAME: getEnvValue('GEMINI_VIDEO_MODEL_NAME') || "veo-3.1-generate",
    VIDEO_MODEL_PROVIDER: getEnvValue('GEMINI_VIDEO_MODEL_PROVIDER') || "google",
    AUDIO_MODEL_NAME: getEnvValue('GEMINI_AUDIO_MODEL_NAME') || "lyria-3-clip-preview",
    AUDIO_MODEL_PROVIDER: getEnvValue('GEMINI_AUDIO_MODEL_PROVIDER') || "google",
    REFERENCE_MODES: {
        OMNI: { id: 'omni', name: '全能参考', icon: '🪄' },
        START_END: { id: 'start_end', name: '首尾帧', icon: '🎞️' },
        MULTI_FRAME: { id: 'multi_frame', name: '智能多帧', icon: '🧠' }
    },
    CANVAS_ZOOM: 1,
    VIDEO_POLLING_INTERVAL: 30000, // 官方建议间隔，防止 Rate Limit (ms)
};


function getEnvValue(key) {
    if (typeof window !== 'undefined' && window.ENV && key in window.ENV) {
        return window.ENV[key];
    }
    return null;
}

export const TEXT_MODELS = [
    { name: "gemini-3-flash-preview(google)", value: "gemini-3-flash-preview", provider: "google", group: "Google" },
    { name: "gemini-3-pro-preview(google)", value: "gemini-3-pro-preview", provider: "google", group: "Google" },
    { name: "gemini-2.5-flash(google)", value: "gemini-2.5-flash", provider: "google", group: "Google" }
];

export const IMAGE_MODELS = [
    { name: "gemini-3.1-flash-image-preview(google)", value: "gemini-3.1-flash-image-preview", provider: "google", group: "Google" },
    { name: "gemini-3-pro-image-preview(google)", value: "gemini-3-pro-image-preview", provider: "google", group: "Google" },
    { name: "gemini-2.5-flash-image(google)", value: "gemini-2.5-flash-image", provider: "google", group: "Google" }
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
    { name: "Seedance-2.0(Volces)", value: "doubao-seedance-2-0-260128", provider: "volces", group: "Volces",
      params: {
        durations: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        aspectRatios: ["16:9", "9:16", "3:4", "4:3", "1:1", "21:9", "adaptive"],
        resolutions: { 
          "1": ["480p", "720p", "1080p"], "2": ["480p", "720p", "1080p"], "3": ["480p", "720p", "1080p"],
          "4": ["480p", "720p", "1080p"], "5": ["480p", "720p", "1080p"], "6": ["480p", "720p", "1080p"],
          "7": ["480p", "720p", "1080p"], "8": ["480p", "720p", "1080p"], "9": ["480p", "720p", "1080p"],
          "10": ["480p", "720p", "1080p"], "11": ["480p", "720p", "1080p"], "12": ["480p", "720p", "1080p"],
          "13": ["480p", "720p", "1080p"], "14": ["480p", "720p", "1080p"], "15": ["480p", "720p", "1080p"]
        },
        supportsReferenceImages: true,
        supportsVideoExtension: true,
        referenceModes: ['omni', 'start_end', 'multi_frame']
      }
    },
    { name: "Seedance-2.0-Fast(Volces)", value: "doubao-seedance-2-0-fast-260128", provider: "volces", group: "Volces",
      params: {
        durations: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        aspectRatios: ["16:9", "9:16", "3:4", "4:3", "1:1", "21:9", "adaptive"],
        resolutions: { 
          "1": ["480p", "720p", "1080p"], "2": ["480p", "720p", "1080p"], "3": ["480p", "720p", "1080p"],
          "4": ["480p", "720p", "1080p"], "5": ["480p", "720p", "1080p"], "6": ["480p", "720p", "1080p"],
          "7": ["480p", "720p", "1080p"], "8": ["480p", "720p", "1080p"], "9": ["480p", "720p", "1080p"],
          "10": ["480p", "720p", "1080p"], "11": ["480p", "720p", "1080p"], "12": ["480p", "720p", "1080p"],
          "13": ["480p", "720p", "1080p"], "14": ["480p", "720p", "1080p"], "15": ["480p", "720p", "1080p"]
        },
        supportsReferenceImages: true,
        supportsVideoExtension: true,
        referenceModes: ['omni', 'start_end', 'multi_frame']
      }
    }
];

export const AUDIO_MODELS = [
    { name: "lyria-3-clip-preview(google)", value: "lyria-3-clip-preview", provider: "google", group: "Google",
      params: {
        durations: ["30"],
        formats: ["mp3"]
      }
    },
    { name: "lyria-3-pro-preview(google)", value: "lyria-3-pro-preview", provider: "google", group: "Google",
      params: {
        durations: ["60", "120", "180"],
        formats: ["mp3", "wav"]
      }
    }
];

export const AUDIO_DURATIONS = [
    { name: "15 秒", value: "15" },
    { name: "30 秒", value: "30" },
    { name: "60 秒", value: "60" }
];

export const AUDIO_FORMATS = [
    { name: "mp3", value: "mp3" },
    { name: "wav", value: "wav" },
    { name: "aac", value: "aac" }
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
    
    if (window.dynamicProviderManager) {
        const allModels = window.dynamicProviderManager.getAllModels();
        const combined = [...(allModels.text || []), ...(allModels.image || []), ...(allModels.video || []), ...(allModels.audio || [])];
        const model = combined.find(m => m.value === modelId);
        if (model) return model.provider;
    }
    
    const allModels = [...TEXT_MODELS, ...IMAGE_MODELS, ...VIDEO_MODELS, ...AUDIO_MODELS];
    const model = allModels.find(m => m.value === modelId);
    return model?.provider || 'google';
}

export function getModelDisplayName(modelId, provider) {
    if (!modelId) return { name: '', provider: '' };
    
    if (window.dynamicProviderManager) {
        const allModels = window.dynamicProviderManager.getAllModels();
        const combined = [...(allModels.text || []), ...(allModels.image || []), ...(allModels.video || []), ...(allModels.audio || [])];
        const model = combined.find(m => m.value === modelId && m.provider === provider);
        if (model) {
            return { name: model.name, provider: model.group || provider };
        }
    }
    
    const allModels = [...TEXT_MODELS, ...IMAGE_MODELS, ...VIDEO_MODELS, ...AUDIO_MODELS];
    const model = allModels.find(m => m.value === modelId && m.provider === provider);
    if (model) {
        const name = model.name.replace(/\s*\(Google\)/g, '');
        const providerName = provider === 'google' ? 'Google' : provider;
        return { name, provider: providerName };
    }
    return { name: modelId, provider: '' };
}

export function migrateOldStorageFormat() {
    const keys = [
        { name: 'GEMINI_MODEL_NAME', providerKey: 'GEMINI_MODEL_PROVIDER' },
        { name: 'GEMINI_IMAGE_MODEL_NAME', providerKey: 'GEMINI_IMAGE_MODEL_PROVIDER' },
        { name: 'GEMINI_VIDEO_MODEL_NAME', providerKey: 'GEMINI_VIDEO_MODEL_PROVIDER' },
        { name: 'GEMINI_AUDIO_MODEL_NAME', providerKey: 'GEMINI_AUDIO_MODEL_PROVIDER' }
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
