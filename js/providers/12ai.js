import { CONFIG, PROTOCOL_MAP } from '../../config.js';

export class TwelveAIProvider {
    constructor(config = {}) {
        this.apiKey = config.apiKey || CONFIG.TWELVE_AI_API_KEY;
        const rawBaseUrl = config.baseUrl || (CONFIG.TWELVE_AI_SELECTED_LINE === 2 ? CONFIG.TWELVE_AI_BASE_URL_2 : CONFIG.TWELVE_AI_BASE_URL_1);
        this.baseUrl = rawBaseUrl.replace(/\/$/, '');
        this.providerProtocol = config.providerProtocol || 'openai';
        this.getProtocol = config.getProtocol || ((modelName) => this.providerProtocol);
    }

    getSuffix(protocol) {
        return PROTOCOL_MAP[protocol]?.suffix || '/v1';
    }

    updateAPIKey(apiKey) {
        this.apiKey = apiKey;
    }

    updateBaseUrl(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async generateVideo(config) {
        const {
            model,
            prompt,
            images = [],
            aspectRatio = "16:9",
            resolution = "720p",
            durationSeconds = 6,
            onProgressUpdate,
            onVideoGenerated,
            onError,
            debugLog
        } = config;

        if (!this.apiKey) {
            const error = new Error("12AI API Key 未设置");
            if (onError) onError(error);
            throw error;
        }

        if (debugLog) {
            debugLog(`[12AI] 开始生成视频, 模型: ${model}, 提示词: ${prompt}`, 'info');
        }

        try {
            const taskId = await this.submitTask({
                model,
                prompt,
                images,
                aspectRatio,
                resolution,
                durationSeconds,
                debugLog
            });

            if (debugLog) {
                debugLog(`[12AI] 任务已提交, Task ID: ${taskId}`, 'info');
            }

            await this.pollTask({
                taskId,
                onProgressUpdate,
                onVideoGenerated,
                onError,
                debugLog
            });

        } catch (error) {
            if (debugLog) {
                debugLog(`[12AI] 错误: ${error.message}`, 'error');
            }
            if (onError) onError(error);
            throw error;
        }
    }

    async submitTask({ model, prompt, images, aspectRatio, resolution, durationSeconds, debugLog }) {
        const payload = {
            model,
            prompt
        };

        if (images && images.length > 0) {
            payload.images = images;
        }

        payload.metadata = {
            aspectRatio: aspectRatio
        };

        if (!model.startsWith('seedance')) {
            payload.metadata.durationSeconds = durationSeconds;
            payload.metadata.resolution = resolution;
        }

        if (debugLog) {
            debugLog(`[12AI] 请求Payload: ${JSON.stringify(payload)}`, 'info');
        }

        const response = await fetch(`${this.baseUrl}/v1/videos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        
        if (debugLog) {
            debugLog(`[12AI] 响应状态: ${response.status}, 响应内容: ${responseText}`, 'info');
        }

        if (!response.ok) {
            let errorData = {};
            try {
                errorData = JSON.parse(responseText);
            } catch (e) {}
            throw new Error(errorData.error?.message || `提交任务失败: ${response.status} - ${responseText}`);
        }

        const data = JSON.parse(responseText);
        return data.task_id || data.id;
    }

    async pollTask({ taskId, onProgressUpdate, onVideoGenerated, onError, debugLog }) {
        return new Promise((resolve, reject) => {
            const pollInterval = setInterval(async () => {
                try {
                    const result = await this.checkTaskStatus(taskId);

                    if (debugLog) {
                        debugLog(`[12AI] 状态: ${result.status}, 进度: ${result.progress}%`, 'info');
                    }

                    if (onProgressUpdate && result.progress !== undefined) {
                        onProgressUpdate(result.progress);
                    }

                    if (result.status === 'completed') {
                        clearInterval(pollInterval);
                        if (debugLog) {
                            debugLog(`[12AI] 生成完成, 视频URL: ${result.video_url}`, 'info');
                        }
                        if (onVideoGenerated) {
                            onVideoGenerated(`${this.baseUrl}/v1/videos/${taskId}/content`);
                        }
                        resolve(result);
                    } else if (result.status === 'failure') {
                        clearInterval(pollInterval);
                        const error = new Error(result.fail_reason || '视频生成失败');
                        if (onError) onError(error);
                        reject(error);
                    }

                } catch (error) {
                    clearInterval(pollInterval);
                    if (onError) onError(error);
                    reject(error);
                }
            }, 3000);
        });
    }

    async checkTaskStatus(taskId) {
        const response = await fetch(`${this.baseUrl}/v1/videos/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`查询任务状态失败: ${response.status}`);
        }

        const data = await response.json();
        return {
            status: data.status,
            progress: data.progress,
            video_url: data.video_url,
            error: data.error
        };
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

        if (!this.apiKey) {
            throw new Error("12AI API Key 未设置");
        }

        if (debugLog) {
            debugLog(`[12AI] 开始请求, 模型: ${modelName}, 模式: ${isImageGenMode ? '生图' : '文本'}`, 'info');
        }

        if (modelName.startsWith('gemini-')) {
            return await this.generateGeminiFormat(config);
        } else {
            return await this.generateOpenAIFormat(config);
        }
    }

