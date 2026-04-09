import { CONFIG, migrateOldStorageFormat, getModelDisplayName } from '../config.js';
import { AppState, CanvasState } from './app-state.js';
import { PinManager } from './pin-manager.js';
import { apiClient, initializeAPIClient } from './api-client.js';
import { UIManager, initModeSwitchers } from './ui.js';
import './node-factory.js';
import { ModelSelectManager } from './model-selects.js';
import { EventHandler, initCanvasEvents } from './event-handlers.js';
import { handleAPICall } from './api-operations.js';
import { debugLog, updateAddButtonVisibility, createModelItem, adjustBaseUrlInputWidth } from './utils.js';
import { initCanvasElements, initCanvas, resetCanvas, refreshUI, updateMinimapViewport, updateMinimapWithImage, updateCanvasScale, getPanzoom, getImageResponseContainer, updateToolbarPosition } from './canvas-manager.js';
import { initNodeManager, selectNode, deselectAllNodes, createImageNode, createTextNode, incrementNodeCounter, getSelectedNode, copySelectedNode, cutSelectedNode, deleteSelectedNode } from './node-manager.js';
import { createLoadingPlaceholder, createTextLoadingPlaceholder, updateLoadingPlaceholder, updateTextLoadingPlaceholder } from './loading-placeholder.js';
import { TemplateLoader } from './template-loader.js';
import { DebugConsole } from './debug-console.js';
import { SettingsPanel } from './settings-panel.js';
import { referenceManager } from './reference-manager.js';
import { mentionManager } from './mention-manager.js';
import { previewManager } from './preview-manager.js';
import { LinkerManager } from './linker-manager.js';

class GlobalLogger {
    constructor() {
        this.colors = {
            UI: '#3b82f6',
            State: '#22c55e',
            DOM: '#a855f7',
            API: '#f97316'
        };
        this.sensitiveFields = ['apiKey', 'ApiKey', 'API_KEY', 'key', 'password', 'token'];
        this.init();
    }
    
    init() {
        this.bindGlobalEvents();
        console.log('%c[GlobalLogger] 地毯式日志系统已启动', `color: ${this.colors.State}; font-weight: bold`);
    }
    
    log(type, message, data = '') {
        const color = this.colors[type] || '#ffffff';
        const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        if (data) {
            console.log(`%c[${timestamp}][${type}] ${message}`, `color: ${color}; font-weight: bold`, data);
        } else {
            console.log(`%c[${timestamp}][${type}] ${message}`, `color: ${color}; font-weight: bold`);
        }
    }
    
    maskSensitiveValue(value, fieldName = '') {
        if (!value || typeof value !== 'string') return value;
        const isSensitive = this.sensitiveFields.some(field => 
            fieldName.toLowerCase().includes(field.toLowerCase())
        );
        if (isSensitive && value.length > 5) {
            return value.substring(0, 5) + '***';
        }
        return value;
    }
    
    extractDataId(element) {
        let current = element;
        while (current && current !== document) {
            const dataId = current.dataset?.id || current.dataset?.providerId || current.dataset?.modelId;
            if (dataId) return dataId;
            current = current.parentElement;
        }
        return null;
    }
    
    getProviderFromElement(element) {
        let current = element;
        while (current && current !== document) {
            const providerId = current.dataset?.providerId || current.id?.match(/settings(\w+?)(?:ApiKey|BaseUrl|Name|Enabled|TextModels|ImageModels|VideoModels)/)?.[1];
            if (providerId) return providerId;
            current = current.parentElement;
        }
        const panel = element.closest('[data-provider-panel]');
        if (panel) return panel.dataset.providerId;
        return null;
    }
    
