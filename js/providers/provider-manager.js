// Provider管理器
// 目标：根据用户配置的Provider动态加载对应的API模块

import { GeminiProvider } from './gemini-provider.js';
import { VideoProvider } from './video-provider.js';
import { PROTOCOL_MAP } from '../../config.js';

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
        const { id, name, baseUrl, apiKey, protocol: providerProtocol, textModels, imageModels, videoModels } = providerConfig;
        
        // 收集所有模型的协议信息
        const allModels = [...(textModels || []), ...(imageModels || []), ...(videoModels || [])];
        
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
            const protocolConfig = PROTOCOL_MAP[protocol] || PROTOCOL_MAP['openai'];
            
            let ProviderClass;
            if (protocol === 'gemini') {
                ProviderClass = GeminiProvider;
            } else {
                ProviderClass = VideoProvider;
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
            mix: provider.protocol === 'mix' ? 'checked' : ''
        };
        
        const protocolIndicator = provider.protocol === 'gemini' ? 'G' : (provider.protocol === 'openai' ? 'O' : 'M');
        
        panel.innerHTML = `
            <div>
                <label class="block text-xs text-gray-500 mb-1.5">名称:</label>
                <input type="text" id="settings${provider.id}NameInput" value="${provider.name || ''}" 
                    class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Provider名称">
            </div>
            
            <div>
                <label class="block text-xs text-gray-500 mb-1.5">Base URL:</label>
                <div class="flex items-center gap-2">
                    <input type="text" id="settings${provider.id}BaseUrlInput" value="${provider.baseUrl || ''}" 
                        autocomplete="off"
                        class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                        placeholder="API Base URL">
                    <div id="settings${provider.id}ProtocolIndicator" 
                        class="w-6 h-6 flex items-center justify-center text-xs font-bold rounded border border-gray-300 bg-gray-50"
                        title="当前协议: ${provider.protocol || 'openai'}">
                        ${protocolIndicator}
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
                        <input type="radio" name="settings${provider.id}Format" value="mix" ${protocolChecked.mix} 
                            class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500">
                        <span class="text-sm text-gray-600">混合</span>
                    </label>
                </div>
            </div>
            
            <div class="grid grid-cols-3 gap-4">
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
            });
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
                    protocolIndicator.textContent = value === 'gemini' ? 'G' : (value === 'openai' ? 'O' : 'M');
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
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                        this.markDirty();
                    }
                });
                container.addEventListener('click', (e) => {
                    if (e.target.classList.contains('model-delete-btn')) {
                        this.markDirty();
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
                
                if (!apiKey) {
                    this.showApiStatus(apiStatus, apiStatusText, false, '请输入API Key');
                    return;
                }
                
                testBtn.disabled = true;
                testBtn.textContent = '测试中...';
                
                try {
                    const result = await this.testApiConnection(apiKey, baseUrl, selectedProtocol);
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
    
    async testApiConnection(apiKey, baseUrl, protocol) {
        console.log(`[API] Requesting test connection with protocol: ${protocol}, baseUrl: ${baseUrl || 'default'}`);
        try {
            let url = baseUrl;
            let headers = {};
            let body = null;
            
            if (protocol === 'gemini') {
                url = baseUrl || 'https://generativelanguage.googleapis.com';
                url = url.replace(/\/$/, '') + '/v1beta/models?key=' + apiKey;
                headers = { 'Content-Type': 'application/json' };
            } else {
                url = baseUrl || 'https://api.openai.com';
                url = url.replace(/\/$/, '') + '/v1/models';
                headers = { 
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                };
            }
            
            console.log(`[API] Requesting ${url}`);
            const response = await fetch(url, { method: 'GET', headers });
            
            if (response.ok) {
                console.log('[API] Received: connection success');
                return { success: true, message: '连接成功' };
            } else {
                const errorText = await response.text();
                console.log(`[API] Received: connection failed - ${response.status}`);
                return { success: false, message: `连接失败: ${response.status}` };
            }
        } catch (error) {
            console.log(`[API] Received: connection error - ${error.message}`);
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
    }

    // 更新模型下拉框状态
    updateModelSelectsState(providerId, format) {
        console.log(`[State] Model selects state updated: ${providerId} -> ${format}`);
        const containers = [
            `settings${providerId}TextModels`,
            `settings${providerId}ImageModels`,
            `settings${providerId}VideoModels`
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
            const savedProviders = localStorage.getItem('nano_api_providers');
            if (!savedProviders) return { text: [], image: [], video: [] };
            
            const providers = JSON.parse(savedProviders);
            
            const textModels = [];
            const imageModels = [];
            const videoModels = [];
            
            providers.forEach(provider => {
                if (!provider.enabled) return;
                
                if (provider.textModels) {
                    provider.textModels.forEach(m => {
                        textModels.push({
                            name: `${m.name}(${provider.name})`,
                            value: m.name,
                            provider: provider.id,
                            group: provider.name,
                            protocol: m.protocol || provider.protocol
                        });
                    });
                }
                
                if (provider.imageModels) {
                    provider.imageModels.forEach(m => {
                        imageModels.push({
                            name: `${m.name}(${provider.name})`,
                            value: m.name,
                            provider: provider.id,
                            group: provider.name,
                            protocol: m.protocol || provider.protocol
                        });
                    });
                }
                
                if (provider.videoModels) {
                    provider.videoModels.forEach(m => {
                        videoModels.push({
                            name: `${m.name}(${provider.name})`,
                            value: m.name,
                            provider: provider.id,
                            group: provider.name,
                            protocol: m.protocol || provider.protocol
                        });
                    });
                }
            });
            
            return { text: textModels, image: imageModels, video: videoModels };
        } catch (e) {
            console.error('[ProviderManager] Error getting all models:', e);
            return { text: [], image: [], video: [] };
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

    // 标记需要更新保存按钮状态
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
                
                const protocolRadio = document.querySelector(`input[name="settings${providerId}Format"]:checked`);
                const protocol = protocolRadio ? protocolRadio.value : 'openai';
                
                const defaultTextModel = this.getDefaultModelFromSelect(`settingsDefaultTextModelWrapper`);
                const defaultImageModel = this.getDefaultModelFromSelect(`settingsDefaultImageModelWrapper`);
                const defaultVideoModel = this.getDefaultModelFromSelect(`settingsDefaultVideoModelWrapper`);
                
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
                    defaultModel: {
                        text: defaultTextModel,
                        image: defaultImageModel,
                        video: defaultVideoModel
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
            this.refreshModelSelects();
            
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
        const allModels = [...(models.text || []), ...(models.image || []), ...(models.video || [])];
        const model = allModels.find(m => m.name === text);
        
        if (model) {
            return { value: model.value, provider: model.provider };
        }
        return null;
    }

    // 显示保存成功弹窗
    showSaveSuccessModal(message = '设置已成功保存') {
        console.log('[State] Modal opened: saveSuccess | z-index: 10010');
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 flex items-center justify-center';
        modal.style.zIndex = '10010';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50"></div>
            <div class="relative bg-white rounded-xl p-6 shadow-2xl max-w-sm mx-4 transform transition-all">
                <div class="text-center">
                    <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">保存成功</h3>
                    <p class="text-gray-500">${message}</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        setTimeout(() => {
            modal.remove();
            console.log('[State] Modal closed: saveSuccess');
        }, 2000);
    }

    // 显示确认弹窗
    showConfirmModal(message, options = {}) {
        console.log('[State] Modal opened: confirm | z-index: 10010');
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 flex items-center justify-center';
            modal.style.zIndex = '10010';
            modal.innerHTML = `
                <div class="absolute inset-0 bg-black/50"></div>
                <div class="relative bg-white rounded-xl p-6 shadow-2xl max-w-sm mx-4 transform transition-all">
                    <div class="text-center">
                        <h3 class="text-lg font-medium text-gray-900 mb-2">${options.title || '确认'}</h3>
                        <p class="text-gray-500 mb-6">${message}</p>
                        <div class="flex gap-3 justify-center">
                            <button class="cancel-btn ${options.cancelClass || 'px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors'}">${options.cancelText || '取消'}</button>
                            <button class="ok-btn ${options.okClass || 'px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors'}">${options.okText || '确认'}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            modal.querySelector('.ok-btn').addEventListener('click', () => {
                console.log('[UI] User clicked: confirmModalOk');
                modal.remove();
                console.log('[State] Modal closed: confirm');
                resolve(true);
            });
            
            modal.querySelector('.cancel-btn').addEventListener('click', () => {
                console.log('[UI] User clicked: confirmModalCancel');
                modal.remove();
                console.log('[State] Modal closed: confirm');
                resolve(false);
            });
            
            modal.querySelector('.absolute').addEventListener('click', () => {
                console.log('[UI] User clicked: confirmModalOverlay (cancel)');
                modal.remove();
                console.log('[State] Modal closed: confirm');
                resolve(false);
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
        
        const providers = this.getStoredProviders();
        providers.push(newProvider);
        localStorage.setItem('nano_api_providers', JSON.stringify(providers));
        
        this.createProviderFromConfig(newProvider);
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
        const providers = this.getStoredProviders();
        const index = providers.findIndex(p => p.id === providerId);
        if (index > -1) {
            providers.splice(index, 1);
            localStorage.setItem('nano_api_providers', JSON.stringify(providers));
        }
        
        this.providers.delete(providerId);
        
        const tabBtn = document.querySelector(`button[data-provider-id="${providerId}"]`);
        if (tabBtn) tabBtn.remove();
        
        const panel = document.getElementById(`settings${providerId}Config`);
        if (panel) panel.remove();
        
        const firstTab = document.querySelector('#settingsTabs button:not(#settingsTabAdd)');
        if (firstTab) firstTab.click();
    }
}

// 全局实例
window.dynamicProviderManager = new DynamicProviderManager();

// 导出供其他模块使用
export { DynamicProviderManager };
