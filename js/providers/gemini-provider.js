import { GoogleGenerativeAI } from "@google/generative-ai";
import { PROTOCOL_MAP } from '../../config.js';

export class GeminiProvider {
    constructor(config = {}) {
        this.apiKey = config.apiKey || '';
        this.baseUrl = config.baseUrl || '';
        this.providerProtocol = config.providerProtocol || 'gemini';
        this.getProtocol = config.getProtocol || ((modelName) => this.providerProtocol);
        
        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
        }
    }

    getSuffix(protocol) {
        return PROTOCOL_MAP[protocol]?.suffix || '/v1beta';
    }

    async generateContent(config) {
        const {
            modelName,
            prompt,
            images = [],
            generationConfig,
            isImageGenMode,
            aspectRatio,
            imageSize,
            debugLog
        } = config;

        const modelConfig = {
            model: modelName
        };

        if (isImageGenMode) {
            modelConfig.generationConfig = {
                ...generationConfig,
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: imageSize
                }
            };
        } else {
            modelConfig.generationConfig = generationConfig;
        }

        const model = this.genAI.getGenerativeModel(modelConfig);

        let content;
        if (isImageGenMode) {
            content = this.buildImageGenContent(prompt, images, config);
        } else {
            content = this.buildTextContent(prompt, images);
        }

        if (debugLog) {
            debugLog(`[Gemini] 发送请求, 模型: ${modelName}`, 'info');
            debugLog(`[Gemini] 模式: ${isImageGenMode ? '生图' : '文本'}`, 'info');
            debugLog(`[Gemini] 提示词: ${prompt}`, 'info');
            debugLog(`[Gemini] 图片数量: ${images.length}`, 'info');
            if (isImageGenMode) {
                debugLog(`[Gemini] 宽高比: ${aspectRatio}, 分辨率: ${imageSize}`, 'info');
            }
        }

        const result = await model.generateContent(content);
        const response = await result.response;

        return {
            response,
            candidates: response.candidates,
            text: response.text(),
            imageData: this.extractImageData(response)
        };
    }

    buildImageGenContent(prompt, images, config) {
        const { pinNote } = config;
        
        if (images.length > 0) {
            const imageContent = images.map(imageData => ({
                inlineData: {
                    data: imageData.data.split(',')[1],
                    mimeType: imageData.data.split(';')[0].split(':')[1]
                }
            }));

            if (prompt) {
                const note = pinNote || (config.pinInfo?.length > 0 ? '完全移除图片上的所有红色数字标记，不要在生成的图片中显示任何标记。' : '');
                imageContent.push(`${prompt}。${note}`);
            } else {
                const note = pinNote || (config.pinInfo?.length > 0 ? '完全移除图片上的所有红色数字标记，不要在生成的图片中显示任何标记。' : '');
                imageContent.push(`请美化这张图片。${note}`);
            }

            return imageContent;
        } else {
            return prompt;
        }
    }

    buildTextContent(prompt, images) {
        if (images.length > 0) {
            const content = images.map(imageData => ({
                inlineData: {
                    data: imageData.data.split(',')[1],
                    mimeType: imageData.data.split(';')[0].split(':')[1]
                }
            }));
            content.push(prompt);
            return content;
        } else {
            return prompt;
        }
    }

    extractImageData(response) {
        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (imagePart) {
            return imagePart.inlineData.data;
        }
        return null;
    }
}