    getElementPath(element) {
        const path = [];
        let current = element;
        let depth = 0;
        while (current && current !== document && depth < 5) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                selector = `#${current.id}`;
            } else if (current.className && typeof current.className === 'string') {
                const classes = current.className.split(' ').filter(c => c && !c.includes(':')).slice(0, 2);
                if (classes.length) selector += `.${classes.join('.')}`;
            }
            const dataId = current.dataset?.providerId || current.dataset?.id;
            if (dataId) selector += `[data-id="${dataId}"]`;
            path.unshift(selector);
            current = current.parentElement;
            depth++;
        }
        return path.join(' > ');
    }
    
    bindGlobalEvents() {
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                const elementId = target.id || target.className || 'unnamed';
                const providerId = this.getProviderFromElement(target);
                const dataId = this.extractDataId(target);
                const value = this.maskSensitiveValue(target.value, target.id || target.name || '');
                
                let logMsg = `Element changed: #${elementId}`;
                if (providerId) logMsg += ` | Provider: ${providerId}`;
                if (dataId) logMsg += ` | DataId: ${dataId}`;
                
                this.log('UI', logMsg, `Value: ${value}`);
            }
        }, true);
        
        document.addEventListener('blur', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                const elementId = target.id || target.className || 'unnamed';
                const providerId = this.getProviderFromElement(target);
                const dataId = this.extractDataId(target);
                const value = this.maskSensitiveValue(target.value, target.id || target.name || '');
                
                let logMsg = `Element blur: #${elementId}`;
                if (providerId) logMsg += ` | Provider: ${providerId}`;
                if (dataId) logMsg += ` | DataId: ${dataId}`;
                
                this.log('UI', logMsg, `Value: ${value}`);
            }
        }, true);
        
        document.addEventListener('mousedown', (e) => {
            const target = e.target;
            const tagName = target.tagName.toLowerCase();
            const containerTags = ['div', 'section', 'table', 'article', 'main', 'aside', 'header', 'footer', 'nav'];
            
            if (containerTags.includes(tagName) || target.id || target.className) {
                const path = this.getElementPath(target);
                const dataId = this.extractDataId(target);
                
                let logMsg = `Active Element: ${path}`;
                if (dataId) logMsg += ` | DataId: ${dataId}`;
                
                this.log('DOM', logMsg);
            }
        }, true);
        
        document.addEventListener('focus', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                const elementId = target.id || target.className || 'unnamed';
                const providerId = this.getProviderFromElement(target);
                
                let logMsg = `Element focused: #${elementId}`;
                if (providerId) logMsg += ` | Provider: ${providerId}`;
                
                this.log('UI', logMsg);
            }
        }, true);
        
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const self = this;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._logUrl = url;
            this._logMethod = method;
            return originalOpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            self.log('API', `Request: ${this._logMethod} ${this._logUrl}`);
            return originalSend.call(this, body);
        };
        
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            const method = options.method || 'GET';
            self.log('API', `Fetch: ${method} ${url}`);
            return originalFetch.call(this, url, options);
        };
    }
}

