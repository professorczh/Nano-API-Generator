import { BaseProvider } from './base-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { VolcesProvider } from './volces-provider.js';
import { VideoProvider } from './video-provider.js';

class DynamicProviderManager {
    constructor() {
        this.providers = new Map();
        this.hasUnsavedChanges = false;
        this.defaultProviders = [
            {
                id: 'Gemini',
                name: 'Google',
                baseUrl: 'https://generativelanguage.googleapis.com',
                apiKey: '',
                protocol: 'gemini',
                enabled: true,
                textModels: [
                    { protocol: 'gemini', name: 'gemini-3.1-flash-lite-preview' }
                ],
                imageModels: [
                    { protocol: 'gemini', name: 'gemini-3.1-flash-image-preview' }
                ],
                videoModels: [
                    { protocol: 'gemini', name: 'veo-3.1-fast-generate-preview' }
                ],
                audioModels: [
                    { protocol: 'gemini', name: 'audio-3.1-generate' }
                ]
            }
        ];
        this.initialize();
    }

    initialize() {
        console.log('[ProviderManager] 初始化Provider管理系统');
    }

    // 从localStorage获取Provider配置
    getStoredProviders() {
        try {
            const savedProviders = localStorage.getItem('nano_api_providers');
            if (savedProviders) {
                return JSON.parse(savedProviders);
            }
        } catch (e) {
            console.error('[ProviderManager] 读取配置失败:', e);
        }
        return [];
    }

    // 注册Provider
    registerProvider(name, providerClass, config) {
        if (this.providers.has(name)) {
            return;
        }
        this.providers.set(name, {
            class: providerClass,
            config: config,
            instance: null
        });
        console.log(`[ProviderManager] 注册Provider: ${name}`);
    }

    // 获取最终协议（模型协议 > Provider协议）
    getFinalProtocol(providerProtocol, modelProtocol) {
        if (modelProtocol && modelProtocol !== 'openai') {
            return modelProtocol;
        }
        return providerProtocol || 'openai';
    }

    // 根据配置创建Provider实例
    createProviderFromConfig(providerConfig) {
        const { id, name, baseUrl, apiKey, protocol: providerProtocol, textModels, imageModels, videoModels, audioModels } = providerConfig;
        
        // 收集所有模型的协议信息
        const allModels = [...(textModels || []), ...(imageModels || []), ...(videoModels || []), ...(audioModels || [])];
        
        // 为每个模型协议注册Provider
        const protocols = new Set();
        protocols.add(providerProtocol || 'openai');
        allModels.forEach(model => {
            if (model.protocol) {
                protocols.add(model.protocol);
            }
        });
        
        // 根据协议类型选择Provider类
        protocols.forEach(protocol => {
            let ProviderClass;
            if (protocol === 'gemini') {
                ProviderClass = GeminiProvider;
            } else if (protocol === 'volces') {
                ProviderClass = VolcesProvider;
            } else {
                ProviderClass = OpenAIProvider;
            }
            
            const config = {
                apiKey: apiKey,
                baseUrl: baseUrl,
                providerProtocol: providerProtocol || 'openai',
                modelProtocols: allModels.reduce((acc, m) => {
                    if (m.name) acc[m.name] = m.protocol || providerProtocol || 'openai';
                    return acc;
                }, {}),
                getProtocol: function(modelName) {
                    return this.modelProtocols[modelName] || this.providerProtocol;
                }
            };
            
            // 只注册ID
            this.registerProvider(id, ProviderClass, config);
            
            console.log(`[ProviderManager] 从配置创建Provider: id=${id}, name=${name}, 协议=${protocol}, apiKey=${apiKey ? apiKey.substring(0, 10) + '...' : 'none'}`);
        });
    }

    // 初始化所有已保存的Provider
    initializeFromStorage() {
        let providers = this.getStoredProviders();
        console.log(`[ProviderManager] 从存储加载 ${providers.length} 个Provider配置`);
        
        // 如果没有存储的配置，使用默认配置
        if (providers.length === 0) {
            console.log('[ProviderManager] 无存储配置，使用默认Provider');
            providers = this.defaultProviders;
            localStorage.setItem('nano_api_providers', JSON.stringify(providers));
        }
        
        // 每次重新初始化时清空
        this.providers.clear();
        
        providers.forEach(providerConfig => {
            if (providerConfig.enabled !== false) {
                this.createProviderFromConfig(providerConfig);
            }
        });
        
        console.log(`[ProviderManager] 注册的Provider:`, Array.from(this.providers.keys()));
        
        // 渲染Provider到设置面板
        this.renderProvidersToSettings();
    }

