﻿// 管理Provider的动态创建和删除

class ProviderManager {
    constructor() {
        this.providerCounter = 0;
        this.hasUnsavedChanges = false;
        this.defaultProviders = [
            {
                id: 'Gemini',
                name: 'Google',
                baseUrl: 'https://generativelanguage.googleapis.com',
                apiKey: '',
                protocol: 'gemini'
            },
            {
                id: '12AI',
                name: '12AI',
                baseUrl: 'https://api.12ai.com',
                apiKey: '',
                protocol: 'openai'
            },
            {
                id: 'OpenAI',
                name: 'OpenAI',
                baseUrl: 'https://api.openai.com',
                apiKey: '',
                protocol: 'openai'
            },
            {
                id: 'Claude',
                name: 'Claude',
                baseUrl: 'https://api.anthropic.com',
                apiKey: '',
                protocol: 'openai'
            }
        ];
        this.init();
        this.loadProviders();
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
            console.error('Error getting all models:', e);
            return { text: [], image: [], video: [] };
        }
    }
    
    init() {
        const addBtn = document.getElementById('settingsTabAdd');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addProvider();
            });
        }

        document.querySelectorAll('.provider-delete-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const providerId = e.target.dataset.providerId;
                this.deleteProvider(providerId);
            });
        });
        
        // 监听默认模型选择区域的变化
         setTimeout(() => {
             const defaultModelWrappers = [
                 'settingsDefaultTextModelWrapper',
                 'settingsDefaultImageModelWrapper', 
                 'settingsDefaultVideoModelWrapper'
             ];
             
             defaultModelWrappers.forEach(wrapperId => {
                 const wrapper = document.getElementById(wrapperId);
                 if (wrapper) {
                     wrapper.addEventListener('click', (e) => {
                         if (e.target.classList.contains('custom-option')) {
                             this.autoSave();
                         }
                     });
                 }
             });
         }, 500);
    }

    createDefaultProviders() {
        const existingTabs = document.querySelectorAll('#settingsTabs button[data-provider-id]');
        if (existingTabs.length > 0) {
            return;
        }

        this.defaultProviders.forEach(provider => {
            this.createProvider(provider);
        });
    }

    createProvider(config) {
        const { id, name, baseUrl, apiKey, protocol } = config;
        const providerId = id;
        const providerProtocol = protocol || 'openai';
        
        const tabContainer = document.getElementById('settingsTabs');
        const addButton = document.getElementById('settingsTabAdd');
        
        const newTab = document.createElement('button');
        newTab.id = `settingsTab${providerId}`;
        newTab.className = `py-1.5 px-4 text-sm font-medium text-gray-500 hover:text-gray-600 rounded-full transition-all`;
        newTab.textContent = name;
        newTab.dataset.providerId = providerId;
        
        tabContainer.insertBefore(newTab, addButton);
        
        const configContainer = document.getElementById('settingsAPIConfig');
        
        const newConfig = document.createElement('div');
        newConfig.id = `settings${providerId}Config`;
        newConfig.className = 'hidden';
        
        const suffixMap = { 'gemini': '/v1beta', 'openai': '/v1', 'mix': '' };
        const suffixValue = suffixMap[providerProtocol] || '/v1';
        const suffixReadonly = providerProtocol === 'mix' ? '' : 'readonly';
        const suffixHidden = providerProtocol === 'mix' ? 'hidden' : '';
        
        const protocolOptions = ['openai', 'gemini', 'mix'].map(fmt => {
            const checked = fmt === providerProtocol ? 'checked' : '';
            const labels = { openai: 'OpenAI格式', gemini: 'Gemini格式', mix: 'Mix兼容格式' };
            return `<label class="flex items-center gap-1.5 text-xs cursor-pointer ${fmt === providerProtocol ? 'text-gray-700' : 'text-gray-500'}">
                <input type="radio" name="settings${providerId}Format" value="${fmt}" ${checked} class="accent-blue-500 w-3.5 h-3.5">
                <span>${labels[fmt] || fmt}</span>
            </label>`;
        }).join('');

        const deleteBtnHtml = `<button type="button" class="ml-auto px-4 py-1.5 text-sm rounded border border-red-300 text-white bg-red-500 hover:border-red-400 hover:bg-red-600 transition-all provider-delete-btn" data-provider-id="${providerId}" title="删除此Provider">删除</button>`;

        newConfig.innerHTML = `
            <div class="mb-4">
                <label class="block text-xs text-gray-500 mb-1.5">API Provider</label>
                <div class="flex gap-3 items-center">
                    <div class="flex gap-2 w-1/5">
                        <input type="text" id="settings${providerId}Provider" 
                            class="flex-1 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                            value="${name}">
                    </div>
                    <span class="text-xs text-gray-500">启用</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="settings${providerId}Enabled" class="sr-only peer" checked>
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                    ${deleteBtnHtml}
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-xs text-gray-500 mb-1.5">BASE URL</label>
                <div class="flex gap-2 items-center">
                    <input type="text" id="settings${providerId}BaseUrl" 
                        class="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                        value="${baseUrl}">
                    <input type="text" id="settings${providerId}BaseUrlSuffix" 
                        class="w-20 px-2 py-2 rounded-lg border border-gray-100 bg-gray-100 text-gray-400 text-sm text-center ${suffixHidden}"
                        value="${suffixValue}" ${suffixReadonly}>
                </div>
                <div class="flex gap-4 mt-2">
                    ${protocolOptions}
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-xs text-gray-500 mb-1.5">API KEY</label>
                <div class="flex gap-2 items-center">
                    <input type="text" id="settings${providerId}ApiKeyInput" 
                        class="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                        placeholder="输入 API Key" style="width: 200px;" value="${apiKey || ''}">
                    <button id="settingsTest${providerId}KeyBtn" 
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all">
                        测试
                    </button>
                    <div id="settings${providerId}StatusContainer" class="flex items-center w-[200px] bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <span id="settings${providerId}Status" class="text-xs text-gray-500 flex-1 truncate"></span>
                        <button id="settings${providerId}StatusClose" class="text-gray-400 hover:text-gray-600 ml-1 text-xs leading-none">×</button>
                    </div>
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-100">
                <label class="block text-xs text-gray-500 mb-3">模型配置</label>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs text-gray-400 mb-2">文本模型</label>
                        <div id="${providerId}TextModels" class="space-y-1.5 mb-2 model-list-container">
                            <div class="flex gap-1.5 items-center model-row">
                                <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none">
                                    <option value="openai" selected title="OpenAI格式">O</option>
                                    <option value="gemini" title="Gemini格式">G</option>
                                </select>
                                <input type="text" placeholder="模型名称" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none">
                                <button type="button" class="text-gray-300 hover:text-red-400 text-sm model-row-delete transition-colors">×</button>
                            </div>
                        </div>
                        <button type="button" class="text-xs text-gray-500 hover:text-gray-600 add-model-btn" data-container="${providerId}TextModels">+ 添加</button>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-2">图像模型</label>
                        <div id="${providerId}ImageModels" class="space-y-1.5 mb-2 model-list-container">
                            <div class="flex gap-1.5 items-center model-row">
                                <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none">
                                    <option value="openai" selected title="OpenAI格式">O</option>
                                    <option value="gemini" title="Gemini格式">G</option>
                                </select>
                                <input type="text" placeholder="模型名称" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none">
                                <button type="button" class="text-gray-300 hover:text-red-400 text-sm model-row-delete transition-colors">×</button>
                            </div>
                        </div>
                        <button type="button" class="text-xs text-gray-500 hover:text-gray-600 add-model-btn" data-container="${providerId}ImageModels">+ 添加</button>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-2">视频模型</label>
                        <div id="${providerId}VideoModels" class="space-y-1.5 mb-2 model-list-container">
                            <div class="flex gap-1.5 items-center model-row">
                                <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none">
                                    <option value="openai" selected title="OpenAI格式">O</option>
                                    <option value="gemini" title="Gemini格式">G</option>
                                </select>
                                <input type="text" placeholder="模型名称" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none">
                                <button type="button" class="text-gray-300 hover:text-red-400 text-sm model-row-delete transition-colors">×</button>
                            </div>
                        </div>
                        <button type="button" class="text-xs text-gray-500 hover:text-gray-600 add-model-btn" data-container="${providerId}VideoModels">+ 添加</button>
                    </div>
                </div>
            </div>
        `;
        
        configContainer.appendChild(newConfig);
        this.bindProviderEvents(newTab, newConfig, providerId, name);
        
        return { tab: newTab, config: newConfig };
    }

    bindProviderEvents(newTab, newConfig, providerId, providerName) {
        newTab.addEventListener('click', () => {
            document.querySelectorAll('#settingsAPIConfig > div').forEach(panel => {
                panel.classList.add('hidden');
            });
            document.getElementById(`settings${providerId}Config`).classList.remove('hidden');
            
            document.querySelectorAll('#settingsTabs button:not(#settingsTabAdd)').forEach(tab => {
                tab.className = 'py-1.5 px-4 text-sm font-medium text-gray-500 hover:text-gray-600 rounded-full transition-all';
            });
            
            newTab.className = 'py-1.5 px-4 text-sm font-medium text-blue-600 bg-blue-50 rounded-full transition-all';
            
            // 切换 Provider 时刷新下拉菜单
            if (typeof populateSettingsModelSelects === 'function') {
                populateSettingsModelSelects();
            }
        });
        
        const deleteBtn = newConfig.querySelector('.provider-delete-btn');
        if (deleteBtn && !deleteBtn.disabled) {
            deleteBtn.addEventListener('click', async () => {
                const confirmed = await this.showConfirmModal('确定要删除此Provider吗？');
                if (confirmed) {
                    newTab.remove();
                    newConfig.remove();
                    const firstTab = document.querySelector('#settingsTabs button:not(#settingsTabAdd)');
                    if (firstTab) {
                        firstTab.click();
                    }
                    // 直接保存，不触发保存成功提示
                    this.saveProviders(false);
                }
            });
        }
        
        const baseUrlInput = document.getElementById(`settings${providerId}BaseUrl`);
        if (baseUrlInput) {
            this.adjustBaseUrlInputWidth(baseUrlInput);
            baseUrlInput.addEventListener('input', () => this.adjustBaseUrlInputWidth(baseUrlInput));
        }
        
        const baseUrlSuffixInput = document.getElementById(`settings${providerId}BaseUrlSuffix`);
        if (baseUrlSuffixInput) {
            this.adjustBaseUrlInputWidth(baseUrlSuffixInput);
            baseUrlSuffixInput.addEventListener('input', () => this.adjustBaseUrlInputWidth(baseUrlSuffixInput));
        }
        
        // 协议联动逻辑
        const formatRadios = document.querySelectorAll(`input[name="settings${providerId}Format"]`);
        const modelSelects = newConfig.querySelectorAll('.model-format-select');
        
        const updateProtocolState = (selectedProtocol) => {
            const suffixMap = { 'gemini': '/v1beta', 'openai': '/v1', 'mix': '' };
            
            // 更新BASE URL后缀
            if (baseUrlSuffixInput) {
                if (selectedProtocol === 'mix') {
                    baseUrlSuffixInput.classList.add('hidden');
                } else {
                    baseUrlSuffixInput.classList.remove('hidden');
                    baseUrlSuffixInput.value = suffixMap[selectedProtocol] || '/v1';
                    baseUrlSuffixInput.readOnly = true;
                }
                this.adjustBaseUrlInputWidth(baseUrlSuffixInput);
            }
            
            // 更新模型格式下拉框状态
            modelSelects.forEach(select => {
                if (selectedProtocol === 'mix') {
                    select.disabled = false;
                    select.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    select.disabled = true;
                    select.classList.add('opacity-50', 'cursor-not-allowed');
                    select.value = selectedProtocol;
                }
            });
        };
        
        // 绑定协议单选按钮事件
        formatRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                updateProtocolState(e.target.value);
                this.autoSave();
            });
        });
        
        // 应用初始格式状态
        const checkedRadio = document.querySelector(`input[name="settings${providerId}Format"]:checked`);
        if (checkedRadio) {
            updateProtocolState(checkedRadio.value);
        }
        
        const providerNameInput = document.getElementById(`settings${providerId}Provider`);
        if (providerNameInput) {
            providerNameInput.addEventListener('blur', () => {
                const newName = providerNameInput.value.trim() || providerName;
                newTab.textContent = newName;
                this.autoSave();
            });
        }
        
        // 绑定测试按钮事件
        const testBtn = document.getElementById(`settingsTest${providerId}KeyBtn`);
        const statusEl = document.getElementById(`settings${providerId}Status`);
        const statusCloseBtn = document.getElementById(`settings${providerId}StatusClose`);
        const apiKeyInput = document.getElementById(`settings${providerId}ApiKeyInput`);
        
        // API KEY输入框宽度自适应
        if (apiKeyInput) {
            this.adjustApiKeyInputWidth(apiKeyInput);
            apiKeyInput.addEventListener('input', () => this.adjustApiKeyInputWidth(apiKeyInput));
        }
        
        // 绑定状态关闭按钮事件
        if (statusCloseBtn && statusEl) {
            statusCloseBtn.addEventListener('click', () => {
                statusEl.textContent = '';
            });
        }
        
        if (testBtn && statusEl && apiKeyInput) {
            testBtn.addEventListener('click', async () => {
                const apiKey = apiKeyInput.value.trim();
                if (!apiKey) {
                    statusEl.innerHTML = '<span class="text-red-600">请输入 API Key</span>';
                    return;
                }
                
                testBtn.disabled = true;
                testBtn.textContent = '测试中...';
                statusEl.innerHTML = '<span class="text-blue-600">正在验证 API Key...</span>';
                
                try {
                    // 获取 baseUrl
                    const baseUrlInput = document.getElementById(`settings${providerId}BaseUrl`);
                    const baseUrl = baseUrlInput?.value?.trim() || '';
                    
                    if (!baseUrl) {
                        statusEl.innerHTML = '<span class="text-red-600">请填写 BASE URL</span>';
                        return;
                    }
                    
                    // 获取协议
                    const formatInputs = document.querySelectorAll(`input[name="settings${providerId}Format"]`);
                    let selectedProtocol = 'openai';
                    formatInputs.forEach(input => {
                        if (input.checked) selectedProtocol = input.value;
                    });
                    
                    // 拼接完整 URL
                    const fullUrl = baseUrl.replace(/\/$/, '');
                    
                    // 发送测试请求
                    let success = false;
                    let message = '';
                    
                    if (selectedProtocol === 'gemini') {
                        // Gemini 格式测试 - key 作为 URL 参数
                        try {
                            const response = await fetch(`${fullUrl}/v1beta/models?key=${apiKey}`, {
                                method: 'GET'
                            });
                            
                            if (response.ok) {
                                const data = await response.json();
                                if (data.models && data.models.length > 0) {
                                    success = true;
                                    message = `验证成功 (${data.models.length} 个模型)`;
                                } else {
                                    message = '未找到可用模型';
                                }
                            } else if (response.status === 401) {
                                message = 'API Key 无效';
                            } else if (response.status === 404) {
                                message = 'URL 可能不正确';
                            } else {
                                message = `HTTP ${response.status}`;
                            }
                        } catch (e) {
                            message = '请求失败: ' + e.message;
                        }
                    } else {
                        // OpenAI/Mix 格式测试 - key 在 Header
                        try {
                            const response = await fetch(`${fullUrl}/v1/models`, {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${apiKey}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            if (response.ok) {
                                const data = await response.json();
                                if (data.data && data.data.length > 0) {
                                    success = true;
                                    message = `验证成功 (${data.data.length} 个模型)`;
                                } else {
                                    message = '未找到可用模型';
                                }
                            } else if (response.status === 401) {
                                message = 'API Key 无效';
                            } else if (response.status === 404) {
                                message = 'URL 可能不正确';
                            } else {
                                message = `HTTP ${response.status}`;
                            }
                        } catch (e) {
                            message = '请求失败: ' + e.message;
                        }
                    }
                    
                    if (success) {
                        statusEl.innerHTML = '<span class="text-green-600">✓ 验证成功</span>';
                    } else {
                        statusEl.innerHTML = '<span class="text-red-600">✗ 验证失败: ' + message + '</span>';
                    }
                } catch (error) {
                    console.error(error);
                    statusEl.innerHTML = '<span class="text-red-600">✗ 测试失败: ' + error.message + '</span>';
                } finally {
                    testBtn.disabled = false;
                    testBtn.textContent = '测试';
                }
            });
        }
        
        // 为所有输入框添加自动保存
        const inputs = newConfig.querySelectorAll('input[type="text"], input[type="checkbox"], select, input[type="radio"]');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.autoSave());
            if (input.type === 'text') {
                input.addEventListener('input', () => this.autoSave());
            }
        });
        
        // 为模型添加按钮添加自动保存
        newConfig.querySelectorAll('.add-model-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setTimeout(() => this.autoSave(), 100);
            });
        });
        
        // 为模型行删除按钮添加删除和自动保存功能
        const self = this;
        newConfig.querySelectorAll('.model-row-delete').forEach(btn => {
            btn.addEventListener('click', function() {
                this.closest('.model-row').remove();
                setTimeout(() => self.autoSave(), 100);
            });
        });
        
        const createModelRow = (defaultProtocol = 'openai') => {
            const div = document.createElement('div');
            div.className = 'flex gap-1.5 items-center model-row';
            div.innerHTML = `
                <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-gray-300 focus:ring-1 focus:ring-gray-100 outline-none">
                    <option value="openai" ${defaultProtocol === 'openai' ? 'selected' : ''} title="OpenAI格式">O</option>
                    <option value="gemini" ${defaultProtocol === 'gemini' ? 'selected' : ''} title="Gemini格式">G</option>
                </select>
                <input type="text" placeholder="模型名称" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-gray-300 focus:ring-1 focus:ring-gray-100 outline-none">
                <button type="button" class="text-gray-300 hover:text-red-400 text-sm model-row-delete transition-colors">×</button>
            `;
            
            const select = div.querySelector('select');
            const protocolRadios = document.querySelectorAll(`input[name="settings${providerId}Format"]`);
            let currentProtocol = 'openai';
            protocolRadios.forEach(radio => {
                if (radio.checked) currentProtocol = radio.value;
            });
            
            if (currentProtocol !== 'mix') {
                select.disabled = true;
                select.classList.add('opacity-50', 'cursor-not-allowed');
                select.value = currentProtocol;
            }
            
            div.querySelector('.model-row-delete').addEventListener('click', function() {
                div.remove();
                setTimeout(() => self.autoSave(), 100);
            });
            
            div.querySelector('input[type="text"]').addEventListener('input', function() {
                console.log('[模型输入] 检测到输入, providerId:', providerId);
                setTimeout(() => self.autoSave(), 1000);
            });
            
            div.querySelector('select').addEventListener('change', function() {
                console.log('[模型选择] 检测到变更, providerId:', providerId);
                setTimeout(() => self.autoSave(), 100);
            });
            
            return div;
        };
        
        newConfig.querySelectorAll('.add-model-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const containerId = this.dataset.container;
                const container = document.getElementById(containerId);
                if (container) {
                    const protocolRadios = document.querySelectorAll(`input[name="settings${providerId}Format"]`);
                    let currentProtocol = 'openai';
                    protocolRadios.forEach(radio => {
                        if (radio.checked) currentProtocol = radio.value;
                    });
                    container.appendChild(createModelRow(currentProtocol === 'mix' ? 'openai' : currentProtocol));
                }
            });
        });
    }

    addProvider() {
        this.providerCounter++;
        const providerId = `custom${this.providerCounter}`;
        const providerName = `Custom ${this.providerCounter}`;
        
        this.createProvider({
            id: providerId,
            name: providerName,
            baseUrl: 'https://api.example.com',
            apiKey: '',
            protocol: 'openai'
        });
        
        // 自动切换到新标签
        const newTab = document.getElementById(`settingsTab${providerId}`);
        if (newTab) {
            newTab.click();
        }
    }

    deleteProvider(providerId) {
        return new Promise((resolve) => {
            const confirmModal = document.getElementById('confirmModal');
            const confirmModalMessage = document.getElementById('confirmModalMessage');
            const confirmModalCheckbox = document.getElementById('confirmModalCheckbox');
            const confirmModalCancel = document.getElementById('confirmModalCancel');
            const confirmModalOk = document.getElementById('confirmModalOk');
            
            confirmModalMessage.textContent = '确定要删除此Provider吗？';
            confirmModalCheckbox.parentElement.style.display = 'none';
            confirmModal.classList.remove('hidden');
            confirmModal.classList.add('flex');
            
            const handleConfirm = () => {
                const tab = document.querySelector(`#settingsTab${providerId}`);
                if (tab) tab.remove();
                const config = document.querySelector(`#settings${providerId}Config`);
                if (config) config.remove();
                const firstTab = document.querySelector('#settingsTabs button:not(#settingsTabAdd)');
                if (firstTab) {
                    firstTab.click();
                }
                this.autoSave();
                
                confirmModal.classList.add('hidden');
                confirmModal.classList.remove('flex');
                confirmModalCheckbox.parentElement.style.display = 'flex';
                confirmModalOk.removeEventListener('click', handleConfirm);
                confirmModalCancel.removeEventListener('click', handleCancel);
                resolve(true);
            };
            
            const handleCancel = () => {
                confirmModal.classList.add('hidden');
                confirmModal.classList.remove('flex');
                confirmModalCheckbox.parentElement.style.display = 'flex';
                confirmModalOk.removeEventListener('click', handleConfirm);
                confirmModalCancel.removeEventListener('click', handleCancel);
                resolve(false);
            };
            
            confirmModalOk.addEventListener('click', handleConfirm);
            confirmModalCancel.addEventListener('click', handleCancel);
        });
    }

    // 显示确认模态框
    showConfirmModal(message, options = {}) {
        return new Promise((resolve) => {
            const confirmModal = document.getElementById('confirmModal');
            const confirmModalMessage = document.getElementById('confirmModalMessage');
            const confirmModalCheckbox = document.getElementById('confirmModalCheckbox');
            const confirmModalCancel = document.getElementById('confirmModalCancel');
            const confirmModalOk = document.getElementById('confirmModalOk');
            const confirmModalTitle = confirmModal?.querySelector('h3');
            
            if (!confirmModal || !confirmModalOk || !confirmModalCancel) {
                console.error('Confirm modal elements not found');
                resolve(false);
                return;
            }
            
            // 将模态框移动到body的最后，确保它在所有其他元素之上
            document.body.appendChild(confirmModal);
            
            // 自定义标题
            if (options.title) {
                confirmModalTitle.textContent = options.title;
            } else {
                confirmModalTitle.textContent = '确认删除';
            }
            
            // 自定义按钮文字
            confirmModalOk.textContent = options.okText || '删除';
            confirmModalCancel.textContent = options.cancelText || '取消';
            
            // 自定义按钮样式
            confirmModalOk.className = options.okClass || 'px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors';
            confirmModalCancel.className = options.cancelClass || 'px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors';
            
            confirmModalMessage.textContent = message;
            confirmModalCheckbox.parentElement.style.display = 'none';
            confirmModal.classList.remove('hidden');
            confirmModal.classList.add('flex');
            
            const cleanup = () => {
                confirmModalOk.removeEventListener('click', handleConfirm);
                confirmModalCancel.removeEventListener('click', handleCancel);
                // 恢复默认样式
                confirmModalOk.textContent = '删除';
                confirmModalOk.className = 'px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors';
                confirmModalCancel.textContent = '取消';
                confirmModalCancel.className = 'px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors';
                confirmModalTitle.textContent = '确认删除';
            };
            
            const handleConfirm = () => {
                confirmModal.classList.add('hidden');
                confirmModal.classList.remove('flex');
                confirmModalCheckbox.parentElement.style.display = 'flex';
                cleanup();
                resolve(true);
            };
            
            const handleCancel = () => {
                confirmModal.classList.add('hidden');
                confirmModal.classList.remove('flex');
                confirmModalCheckbox.parentElement.style.display = 'flex';
                cleanup();
                resolve(false);
            };
            
            confirmModalOk.addEventListener('click', handleConfirm);
            confirmModalCancel.addEventListener('click', handleCancel);
        });
    }

    // 显示保存成功提示
    showSaveSuccessModal(message = '设置已成功保存') {
        const saveSuccessModal = document.getElementById('saveSuccessModal');
        const saveSuccessModalMessage = document.getElementById('saveSuccessModalMessage');
        const saveSuccessModalOk = document.getElementById('saveSuccessModalOk');
        
        if (!saveSuccessModal || !saveSuccessModalOk) {
            console.error('Save success modal elements not found');
            return;
        }
        
        // 将模态框移动到body的最后，确保它在所有其他元素之上
        document.body.appendChild(saveSuccessModal);
        
        saveSuccessModalMessage.textContent = message;
        saveSuccessModal.classList.remove('hidden');
        saveSuccessModal.classList.add('flex');
        
        const handleOk = () => {
            saveSuccessModal.classList.add('hidden');
            saveSuccessModal.classList.remove('flex');
            saveSuccessModalOk.removeEventListener('click', handleOk);
        };
        
        saveSuccessModalOk.addEventListener('click', handleOk);
        
        // 3秒后自动关闭
        setTimeout(() => {
            if (!saveSuccessModal.classList.contains('hidden')) {
                handleOk();
            }
        }, 3000);
    }

    adjustBaseUrlInputWidth(input) {
        const minWidth = 40;
        const maxWidth = 400;
        const textLength = input.value.length;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, textLength * 8 + 16));
        input.style.width = `${newWidth}px`;
    }

    adjustApiKeyInputWidth(input) {
        const minWidth = 220;
        const maxWidth = 450;
        const textLength = input.value.length;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, textLength * 9 + 24));
        input.style.width = `${newWidth}px`;
    }

    // 保存所有Provider配置到localStorage
    saveProviders(showSuccessMessage = true) {
        try {
            const providers = [];
            
            // 收集所有Provider配置
            document.querySelectorAll('#settingsAPIConfig > div').forEach(panel => {
                const providerId = panel.id.replace('settings', '').replace('Config', '');
                const providerNameInput = document.getElementById(`settings${providerId}Provider`);
                const baseUrlInput = document.getElementById(`settings${providerId}BaseUrl`);
                const baseUrlSuffixInput = document.getElementById(`settings${providerId}BaseUrlSuffix`);
                const apiKeyInput = document.getElementById(`settings${providerId}ApiKeyInput`);
                const enabledInput = document.getElementById(`settings${providerId}Enabled`);
                const formatInputs = document.querySelectorAll(`input[name="settings${providerId}Format"]`);
                
                if (providerNameInput && baseUrlInput) {
                    let selectedFormat = 'openai';
                    formatInputs.forEach(input => {
                        if (input.checked) {
                            selectedFormat = input.value;
                        }
                    });
                    
                    // 收集模型配置
                    const textModels = this.collectModels(`${providerId}TextModels`);
                    const imageModels = this.collectModels(`${providerId}ImageModels`);
                    const videoModels = this.collectModels(`${providerId}VideoModels`);
                    
                    // 收集当前选中的默认模型（从 localStorage 读取）
                    const defaultTextModel = localStorage.getItem('GEMINI_MODEL_NAME') || '';
                    const defaultTextProvider = localStorage.getItem('GEMINI_MODEL_PROVIDER') || '';
                    const defaultImageModel = localStorage.getItem('GEMINI_IMAGE_MODEL_NAME') || '';
                    const defaultImageProvider = localStorage.getItem('GEMINI_IMAGE_MODEL_PROVIDER') || '';
                    const defaultVideoModel = localStorage.getItem('GEMINI_VIDEO_MODEL_NAME') || '';
                    const defaultVideoProvider = localStorage.getItem('GEMINI_VIDEO_MODEL_PROVIDER') || '';
                    
                    providers.push({
                        id: providerId,
                        name: providerNameInput.value,
                        baseUrl: baseUrlInput.value,
                        apiKey: apiKeyInput?.value || '',
                        enabled: enabledInput?.checked || false,
                        protocol: selectedFormat,
                        textModels,
                        imageModels,
                        videoModels,
                        defaultModel: {
                            text: { value: defaultTextModel, provider: defaultTextProvider },
                            image: { value: defaultImageModel, provider: defaultImageProvider },
                            video: { value: defaultVideoModel, provider: defaultVideoProvider }
                        }
                    });
                }
            });
            
            localStorage.setItem('nano_api_providers', JSON.stringify(providers));
            localStorage.setItem('nano_api_provider_counter', this.providerCounter.toString());
            console.log('Providers saved successfully, providers:', providers);
            
            // 保存成功后清除未保存标志
            const hadUnsavedChanges = this.hasUnsavedChanges;
            console.log('[保存] hadUnsavedChanges:', hadUnsavedChanges, 'showSuccessMessage:', showSuccessMessage);
            this.hasUnsavedChanges = false;
            this.updateSaveButtonState();
            
            // 只有在有未保存修改且需要显示提示时才显示保存成功提示
            if (hadUnsavedChanges && showSuccessMessage) {
                console.log('[保存] 准备显示成功提示');
                this.showSaveSuccessModal('设置已成功保存到本地');
            }
            
            // 保存后刷新上方默认模型下拉菜单
            if (typeof populateSettingsModelSelects === 'function') {
                populateSettingsModelSelects();
            }
            
            // 刷新提示词面板的模型下拉菜单
            if (window.modelSelectManager) {
                window.modelSelectManager.populateModelSelects();
            }
        } catch (error) {
            console.error('Error saving providers:', error);
        }
    }

    // 从localStorage加载Provider配置
    loadProviders() {
        try {
            const savedProviders = localStorage.getItem('nano_api_providers');
            const savedCounter = localStorage.getItem('nano_api_provider_counter');
            
            if (savedCounter) {
                this.providerCounter = parseInt(savedCounter, 10);
            }
            
            if (savedProviders) {
                const providers = JSON.parse(savedProviders);
                
                // 清空现有面板（保留默认面板）
                const existingPanels = document.querySelectorAll('#settingsAPIConfig > div[id^="settingsCustom"]');
                existingPanels.forEach(panel => panel.remove());
                
                const existingTabs = document.querySelectorAll('#settingsTabs button[data-provider-id^="custom"]');
                existingTabs.forEach(tab => tab.remove());
                
                // 重建自定义Provider
                providers.forEach(provider => {
                    if (provider.id.startsWith('custom')) {
                        this.createProvider({
                            id: provider.id,
                            name: provider.name,
                            baseUrl: provider.baseUrl,
                            apiKey: provider.apiKey,
                            protocol: provider.protocol || 'openai'
                        });
                        
                        // 恢复API Key
                        const apiKeyInput = document.getElementById(`settings${provider.id}ApiKeyInput`);
                        if (apiKeyInput) {
                            apiKeyInput.value = provider.apiKey || '';
                        }
                        
                        // 恢复启用状态
                        const enabledInput = document.getElementById(`settings${provider.id}Enabled`);
                        if (enabledInput) {
                            enabledInput.checked = provider.enabled || false;
                        }
                        
                        // 恢复模型配置
                        this.restoreModels(`${provider.id}TextModels`, provider.textModels);
                        this.restoreModels(`${provider.id}ImageModels`, provider.imageModels);
                        this.restoreModels(`${provider.id}VideoModels`, provider.videoModels);
                        
                        // 恢复默认模型选择
                        if (provider.defaultModel) {
                            if (provider.defaultModel.text) {
                                localStorage.setItem('GEMINI_MODEL_NAME', provider.defaultModel.text.value || '');
                                localStorage.setItem('GEMINI_MODEL_PROVIDER', provider.defaultModel.text.provider || '');
                            }
                            if (provider.defaultModel.image) {
                                localStorage.setItem('GEMINI_IMAGE_MODEL_NAME', provider.defaultModel.image.value || '');
                                localStorage.setItem('GEMINI_IMAGE_MODEL_PROVIDER', provider.defaultModel.image.provider || '');
                            }
                            if (provider.defaultModel.video) {
                                localStorage.setItem('GEMINI_VIDEO_MODEL_NAME', provider.defaultModel.video.value || '');
                                localStorage.setItem('GEMINI_VIDEO_MODEL_PROVIDER', provider.defaultModel.video.provider || '');
                            }
                        }
                    }
                });
                
                console.log('Providers loaded successfully');
                
                // 初始化保存按钮状态
                this.hasUnsavedChanges = false;
                this.updateSaveButtonState();
            }
        } catch (error) {
            console.error('Error loading providers:', error);
        }
    }

    // 收集模型配置
    collectModels(containerId) {
        const models = [];
        const container = document.getElementById(containerId);
        console.log('[collectModels] containerId:', containerId, 'container exists:', !!container);
        if (container) {
            const rows = container.querySelectorAll('.model-row');
            console.log('[collectModels] model rows count:', rows.length);
            rows.forEach(row => {
                const protocolSelect = row.querySelector('select');
                const modelInput = row.querySelector('input[type="text"]');
                console.log('[collectModels] protocolSelect:', !!protocolSelect, 'modelInput:', !!modelInput, 'value:', modelInput?.value);
                if (protocolSelect && modelInput) {
                    models.push({
                        protocol: protocolSelect.value,
                        name: modelInput.value
                    });
                }
            });
        }
        return models;
    }

    // 恢复模型配置
    restoreModels(containerId, models) {
        const container = document.getElementById(containerId);
        if (container && models && models.length > 0) {
            container.innerHTML = '';
            const self = this;
            
            models.forEach(model => {
                const row = document.createElement('div');
                row.className = 'flex gap-1.5 items-center model-row';
                row.innerHTML = `
                    <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-gray-300 focus:ring-1 focus:ring-gray-100 outline-none" disabled>
                        <option value="openai" ${model.protocol === 'openai' ? 'selected' : ''} title="OpenAI格式">O</option>
                        <option value="gemini" ${model.protocol === 'gemini' ? 'selected' : ''} title="Gemini格式">G</option>
                    </select>
                    <input type="text" value="${model.name || ''}" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-gray-300 focus:ring-1 focus:ring-gray-100 outline-none">
                    <button type="button" class="text-gray-300 hover:text-red-400 text-sm model-row-delete transition-colors">×</button>
                `;
                
                row.querySelector('.model-row-delete').addEventListener('click', function() {
                    row.remove();
                    setTimeout(() => self.autoSave(), 100);
                });
                
                row.querySelector('input[type="text"]').addEventListener('input', function() {
                    console.log('[模型输入] 检测到输入, 从restore');
                    setTimeout(() => self.autoSave(), 1000);
                });
                
                row.querySelector('select').addEventListener('change', function() {
                    console.log('[模型选择] 检测到变更, 从restore');
                    setTimeout(() => self.autoSave(), 100);
                });
                
                container.appendChild(row);
            });
        }
    }

    // 标记需要更新保存按钮状态
    markDirty() {
        this.hasUnsavedChanges = true;
        this.updateSaveButtonState();
    }

    // 更新保存按钮状态
    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveSettingsBtn');
        console.log('[保存按钮] updateSaveButtonState 被调用, hasUnsavedChanges:', this.hasUnsavedChanges, '按钮元素:', !!saveBtn);
        if (saveBtn) {
            if (this.hasUnsavedChanges) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                console.log('[保存按钮] 已启用');
            } else {
                saveBtn.disabled = true;
                saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
                console.log('[保存按钮] 已禁用');
            }
        }
    }

    // 保存配置（手动点击保存按钮）
    saveNow() {
        console.log('[保存] saveNow 被调用');
        this.hasUnsavedChanges = true;
        this.saveProviders(true);
    }

    // 自动保存配置（已弃用，改用手动保存）
    autoSave() {
        // 不再自动保存，只标记脏状态
        this.markDirty();
    }
    
    // 检查是否有未保存的修改
    checkUnsavedChanges() {
        return this.hasUnsavedChanges;
    }
}

export { ProviderManager };
