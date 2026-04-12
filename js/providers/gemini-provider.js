import { BaseProvider } from './base-provider.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG } from '../../config.js';

/**
 * Google Gemini Provider
 */
export class GeminiProvider extends BaseProvider {
    constructor(config = {}) {
        super(config);
        
        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
        }
    }

    /**
     * 实现：文本生成 (利用 SDK)
     */
    async generateText(params) {
        const { modelName, prompt, media = [], generationConfig, debugLog } = params;
        if (!this.genAI) throw new Error("Google SDK 未初始化 (API Key缺失)");

        const model = this.genAI.getGenerativeModel({ model: modelName, generationConfig });
        const content = await this.buildTextContent(prompt, media);

        if (debugLog) debugLog(`[Gemini] 发送文本请求, 模型: ${modelName}`, 'info');

        const result = await model.generateContent(content);
        const response = await result.response;

        return this._wrapResponse({
            text: response.text(),
            raw: response
        });
    }

    /**
     * 实现：图片生成 (利用 SDK)
     */
    async generateImage(params) {
        const { modelName, prompt, media = [], generationConfig, aspectRatio, imageSize, debugLog } = params;
        if (!this.genAI) throw new Error("Google SDK 未初始化 (API Key缺失)");

        const model = this.genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                ...generationConfig,
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: { aspectRatio, imageSize }
            }
        });

        const content = await this.buildImageGenContent(prompt, media, params);

        if (debugLog) debugLog(`[Gemini] 发送生图请求, 模型: ${modelName}`, 'info');

        const result = await model.generateContent(content);
        const response = await result.response;

        return this._wrapResponse({
            imageData: this.extractImageData(response),
            raw: response
        });
    }

    /**
     * 实现：音频生成 (通过代理)
     */
    async generateAudio(params) {
        const { modelName, prompt, media = [], audioFormat, debugLog } = params;
        
        if (debugLog) debugLog(`[Gemini] 发送音频请求, 模型: ${modelName}`, 'info');

        try {
            const response = await fetch('/api/google/generate-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: this.apiKey,
                    model: modelName,
                    prompt: prompt,
                    format: audioFormat || 'mp3',
                    media: media.map(item => {
                        const { data, mimeType } = this._getMediaData(item.data || item);
                        return { data, mimeType };
                    })
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const apiResponse = await response.json();
            const audioData = this.extractAudioData(apiResponse);
            
            // 提取歌词和描述 (假设第一个文本部分是歌词，第二个是描述)
            const textParts = apiResponse.candidates?.[0]?.content?.parts?.filter(p => p.text) || [];
            const lyrics = textParts[0]?.text || '';
            const caption = textParts[1]?.text || '';

            return this._wrapResponse({
                audioUrl: audioData ? `data:audio/${audioFormat || 'mp3'};base64,${audioData}` : null,
                raw: apiResponse,
                audioData: audioData,
                lyrics: lyrics,
                caption: caption
            });

        } catch (error) {
            console.error('[Gemini] 音频生成失败:', error);
            throw error;
        }
    }

    /**
     * 实现：视频生成 (异步工作流，调用后端代理)
     */
    async generateVideo(config) {
        const {
            modelName,
            prompt,
            aspectRatio,
            resolution,
            durationSeconds,
            media,
            referenceMode,
            onProgressUpdate,
            onVideoGenerated,
            onError,
            debugLog
        } = config;

        try {
            if (debugLog) debugLog(`[Google Veo] 开始生成视频, 模式: ${referenceMode || 'omni'}, 模型: ${modelName}`, 'info');
            
            const isHighRes = resolution === "1080p" || resolution === "4k";
            const images = (media || []).filter(m => m.type === 'image');
            const videos = (media || []).filter(m => m.type === 'video');
            
            // 文档关键：如果使用了参考图、视频扩展或高分辨率，强制时长为 8s
            const smartDuration = (images.length > 0 || videos.length > 0 || isHighRes) ? 8 : parseInt(durationSeconds || 5, 10);

            // 分辨率对齐：Gemini 最低要求 720p
            let finalResolution = resolution || "720p";
            if (finalResolution === "480p" || finalResolution === "360p") {
                if (debugLog) debugLog(`[Google Veo] 自动将不兼容的分辨率 ${finalResolution} 提升至 720p`, 'info');
                finalResolution = "720p";
            }

            // --- 强效清理 Prompt ---
            let cleanPrompt = prompt.trim();
            cleanPrompt = cleanPrompt.replace(/^["'“]*|["'”]*[,\s]*$/g, '');
            if (cleanPrompt.includes('"prompt":')) {
                const match = cleanPrompt.match(/"prompt":\s*"([^"]+)"/);
                if (match) cleanPrompt = match[1];
            }
            cleanPrompt = cleanPrompt.replace(/[",\s]+$/g, '');

            const instance = {
                prompt: cleanPrompt
            };

            const parameters = {
                aspectRatio: aspectRatio || "16:9",
                resolution: finalResolution,
                durationSeconds: parseInt(smartDuration, 10)
            };

            const isLite = modelName.toLowerCase().includes('lite');

            // --- 核心逻辑：无论是否 Lite，只要是首尾帧模式，就尝试带上两张图 ---
            if (referenceMode === 'start_end' && images.length >= 1) {
                const firstMedia = this._getMediaData(images[0]);
                instance.image = { 
                    mimeType: firstMedia.mimeType, 
                    bytesBase64Encoded: firstMedia.data 
                };
                
                if (images.length >= 2) {
                    const lastMedia = this._getMediaData(images[1]);
                    instance.lastFrame = { 
                        mimeType: lastMedia.mimeType, 
                        bytesBase64Encoded: lastMedia.data 
                    };
                }
            } else if (images.length > 0) {
                // 全能模式 (Omni)
                if (!isLite) {
                    instance.referenceImages = images.map(img => {
                        const mediaData = this._getMediaData(img);
                        return {
                            image: { 
                                mimeType: mediaData.mimeType,
                                bytesBase64Encoded: mediaData.data
                            },
                            referenceType: "asset"
                        };
                    });
                } else {
                    // Lite 模型仅支持单图参考 (在非 start_end 模式下)
                    const mediaData = this._getMediaData(images[0]);
                    instance.image = { 
                        mimeType: mediaData.mimeType, 
                        bytesBase64Encoded: mediaData.data 
                    };
                }
            }
            
            // 视频参考逻辑 (仅限标准版)
            if (videos.length > 0 && !isLite) {
                const videoMedia = this._getMediaData(videos[0]);
                instance.video = { 
                    mimeType: videoMedia.mimeType, 
                    bytesBase64Encoded: videoMedia.data 
                };
            }

            const requestBody = {
                apiKey: this.apiKey,
                model: modelName,
                instances: [instance],
                parameters: parameters
            };
            
            let operationName = config._resumeOperation;
            
            if (!operationName) {
                const response = await fetch('/api/google/generate-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }
                
                const data = await response.json();
                operationName = data.operationName;
                
                if (debugLog) debugLog(`[Google Veo] 任务提交成功, Operation: ${operationName}`, 'info');
            } else {
                if (debugLog) debugLog(`[Google Veo] 正在恢复任务轮询: ${operationName}`, 'info');
            }

            // 轮询状态
            const videoUrl = await this.pollVideoTask({ operationName, onProgressUpdate, onVideoGenerated, onError, debugLog });
            
            return this._wrapResponse({ videoUrl, provider: this.id });
            
        } catch (error) {
            if (debugLog) debugLog(`[Google Veo 错误] ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 内部方法：轮询视频任务
     */
    async pollVideoTask({ operationName, onProgressUpdate, onVideoGenerated, onError, debugLog }) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 300;
            let isFinished = false; // 原子状态锁，防止竞态触发多次回调
            
            const poll = async () => {
                if (isFinished) return;

                try {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        isFinished = true;
                        reject(new Error('视频生成超时'));
                        return;
                    }

                    // 进度由 NodeFactory 的内部计时器平滑驱动，此处仅同步状态
                    if (onProgressUpdate && !isFinished) onProgressUpdate(undefined); 

                    const saveToDisk = document.getElementById('providerToggle')?.checked || false;
                    const statusResponse = await fetch(`/api/google/video-status?operation=${encodeURIComponent(operationName)}&saveToDisk=${saveToDisk}`);
                    
                    if (!statusResponse.ok) {
                        setTimeout(poll, CONFIG.VIDEO_POLLING_INTERVAL || 30000);
                        return;
                    }

                    const statusData = await statusResponse.json();
                    
                    if (statusData.done && !isFinished) {
                        isFinished = true; // 立即抢占状态
                        if (statusData.error) {
                            throw new Error(statusData.error.message || '视频生成失败');
                        }
                        
                        const videoUrl = statusData.videoUrl;
                        if (debugLog) debugLog(`[Google Veo] 完成: ${videoUrl}`, 'success');
                        if (onVideoGenerated) onVideoGenerated(videoUrl, this.id);
                        resolve(videoUrl);
                    } else if (!isFinished) {
                        // 任务未完成，根据全局配置进行下一轮递归轮询
                        setTimeout(poll, CONFIG.VIDEO_POLLING_INTERVAL || 30000);
                    }
                } catch (error) {
                    if (!isFinished) {
                        isFinished = true;
                        reject(error);
                    }
                }
            };

            // 开启第一轮轮询
            setTimeout(poll, CONFIG.VIDEO_POLLING_INTERVAL || 30000);
        });
    }

    /**
     * 实现：连接测试 (利用 SDK)
     */
    async testConnection(debugLog = null) {
        if (!this.apiKey) return { success: false, message: '未配置 API Key' };
        try {
            // 通过直连 Google API 验证 Key 的有效性 (SDK 暂无简单的 listModels 接口)
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            const data = await response.json();
            
            if (!response.ok) {
                const msg = data.error?.message || `HTTP错误: ${response.status}`;
                return { success: false, message: msg };
            }
            
            const count = data.models?.length || 0;
            return { success: true, message: `连接成功 (可用模型: ${count})` };
        } catch (error) {
            return { success: false, message: '网络连接失败: ' + error.message };
        }
    }

    /**
     * 内容构建辅助方法 (支持多模态：图片、视频、音频)
     */
    async buildTextContent(prompt, media = []) {
        if (media.length > 0) {
            const parts = [];

            for (const item of media) {
                let data = item.data;
                let mimeType = '';

                // 解析 MIME 和提取 Base64
                if (data.startsWith('data:')) {
                    mimeType = data.split(';')[0].split(':')[1];
                    data = data.split(',')[1];
                } else if (data.startsWith('blob:')) {
                    // 如果是 blob，需要转换
                    try {
                        const blob = await fetch(data).then(r => r.blob());
                        mimeType = blob.type;
                        data = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.readAsDataURL(blob);
                        });
                    } catch (e) {
                        console.error('[Gemini] Blob 转换失败:', e);
                        continue;
                    }
                }

                if (data && mimeType) {
                    parts.push({
                        inlineData: { data, mimeType }
                    });
                }
            }

            // 最后加入文字
            parts.push(prompt);
            return parts;
        }
        return prompt;
    }

    async buildImageGenContent(prompt, media = [], config) {
        const { pinNote, pinInfo } = config;
        
        if (media.length > 0) {
            const parts = [];

            for (const item of media) {
                let data = item.data;
                let mimeType = '';

                // 解析 MIME 和提取 Base64
                if (data.startsWith('data:')) {
                    mimeType = data.split(';')[0].split(':')[1];
                    data = data.split(',')[1];
                } else if (data.startsWith('blob:')) {
                    try {
                        const blob = await fetch(data).then(r => r.blob());
                        mimeType = blob.type;
                        data = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.readAsDataURL(blob);
                        });
                    } catch (e) {
                        console.error('[Gemini] Blob 转换失败:', e);
                        continue;
                    }
                }

                if (data && mimeType) {
                    parts.push({
                        inlineData: { data, mimeType }
                    });
                }
            }

            let note = '';
            if (pinInfo && pinInfo.length > 0) {
                const pinDetails = pinInfo.map(pin => `PIN ${pin.pinNumber} 在(${Math.round(pin.x)}, ${Math.round(pin.y)})`).join('，');
                note = `完全移除图片上的标记。标记信息：${pinDetails}。`;
            } else if (pinNote) {
                note = pinNote;
            }

            const fullPrompt = prompt ? `${prompt}。${note}` : `请美化这张图片。${note}`;
            parts.push(fullPrompt);
            return parts;
        }
        return prompt;
    }

    extractImageData(response) {
        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        return imagePart ? imagePart.inlineData.data : null;
    }

    extractAudioData(response) {
        const audioPart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData && part.inlineData.mimeType.startsWith('audio/'));
        return audioPart ? audioPart.inlineData.data : null;
    }

    /**
     * 内部辅助：格式化媒体数据为 inlineData
     */
    _getMediaData(mediaItem) {
        let base64 = mediaItem.data || mediaItem;
        let mimeType = 'image/png'; // 默认值
        
        if (base64.startsWith('data:')) {
            const parts = base64.split(';');
            // 从 dataURI 真实提取 mimeType (如 image/jpeg)
            mimeType = parts[0].split(':')[1];
            base64 = parts[1].split(',')[1];
        } else {
            // 如果只有 base64，尝试根据内容推断或保持默认
            if (base64.startsWith('/9j/')) mimeType = 'image/jpeg';
        }
        
        const cleanBase64 = base64.replace(/[\n\r\s]/g, '');
        
        return {
            mimeType: mimeType,
            data: cleanBase64
        };
    }
}