const App = {
    elements: {},
    state: {
        currentBlobUrl: null,
        useDynamicProvider: false
    },

    async init() {
        new GlobalLogger();
        this.cacheElements();
        this.loadConfig();
        this.initModules();
        this.initEventListeners();
        this.initGlobalFunctions();
        this.initLogo();
        await this.loadTemplates();
        
        // 页面加载后自动尝试恢复未完成的视频任务
        this.resumeVideoTasks();
    },

    async resumeVideoTasks() {
        try {
            const response = await fetch('/api/google/list-operations');
            if (!response.ok) return;
            const operations = await response.json();
            
            const opNames = Object.keys(operations);
            if (opNames.length === 0) return;

            debugLog(`[状态恢复] 发现 ${opNames.length} 个历史任务记录，正在检查状态...`, 'info');
            
            for (const opName of opNames) {
                const info = operations[opName];
                // 如果是最近生成的（比如1小时内），尝试在画布上找回或重建
                // 注意：这里我们简单处理，直接为那些看起来没完成的任务建立轮询
                if (info.timestamp && (Date.now() - info.timestamp < 3600000 * 2)) {
                    // 调用 apiClient 重新启动轮询
                    this.resumeSingleVideoTask(opName, info);
                }
            }
        } catch (e) {
            console.error('[恢复任务] 失败:', e);
        }
    },

    resumeSingleVideoTask(operationName, info) {
        const { prompt, modelName, modelProvider } = info;
        // 避免重复创建 (虽然简单刷新后 canvas 应该是空的，但为了健壮性检查一下)
        const existingNode = Array.from(document.querySelectorAll('.canvas-node'))
            .find(node => node.dataset.operationName === operationName);
        if (existingNode) return;

        // 这里我们借用 handleAPICall 相似的逻辑，但跳过提交请求阶段，直接进轮询
        import('./api-operations.js').then(async (module) => {
            // 在画布中心附近找个位置
            const x = 5000 + (Math.random() * 200 - 100);
            const y = 5000 + (Math.random() * 200 - 100);
            
            const modelDisplayName = info.modelName || 'Google Veo';
            const videoPlaceholder = NodeFactory.createVideoPlaceholder(x, y, prompt, modelDisplayName);
            videoPlaceholder.dataset.operationName = operationName;
            
            this.elements.imageResponseContainer.appendChild(videoPlaceholder);
            updateMinimapWithImage(videoPlaceholder);
            selectNode(videoPlaceholder);

            // 启动真实计时器
            const startTime = info.timestamp || Date.now();
            const timeElement = videoPlaceholder.querySelector('.node-sidebar .node-generation-time');
            if (timeElement) {
                const timer = setInterval(() => {
                    const elapsed = (Date.now() - startTime) / 1000;
                    timeElement.textContent = `⏱️ ${elapsed.toFixed(1)}s`;
                }, 100);
                videoPlaceholder._timer = timer;
            }

            // 调用 apiClient 的轮询入口
            apiClient.generateVideo({
                videoModel: modelName,
                videoProvider: modelProvider,
                prompt: prompt,
                _resumeOperation: operationName, // 特殊标志位：跳过提交，直接轮询
                onVideoProgress: (progress) => {
                    const progressEl = videoPlaceholder.querySelector('.video-progress-text');
                    if (progressEl) progressEl.textContent = `视频进度: ${progress}%`;
                },
                onVideoGenerated: (videoUrl) => {
                    if (videoPlaceholder._timer) clearInterval(videoPlaceholder._timer);
                    const genTime = (Date.now() - startTime) / 1000;
                    NodeFactory.replaceWithVideo(videoPlaceholder, videoUrl, prompt, modelDisplayName, genTime, '16:9');
                },
                onError: (error) => {
                    debugLog(`[恢复错误] ${error.message}`, 'error');
                    if (videoPlaceholder._timer) clearInterval(videoPlaceholder._timer);
                    // 替换成错误节点
                    const errorX = parseInt(videoPlaceholder.style.left);
                    const errorY = parseInt(videoPlaceholder.style.top);
                    videoPlaceholder.remove();
                    const errorNode = createImageNode('', prompt, CanvasState.nodeCounter++, 'Error', '', 0, modelDisplayName, error.message);
                    errorNode.style.left = `${errorX}px`;
                    errorNode.style.top = `${errorY}px`;
                    this.elements.imageResponseContainer.appendChild(errorNode);
                }
            });
        });
    },

    initLogo() {
        const logoPath = document.querySelector('.logo-path');
        if (logoPath) {
            const pathLength = Math.round(logoPath.getTotalLength());
            console.log('%c[DOM] Logo initialized with flowing animation. Path length: ' + pathLength, 'color: #a855f7; font-weight: bold');
        }
    },

    cacheElements() {
        this.elements = {
            sendBtn: document.getElementById('sendBtn'),
            promptInput: document.getElementById('promptInput'),
            loader: document.getElementById('loader'),
            statusTag: document.getElementById('statusTag'),
            videoRatioWrapper: document.getElementById('videoRatioWrapper'),
            videoResolutionWrapper: document.getElementById('videoResolutionWrapper'),
            videoDurationWrapper: document.getElementById('videoDurationWrapper'),
            aspectRatioWrapper: document.getElementById('aspectRatioWrapper'),
            imageSize: document.getElementById('imageSizeWrapper'),
            temperature: document.getElementById('temperature'),
            topP: document.getElementById('topP'),
            imageResponseContainer: document.getElementById('imageResponseContainer'),
            imageModal: document.getElementById('imageModal'),
            modalImage: document.getElementById('modalImage'),
            closeModalBtn: document.getElementById('closeModalBtn'),
            closeModalBtn2: document.getElementById('closeModalBtn2'),
            downloadModalBtn: document.getElementById('downloadModalBtn'),
            openFolderBtn: document.getElementById('openFolderBtn'),
            canvasViewport: document.getElementById('canvasViewport'),
            canvas: document.getElementById('canvas'),
            debugConsole: document.getElementById('debugConsole'),
            debugConsoleContent: document.getElementById('debugConsoleContent'),
            debugConsoleClear: document.getElementById('debugConsoleClear'),
            debugConsoleHeader: document.querySelector('.debug-console-header'),
            uiPanel: document.getElementById('uiPanel'),
            canvasMinimap: document.getElementById('canvasMinimap'),
            uploadImageBtn: document.getElementById('uploadImageBtn'),
            imageUploadInput: document.getElementById('imageUploadInput'),
            toolbarZoomOut: document.getElementById('toolbarZoomOut'),
            toolbarZoomIn: document.getElementById('toolbarZoomIn'),
            toolbarZoomReset: document.getElementById('toolbarZoomReset'),
            toolbarZoomValue: document.getElementById('toolbarZoomValue'),
            toolbarCenterCanvas: document.getElementById('toolbarCenterCanvas'),
            miniToolbar: document.getElementById('miniToolbar'),
            toolbarSettingsBtn: document.getElementById('toolbarSettingsBtn'),
            settingsPanel: document.getElementById('settingsPanel'),
            providerToggle: document.getElementById('providerToggle'),
            providerToggleLabel: document.getElementById('providerToggleLabel'),
            providerToggleLabelDynamic: document.getElementById('providerToggleLabelDynamic'),
            providerToggleContainer: document.getElementById('providerToggleContainer'),
            storageWarning: document.getElementById('storageWarning'),
            canvasCenterMarker: document.getElementById('canvasCenterMarker'),
            debugGrid: document.getElementById('debugGrid'),
            referenceShelf: document.getElementById('referenceShelf'),
            shelfFileInput: document.getElementById('shelfFileInput'),
            settingsDefaultTextModelWrapper: document.getElementById('settingsDefaultTextModelWrapper'),
            settingsDefaultImageModelWrapper: document.getElementById('settingsDefaultImageModelWrapper'),
            settingsDefaultVideoModelWrapper: document.getElementById('settingsDefaultVideoModelWrapper'),
            settingsDefaultAudioModelWrapper: document.getElementById('settingsDefaultAudioModelWrapper'),
            audioModelNameWrapper: document.getElementById('audioModelNameWrapper'),
            audioDurationWrapper: document.getElementById('audioDurationWrapper'),
            audioFormatWrapper: document.getElementById('audioFormatWrapper')
        };
    },

    loadConfig() {
        migrateOldStorageFormat();

        const savedModelName = localStorage.getItem('GEMINI_MODEL_NAME');
        const savedModelProvider = localStorage.getItem('GEMINI_MODEL_PROVIDER');
        if (savedModelName) CONFIG.MODEL_NAME = savedModelName;
        if (savedModelProvider) CONFIG.MODEL_PROVIDER = savedModelProvider;

        const savedImageModelName = localStorage.getItem('GEMINI_IMAGE_MODEL_NAME');
        const savedImageModelProvider = localStorage.getItem('GEMINI_IMAGE_MODEL_PROVIDER');
        if (savedImageModelName) CONFIG.IMAGE_MODEL_NAME = savedImageModelName;
        if (savedImageModelProvider) CONFIG.IMAGE_MODEL_PROVIDER = savedImageModelProvider;

        const savedVideoModelName = localStorage.getItem('GEMINI_VIDEO_MODEL_NAME');
        const savedVideoModelProvider = localStorage.getItem('GEMINI_VIDEO_MODEL_PROVIDER');
        if (savedVideoModelName) CONFIG.VIDEO_MODEL_NAME = savedVideoModelName;
        if (savedVideoModelProvider) CONFIG.VIDEO_MODEL_PROVIDER = savedVideoModelProvider;

        const savedAudioModelName = localStorage.getItem('GEMINI_AUDIO_MODEL_NAME');
        const savedAudioModelProvider = localStorage.getItem('GEMINI_AUDIO_MODEL_PROVIDER');
        if (savedAudioModelName) CONFIG.AUDIO_MODEL_NAME = savedAudioModelName;
        if (savedAudioModelProvider) CONFIG.AUDIO_MODEL_PROVIDER = savedAudioModelProvider;
    },

    initModules() {
        const { promptInput, statusTag, loader, debugConsole, debugConsoleContent, debugConsoleHeader, debugConsoleClear, canvasCenterMarker, debugGrid, imageResponseContainer, providerToggle } = this.elements;

        PinManager.setPromptInput(promptInput);
        
        initializeAPIClient({
            promptInput,
            debugLog,
            statusTag,
            loader
        });

        DebugConsole.init({
            debugConsole,
            debugConsoleContent,
            debugConsoleHeader,
            debugConsoleClear,
            canvasCenterMarker,
            debugGrid,
            imageResponseContainer,
            showGenerationTime: true,
            showModelTag: true
        });
        
        if (this.elements.referenceShelf) {
            referenceManager.setShelfElement(this.elements.referenceShelf);
        }

        if (this.elements.promptInput) {
            mentionManager.init(this.elements.promptInput);
        }

        previewManager.init();

        LinkerManager.init();

        this.initProviderToggle();
    },

    initEventListeners() {
        const el = this.elements;

        initModeSwitchers();
        this.initUploadEvents();
        this.initZoomEvents();
        this.initModelConfigEvents();
        this.initModalEvents();
        this.initSendEvents();
        this.initMouseEvents();
        this.initResizeEvent();
    },


    initUploadEvents() {
        const { uploadImageBtn, imageUploadInput } = this.elements;
        
        uploadImageBtn.addEventListener('click', () => imageUploadInput.click());
        
        imageUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imageUrl = event.target.result;
                    const img = new Image();
                    img.onload = function() {
                        const width = img.width;
                        const height = img.height;
                        const aspectRatio = width / height;
                        let displayWidth, displayHeight;
                        
                        if (width > height) {
                            displayWidth = Math.min(width, 300);
                            displayHeight = Math.round(displayWidth / aspectRatio);
                        } else {
                            displayHeight = Math.min(height, 300);
                            displayWidth = Math.round(displayHeight * aspectRatio);
                        }
                        
                        const resolution = `${Math.round(displayWidth)}x${Math.round(displayHeight)}`;
                        
                        const container = getImageResponseContainer();
                        const existingNodes = container ? container.querySelectorAll('.canvas-node') : [];
                        let x = 5000;
                        let y = 5000;
                        
                        if (existingNodes.length > 0) {
                            const lastNode = existingNodes[existingNodes.length - 1];
                            const lastNodeX = parseInt(lastNode.style.left) || 0;
                            const lastNodeY = parseInt(lastNode.style.top) || 0;
                            const lastNodeWidth = lastNode.offsetWidth;
                            const lastNodeHeight = lastNode.offsetHeight;
                            
                            x = lastNodeX + lastNodeWidth + 50;
                            y = lastNodeY;
                            
                            if (x > 6000) {
                                x = 5000;
                                y = lastNodeY + lastNodeHeight + 50;
                            }
                        }
                        
                        const node = createImageNode(imageUrl, file.name, CanvasState.nodeCounter++, file.name, resolution, null, '', null, x, y);
                        if (container) container.appendChild(node);
                        debugLog(`[图片上传] 文件名: ${file.name}, 尺寸: ${resolution}`, 'info');
                    };
                    img.src = imageUrl;
                };
                reader.readAsDataURL(file);
            }
            imageUploadInput.value = '';
        });
    },

    initZoomEvents() {
        const { toolbarZoomOut, toolbarZoomIn, toolbarZoomReset, toolbarZoomValue, toolbarCenterCanvas } = this.elements;

        if (toolbarZoomOut) {
            toolbarZoomOut.addEventListener('click', () => {
                const currentScale = getPanzoom().getScale();
                const newScale = Math.max(0.5, currentScale - 0.25);
                updateCanvasScale(newScale);
            });
        }

        if (toolbarZoomIn) {
            toolbarZoomIn.addEventListener('click', () => {
                const currentScale = getPanzoom().getScale();
                const newScale = Math.min(2.5, currentScale + 0.25);
                updateCanvasScale(newScale);
            });
        }

        if (toolbarZoomReset) {
            toolbarZoomReset.addEventListener('click', () => updateCanvasScale(1));
        }

        if (toolbarZoomValue) {
            toolbarZoomValue.addEventListener('click', () => updateCanvasScale(1));
        }

        if (toolbarCenterCanvas) {
            toolbarCenterCanvas.addEventListener('click', resetCanvas);
        }
    },

    initSettingsEvents() {
        const { toolbarSettingsBtn, settingsPanel } = this.elements;

        if (toolbarSettingsBtn) {
            toolbarSettingsBtn.addEventListener('click', () => this.openSettingsPanel());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && settingsPanel && settingsPanel.classList.contains('flex')) {
                this.handleCloseSettingsPanel();
            }
        });
    },

    initProviderToggle() {
        const { providerToggle, providerToggleLabel, providerToggleLabelDynamic, providerToggleContainer, storageWarning } = this.elements;

        fetch('/api/config')
            .then(res => res.json())
            .then(config => {
                const canWrite = config.storageCapabilities?.canWrite ?? false;
                console.log(`🧪 [SYSTEM] 磁盘权限检查：${canWrite ? '可写' : '不可写'}`);
                
                if (!canWrite) {
                    if (storageWarning) {
                        storageWarning.classList.remove('hidden');
                        storageWarning.title = '检测到当前环境可能没有写入权限，开启本地存盘可能会失败。';
                    }
                    const savedUseDynamic = localStorage.getItem('useDynamicProvider');
                    this.state.useDynamicProvider = savedUseDynamic === 'true';
                    if (providerToggle) {
                        providerToggle.checked = this.state.useDynamicProvider;
                    }
                    this.updateProviderToggleUI(this.state.useDynamicProvider);
                } else {
                    const savedUseDynamic = localStorage.getItem('useDynamicProvider');
                    this.state.useDynamicProvider = savedUseDynamic === 'true';
                    if (providerToggle) {
                        providerToggle.checked = this.state.useDynamicProvider;
                    }
                    this.updateProviderToggleUI(this.state.useDynamicProvider);
                }
            })
            .catch(err => {
                console.error('获取配置失败:', err);
            });

        if (providerToggle) {
            providerToggle.addEventListener('change', (e) => {
                this.state.useDynamicProvider = e.target.checked;
                localStorage.setItem('useDynamicProvider', this.state.useDynamicProvider);
                this.updateProviderToggleUI(this.state.useDynamicProvider);
                const mode = this.state.useDynamicProvider ? '本地存盘' : '仅预览';
                debugLog(`🧪 [STORAGE] 模式已切换：${mode}`, 'info');
            });
        }
    },

    updateProviderToggleUI(isDynamic) {
        const { providerToggleLabel, providerToggleLabelDynamic } = this.elements;
        
        if (providerToggleLabel) {
            providerToggleLabel.className = isDynamic ? 'text-xs font-medium text-gray-400' : 'text-xs font-medium text-blue-600';
        }
        if (providerToggleLabelDynamic) {
            providerToggleLabelDynamic.className = isDynamic ? 'text-xs font-medium text-blue-600' : 'text-xs font-medium text-gray-400';
        }
    },

    initModelConfigEvents() {
        const modelConfigs = [
            { containerId: 'geminiTextModels', addBtnId: 'geminiTextModelsAddBtn', colorClass: 'text-blue-600 hover:text-blue-700', defaultFormat: 'gemini' },
            { containerId: 'geminiImageModels', addBtnId: 'geminiImageModelsAddBtn', colorClass: 'text-blue-600 hover:text-blue-700', defaultFormat: 'gemini' },
            { containerId: 'geminiVideoModels', addBtnId: 'geminiVideoModelsAddBtn', colorClass: 'text-blue-600 hover:text-blue-700', defaultFormat: 'gemini' },
            { containerId: 'geminiAudioModels', addBtnId: 'geminiAudioModelsAddBtn', colorClass: 'text-blue-600 hover:text-blue-700', defaultFormat: 'gemini' },
            { containerId: 'openaiTextModels', addBtnId: 'openaiTextModelsAddBtn', colorClass: 'text-green-600 hover:text-green-700', defaultFormat: 'openai' },
            { containerId: 'openaiImageModels', addBtnId: 'openaiImageModelsAddBtn', colorClass: 'text-green-600 hover:text-green-700', defaultFormat: 'openai' },
            { containerId: 'openaiVideoModels', addBtnId: 'openaiVideoModelsAddBtn', colorClass: 'text-green-600 hover:text-green-700', defaultFormat: 'openai' },
            { containerId: 'openaiAudioModels', addBtnId: 'openaiAudioModelsAddBtn', colorClass: 'text-green-600 hover:text-green-700', defaultFormat: 'openai' },
            { containerId: 'claudeTextModels', addBtnId: 'claudeTextModelsAddBtn', colorClass: 'text-orange-600 hover:text-orange-700', defaultFormat: 'openai' },
            { containerId: 'claudeImageModels', addBtnId: 'claudeImageModelsAddBtn', colorClass: 'text-orange-600 hover:text-orange-700', defaultFormat: 'openai' },
            { containerId: 'claudeVideoModels', addBtnId: 'claudeVideoModelsAddBtn', colorClass: 'text-orange-600 hover:text-orange-700', defaultFormat: 'openai' }
        ];

        const formatConfigs = [
            { radioName: 'settingsGeminiFormat', containers: ['geminiTextModels', 'geminiImageModels', 'geminiVideoModels', 'geminiAudioModels'], defaultFormat: 'gemini' },
            { radioName: 'settingsOpenAIFormat', containers: ['openaiTextModels', 'openaiImageModels', 'openaiVideoModels', 'openaiAudioModels'], defaultFormat: 'openai' },
            { radioName: 'settingsClaudeFormat', containers: ['claudeTextModels', 'claudeImageModels', 'claudeVideoModels'], defaultFormat: 'openai' }
        ];

        const updateModelSelectsState = (containers, format) => {
            containers.forEach(containerId => {
                const container = document.getElementById(containerId);
                if (!container) return;
                
                const selects = container.querySelectorAll('.model-format-select');
                selects.forEach(select => {
                    if (format === 'mix') {
                        select.disabled = false;
                        select.classList.remove('opacity-50', 'cursor-not-allowed');
                    } else {
                        select.disabled = true;
                        select.classList.add('opacity-50', 'cursor-not-allowed');
                        select.value = format;
                    }
                });
            });
        };

        const initFormatListeners = () => {
            formatConfigs.forEach(config => {
                const radios = document.querySelectorAll(`input[name="${config.radioName}"]`);
                radios.forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        updateModelSelectsState(config.containers, e.target.value);
                    });
                });
            });
        };

        const applyInitialFormatState = () => {
            formatConfigs.forEach(config => {
                const checkedRadio = document.querySelector(`input[name="${config.radioName}"]:checked`);
                if (checkedRadio) {
                    updateModelSelectsState(config.containers, checkedRadio.value);
                }
            });
        };

        modelConfigs.forEach(config => {
            const container = document.getElementById(config.containerId);
            const addBtn = document.getElementById(config.addBtnId);
            
            if (container && addBtn) {
                addBtn.addEventListener('click', () => {
                    const newItem = createModelItem(config.defaultFormat);
                    container.appendChild(newItem);
                    updateAddButtonVisibility(config.containerId, config.addBtnId);
                    
                    const formatConfig = formatConfigs.find(fc => fc.containers.includes(config.containerId));
                    if (formatConfig) {
                        const checkedRadio = document.querySelector(`input[name="${formatConfig.radioName}"]:checked`);
                        if (checkedRadio) {
                            const select = newItem.querySelector('.model-format-select');
                            if (select) {
                                if (checkedRadio.value === 'mix') {
                                    select.disabled = false;
                                    select.classList.remove('opacity-50', 'cursor-not-allowed');
                                } else {
                                    select.disabled = true;
                                    select.classList.add('opacity-50', 'cursor-not-allowed');
                                    select.value = checkedRadio.value;
                                }
                            }
                        }
                    }
                });
                
                container.addEventListener('click', (e) => {
                    if (e.target.classList.contains('model-delete-btn')) {
                        e.target.closest('.flex').remove();
                        updateAddButtonVisibility(config.containerId, config.addBtnId);
                    }
                });
            }
        });

        initFormatListeners();
        applyInitialFormatState();
    },

    initModalEvents() {
        const { imageModal, closeModalBtn, closeModalBtn2, downloadModalBtn, openFolderBtn } = this.elements;

        const openModal = (blobUrl) => {
            this.state.currentBlobUrl = blobUrl;
            this.elements.modalImage.src = blobUrl;
            imageModal.classList.remove('hidden');
            imageModal.classList.add('flex');
        };

        const closeModal = () => {
            imageModal.classList.add('hidden');
            imageModal.classList.remove('flex');
        };

        closeModalBtn.addEventListener('click', closeModal);
        closeModalBtn2.addEventListener('click', closeModal);
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) closeModal();
        });

        downloadModalBtn.addEventListener('click', () => {
            if (this.state.currentBlobUrl) {
                const link = document.createElement('a');
                link.href = this.state.currentBlobUrl;
                link.download = `gemini-generated-${Date.now()}.png`;
                link.click();
            }
        });

        openFolderBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/open-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const result = await response.json();
                if (result.success) {
                    alert(`${result.message}\n\n请复制路径并在文件资源管理器中打开`);
                    navigator.clipboard.writeText(result.path);
                } else {
                    alert('打开文件夹失败: ' + result.error);
                }
            } catch (error) {
                alert('打开文件夹失败: ' + error.message);
            }
        });

        window.openModal = openModal;
        window.closeModal = closeModal;
    },

    initSendEvents() {
        const { sendBtn, promptInput, temperature, topP, aspectRatioWrapper, imageSize, videoRatioWrapper, videoResolutionWrapper, videoDurationWrapper, audioModelNameWrapper, audioDurationWrapper, audioFormatWrapper, loader, statusTag, imageResponseContainer } = this.elements;

        const callAPI = () => handleAPICall({
            promptInput,
            temperature,
            topP,
            aspectRatioWrapper,
            imageSizeWrapper: imageSize,
            videoRatioWrapper,
            videoResolutionWrapper,
            videoDurationWrapper,
            audioModelNameWrapper,
            audioDurationWrapper,
            audioFormatWrapper,
            loader,
            statusTag,
            imageResponseContainer,
            createLoadingPlaceholder,
            createTextLoadingPlaceholder,
            updateMinimapWithImage,
            selectNode,
            incrementNodeCounter
        });

        sendBtn.addEventListener('click', callAPI);

        promptInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                callAPI();
            }
        });
    },

    initMouseEvents() {
        const { canvas, canvasViewport, debugConsole, promptInput, imageResponseContainer } = this.elements;

        document.addEventListener('mousemove', (e) => {
            if (AppState.isDraggingNode && AppState.dragNode) {
                const scale = getPanzoom().getScale();
                const deltaX = (e.clientX - AppState.dragStartX) / scale;
                const deltaY = (e.clientY - AppState.dragStartY) / scale;
                
                const newLeft = AppState.dragNodeStartLeft + deltaX;
                const newTop = AppState.dragNodeStartTop + deltaY;
                
                AppState.dragNode.style.left = `${newLeft}px`;
                AppState.dragNode.style.top = `${newTop}px`;
                
                updateMinimapWithImage(AppState.dragNode);
                
                if (DebugConsole.showMouseLogs) {
                    debugLog(`[拖动节点] x=${newLeft.toFixed(0)}, y=${newTop.toFixed(0)}`, 'event');
                }
            }
            
            if (AppState.isResizingNode && AppState.resizeNode) {
                const scale = getPanzoom().getScale();
                const deltaX = (e.clientX - AppState.resizeStartX) / scale;
                const newWidth = Math.max(100, AppState.resizeStartWidth + deltaX);
                
                AppState.resizeNode.style.width = `${newWidth}px`;
                
                updateMinimapWithImage(AppState.resizeNode);
                
                if (DebugConsole.showMouseLogs) {
                    debugLog(`[调整大小] width=${newWidth.toFixed(0)}`, 'event');
                }
            }

            if (AppState.isLinking) {
                LinkerManager.updateLinking(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (debugConsole.contains(e.target)) return;
            
            if (DebugConsole.showMouseLogs) {
                debugLog(`[鼠标抬起] button=${e.button}`, 'event');
            }
            
            if (AppState.isDraggingNode && AppState.dragNode) {
                AppState.dragNode.style.cursor = 'grab';
                AppState.isDraggingNode = false;
                AppState.dragNode = null;
            }
            
            if (AppState.isResizingNode && AppState.resizeNode) {
                AppState.isResizingNode = false;
                AppState.resizeNode = null;
                document.body.style.cursor = '';
            }
            
            if (AppState.isMiddleMouseDown) {
                AppState.isMiddleMouseDown = false;
                canvasViewport.style.cursor = 'default';
            }

            if (AppState.isLinking) {
                LinkerManager.endLinking(e);
            }
        });

        canvas.addEventListener('click', (e) => {
            if (debugConsole.contains(e.target)) return;
            
            if (document.activeElement === promptInput) {
                promptInput.blur();
            }
            
            if (e.target === canvas || e.target === imageResponseContainer) {
                deselectAllNodes();
            }
        });
    },

    initResizeEvent() {
        window.addEventListener('resize', () => refreshUI());
    },

    initGlobalFunctions() {
        const { miniToolbar, debugConsole, canvasMinimap } = this.elements;

        window.updateToolbarPosition = () => {
            if (!miniToolbar || !debugConsole) return;
            
            const isCollapsed = debugConsole.classList.contains('collapsed');
            const debugConsoleHeight = isCollapsed ? 24 : 364;
            const toolbarBottom = debugConsoleHeight + 16;
            
            miniToolbar.style.bottom = `${toolbarBottom}px`;
            
            if (canvasMinimap) {
                canvasMinimap.style.bottom = `${debugConsoleHeight + 16}px`;
            }
        };

        window.createImageNode = createImageNode;
        window.createTextNode = createTextNode;
        window.createLoadingPlaceholder = createLoadingPlaceholder;
        window.createTextLoadingPlaceholder = createTextLoadingPlaceholder;
        window.updateLoadingPlaceholder = updateLoadingPlaceholder;
        window.updateTextLoadingPlaceholder = updateTextLoadingPlaceholder;
        window.selectNode = selectNode;
        window.updateMinimapWithImage = updateMinimapWithImage;
        window.insertImageToPrompt = PinManager.insertImageToPrompt;
    },

    async loadTemplates() {
        initCanvasElements();
        initNodeManager();
        setTimeout(initCanvas, 100);
        
        await TemplateLoader.loadSettingsPanel();
        
        this.elements.settingsPanel = document.getElementById('settingsPanel');
        this.initSettingsEvents();
        
        const baseUrlInputs = [
            'settingsGeminiBaseUrl',
            'settingsOpenAIBaseUrl',
            'settingsClaudeBaseUrl'
        ];
        
        baseUrlInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                adjustBaseUrlInputWidth(input);
                input.addEventListener('input', () => adjustBaseUrlInputWidth(input));
            }
        });
        
        window.dynamicProviderManager.initializeFromStorage();
        new UIManager();
        new EventHandler();
        new SettingsPanel();
        
        initCanvasEvents({
            promptInput: this.elements.promptInput,
            debugConsole: this.elements.debugConsole,
            handleAPICall,
            getPanzoom,
            updateCanvasScale,
            updateToolbarPosition: () => window.updateToolbarPosition(),
            getSelectedNode,
            copySelectedNode,
            cutSelectedNode,
            deleteSelectedNode
        });
        
        window.modelSelectManager = new ModelSelectManager();
        
        if (window.modelSelectManager) {
            window.modelSelectManager.populateModelSelects();
        }
        
        const closeSettingsBtnAfterLoad = document.getElementById('closeSettingsBtn');
        if (closeSettingsBtnAfterLoad) {
            closeSettingsBtnAfterLoad.addEventListener('click', () => {
                console.log('[UI] User clicked: closeSettingsBtn');
                this.handleCloseSettingsPanel();
            });
        }
        
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                console.log('[UI] User clicked: saveSettingsBtn');
                if (window.dynamicProviderManager) {
                    window.dynamicProviderManager.saveNow();
                }
            });
        }
    },

    openSettingsPanel() {
        console.log('[State] Settings panel opened');
        const { settingsPanel } = this.elements;
        
        if (settingsPanel) {
            settingsPanel.classList.remove('hidden');
            settingsPanel.classList.add('flex');
            
            if (window.modelSelectManager) {
                if (typeof window.modelSelectManager.populateSettingsModelSelects === 'function') {
                    window.modelSelectManager.populateSettingsModelSelects();
                }
                if (typeof window.modelSelectManager.syncFromModeToSettingsSelects === 'function') {
                    window.modelSelectManager.syncFromModeToSettingsSelects();
                }
            }
            
            // 同步保存按钮状态
            if (window.dynamicProviderManager && typeof window.dynamicProviderManager.updateSaveButtonState === 'function') {
                window.dynamicProviderManager.updateSaveButtonState();
            }
            
            const firstTab = document.querySelector('#settingsTabs button:not(#settingsTabAdd)');
            if (firstTab) {
                firstTab.click();
            }
        }
    },

    async handleCloseSettingsPanel() {
        console.log('[UI] User clicked: closeSettingsPanel');
        if (window.dynamicProviderManager && window.dynamicProviderManager.checkUnsavedChanges()) {
            const confirmed = await window.dynamicProviderManager.showConfirmModal('有未保存的修改，是否保存？', {
                title: '确认退出',
                okText: '保存',
                cancelText: '不保存',
                okClass: 'px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors',
                cancelClass: 'px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors'
            });
            
            if (confirmed === true) {
                window.dynamicProviderManager.saveProviders(false);
                window.dynamicProviderManager.showSaveSuccessModal('设置已成功保存到本地');
                this.closeSettingsPanel();
                return;
            } else if (confirmed === false) {
                window.dynamicProviderManager.clearUnsavedChanges();
                this.closeSettingsPanel();
                return;
            }
            return;
        }
        this.closeSettingsPanel();
    },

    closeSettingsPanel() {
        console.log('[State] Settings panel closed');
        const { settingsPanel } = this.elements;
        
        if (settingsPanel) {
            settingsPanel.classList.add('hidden');
            settingsPanel.classList.remove('flex');
        }
    }
};

export { App };
