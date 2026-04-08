import { BaseProvider } from './base-provider.js';

/**
 * OpenAI 兼容 Provider
 * 适用于 OpenAI (GPT-4), DeepSeek, Claude (通过 OpenAI 兼容接口) 等所有使用标准 OpenAI API 格式的厂家
 */
export class OpenAIProvider extends BaseProvider {
    constructor(config = {}) {
        super(config);
        
        // 路由表定义
        this.ENDPOINTS = {
            TEXT:  '/v1/chat/completions',
            IMAGE: '/v1/images/generations',
            VIDEO: '/v1/images/generations', // 某些厂家兼容此路径
            AUDIO: '/v1/audio/speech'
        };
    }

    /**
     * 实现：文本生成
     */
    async generateText(params) {
        const { modelName, prompt, media = [], images = [], generationConfig, debugLog } = params;
        const allMedia = [...media, ...images]; // 向上兼容
        const messages = [];

        // 提取图片作为多模态输入
        const imageContents = allMedia.filter(m => m.type === 'image');
        
        if (imageContents.length > 0) {
            const content = [{ type: "text", text: prompt || "解释这张图片" }];
            imageContents.forEach(img => {
                content.push({
                    type: "image_url",
                    image_url: { url: img.data || img } // 支持 Base64 字典或直接 URL
                });
            });
            messages.push({ role: "user", content });
        } else {
            messages.push({ role: "user", content: prompt });
        }

        const payload = {
            model: modelName,
            messages: messages,
            temperature: generationConfig?.temperature || 0.7,
            top_p: generationConfig?.topP || 1.0,
            max_tokens: generationConfig?.maxOutputTokens || 2048
        };

        if (debugLog) debugLog(`[OpenAI] 发送文本请求, 模型: ${modelName}`, 'info');

        const data = await this._fetch(this.ENDPOINTS.TEXT, {
            method: 'POST',
            body: JSON.stringify(payload)
        }, debugLog);

        return this._wrapResponse({
            text: data.choices[0].message.content,
            raw: data
        });
    }

    /**
     * 实现：图片生成
     */
    async generateImage(params) {
        const { modelName, prompt, aspectRatio, imageSize, debugLog } = params;

        // 映射参数
        const payload = {
            model: modelName,
            prompt: prompt,
            n: 1,
            size: imageSize === '1024x1024' || imageSize === '1K' ? "1024x1024" : "1024x1024" // 部分厂家支持自适应
        };

        // 如果是 DALL-E 3，比例通常在 prompt 里或者通过特殊字段
        if (aspectRatio) {
            payload.quality = "hd";
            // 某些厂家支持 style: "natural" 或 "vivid"
        }

        if (debugLog) debugLog(`[OpenAI] 发送生图请求, 模型: ${modelName}`, 'info');

        const data = await this._fetch(this.ENDPOINTS.IMAGE, {
            method: 'POST',
            body: JSON.stringify(payload)
        }, debugLog);

        // OpenAI 通常返回 URL 或 b64_json
        const imageData = data.data[0].url || data.data[0].b64_json;

        return this._wrapResponse({
            imageData: imageData,
            raw: data
        });
    }
}
