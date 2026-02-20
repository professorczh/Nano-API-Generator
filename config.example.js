// config.example.js
// 使用说明：
// 1. 复制此文件为 config.js
// 2. 在 config.js 中填入你的真实 API Key
// 3. 不要将 config.js 上传到 GitHub

export const CONFIG = {
    // 在这里填入你的 Google AI Studio API Key
    API_KEY: "YOUR_API_KEY_HERE",
    // 默认使用的模型（文本生成/图片识别）
    MODEL_NAME: "gemini-3-flash-preview",
    // 图片生成模型
    IMAGE_MODEL_NAME: "gemini-3-pro-image-preview"
};

// 可选的文本/识图模型列表（已验证）
export const TEXT_MODELS = [
    { name: "Gemini 3 Flash", value: "gemini-3-flash-preview" },
    { name: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
    { name: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
    { name: "Gemini 1.5 Pro", value: "gemini-1.5-pro" }
];

// 可选的生图模型列表（已验证）
export const IMAGE_MODELS = [
    { name: "Gemini 3 Pro Image", value: "gemini-3-pro-image-preview" },
    { name: "Gemini 2.5 Flash Image", value: "gemini-2.5-flash-image-preview" }
];
