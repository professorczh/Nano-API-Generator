import { BaseProvider } from './base-provider.js';

/**
 * Vertex AI Provider
 * 所有的请求都通过后端代理处理，以利用本地 ADC 认证
 */
export class VertexProvider extends BaseProvider {
    constructor(config = {}) {
        super(config);
        this.id = 'vertex';
    }

    /**
     * 通用代理方法
     */
    async _proxyRequest(action, params) {
        const { debugLog } = params;
        if (debugLog) debugLog(`[Vertex] 发送请求: ${action}, 模型: ${params.modelName}`, 'info');

        let response;
        try {
            response = await fetch('/api/vertex/proxy-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    model: params.modelName,
                    params: params
                })
            });
        } catch (fetchError) {
            console.error('[Vertex Proxy Network Error]', fetchError);
            throw new Error(`网络请求失败: ${fetchError.message}。请检查后端服务器是否运行在 8000 端口，或代理是否拦截了本地请求。`);
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Vertex 代理错误: ${response.status}`);
        }

        return await response.json();
    }

    async generateContent(params) {
        const result = await this._proxyRequest('generateContent', params);
        return this._wrapResponse(result);
    }

    async generateText(params) {
        return this.generateContent(params);
    }

    async generateImage(params) {
        return this.generateContent(params);
    }

    async generateAudio(params) {
        const result = await this._proxyRequest('generateAudio', params);
        return this._wrapResponse(result);
    }

    async generateVideo(params) {
        // Vertex 的视频通常是长时任务
        const result = await this._proxyRequest('generateVideo', params);
        
        if (result.operationName) {
            // 如果是异步任务，进入轮询逻辑
            return this.pollVideoTask({ 
                operationName: result.operationName, 
                ...params 
            });
        }
        
        return this._wrapResponse(result);
    }

    async pollVideoTask(params) {
        const { operationName, debugLog, onProgressUpdate, onVideoGenerated } = params;
        // 这里的轮询也需要通过后端
        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const response = await fetch(`/api/vertex/video-status?operation=${encodeURIComponent(operationName)}`);
                    const statusData = await response.json();

                    if (statusData.done) {
                        if (statusData.error) throw new Error(statusData.error.message);
                        if (onVideoGenerated) onVideoGenerated(statusData.videoUrl, this.id);
                        resolve(this._wrapResponse({ videoUrl: statusData.videoUrl }));
                    } else {
                        if (onProgressUpdate) onProgressUpdate(statusData.progress);
                        setTimeout(poll, 10000); // 10秒轮询一次
                    }
                } catch (e) {
                    reject(e);
                }
            };
            poll();
        });
    }

    async testConnection(debugLog = null) {
        try {
            const result = await this._proxyRequest('testConnection', { modelName: 'gemini-1.5-flash' });
            return { success: result.success, message: result.message || '连接成功' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * 统一包装响应结果
     */
    _wrapResponse(data) {
        // 1. 优先使用后端提取好的数据
        let text = data.text || '';
        let imageData = data.imageData || null;

        // 2. 如果后端没提出来，尝试从 candidates (Gemini 3.1 原始结构) 中提取
        if (!text || !imageData) {
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const parts = data.candidates[0].content.parts;
                
                if (!text) {
                    const textPart = parts.find(p => p.text);
                    if (textPart) text = textPart.text;
                }
                
                if (!imageData) {
                    const imagePart = parts.find(p => p.inlineData);
                    if (imagePart) {
                        imageData = imagePart.inlineData.data;
                    }
                }
            }
        }

        // 3. 尝试提取图片 (Imagen 模式)
        if (!imageData && data.images && data.images[0]) {
            imageData = data.images[0].bytesBase64Encoded || data.images[0].base64Html || data.images[0].url;
        }

        // 4. 防御性逻辑：确保 imageData 是纯 base64 (剥离前缀)
        if (imageData && typeof imageData === 'string' && imageData.startsWith('data:')) {
            imageData = imageData.split(',')[1];
        }

        // 4. 处理 data.text 是函数的情况 (部分 SDK 版本兼容)
        if (!text && typeof data.text === 'function') {
            try { text = data.text(); } catch(e) {}
        }

        return {
            text: text,
            imageData: imageData,
            raw: data.raw || data
        };
    }
}
