import { CONFIG, getProviderByModelId } from '../config.js';
import { AppState } from './app-state.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import './providers/provider-manager.js';

let promptInputElement = null;
let debugLogFunction = null;
let statusTagElement = null;
let loaderElement = null;

export function initializeAPIClient(config) {
    if (config.promptInput) {
        promptInputElement = config.promptInput;
    }
    if (config.debugLog) {
        debugLogFunction = config.debugLog;
    }
    if (config.statusTag) {
        statusTagElement = config.statusTag;
    }
    if (config.loader) {
        loaderElement = config.loader;
    }
}

function debugLog(message, type = 'info') {
    if (debugLogFunction) {
        debugLogFunction(message, type);
    } else if (typeof window !== 'undefined' && window.debugLog) {
        window.debugLog(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

function updateStatus(status, isError = false) {
    if (statusTagElement) {
        statusTagElement.innerText = status;
        if (isError) {
            statusTagElement.className = "text-xs px-2 py-1 rounded bg-red-50 text-red-600";
        } else if (status === '成功') {
            statusTagElement.className = "text-xs px-2 py-1 rounded bg-green-50 text-green-600";
        } else if (status === '请求中') {
            statusTagElement.className = "text-xs px-2 py-1 rounded bg-blue-50 text-blue-600";
        }
    }
}

function showLoader(show) {
    if (loaderElement) {
        if (show) {
            loaderElement.classList.remove('hidden');
        } else {
            loaderElement.classList.add('hidden');
        }
    }
}

export class APIClient {
    constructor() {
        this.providers = {
            gemini: new GeminiProvider(CONFIG.API_KEY)
        };
        this.activeRequests = 0;
        this.currentMode = 'image';
    }

    setCurrentMode(mode) {
        this.currentMode = mode;
    }

    updateAPIKey(apiKey) {
        CONFIG.API_KEY = apiKey;
        this.providers.gemini = new GeminiProvider(apiKey);
    }

    update12AIKey(apiKey) {
        CONFIG.TWELVE_AI_API_KEY = apiKey;
        this.providers.twelveAI.updateAPIKey(apiKey);
    }

    update12AIBaseUrl(baseUrl) {
        this.providers.twelveAI.updateBaseUrl(baseUrl);
    }

    getProvider(modelId) {
        return getProviderByModelId(modelId);
    }

    validateAPIKeys(provider, isVideoMode) {
        return { valid: true };
    }

    async generateVideo(requestConfig) {
        const {
            videoModel,
            videoProvider,
            onVideoProgress,
            onVideoGenerated,
            onError,
            onComplete
        } = requestConfig;

        const providerId = videoProvider || this.getProvider(videoModel);
        
        this.activeRequests++;
        if (this.activeRequests === 1) {
            showLoader(true);
            updateStatus('视频生成中');
        }

        const requestStartTime = Date.now();
        debugLog(`[视频请求] 提供商: ${providerId}, 模型: ${videoModel}`, 'info');

        try {
            if (!window.dynamicProviderManager) {
                throw new Error('动态Provider系统未初始化');
            }
            
            const dynamicProvider = window.dynamicProviderManager.getProvider(providerId);
            if (!dynamicProvider) {
                throw new Error(`Provider "${providerId}" 未找到，请检查设置面板配置`);
            }
            
            // 强制使用动态供应商派发的生成方法
            const result = await dynamicProvider.generateVideo({
                ...requestConfig,
                modelName: videoModel,
                protocol: dynamicProvider.protocol, // 明确传递协议
                onProgressUpdate: (progress) => {
                    if (onVideoProgress) onVideoProgress(progress);
                },
                onVideoGenerated: (url) => {
                    if (onVideoGenerated) onVideoGenerated(url, dynamicProvider.protocol);
                },
                debugLog
            });

            // --- 关键加固：捕获 Safety Block ---
            if (result && result.response && result.response.promptFeedback) {
                const fb = result.response.promptFeedback;
                if (fb.blockReason) {
                    throw new Error(`内容拦截: ${fb.blockReason} (你的提示词可能触及了安全红线)`);
                }
            }

            const elapsedTime = (Date.now() - requestStartTime) / 1000;
            debugLog(`[视频完成] 耗时: ${elapsedTime.toFixed(2)}秒`, 'success');
            updateStatus('成功');

            if (onComplete) onComplete(null, { ...result, generationTime: elapsedTime });

        } catch (error) {
            const elapsedTime = (Date.now() - requestStartTime) / 1000;
            debugLog(`[视频错误] 耗时: ${elapsedTime.toFixed(2)}秒, 错误: ${error.message}`, 'error');
            updateStatus('失败', true);
            
            // 重要：标准流程是由 APIClient 统筹所有的错误回调通知
            if (onError) onError(error);
            if (onComplete) onComplete(error, null);
        } finally {
            this.activeRequests--;
            if (this.activeRequests === 0) showLoader(false);
        }
    }

    async request(requestConfig) {
        const {
            prompt,
            modelName,
            modelProvider,
            onImageGenerated,
            onTextGenerated,
            onError,
            onComplete
        } = requestConfig;

        if (requestConfig.isVideoGenMode) {
            return this.generateVideo(requestConfig);
        }

        const providerId = modelProvider || this.getProvider(modelName);
        
        this.activeRequests++;
        if (this.activeRequests === 1) {
            showLoader(true);
            updateStatus('请求中');
        }

        const requestStartTime = Date.now();
        debugLog(`[API请求] 提供商: ${providerId}, 模型: ${modelName}`, 'info');

        try {
            if (!window.dynamicProviderManager) {
                throw new Error('动态Provider系统未初始化');
            }
            
            const dynamicProvider = window.dynamicProviderManager.getProvider(providerId);
            if (!dynamicProvider) {
                throw new Error(`Provider "${providerId}" 未配置或未启用。`);
            }
            
            const result = await dynamicProvider.generateContent({
                ...requestConfig,
                debugLog
            });

            if (requestConfig.isImageGenMode) {
                if (result.imageData && onImageGenerated) {
                    await onImageGenerated(result);
                }
            } else if (requestConfig.isAudioGenMode) {
                if (result.audioUrl && requestConfig.onAudioGenerated) {
                    await requestConfig.onAudioGenerated(result.audioUrl, result);
                }
            } else {
                if (result.text && onTextGenerated) {
                    onTextGenerated(result.text);
                }
            }

            updateStatus('成功');
            const elapsedTime = (Date.now() - requestStartTime) / 1000;
            debugLog(`[API响应] 耗时: ${elapsedTime.toFixed(2)}秒`, 'success');
            
            const resultWithTime = { ...result, generationTime: elapsedTime };
            if (onComplete) onComplete(null, resultWithTime);

            return resultWithTime;

        } catch (error) {
            const elapsedTime = (Date.now() - requestStartTime) / 1000;
            debugLog(`[API错误] 耗时: ${elapsedTime.toFixed(2)}秒, 错误: ${error.message}`, 'error');
            updateStatus('失败', true);
            if (onError) onError(error);
            if (onComplete) onComplete(error, null);
            throw error;
        } finally {
            this.activeRequests--;
            if (this.activeRequests === 0) showLoader(false);
            if (promptInputElement) promptInputElement.innerHTML = '';
        }
    }
}

export const apiClient = new APIClient();
