import { CONFIG, getProviderByModelId } from '../config.js';
import { AppState } from './app-state.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import { TwelveAIProvider } from './providers/12ai.js';

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
            gemini: new GeminiProvider(CONFIG.API_KEY),
            twelveAI: new TwelveAIProvider()
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
        if (provider === '12ai') {
            if (!CONFIG.TWELVE_AI_API_KEY || CONFIG.TWELVE_AI_API_KEY.trim() === '') {
                return { valid: false, error: '请输入 12AI API Key', provider: '12ai' };
            }
        } else {
            if (!CONFIG.API_KEY || CONFIG.API_KEY.trim() === '' || CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
                return { valid: false, error: '请输入 Google API Key', provider: 'google' };
            }
        }
        
        return { valid: true };
    }

    async generateVideo(requestConfig) {
        const {
            prompt,
            videoModel,
            videoProvider,
            videoRatio,
            videoResolution,
            videoDuration,
            selectedImageUrl,
            onVideoProgress,
            onVideoGenerated,
            onError,
            onComplete
        } = requestConfig;

        const provider = videoProvider || this.getProvider(videoModel);
        const realModelId = videoModel;
        
        const validation = this.validateAPIKeys(provider, true);
        if (!validation.valid) {
            const errorMsg = validation.error;
            debugLog(`[${provider === '12ai' ? '12AI' : 'Google'}错误] ${errorMsg}`, 'error');
            if (onError) onError(new Error(errorMsg));
            return;
        }

        if (!prompt && !selectedImageUrl) {
            const errorMsg = "请输入提示词或选择图片";
            debugLog(`[错误] ${errorMsg}`, 'error');
            if (onError) onError(new Error(errorMsg));
            return;
        }

        this.activeRequests++;
        if (this.activeRequests === 1) {
            showLoader(true);
            updateStatus('视频生成中');
        }

        const requestStartTime = Date.now();
        
        debugLog(`[视频请求] 提供商: ${provider}, 模型ID: ${realModelId}, 提示词: "${prompt}"`, 'info');

        try {
            if (provider === '12ai') {
                await this.providers.twelveAI.generateVideo({
                    model: realModelId,
                    prompt: prompt,
                    images: selectedImageUrl ? [selectedImageUrl] : [],
                    aspectRatio: videoRatio || "16:9",
                    resolution: videoResolution || "720p",
                    durationSeconds: videoDuration || "6",
                    onProgressUpdate: (progress) => {
                        debugLog(`[12AI进度] ${progress}%`, 'info');
                        if (onVideoProgress) {
                            onVideoProgress(progress);
                        }
                    },
                    onVideoGenerated: (videoUrl) => {
                        debugLog(`[12AI完成] 视频URL: ${videoUrl}`, 'info');
                        if (onVideoGenerated) {
                            onVideoGenerated(videoUrl);
                        }
                    },
                    onError: (error) => {
                        debugLog(`[12AI错误] ${error.message}`, 'error');
                        updateStatus('失败', true);
                        if (onError) onError(error);
                    },
                    debugLog
                });
            } else if (provider === 'google') {
                // Google Veo 视频生成
                await this.generateGoogleVideo({
                    model: realModelId,
                    prompt: prompt,
                    aspectRatio: videoRatio || "16:9",
                    resolution: videoResolution || "720p",
                    durationSeconds: videoDuration || "6",
                    onVideoProgress,
                    onVideoGenerated,
                    onError,
                    debugLog
                });
            } else {
                throw new Error('不支持的视频提供商: ' + provider);
            }

            const elapsedTime = (Date.now() - requestStartTime) / 1000;
            debugLog(`[视频完成] 耗时: ${elapsedTime.toFixed(2)}秒`, 'success');
            
            updateStatus('成功');

            if (onComplete) {
                onComplete(null, { videoUrl: requestConfig.videoUrl, generationTime: elapsedTime });
            }

        } catch (error) {
            const elapsedTime = (Date.now() - requestStartTime) / 1000;
            debugLog(`[视频错误] 耗时: ${elapsedTime.toFixed(2)}秒, 错误: ${error.message}`, 'error');
            updateStatus('失败', true);

            if (onError) {
                onError(error);
            }

            if (onComplete) {
                onComplete(error, null);
            }

            throw error;
        } finally {
            this.activeRequests--;
            if (this.activeRequests === 0) {
                showLoader(false);
            }
        }
    }

    async generateGoogleVideo({ model, prompt, aspectRatio, resolution, durationSeconds, onVideoProgress, onVideoGenerated, onError, debugLog }) {
        try {
            debugLog(`[Google Veo] 开始生成视频, 模型: ${model}, 提示词: "${prompt}"`, 'info');
            
            // 构建请求参数
            const requestBody = {
                model: model,
                prompt: prompt,
                config: {
                    aspectRatio: aspectRatio,
                    durationSeconds: parseInt(durationSeconds, 10)
                }
            };
            
            // 只有非 Veo 2 模型才添加分辨率参数
            if (!model.includes('veo-2')) {
                requestBody.config.resolution = resolution;
            }
            
            debugLog(`[Google Veo] 请求参数: ${JSON.stringify(requestBody)}`, 'info');
            
            // 调用后端 API 开始视频生成
            const response = await fetch('/api/google/generate-video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const operationName = data.operationName;
            
            debugLog(`[Google Veo] 任务已提交, Operation: ${operationName}`, 'info');
            
            // 轮询检查视频生成状态
            let isComplete = false;
            let attempts = 0;
            const maxAttempts = 300; // 最多轮询300次（约50分钟）
            
            while (!isComplete && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // 每10秒检查一次
                attempts++;
                
                // 更新进度
                const progress = Math.min(Math.round((attempts / 60) * 100), 99); // 预估进度，最多99%
                if (onVideoProgress) {
                    onVideoProgress(progress);
                }
                
                // 检查状态
                const statusResponse = await fetch(`/api/google/video-status?operation=${encodeURIComponent(operationName)}`);
                
                if (!statusResponse.ok) {
                    continue; // 继续轮询
                }
                
                const statusData = await statusResponse.json();
                
                if (statusData.done) {
                    isComplete = true;
                    
                    if (statusData.error) {
                        throw new Error(statusData.error.message || '视频生成失败');
                    }
                    
                    // 获取视频 URL
                    const videoUrl = statusData.videoUrl;
                    debugLog(`[Google Veo] 视频生成完成: ${videoUrl}`, 'success');
                    
                    if (onVideoGenerated) {
                        onVideoGenerated(videoUrl);
                    }
                    return;
                }
                
                debugLog(`[Google Veo] 等待中... 尝试 ${attempts}/${maxAttempts}`, 'info');
            }
            
            if (!isComplete) {
                throw new Error('视频生成超时，请稍后检查');
            }
            
        } catch (error) {
            debugLog(`[Google Veo错误] ${error.message}`, 'error');
            if (onError) {
                onError(error);
            }
            throw error;
        }
    }

    async request(requestConfig) {
        const {
            prompt,
            images = [],
            pinInfo = [],
            modelName,
            modelProvider,
            generationConfig,
            isImageGenMode,
            isVideoGenMode,
            videoModel,
            videoProvider,
            videoRatio,
            selectedImageUrl,
            aspectRatio,
            imageSize,
            onImageGenerated,
            onVideoProgress,
            onVideoGenerated,
            onTextGenerated,
            onError,
            onComplete
        } = requestConfig;

        if (isVideoGenMode) {
            return this.generateVideo(requestConfig);
        }

        const provider = modelProvider || this.getProvider(modelName);
        const realModelId = modelName;
        
        const validation = this.validateAPIKeys(provider, false);
        
        if (!validation.valid) {
            const errorMsg = validation.error;
            debugLog(`[错误] ${errorMsg}`, 'error');
            updateStatus('失败', true);
            if (onError) onError(new Error(errorMsg));
            return;
        }
        
        if (!prompt && images.length === 0 && pinInfo.length === 0) {
            const errorMsg = "请输入内容或粘贴图片";
            debugLog(`[错误] ${errorMsg}`, 'error');
            if (onError) onError(new Error(errorMsg));
            return;
        }

        this.activeRequests++;
        if (this.activeRequests === 1) {
            showLoader(true);
            updateStatus('请求中');
        }

        const requestStartTime = Date.now();
        
        debugLog(`[API请求] 提供商: ${provider}, 模型: ${realModelId}, 模式: ${isImageGenMode ? '生图' : '文本'}`, 'info');

        try {
            let result;
            
            if (provider === '12ai') {
                result = await this.providers.twelveAI.generateContent({
                    modelName: realModelId,
                    prompt,
                    images,
                    generationConfig,
                    isImageGenMode,
                    aspectRatio,
                    imageSize,
                    debugLog
                });
            } else {
                result = await this.providers.gemini.generateContent({
                    modelName: realModelId,
                    prompt,
                    images,
                    generationConfig,
                    isImageGenMode,
                    aspectRatio,
                    imageSize,
                    pinInfo,
                    debugLog
                });
            }

            if (isImageGenMode) {
                debugLog(`[生图模式] 图片数据: ${result.imageData ? '存在' : '不存在'}`, 'info');
                
                if (result.imageData) {
                    debugLog(`[图片数据] Base64长度: ${result.imageData.length}`, 'info');
                    
                    if (onImageGenerated) {
                        await onImageGenerated(result.imageData);
                    }
                    
                    debugLog(`[API响应] 模式: 生图, 状态: 成功`, 'success');
                } else {
                    debugLog(`[生图模式] 无图片数据`, 'warning');
                    updateStatus('无图片数据', true);
                }
            } else {
                debugLog(`[文本模式] 文本长度: ${result.text.length}`, 'info');
                
                if (onTextGenerated) {
                    onTextGenerated(result.text);
                }
                
                debugLog(`[API响应] 模式: 文本, 状态: 成功`, 'success');
            }

            updateStatus('成功');
            
            const elapsedTime = (Date.now() - requestStartTime) / 1000;
            debugLog(`[API响应] 耗时: ${elapsedTime.toFixed(2)}秒`, 'success');
            
            const resultWithTime = {
                ...result,
                generationTime: elapsedTime
            };
            
            if (onComplete) {
                onComplete(null, resultWithTime);
            }

            return resultWithTime;

        } catch (error) {
            const elapsedTime = (Date.now() - requestStartTime) / 1000;
            debugLog(`[API错误] 提供商: ${provider}, 耗时: ${elapsedTime.toFixed(2)}秒, 错误: ${error.message}`, 'error');
            updateStatus('失败', true);
            
            if (onError) {
                onError(error);
            }
            
            if (onComplete) {
                onComplete(error, null);
            }
            
            throw error;
        } finally {
            this.activeRequests--;
            if (this.activeRequests === 0) {
                showLoader(false);
            }
            
            if (promptInputElement) {
                promptInputElement.innerHTML = '';
            }
        }
    }

    async test12AIKey(apiKey, onResult) {
        if (!apiKey || apiKey.trim() === '') {
            if (onResult) onResult(false, '请输入 API Key');
            return;
        }

        debugLog(`[12AI测试] 正在验证 Key...`, 'info');

        try {
            const baseUrl = this.providers.twelveAI.baseUrl;
            const response = await fetch(`${baseUrl}/v1/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (response.ok) {
                debugLog(`[12AI测试] Key 有效`, 'success');
                if (onResult) onResult(true, 'Key 有效');
            } else {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error?.message || `验证失败: ${response.status}`;
                debugLog(`[12AI测试] ${errorMsg}`, 'error');
                if (onResult) onResult(false, errorMsg);
            }
        } catch (error) {
            debugLog(`[12AI测试] ${error.message}`, 'error');
            if (onResult) onResult(false, error.message);
        }
    }
}

export const apiClient = new APIClient();
