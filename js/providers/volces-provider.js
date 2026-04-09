import { BaseProvider } from './base-provider.js';

/**
 * 火山方舟 (Volcengine Ark) Provider
 * 支持文本 (Doubao)、图片 (Ark Image) 和 视频 (Seedance)
 */
export class VolcesProvider extends BaseProvider {
    constructor(config = {}) {
        super(config);
        
        // 自动添加 Ark 路径后缀
        if (!this.baseUrl.includes('/api/v3')) {
            this.baseUrl += '/api/v3';
        }

        // 路由表定义
        this.ENDPOINTS = {
            TEXT:  '/chat/completions',
            IMAGE: '/images/generations',
            VIDEO: '/api/volces/generate-video', // 后端代理路径
            STATUS: '/api/volces/video-status'   // 后端状态路径
        };
    }

    /**
     * 实现：文本生成 (Chat Completions)
     */
    async generateText(params) {
        const { modelName, prompt, media = [], images = [], debugLog } = params;
        const allMedia = [...media, ...images]; // 向上兼容
        if (debugLog) debugLog(`[Volces] 文本请求: ${modelName}, 提示词: ${prompt.substring(0, 50)}...`, 'info');

        const messages = [];
        const imageContents = allMedia.filter(m => m.type === 'image');
        
        if (imageContents.length > 0) {
             const content = [{ type: "text", text: prompt }];
             imageContents.forEach(img => {
                 content.push({
                     type: "image_url",
                     image_url: { url: img.data || img }
                 });
             });
             messages.push({ role: "user", content });
        } else {
            messages.push({ role: "user", content: prompt });
        }

        const payload = {
            model: modelName,
            messages: messages,
            thinking: { type: "disabled" } // 默认关闭思考过程以匹配界面渲染
        };

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
     * 实现：图片生成 (Images Generations)
     */
    async generateImage(params) {
        const { modelName, prompt, imageSize, debugLog } = params;
        if (debugLog) debugLog(`[Volces] 图片请求: ${modelName}, 尺寸: ${imageSize}`, 'info');

        const payload = {
            model: modelName,
            prompt: prompt,
            size: imageSize === '1024x1024' || imageSize === '1K' ? "1024x1024" : "1024x1024"
        };

        const data = await this._fetch(this.ENDPOINTS.IMAGE, {
            method: 'POST',
            body: JSON.stringify(payload)
        }, debugLog);

        const imageUrl = data.data[0].url || data.data[0].b64_json;
        
        return this._wrapResponse({
            imageData: imageUrl,
            raw: data
        });
    }

    /**
     * 实现：视频生成 (异步工作流)
     */
    async generateVideo(config) {
        const {
            modelName,
            prompt,
            images = [],
            aspectRatio,
            resolution,
            durationSeconds,
            onProgressUpdate,
            onVideoGenerated,
            onError,
            debugLog
        } = config;

        try {
            if (debugLog) debugLog(`[Volces] 提交视频任务: ${modelName}, 比例: ${aspectRatio}, 时长: ${durationSeconds}`, 'info');
            
            // 提取图片和视频作为参考 (Seedance 2.0)
            const media = [...(config.media || []), ...(config.images || [])];
            const allImages = media.filter(m => m.type === 'image').map(m => m.data || m);
            const allVideos = media.filter(m => m.type === 'video').map(m => m.data || m);

            // 提交任务到后端代理
            const taskId = await this.submitVideoTask({ 
                model: modelName, 
                prompt, 
                images: allImages, 
                videos: allVideos,
                aspectRatio, 
                resolution, 
                duration: durationSeconds,
                debugLog 
            });

            if (debugLog) debugLog(`[Volces] 任务已创建: ${taskId}`, 'info');

            // 轮询状态
            const videoUrl = await this.pollVideoTask({ taskId, onProgressUpdate, onVideoGenerated, onError, debugLog });
            
            return this._wrapResponse({ videoUrl });

        } catch (error) {
            throw error;
        }
    }

    /**
     * 内部方法：提交视频任务 (升级支持 Seedance 2.0 多模态)
     */
    async submitVideoTask({ model, prompt, images, videos = [], aspectRatio, resolution, duration, debugLog }) {
        // 构建 Seedance 2.0 多模态 Content 数组
        const content = [];
        let enhancedPrompt = prompt;

        // 1. 处理图片参考 (首帧参考)
        const imageRefs = images.map((url, index) => ({
            type: "image_url",
            image_url: { url },
            role: index === 0 ? "reference_image" : "image_reference" // 第一个默认为首帧参考
        }));

        // 2. 处理视频参考 (运动参考)
        const videoRefs = videos.map((url, index) => ({
            type: "video_url",
            video_url: { url },
            role: index === 0 ? "reference_video" : "video_reference" // 第一个默认为运动视频参考
        }));

        // 3. 提示词增强：Seedance 2.0 需要显式引用别名
        if (imageRefs.length > 0) {
            enhancedPrompt = `首帧引用图片1，${enhancedPrompt}`;
        }
        if (videoRefs.length > 0) {
            enhancedPrompt = `全程使用视频1的运动趋势，${enhancedPrompt}`;
        }

        // 4. 组装多模态 Content
        content.push({ type: "text", text: enhancedPrompt });
        content.push(...imageRefs);
        content.push(...videoRefs);

        const payload = {
            apiKey: this.apiKey,
            model: model,
            content: content, // 发送 2.0 格式的数据包
            aspectRatio: aspectRatio,
            resolution: resolution,
            duration: duration,
            generate_audio: true // 默认开启火山 2.0 的智能配乐
        };

        if (debugLog) debugLog(`[Volces] 2.0 载荷: ${enhancedPrompt}`, 'info');

        const response = await fetch(this.ENDPOINTS.VIDEO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `提交视频失败: ${response.status}`);
        }

        return data.taskId;
    }