    // 渲染Provider配置到设置面板
    renderProvidersToSettings() {
        const settingsTabs = document.getElementById('settingsTabs');
        const settingsAPIConfig = document.getElementById('settingsAPIConfig');
        
        if (!settingsTabs || !settingsAPIConfig) {
            console.warn('[ProviderManager] 设置面板元素未找到');
            return;
        }
        
        // 清除旧的动态标签和面板（保留+按钮）
        const oldTabs = settingsTabs.querySelectorAll('button[data-provider-id]');
        oldTabs.forEach(tab => tab.remove());
        
        const oldPanels = settingsAPIConfig.querySelectorAll('div[data-provider-panel]');
        oldPanels.forEach(panel => panel.remove());
        
        // 获取存储的Provider配置
        const providers = this.getStoredProviders();
        
        providers.forEach((provider, index) => {
            // 创建标签按钮
            const tabBtn = document.createElement('button');
            tabBtn.className = 'py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-600 rounded-full transition-all flex items-center gap-2';
            tabBtn.dataset.providerId = provider.id;
            tabBtn.innerHTML = `
                <span>${provider.name}</span>
                <span class="tab-delete hidden text-gray-400 hover:text-red-500 cursor-pointer">×</span>
            `;
            
            // 插入到+按钮之前
            const addBtn = document.getElementById('settingsTabAdd');
            if (addBtn) {
                settingsTabs.insertBefore(tabBtn, addBtn);
            } else {
                settingsTabs.appendChild(tabBtn);
            }
            
            tabBtn.addEventListener('click', () => {
                console.log(`[UI] User clicked: providerTab | Target: ${provider.id}`);
                this.switchToProviderPanel(provider.id);
            });
            
            tabBtn.addEventListener('mouseenter', () => {
                const deleteSpan = tabBtn.querySelector('.tab-delete');
                if (deleteSpan) deleteSpan.classList.remove('hidden');
            });
            
            tabBtn.addEventListener('mouseleave', () => {
                if (!tabBtn.classList.contains('text-blue-600')) {
                    const deleteSpan = tabBtn.querySelector('.tab-delete');
                    if (deleteSpan) deleteSpan.classList.add('hidden');
                }
            });
            
            const deleteSpan = tabBtn.querySelector('.tab-delete');
            if (deleteSpan) {
                deleteSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteProvider(provider.id);
                });
            }
            
            // 创建配置面板
            const panel = this.createProviderPanel(provider);
            settingsAPIConfig.appendChild(panel);
            
            // 第一个标签默认激活
            if (index === 0) {
                tabBtn.click();
            }
        });
        
        console.log(`[ProviderManager] 已渲染 ${providers.length} 个Provider到设置面板`);
    }

    // 创建Provider配置面板
    createProviderPanel(provider) {
        const panel = document.createElement('div');
        panel.id = `settings${provider.id}Config`;
        panel.dataset.providerPanel = 'true';
        panel.dataset.providerId = provider.id;
        panel.className = 'hidden bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4';
        
        const protocolChecked = {
            openai: provider.protocol === 'openai' ? 'checked' : '',
            gemini: provider.protocol === 'gemini' ? 'checked' : '',
            volces: provider.protocol === 'volces' ? 'checked' : '',
            mix: provider.protocol === 'mix' ? 'checked' : ''
        };
        
        const protocolIndicator = ({
            gemini: 'G',
            openai: 'O',
            volces: 'V',
            mix: 'M'
        })[provider.protocol || 'openai'];
        
        panel.innerHTML = `
            <div class="flex items-start gap-4">
                <div class="flex-shrink-0">
                    <label class="block text-xs text-gray-500 mb-1.5">名称:</label>
                    <input type="text" id="settings${provider.id}NameInput" value="${provider.name || ''}" 
                        class="w-36 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                        placeholder="Provider名称">
                </div>
                
                <div class="flex-1">
                    <label class="block text-xs text-gray-500 mb-1.5">Base URL:</label>
                    <div class="flex items-center gap-2">
                        <input type="text" id="settings${provider.id}BaseUrlInput" value="${provider.baseUrl || ''}" 
                            autocomplete="off"
                            class="auto-width-input px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]" 
                            placeholder="API Base URL"
                            data-min-width="200">
                        <div id="settings${provider.id}ProtocolIndicator" 
                            class="w-6 h-6 flex items-center justify-center text-xs font-bold rounded border border-gray-300 bg-gray-50"
                            title="当前协议: ${provider.protocol || 'openai'}">
                            ${protocolIndicator}
                        </div>
                    </div>
                </div>
            </div>
            
            <div>
                <label class="block text-xs text-gray-500 mb-1.5">API Key:</label>
                <div class="flex items-center gap-2">
                    <input type="password" id="settings${provider.id}ApiKeyInput" value="${provider.apiKey || ''}" 
                        autocomplete="off"
                        class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                        placeholder="输入API Key">
                    <button type="button" id="settings${provider.id}TestBtn" data-id="${provider.id}"
                        class="px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
                        测试
                    </button>
                    <div id="settings${provider.id}ApiStatus" class="hidden items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gray-100">
                        <span id="settings${provider.id}ApiStatusText" class="status-text"></span>
                        <button type="button" id="settings${provider.id}ApiStatusClose" class="text-gray-400 hover:text-gray-600">×</button>
                    </div>
                </div>
            </div>
            
            <div class="flex items-center gap-4">
                <label class="flex items-center gap-2">
                    <input type="checkbox" id="settings${provider.id}Enabled" ${provider.enabled !== false ? 'checked' : ''} 
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                    <span class="text-sm text-gray-700">启用</span>
                </label>
                
                <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-700">协议:</span>
                    <label class="flex items-center gap-1">
                        <input type="radio" name="settings${provider.id}Format" value="openai" ${protocolChecked.openai} 
                            class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500">
                        <span class="text-sm text-gray-600">OpenAI</span>
                    </label>
                    <label class="flex items-center gap-1">
                        <input type="radio" name="settings${provider.id}Format" value="gemini" ${protocolChecked.gemini} 
                            class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500">
                        <span class="text-sm text-gray-600">Gemini</span>
                    </label>
                    <label class="flex items-center gap-1">
                        <input type="radio" name="settings${provider.id}Format" value="volces" ${protocolChecked.volces} 
                            class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500">
                        <span class="text-sm text-gray-600">火山方舟</span>
                    </label>
                    <label class="flex items-center gap-1">
                        <input type="radio" name="settings${provider.id}Format" value="mix" ${protocolChecked.mix} 
                            class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500">
                        <span class="text-sm text-gray-600">混合</span>
                    </label>
                </div>
            </div>
            
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-xs text-gray-500 mb-1.5">文本模型</label>
                    <div id="settings${provider.id}TextModels" class="space-y-1">
                        ${this.renderModelList(provider.textModels || [], provider.protocol, provider.id)}
                    </div>
                    <button type="button" class="mt-1 text-xs text-blue-500 hover:text-blue-600" 
                        data-provider-id="${provider.id}" data-type="Text"
                        onclick="window.dynamicProviderManager.addModelInput('${provider.id}', 'Text')">
                        + 添加模型
                    </button>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1.5">图片模型</label>
                    <div id="settings${provider.id}ImageModels" class="space-y-1">
                        ${this.renderModelList(provider.imageModels || [], provider.protocol, provider.id)}
                    </div>
                    <button type="button" class="mt-1 text-xs text-blue-500 hover:text-blue-600" 
                        data-provider-id="${provider.id}" data-type="Image"
                        onclick="window.dynamicProviderManager.addModelInput('${provider.id}', 'Image')">
                        + 添加模型
                    </button>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1.5">视频模型</label>
                    <div id="settings${provider.id}VideoModels" class="space-y-1">
                        ${this.renderModelList(provider.videoModels || [], provider.protocol, provider.id)}
                    </div>
                    <button type="button" class="mt-1 text-xs text-blue-500 hover:text-blue-600" 
                        data-provider-id="${provider.id}" data-type="Video"
                        onclick="window.dynamicProviderManager.addModelInput('${provider.id}', 'Video')">
                        + 添加模型
                    </button>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1.5">音频模型</label>
                    <div id="settings${provider.id}AudioModels" class="space-y-1">
                        ${this.renderModelList(provider.audioModels || [], provider.protocol, provider.id)}
                    </div>
                    <button type="button" class="mt-1 text-xs text-blue-500 hover:text-blue-600" 
                        data-provider-id="${provider.id}" data-type="Audio"
                        onclick="window.dynamicProviderManager.addModelInput('${provider.id}', 'Audio')">
                        + 添加模型
                    </button>
                </div>
            </div>
        `;
        
        this.setupProviderPanelEvents(panel, provider.id);
        
        return panel;
    }
    
    setupProviderPanelEvents(panel, providerId) {
        const nameInput = panel.querySelector(`#settings${providerId}NameInput`);
        const baseUrlInput = panel.querySelector(`#settings${providerId}BaseUrlInput`);
        const apiKeyInput = panel.querySelector(`#settings${providerId}ApiKeyInput`);
        const enabledCheckbox = panel.querySelector(`#settings${providerId}Enabled`);
        const protocolRadios = panel.querySelectorAll(`input[name="settings${providerId}Format"]`);
        const protocolIndicator = panel.querySelector(`#settings${providerId}ProtocolIndicator`);
        const testBtn = panel.querySelector(`#settings${providerId}TestBtn`);
        const apiStatus = panel.querySelector(`#settings${providerId}ApiStatus`);
        const apiStatusText = panel.querySelector(`#settings${providerId}ApiStatusText`);
        const apiStatusClose = panel.querySelector(`#settings${providerId}ApiStatusClose`);
        
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                this.markDirty();
            });
            nameInput.addEventListener('blur', () => {
                const tabBtn = document.querySelector(`button[data-provider-id="${providerId}"] span:first-child`);
                if (tabBtn) {
                    tabBtn.textContent = nameInput.value || providerId;
                }
            });
        }
        
        if (baseUrlInput) {
            baseUrlInput.addEventListener('input', () => {
                this.markDirty();
                this.adjustInputWidth(baseUrlInput);
            });
            this.adjustInputWidth(baseUrlInput);
        }
        
        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', () => {
                this.markDirty();
            });
        }
        
        if (enabledCheckbox) {
            enabledCheckbox.addEventListener('change', () => {
                this.markDirty();
            });
        }
        
        protocolRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.markDirty();
                const value = radio.value;
                if (protocolIndicator) {
                    const indicatorMap = { gemini: 'G', openai: 'O', volces: 'V', mix: 'M' };
                    protocolIndicator.textContent = indicatorMap[value] || 'O';
                    protocolIndicator.title = `当前协议: ${value}`;
                }
                this.updateModelSelectsState(providerId, value);
            });
        });
        
        const textModelsContainer = panel.querySelector(`#settings${providerId}TextModels`);
        const imageModelsContainer = panel.querySelector(`#settings${providerId}ImageModels`);
        const videoModelsContainer = panel.querySelector(`#settings${providerId}VideoModels`);
        
        [textModelsContainer, imageModelsContainer, videoModelsContainer].forEach(container => {
            if (container) {
                container.addEventListener('input', (e) => {
                    this.markDirty();
                    // 实时刷新默认模型下拉列表
                    if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
                        this.refreshModelSelects();
                    }
                });
                container.addEventListener('click', (e) => {
                    if (e.target.classList.contains('model-delete-btn')) {
                        this.markDirty();
                        this.refreshModelSelects();
                    }
                });
            }
        });
        
        const initialProtocol = panel.querySelector(`input[name="settings${providerId}Format"]:checked`)?.value || 'openai';
        this.updateModelSelectsState(providerId, initialProtocol);
        
        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                console.log(`[UI] User clicked: testApiBtn | Provider: ${providerId}`);
                const selectedProtocol = panel.querySelector(`input[name="settings${providerId}Format"]:checked`)?.value || 'openai';
                
                const apiKey = apiKeyInput?.value;
                const baseUrl = baseUrlInput?.value;
                
                // 获取该面板下的第一个模型名称用于测试
                const firstModelInput = panel.querySelector('input[data-model-name], #settings' + providerId + 'TextModels input, #settings' + providerId + 'ImageModels input');
                const modelName = firstModelInput ? firstModelInput.value.trim() : '';
                
                if (!apiKey) {
                    this.showApiStatus(apiStatus, apiStatusText, false, '请输入API Key');
                    return;
                }
                
                testBtn.disabled = true;
                testBtn.textContent = '测试中...';
                
                try {
                    const result = await this.testApiConnection(apiKey, baseUrl, selectedProtocol, modelName);
                    this.showApiStatus(apiStatus, apiStatusText, result.success, result.message);
                } catch (error) {
                    this.showApiStatus(apiStatus, apiStatusText, false, error.message);
                } finally {
                    testBtn.disabled = false;
                    testBtn.textContent = '测试';
                }
            });
        }
        
        if (apiStatusClose) {
            apiStatusClose.addEventListener('click', () => {
                console.log('[UI] User clicked: apiStatusClose');
                apiStatus.classList.add('hidden');
                apiStatus.classList.remove('flex');
            });
        }
    }
    
    showApiStatus(statusEl, textEl, success, message) {
        console.log(`[State] API status updated: ${success ? 'success' : 'error'} - ${message}`);
        if (!statusEl || !textEl) return;
        
        statusEl.classList.remove('hidden');
        statusEl.classList.add('flex');
        
        if (success) {
            statusEl.className = 'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-green-100 text-green-700';
            textEl.textContent = '✓ ' + message;
        } else {
            statusEl.className = 'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-red-100 text-red-700';
            textEl.textContent = '✗ ' + message;
            console.error(`[API] Error: ${message}`);
        }
    }
    
    /**
     * 测试 API 连接 (委托给对应的 Provider 类)
     */
    async testApiConnection(apiKey, baseUrl, protocol, modelName = '') {
        console.log(`[API] 测试连接: 协议=${protocol}, baseUrl=${baseUrl || '默认'}`);
        try {
            let ProviderClass;
            if (protocol === 'gemini') {
                ProviderClass = GeminiProvider;
            } else if (protocol === 'volces') {
                ProviderClass = VolcesProvider;
            } else {
                ProviderClass = OpenAIProvider;
            }

            // 创建一个临时实例进行测试
            const tempProvider = new ProviderClass({
                id: 'test',
                apiKey: apiKey,
                baseUrl: baseUrl,
                protocol: protocol
            });

            return await tempProvider.testConnection(null);
        } catch (error) {
            console.log(`[API] 测试失败: ${error.message}`);
            return { success: false, message: `连接错误: ${error.message}` };
        }
    }

    // 渲染模型列表
    renderModelList(models, defaultProtocol, providerId) {
        if (!models || models.length === 0) {
            return '';
        }
        
        return models.map(model => `
            <div class="flex gap-1 items-center model-row">
                <select class="w-10 px-1 py-1 text-xs rounded border border-gray-200 bg-white model-format-select">
                    <option value="openai" ${model.protocol === 'openai' ? 'selected' : ''}>O</option>
                    <option value="gemini" ${model.protocol === 'gemini' ? 'selected' : ''}>G</option>
                    <option value="volces" ${model.protocol === 'volces' ? 'selected' : ''}>V</option>
                </select>
                <input type="text" value="${model.name || ''}" 
                    class="flex-1 px-2 py-1 text-xs rounded border border-gray-200" 
                    placeholder="模型名称" data-provider-id="${providerId}" data-model-name="${model.name || ''}">
                <button type="button" class="text-red-500 hover:text-red-700 text-xs model-delete-btn" 
                    data-provider-id="${providerId}" data-model-name="${model.name || ''}"
                    onclick="this.closest('.model-row').remove(); window.dynamicProviderManager.markDirty(); console.log('[UI] User clicked: deleteModelBtn | Provider: ${providerId} | Model: ${model.name || 'unnamed'}');">×</button>
            </div>
        `).join('');
    }

    // 添加模型输入框
    addModelInput(providerId, type) {
        console.log(`[UI] User clicked: addModelBtn | Provider: ${providerId} | Type: ${type}`);
        const container = document.getElementById(`settings${providerId}${type}Models`);
        if (!container) return;
        
        const row = document.createElement('div');
        row.className = 'flex gap-1 items-center model-row';
        row.innerHTML = `
            <select class="w-10 px-1 py-1 text-xs rounded border border-gray-200 bg-white model-format-select">
                <option value="openai">O</option>
                <option value="gemini">G</option>
                <option value="volces">V</option>
            </select>
            <input type="text" class="flex-1 px-2 py-1 text-xs rounded border border-gray-200" placeholder="模型名称" data-provider-id="${providerId}">
            <button type="button" class="text-red-500 hover:text-red-700 text-xs model-delete-btn" 
                data-provider-id="${providerId}"
                onclick="this.closest('.model-row').remove(); window.dynamicProviderManager.markDirty(); console.log('[UI] User clicked: deleteModelBtn | Provider: ${providerId} | Model: new');">×</button>
        `;
        container.appendChild(row);
        
        const currentProtocol = document.querySelector(`input[name="settings${providerId}Format"]:checked`)?.value || 'openai';
        const select = row.querySelector('.model-format-select');
        if (select && currentProtocol !== 'mix') {
            select.disabled = true;
            select.classList.add('opacity-50', 'cursor-not-allowed');
            select.value = currentProtocol;
        }
        
        this.markDirty();
        this.refreshModelSelects();
    }

    // 更新模型下拉框状态
    updateModelSelectsState(providerId, format) {
        console.log(`[State] Model selects state updated: ${providerId} -> ${format}`);
        const containers = [
            `settings${providerId}TextModels`,
            `settings${providerId}ImageModels`,
            `settings${providerId}VideoModels`,
            `settings${providerId}AudioModels`
        ];
        
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
    }

    // 获取Provider实例
    getProvider(name) {
        if (!this.providers.has(name)) {
            console.warn(`[ProviderManager] 未找到Provider: ${name}`);
            return null;
        }

        const providerInfo = this.providers.get(name);
        
        if (!providerInfo.instance) {
            providerInfo.instance = new providerInfo.class(providerInfo.config);
        }
        
        return providerInfo.instance;
    }

    // 获取Provider的协议类型
    getProviderProtocol(name) {
        if (!this.providers.has(name)) {
            return null;
        }
        const providerInfo = this.providers.get(name);
        return providerInfo.config?.providerProtocol || 'openai';
    }

    // 获取Provider的配置
    getProviderConfig(name) {
        if (!this.providers.has(name)) {
            return null;
        }
        const providerInfo = this.providers.get(name);
        return providerInfo.config;
    }

    // 获取所有Provider的模型列表（用于下拉选项）
    getAllModels() {
        try {
            const result = { text: [], image: [], video: [], audio: [] };
            
            // 首先尝试从当前 DOM 中实时抓取模型（Live Mode）
            const providerTabs = document.querySelectorAll('#settingsTabs button[data-provider-id]');
            
            if (providerTabs && providerTabs.length > 0) {
                providerTabs.forEach(tab => {
                    const providerId = tab.getAttribute('data-provider-id');
                    const nameSpan = tab.querySelector('span:first-child');
                    const providerName = nameSpan ? nameSpan.textContent.trim() : providerId;
                    
                    const collect = (containerId, type) => {
                        const models = this.collectModels(containerId);
                        models.forEach(m => {
                            result[type].push({
                                name: `${m.name}(${providerName})`,
                                value: m.name,
                                provider: providerId,
                                group: providerName,
                                protocol: m.protocol
                            });
                        });
                    };
                    
                    collect(`settings${providerId}TextModels`, 'text');
                    collect(`settings${providerId}ImageModels`, 'image');
                    collect(`settings${providerId}VideoModels`, 'video');
                    collect(`settings${providerId}AudioModels`, 'audio');
                });
            }

            // 如果从 DOM 中没抓到任何内容（比如还没渲染），再回退到 localStorage
            if (result.text.length === 0 && result.image.length === 0 && result.video.length === 0 && result.audio.length === 0) {
                const savedProviders = localStorage.getItem('nano_api_providers');
                if (savedProviders) {
                    const providers = JSON.parse(savedProviders);
                    providers.forEach(provider => {
                        const process = (models, type) => {
                            if (!models) return;
                            models.forEach(m => {
                                result[type].push({
                                    name: `${m.name}(${provider.name})`,
                                    value: m.name,
                                    provider: provider.id,
                                    group: provider.name,
                                    protocol: m.protocol || provider.protocol
                                });
                            });
                        };
                        process(provider.textModels, 'text');
                        process(provider.imageModels, 'image');
                        process(provider.videoModels, 'video');
                        process(provider.audioModels, 'audio');
                    });
                }
            }
            
            return result;
        } catch (e) {
            console.error('[ProviderManager] Error getting all models:', e);
            return { text: [], image: [], video: [], audio: [] };
        }
    }

    // 获取所有已注册的Provider列表
    getProviderList() {
        return Array.from(this.providers.keys());
    }

    // 检查Provider是否可用
    isProviderAvailable(name) {
        return this.providers.has(name);
    }

    adjustInputWidth(input) {
        if (!input) return;
        const minWidth = parseInt(input.dataset.minWidth) || 200;
        const value = input.value || input.placeholder || '';
        
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'pre';
        
        const computedStyle = window.getComputedStyle(input);
        tempSpan.style.font = computedStyle.font;
        tempSpan.style.fontSize = computedStyle.fontSize;
        tempSpan.style.fontFamily = computedStyle.fontFamily;
        tempSpan.style.fontWeight = computedStyle.fontWeight;
        tempSpan.style.letterSpacing = computedStyle.letterSpacing;
        
        tempSpan.textContent = value;
        document.body.appendChild(tempSpan);
        
        const textWidth = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);
        
        const padding = 32;
        const newWidth = Math.max(minWidth, textWidth + padding);
        input.style.width = newWidth + 'px';
        
        console.log(`%c[UI] adjustInputWidth: value="${value.substring(0, 30)}..." textWidth=${textWidth} newWidth=${newWidth}`, 'color: #a855f7');
    }

    markDirty() {
        this.hasUnsavedChanges = true;
        this.updateSaveButtonState();
    }

    // 更新保存按钮状态
    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            if (this.hasUnsavedChanges) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                saveBtn.disabled = true;
                saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    // 保存配置（手动点击保存按钮）
    saveNow() {
        console.log('[保存] saveNow 被调用');
        this.hasUnsavedChanges = true;
        this.saveProviders(true);
    }

    // 刷新模型下拉框
    refreshModelSelects() {
        if (window.modelSelectManager) {
            window.modelSelectManager.populateSettingsModelSelects();
            window.modelSelectManager.populateModelSelects();
        }
    }

    // 检查是否有未保存的修改
    checkUnsavedChanges() {
        return this.hasUnsavedChanges;
    }

    // 清除未保存修改状态
    clearUnsavedChanges() {
        this.hasUnsavedChanges = false;
        
        // 重新从localStorage加载配置并重置UI
        const settingsAPIConfig = document.getElementById('settingsAPIConfig');
        if (settingsAPIConfig) {
            this.renderProvidersToSettings();
        }
        
        // 重新渲染后更新保存按钮状态
        this.updateSaveButtonState();
    }

    // 保存Provider配置到localStorage
    saveProviders(showSuccessMessage = true) {
        console.log('[API] Saving providers to localStorage');
        try {
            const providers = [];
            
            document.querySelectorAll('#settingsTabs button[data-provider-id]').forEach(tab => {
                const providerId = tab.getAttribute('data-provider-id');
                const nameSpan = tab.querySelector('span:first-child');
                const providerName = nameSpan ? nameSpan.textContent.trim() : providerId;
                
                const apiKeyInput = document.getElementById(`settings${providerId}ApiKeyInput`);
                const enabledInput = document.getElementById(`settings${providerId}Enabled`);
                const baseUrlInput = document.getElementById(`settings${providerId}BaseUrlInput`);
                
                const textModels = this.collectModels(`settings${providerId}TextModels`);
                const imageModels = this.collectModels(`settings${providerId}ImageModels`);
                const videoModels = this.collectModels(`settings${providerId}VideoModels`);
                const audioModels = this.collectModels(`settings${providerId}AudioModels`);
                
                const protocolRadio = document.querySelector(`input[name="settings${providerId}Format"]:checked`);
                const protocol = protocolRadio ? protocolRadio.value : 'openai';
                
                const defaultTextModel = this.getDefaultModelFromSelect(`settingsDefaultTextModelWrapper`);
                const defaultImageModel = this.getDefaultModelFromSelect(`settingsDefaultImageModelWrapper`);
                const defaultVideoModel = this.getDefaultModelFromSelect(`settingsDefaultVideoModelWrapper`);
                const defaultAudioModel = this.getDefaultModelFromSelect(`settingsDefaultAudioModelWrapper`);
                
                providers.push({
                    id: providerId,
                    name: providerName,
                    apiKey: apiKeyInput ? apiKeyInput.value : '',
                    enabled: enabledInput ? enabledInput.checked : true,
                    baseUrl: baseUrlInput ? baseUrlInput.value : '',
                    protocol: protocol,
                    textModels: textModels,
                    imageModels: imageModels,
                    videoModels: videoModels,
                    audioModels: audioModels,
                    defaultModel: {
                        text: defaultTextModel,
                        image: defaultImageModel,
                        video: defaultVideoModel,
                        audio: defaultAudioModel
                    }
                });
            });
            
            localStorage.setItem('nano_api_providers', JSON.stringify(providers, null, 2));
            console.log('[API] Received: providers saved successfully');
            
            this.hasUnsavedChanges = false;
            this.updateSaveButtonState();
            
            if (showSuccessMessage) {
                this.showSaveSuccessModal('设置已成功保存到本地');
            }
            
            this.initializeFromStorage();
            if (window.modelSelectManager && typeof window.modelSelectManager.refreshModelSelects === 'function') {
                window.modelSelectManager.refreshModelSelects();
            }
            
        } catch (error) {
            console.error('[ProviderManager] 保存配置失败:', error);
        }
    }

    // 收集模型配置
    collectModels(containerId) {
        const models = [];
        const container = document.getElementById(containerId);
        if (container) {
            const rows = container.querySelectorAll('.model-row');
            rows.forEach(row => {
                const protocolSelect = row.querySelector('select');
                const modelInput = row.querySelector('input[type="text"]');
                if (protocolSelect && modelInput && modelInput.value.trim()) {
                    models.push({
                        protocol: protocolSelect.value,
                        name: modelInput.value.trim()
                    });
                }
            });
        }
        return models;
    }

    // 从选择框获取默认模型
    getDefaultModelFromSelect(wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return null;
        
        const trigger = wrapper.querySelector('.custom-select-trigger');
        if (!trigger) return null;
        
        const selectedText = trigger.querySelector('.selected-text');
        if (!selectedText) return null;
        
        const text = selectedText.textContent;
        if (!text || text === '请选择') return null;
        
        const models = this.getAllModels();
        const allModels = [...(models.text || []), ...(models.image || []), ...(models.video || []), ...(models.audio || [])];
        const model = allModels.find(m => m.name === text);
        
        if (model) {
            return { value: model.value, provider: model.provider };
        }
        return null;
    }

    // 显示保存成功Toast
    showSaveSuccessModal(message = '设置已成功保存') {
        console.log('[State] Toast opened: saveSuccess | z-index: 10010');
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.top = '2rem';
        toast.style.left = '50%';
        toast.style.transform = 'translate(-50%, -20px)';
        toast.style.opacity = '0';
        toast.style.zIndex = '10010';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '12px';
        toast.style.padding = '12px 16px';
        toast.style.backgroundColor = 'white';
        toast.style.borderRadius = '8px';
        toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        toast.style.border = '1px solid #dcfce7';
        toast.style.maxWidth = '280px';
        toast.style.margin = '0 16px';
        toast.style.pointerEvents = 'none';
        toast.style.transition = 'all 0.3s ease';
        
        toast.innerHTML = `
            <div style="width: 32px; height: 32px; background-color: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg style="width: 20px; height: 20px; color: #16a34a;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
            <div>
                <h3 style="font-size: 14px; font-weight: 500; color: #1f2937; margin: 0 0 4px 0;">保存成功</h3>
                <p style="font-size: 12px; color: #6b7280; margin: 0;">${message}</p>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // 淡入动画
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translate(-50%, 0)';
        }, 100);
        
        // 淡出动画
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -20px)';
            
            setTimeout(() => {
                toast.remove();
                console.log('[State] Toast closed: saveSuccess');
            }, 300);
        }, 3000);
    }

    // 显示确认弹窗
    showConfirmModal(message, options = {}) {
        console.log('[State] Modal opened: confirm | z-index: 10010');
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10010;';
            modal.innerHTML = `
                <div style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.4);"></div>
                <div style="position: relative; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); width: 360px; max-width: calc(100vw - 32px);">
                    <button class="close-btn" style="position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; border-radius: 6px; background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #9ca3af; transition: all 0.15s;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <h3 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 0 0 12px 0; padding-right: 24px;">${options.title || '确认'}</h3>
                    <p style="font-size: 14px; color: #6b7280; margin: 0 0 20px 0; line-height: 1.5;">${message}</p>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="cancel-btn" style="padding: 8px 16px; border-radius: 6px; background: #f3f4f6; color: #374151; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s;">${options.cancelText || '取消'}</button>
                        <button class="ok-btn" style="padding: 8px 16px; border-radius: 6px; background: #3b82f6; color: white; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s;">${options.okText || '确认'}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            const okBtn = modal.querySelector('.ok-btn');
            const cancelBtn = modal.querySelector('.cancel-btn');
            const closeBtn = modal.querySelector('.close-btn');
            
            okBtn.addEventListener('mouseenter', () => okBtn.style.background = '#2563eb');
            okBtn.addEventListener('mouseleave', () => okBtn.style.background = '#3b82f6');
            cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#e5e7eb');
            cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = '#f3f4f6');
            closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#f3f4f6'; closeBtn.style.color = '#374151'; });
            closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'transparent'; closeBtn.style.color = '#9ca3af'; });
            
            const closeModal = (result) => {
                modal.remove();
                console.log('[State] Modal closed: confirm');
                resolve(result);
            };
            
            okBtn.addEventListener('click', () => {
                console.log('[UI] User clicked: confirmModalOk');
                closeModal(true);
            });
            
            cancelBtn.addEventListener('click', () => {
                console.log('[UI] User clicked: confirmModalCancel');
                closeModal(false);
            });
            
            closeBtn.addEventListener('click', () => {
                console.log('[UI] User clicked: confirmModalClose');
                closeModal(null);
            });
        });
    }
    
    addNewProvider() {
        const newId = `custom${Date.now().toString().slice(-4)}`;
        const newProvider = {
            id: newId,
            name: '新Provider',
            protocol: 'openai',
            baseUrl: '',
            apiKey: '',
            textModels: [],
            imageModels: [],
            videoModels: [],
            enabled: true
        };
        
        const settingsTabs = document.getElementById('settingsTabs');
        const settingsAPIConfig = document.getElementById('settingsAPIConfig');
        
        if (!settingsTabs || !settingsAPIConfig) return;
        
        const tabBtn = document.createElement('button');
        tabBtn.className = 'py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-600 rounded-full transition-all flex items-center gap-2';
        tabBtn.dataset.providerId = newId;
        tabBtn.innerHTML = `
            <span>${newProvider.name}</span>
            <span class="tab-delete hidden text-gray-400 hover:text-red-500 cursor-pointer">×</span>
        `;
        
        const addBtn = document.getElementById('settingsTabAdd');
        if (addBtn) {
            settingsTabs.insertBefore(tabBtn, addBtn);
        }
        
        const panel = this.createProviderPanel(newProvider);
        settingsAPIConfig.appendChild(panel);
        
        tabBtn.addEventListener('click', () => {
            console.log(`[UI] User clicked: providerTab | Target: ${newId}`);
            this.switchToProviderPanel(newId);
        });
        
        tabBtn.addEventListener('mouseenter', () => {
            const deleteSpan = tabBtn.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.remove('hidden');
        });
        
        tabBtn.addEventListener('mouseleave', () => {
            if (!tabBtn.classList.contains('text-blue-600')) {
                const deleteSpan = tabBtn.querySelector('.tab-delete');
                if (deleteSpan) deleteSpan.classList.add('hidden');
            }
        });
        
        const deleteSpan = tabBtn.querySelector('.tab-delete');
        if (deleteSpan) {
            deleteSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteProvider(newId);
            });
        }
        
        tabBtn.click();
        
        // 不再立即保存到localStorage，只在显式保存时才写入
        // const providers = this.getStoredProviders();
        // providers.push(newProvider);
        // localStorage.setItem('nano_api_providers', JSON.stringify(providers));
        
        // 只在内存中注册provider，不保存到localStorage
        // this.createProviderFromConfig(newProvider);
        
        this.markDirty();
    }
    
    switchToProviderPanel(providerId) {
        console.log(`[State] Switched to provider: ${providerId}`);
        document.querySelectorAll('#settingsAPIConfig > div').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        const currentPanel = document.getElementById(`settings${providerId}Config`);
        if (currentPanel) {
            currentPanel.classList.remove('hidden');
        }
        
        document.querySelectorAll('#settingsTabs button:not(#settingsTabAdd)').forEach(tab => {
            tab.className = 'py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-600 rounded-full transition-all flex items-center gap-2';
            const deleteSpan = tab.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.add('hidden');
        });
        
        const currentTab = document.querySelector(`button[data-provider-id="${providerId}"]`);
        if (currentTab) {
            currentTab.className = 'py-1.5 px-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-full transition-all flex items-center gap-2';
            const deleteSpan = currentTab.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.remove('hidden');
        }
    }
    
    deleteProvider(providerId) {
        console.log(`[UI] User clicked: deleteProviderBtn | Target: ${providerId}`);
        
        // 不再立即从localStorage删除，只从UI中移除
        // const providers = this.getStoredProviders();
        // const index = providers.findIndex(p => p.id === providerId);
        // if (index > -1) {
        //     providers.splice(index, 1);
        //     localStorage.setItem('nano_api_providers', JSON.stringify(providers));
        // }
        
        this.providers.delete(providerId);
        
        const tabBtn = document.querySelector(`button[data-provider-id="${providerId}"]`);
        if (tabBtn) tabBtn.remove();
        
        const panel = document.getElementById(`settings${providerId}Config`);
        if (panel) panel.remove();
        
        const firstTab = document.querySelector('#settingsTabs button:not(#settingsTabAdd)');
        if (firstTab) firstTab.click();
        
        this.markDirty();
    }
}

// 全局实例
window.dynamicProviderManager = new DynamicProviderManager();

// 导出供其他模块使用
export { DynamicProviderManager };
