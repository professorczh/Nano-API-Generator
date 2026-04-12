/**
 * AI Provider 基类
 * 所有具体的供应商 (Gemini, OpenAI, Volces 等) 都应继承此类
 */
export class BaseProvider {
    constructor(config = {}) {
        this.id = config.id || '';
        this.name = config.name || '';
        this.apiKey = config.apiKey || '';
        this.baseUrl = (config.baseUrl || '').replace(/\/$/, '');
        this.protocol = config.protocol || 'openai';
        
        // 路由表，由子类填充
        this.ENDPOINTS = {
            TEXT: '',
            IMAGE: '',
            VIDEO: '',
            AUDIO: ''
        };
    }

    /**
     * 更新配置
     */
    updateConfig(config = {}) {
        if (config.apiKey !== undefined) this.apiKey = config.apiKey;
        if (config.baseUrl !== undefined) this.baseUrl = config.baseUrl.replace(/\/$/, '');
    }

    /**
     * 统一内容生成接口 (主要由 api-client 调用)
     */
    async generateContent(params) {
        if (params.isImageGenMode) {
            return this.generateImage(params);
        } else if (params.isVideoGenMode) {
            return this.generateVideo(params);
        } else if (params.isAudioGenMode) {
            return this.generateAudio(params);
        }
        return this.generateText(params);
    }

    /**
     * 基础生成方法 (子类需根据自身协议实现)
     */
    async generateText(params) { throw new Error('generateText not implemented'); }
    async generateImage(params) { throw new Error('generateImage not implemented'); }
    async generateVideo(params) { throw new Error('generateVideo not implemented'); }
    async generateAudio(params) { throw new Error('generateAudio not implemented'); }

    /**
     * 统一的 Fetch 包装器
     */
    async _fetch(endpoint, options = {}, debugLog = null) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
        
        if (debugLog) debugLog(`[${this.name}] 请求 URL: ${url}`, 'info');

        const defaultHeaders = {
            'Content-Type': 'application/json'
        };

        // 如果是 Bearer 协议，自动带上 Authorization
        if (this.apiKey && this.protocol !== 'gemini') {
            defaultHeaders['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const fetchOptions = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, fetchOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
                throw new Error(msg);
            }

            return await response.json();
        } catch (error) {
            if (debugLog) debugLog(`[${this.name}] 请求失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 统一的连接测试
     */
    async testConnection(debugLog = null) {
        if (!this.apiKey) return { success: false, message: '未配置 API Key' };
        
        try {
            // 默认测试：尝试请求文本端点（如果是 OpenAI 协议）
            if (this.protocol === 'openai' && this.ENDPOINTS.TEXT) {
                const data = await this._fetch(this.ENDPOINTS.TEXT, {
                    method: 'POST',
                    body: JSON.stringify({
                        model: 'test',
                        messages: [{ role: 'user', content: 'hi' }],
                        max_tokens: 1
                    })
                }, debugLog);
                return { success: true, message: '连接成功' };
            }
            return { success: true, message: '验证通过' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * 统一返回格式包装
     */
    _wrapResponse(data) {
        return {
            text: data.text || '',
            imageData: data.imageData || null,
            videoUrl: data.videoUrl || null,
            audioUrl: data.audioUrl || null,
            lyrics: data.lyrics || null,
            caption: data.caption || null,
            provider: this.id.toLowerCase(),
            raw: data.raw || null
        };
    }
}
