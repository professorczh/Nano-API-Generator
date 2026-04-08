import { BaseProvider } from './base-provider.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
     * 实现：音频生成 (利用 SDK)
     */
    async generateAudio(params) {
        const { modelName, prompt, media = [], generationConfig, audioDuration, audioFormat, debugLog } = params;
        if (!this.genAI) throw new Error("Google SDK 未初始化 (API Key缺失)");

        const model = this.genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                ...generationConfig,
                responseModalities: ['AUDIO']
            }
        });

        const content = await this.buildTextContent(prompt, media);

        if (debugLog) debugLog(`[Gemini] 发送音频请求, 模型: ${modelName}`, 'info');

        const result = await model.generateContent(content);
        const response = await result.response;

        const audioData = this.extractAudioData(response);
        
        // 如果开启了磁盘保存
        const saveToDisk = document.getElementById('providerToggle')?.checked || false;
        if (saveToDisk && audioData) {
            try {
                await fetch('/save-audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audioData,
                        prompt,
                        format: audioFormat || 'mp3',
                        duration: audioDuration || '15',
                        modelName
                    })
                });
            } catch (e) {
                console.error('[Gemini] 保存音频失败:', e);
            }
        }

        return this._wrapResponse({
            audioUrl: audioData ? `data:audio/${audioFormat || 'mp3'};base64,${audioData}` : null,
            raw: response
        });
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
            onProgressUpdate,
            onVideoGenerated,
            onError,
            debugLog
        } = config;

        try {
            if (debugLog) debugLog(`[Google Veo] 开始生成视频, 模型: ${modelName}`, 'info');
            
            const requestBody = {
                apiKey: this.apiKey,
                model: modelName,
                prompt: prompt,
                config: {
                    aspectRatio: aspectRatio,
                    durationSeconds: parseInt(durationSeconds, 10)
                }
            };
            
            if (!modelName.includes('veo-2')) {
                requestBody.config.resolution = resolution;
            }
            
            // 提交任务到后端
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
            const operationName = data.operationName;
            
            if (debugLog) debugLog(`[Google Veo] 任务提交成功, Operation: ${operationName}`, 'info');

            // 轮询状态
            const videoUrl = await this.pollVideoTask({ operationName, onProgressUpdate, onVideoGenerated, onError, debugLog });
            
            return this._wrapResponse({ videoUrl });
            
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

                    // 更新虚拟进度
                    const progress = Math.min(Math.round((attempts / 60) * 100), 99);
                    if (onProgressUpdate && !isFinished) onProgressUpdate(progress);

                    const saveToDisk = document.getElementById('providerToggle')?.checked || false;
                    const statusResponse = await fetch(`/api/google/video-status?operation=${encodeURIComponent(operationName)}&saveToDisk=${saveToDisk}`);
                    
                    if (!statusResponse.ok) {
                        setTimeout(poll, 10000);
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
                        if (onVideoGenerated) onVideoGenerated(videoUrl);
                        resolve(videoUrl);
                    } else if (!isFinished) {
                        // 任务未完成，10秒后进行下一轮递归轮询
                        setTimeout(poll, 10000);
                    }
                } catch (error) {
                    if (!isFinished) {
                        isFinished = true;
                        reject(error);
                    }
                }
            };

            // 开启第一轮轮询
            setTimeout(poll, 10000);
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
}