    /**
     * 内部方法：轮询视频任务
     */
    async pollVideoTask({ taskId, onProgressUpdate, onVideoGenerated, onError, debugLog }) {
        return new Promise((resolve, reject) => {
            let isFinished = false;

            const poll = async () => {
                if (isFinished) return;

                try {
                    // 查询后端状态 (同步存盘设置)
                    const saveToDisk = document.getElementById('providerToggle')?.checked || false;
                    const response = await fetch(`${this.ENDPOINTS.STATUS}?taskId=${taskId}&saveToDisk=${saveToDisk}`);
                    if (!response.ok) {
                        // 出错后 5 秒重试
                        setTimeout(poll, 5000);
                        return;
                    }

                    const statusData = await response.json();
                    const status = statusData.status;

                    if (debugLog && !isFinished) debugLog(`[Volces] 任务状态: ${status}`, 'info');

                    if (statusData.done && !isFinished) {
                        isFinished = true;
                        if (status === 'succeeded') {
                            const videoUrl = statusData.savedPath || statusData.videoUrl || statusData.video_url;
                            if (videoUrl) {
                                if (onVideoGenerated) onVideoGenerated(videoUrl);
                                resolve(videoUrl);
                            } else {
                                reject(new Error('视频生成成功但未找到有效的视频 URL'));
                            }
                        } else if (status === 'failed' || status === 'error' || status === 'canceled') {
                            const errorMsg = statusData.error?.message || '视频生成失败';
                            reject(new Error(errorMsg));
                        } else {
                            reject(new Error(`未知任务状态: ${status}`));
                        }
                    } else if (!isFinished) {
                        // 任务未完成，3秒后下一轮
                        const interval = status === 'queued' ? 5000 : 3000;
                        setTimeout(poll, interval);
                        
                        if (onProgressUpdate && statusData.progress !== undefined) {
                            onProgressUpdate(statusData.progress);
                        }
                    }
                } catch (error) {
                    if (!isFinished) {
                        isFinished = true;
                        reject(error);
                    }
                }
            };

            // 启动轮询
            setTimeout(poll, 2000);
        });
    }

    /**
     * 实现：连接测试 (自定义)
     */
    async testConnection(debugLog = null) {
        if (!this.apiKey) return { success: false, message: '未配置 API Key' };
        try {
            // 火山测试必须带一个有效的聊天模型，直接复用 generateText 的路径
            // 注意：这里哪怕模型名不对，只要能返回 4xx 里的模型错误，而不是 401 身份错误，就说明通了
            await this.generateText({
                modelName: 'test-connection-only',
                prompt: 'hi',
                debugLog
            });
            return { success: true, message: '连接成功' };
        } catch (error) {
            if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('key')) {
                return { success: false, message: 'API Key 失效: ' + error.message };
            }
            // 只要不是身份错误，说明网络和鉴权是通的
            return { success: true, message: '接口已连通 (API已响应)' };
        }
    }

    /**
     * 预留：音频生成
     */
    async generateAudio(config) {
        throw new Error("火山音频生成功能开发中...");
    }
}