    async generateGeminiFormat(config) {
        const {
            modelName,
            prompt,
            images = [],
            isImageGenMode,
            aspectRatio,
            imageSize,
            debugLog
        } = config;

        const baseUrl = this.baseUrl.replace(/\/$/, '');
        const endpoint = `${baseUrl}/v1beta/models/${modelName}:generateContent`;

        if (debugLog) {
            debugLog(`[12AI Gemini] 端点: ${endpoint}`, 'info');
            debugLog(`[12AI Gemini] 提示词: ${prompt}`, 'info');
            debugLog(`[12AI Gemini] 图片数量: ${images.length}`, 'info');
            debugLog(`[12AI Gemini] 生图模式: ${isImageGenMode}, 宽高比: ${aspectRatio}, 分辨率: ${imageSize}`, 'info');
        }

        let contents = [];
        if (images.length > 0) {
            const parts = [];
            images.forEach(img => {
                parts.push({
                    inlineData: {
                        data: img.data.split(',')[1],
                        mimeType: img.data.split(';')[0].split(':')[1]
                    }
                });
            });
            if (prompt) {
                parts.push({ text: prompt });
            }
            contents.push({ parts });
        } else {
            contents.push({
                parts: [{ text: prompt }]
            });
        }

        const requestBody = { contents };

        if (isImageGenMode) {
            requestBody.generationConfig = {
                responseModalities: ["IMAGE"],
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: imageSize
                }
            };
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
            }

            const data = await response.json();

            if (debugLog) {
                debugLog(`[12AI Gemini] 响应数据: ${JSON.stringify(data).substring(0, 500)}...`, 'info');
                debugLog(`[12AI Gemini] candidates存在: ${!!data.candidates}`, 'info');
                if (data.candidates && data.candidates[0]) {
                    debugLog(`[12AI Gemini] parts数量: ${data.candidates[0]?.content?.parts?.length}`, 'info');
                }
            }

            if (isImageGenMode) {
                const imagePart = data.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
                let imageBase64 = imagePart?.inlineData?.data;
                
                if (debugLog) {
                    debugLog(`[12AI Gemini] 图片部分存在: ${!!imagePart}`, 'info');
                    debugLog(`[12AI Gemini] 图片Base64存在: ${!!imageBase64}`, 'info');
                    if (imageBase64) {
                        debugLog(`[12AI Gemini] 图片Base64长度: ${imageBase64.length}`, 'info');
                    }
                }
                
                if (!imageBase64) {
                    const textPart = data.candidates?.[0]?.content?.parts?.find(part => part.text);
                    const textContent = textPart?.text || '';
                    const urlMatch = textContent.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|gif|webp)/i);
                    
                    if (urlMatch) {
                        const imageUrl = urlMatch[0];
                        if (debugLog) {
                            debugLog(`[12AI Gemini] 检测到图片URL: ${imageUrl}`, 'info');
                        }
                        
                        try {
                            const imgResponse = await fetch(imageUrl);
                            const blob = await imgResponse.blob();
                            
                            imageBase64 = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const base64 = reader.result.split(',')[1];
                                    resolve(base64);
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                            
                            if (debugLog) {
                                debugLog(`[12AI Gemini] URL图片已转换为Base64, 长度: ${imageBase64.length}`, 'info');
                            }
                        } catch (urlError) {
                            if (debugLog) {
                                debugLog(`[12AI Gemini] 下载图片URL失败: ${urlError.message}`, 'error');
                            }
                        }
                    }
                }
                
                return {
                    imageData: imageBase64,
                    text: data.candidates?.[0]?.content?.parts?.find(part => part.text)?.text || ''
                };
            } else {
                return {
                    text: data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '',
                    imageData: null
                };
            }

        } catch (error) {
            if (debugLog) {
                debugLog(`[12AI Gemini] 错误: ${error.message}`, 'error');
            }
            throw error;
        }
    }

    async generateOpenAIFormat(config) {
        const {
            modelName,
            prompt,
            images = [],
            isImageGenMode,
            debugLog
        } = config;

        const endpoint = `${this.baseUrl}/v1/chat/completions`;

        if (debugLog) {
            debugLog(`[12AI OpenAI] 端点: ${endpoint}`, 'info');
            debugLog(`[12AI OpenAI] 模型: ${modelName}`, 'info');
            debugLog(`[12AI OpenAI] 提示词: ${prompt}`, 'info');
            debugLog(`[12AI OpenAI] 图片数量: ${images.length}`, 'info');
            debugLog(`[12AI OpenAI] 生图模式: ${isImageGenMode}`, 'info');
        }

        let requestBody = {
            model: modelName,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        };

        if (isImageGenMode && images.length > 0) {
            requestBody.messages[0].content = [
                { type: "text", text: prompt },
                ...images.map(img => ({
                    type: "image_url",
                    image_url: { url: img.data }
                }))
            ];
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
            }

            const data = await response.json();
            
            if (isImageGenMode) {
                const imageBase64 = data.images?.[0] || data.image?.[0] || data.data?.[0]?.url;
                return {
                    imageData: imageBase64,
                    text: ''
                };
            } else {
                return {
                    text: data.choices?.[0]?.message?.content || '',
                    imageData: null
                };
            }

        } catch (error) {
            if (debugLog) {
                debugLog(`[12AI OpenAI] 错误: ${error.message}`, 'error');
            }
            throw error;
        }
    }
}
