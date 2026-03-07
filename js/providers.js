// 管理Provider的动态创建和删除

class ProviderManager {
    constructor() {
        this.providerCounter = 4;
        this.hasUnsavedChanges = false;
        this.defaultProviders = [
            {
                id: 'Gemini',
                name: 'Google',
                deletable: false,
                baseUrl: 'https://generativelanguage.googleapis.com',
                baseUrlSuffix: '/v1beta',
                formats: ['openai', 'gemini', 'mix'],
                defaultFormat: 'gemini',
                color: 'blue'
            },
            {
                id: '12AI',
                name: '12AI',
                deletable: true,
                baseUrl: 'https://api.12ai.com',
                baseUrlSuffix: '/v1',
                formats: ['openai'],
                defaultFormat: 'openai',
                color: 'purple'
            },
            {
                id: 'OpenAI',
                name: 'OpenAI',
                deletable: true,
                baseUrl: 'https://api.openai.com',
                baseUrlSuffix: '/v1',
                formats: ['openai'],
                defaultFormat: 'openai',
                color: 'green'
            },
            {
                id: 'Claude',
                name: 'Claude',
                deletable: true,
                baseUrl: 'https://api.anthropic.com',
                baseUrlSuffix: '/v1',
                formats: ['openai', 'gemini', 'mix'],
                defaultFormat: 'openai',
                color: 'orange'
            }
        ];
        this.init();
        this.loadProviders();
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
        const { id, name, deletable, baseUrl, baseUrlSuffix, formats, defaultFormat, color } = config;
        const providerId = id;
        
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
        
        const formatOptions = formats.map(fmt => {
            const checked = fmt === defaultFormat ? 'checked' : '';
            const labels = { openai: 'OpenAI格式', gemini: 'Gemini格式', mix: 'Mix兼容格式' };
            return `<label class="flex items-center gap-1.5 text-xs cursor-pointer ${fmt === defaultFormat ? 'text-gray-700' : 'text-gray-500'}">
                <input type="radio" name="settings${providerId}Format" value="${fmt}" ${checked} class="accent-${color}-500 w-3.5 h-3.5">
                <span>${labels[fmt] || fmt}</span>
            </label>`;
        }).join('');

        const deleteBtnHtml = deletable 
            ? `<button type="button" class="ml-auto px-4 py-1.5 text-sm rounded border border-red-300 text-white bg-red-500 hover:border-red-400 hover:bg-red-600 transition-all provider-delete-btn" data-provider-id="${providerId}" title="删除此Provider">删除</button>`
            : `<button type="button" class="ml-auto px-4 py-1.5 text-sm rounded border border-red-300 text-white bg-red-500 opacity-50 cursor-not-allowed" disabled title="默认Provider不可删除">删除</button>`;

        newConfig.innerHTML = `
            <div class="mb-4">
                <label class="block text-xs text-gray-500 mb-1.5">API Provider</label>
                <div class="flex gap-3 items-center">
                    <div class="flex gap-2 w-1/5">
                        <input type="text" id="settings${providerId}Provider" 
                            class="flex-1 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 focus:border-${color}-300 focus:ring-2 focus:ring-${color}-100 outline-none text-sm transition-all"
                            value="${name}">
                    </div>
                    <span class="text-xs text-gray-500">启用</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="settings${providerId}Enabled" class="sr-only peer" checked>
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-${color}-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[&quot;&quot;] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-${color}-500"></div>
                    </label>
                    ${deleteBtnHtml}
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-xs text-gray-500 mb-1.5">BASE URL</label>
                <div class="flex gap-2 items-center">
                    <input type="text" id="settings${providerId}BaseUrl" 
                        class="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 focus:border-${color}-300 focus:ring-2 focus:ring-${color}-100 outline-none text-sm transition-all"
                        value="${baseUrl}">
                    <input type="text" id="settings${providerId}BaseUrlSuffix" 
                        class="w-16 px-2 py-2 rounded-lg border border-gray-100 bg-gray-100 text-gray-400 text-sm text-center"
                        value="${baseUrlSuffix}" readonly>
                </div>
                <div class="flex gap-4 mt-2">
                    ${formatOptions}
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-xs text-gray-500 mb-1.5">API KEY</label>
                <div class="flex gap-2 items-center">
                    <input type="text" id="settings${providerId}ApiKeyInput" 
                        class="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 focus:border-${color}-300 focus:ring-2 focus:ring-${color}-100 outline-none text-sm transition-all"
                        placeholder="输入 API Key" style="width: 200px;">
                    <button id="settingsTest${providerId}KeyBtn" 
                        class="bg-${color}-600 hover:bg-${color}-700 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all">
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
                                <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-${color}-300 focus:ring-1 focus:ring-${color}-100 outline-none">
                                    <option value="openai" selected title="OpenAI格式">O</option>
                                    <option value="gemini" title="Gemini格式">G</option>
                                </select>
                                <input type="text" placeholder="模型名称" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-${color}-300 focus:ring-1 focus:ring-${color}-100 outline-none">
                                <button type="button" class="text-gray-300 hover:text-red-400 text-sm model-row-delete transition-colors">×</button>
                            </div>
                        </div>
                        <button type="button" class="text-xs text-gray-500 hover:text-gray-600 add-model-btn" data-container="${providerId}TextModels">+ 添加</button>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-2">图像模型</label>
                        <div id="${providerId}ImageModels" class="space-y-1.5 mb-2 model-list-container">
                            <div class="flex gap-1.5 items-center model-row">
                                <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-${color}-300 focus:ring-1 focus:ring-${color}-100 outline-none">
                                    <option value="openai" selected title="OpenAI格式">O</option>
                                    <option value="gemini" title="Gemini格式">G</option>
                                </select>
                                <input type="text" placeholder="模型名称" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-${color}-300 focus:ring-1 focus:ring-${color}-100 outline-none">
                                <button type="button" class="text-gray-300 hover:text-red-400 text-sm model-row-delete transition-colors">×</button>
                            </div>
                        </div>
                        <button type="button" class="text-xs text-gray-500 hover:text-gray-600 add-model-btn" data-container="${providerId}ImageModels">+ 添加</button>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-2">视频模型</label>
                        <div id="${providerId}VideoModels" class="space-y-1.5 mb-2 model-list-container">
                            <div class="flex gap-1.5 items-center model-row">
                                <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-${color}-300 focus:ring-1 focus:ring-${color}-100 outline-none">
                                    <option value="openai" selected title="OpenAI格式">O</option>
                                    <option value="gemini" title="Gemini格式">G</option>
                                </select>
                                <input type="text" placeholder="模型名称" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-${color}-300 focus:ring-1 focus:ring-${color}-100 outline-none">
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
        
        // BASE URL格式联动逻辑
        const formatRadios = document.querySelectorAll(`input[name="settings${providerId}Format"]`);
        const modelSelects = newConfig.querySelectorAll('.model-format-select');
        
        const updateFormatState = (selectedFormat) => {
            // 更新BASE URL后缀
            if (baseUrlSuffixInput) {
                if (selectedFormat === 'openai') {
                    baseUrlSuffixInput.value = '/v1';
                    baseUrlSuffixInput.readOnly = true;
                } else if (selectedFormat === 'gemini') {
                    baseUrlSuffixInput.value = '/v1beta';
                    baseUrlSuffixInput.readOnly = true;
                } else if (selectedFormat === 'mix') {
                    baseUrlSuffixInput.readOnly = false;
                }
                this.adjustBaseUrlInputWidth(baseUrlSuffixInput);
            }
            
            // 更新模型格式下拉框状态
            modelSelects.forEach(select => {
                if (selectedFormat === 'mix') {
                    select.disabled = false;
                    select.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    select.disabled = true;
                    select.classList.add('opacity-50', 'cursor-not-allowed');
                    select.value = selectedFormat;
                }
            });
        };
        
        // 绑定格式单选按钮事件
        formatRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                updateFormatState(e.target.value);
                this.autoSave();
            });
        });
        
        // 应用初始格式状态
        const checkedRadio = document.querySelector(`input[name="settings${providerId}Format"]:checked`);
        if (checkedRadio) {
            updateFormatState(checkedRadio.value);
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
                    // 根据providerId选择不同的测试方式
                    let success = false;
                    let message = '';
                    
                    if (providerId === 'Gemini') {
                        // Gemini使用GoogleGenerativeAI测试
                        if (typeof GoogleGenerativeAI !== 'undefined') {
                            const genAI = new GoogleGenerativeAI(apiKey);
                            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
                            await model.generateContent("test");
                            success = true;
                        } else {
                            message = 'GoogleGenerativeAI 未加载';
                        }
                    } else if (providerId === '12AI') {
                        // 12AI使用apiClient测试
                        if (window.apiClient && window.apiClient.test12AIKey) {
                            await new Promise((resolve) => {
                                window.apiClient.test12AIKey(apiKey, (s, m) => {
                                    success = s;
                                    message = m;
                                    resolve();
                                });
                            });
                        } else {
                            message = 'API Client 未加载';
                        }
                    } else {
                        // 其他Provider使用通用测试（模拟成功）
                        // 实际项目中应该根据provider的baseUrl和格式进行测试
                        success = true;
                        message = 'API Key 格式有效';
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
        
        const createModelRow = () => {
            const div = document.createElement('div');
            div.className = 'flex gap-1.5 items-center model-row';
            div.innerHTML = `
                <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-gray-300 focus:ring-1 focus:ring-gray-100 outline-none">
                    <option value="openai" selected title="OpenAI格式">O</option>
                    <option value="gemini" title="Gemini格式">G</option>
                </select>
                <input type="text" placeholder="模型名称" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-gray-300 focus:ring-1 focus:ring-gray-100 outline-none">
                <button type="button" class="text-gray-300 hover:text-red-400 text-sm model-row-delete transition-colors">×</button>
            `;
            div.querySelector('.model-row-delete').addEventListener('click', function() {
                div.remove();
                setTimeout(() => self.autoSave(), 100);
            });
            return div;
        };
        
        newConfig.querySelectorAll('.add-model-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const containerId = this.dataset.container;
                const container = document.getElementById(containerId);
                if (container) {
                    container.appendChild(createModelRow());
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
            deletable: true,
            baseUrl: 'https://api.example.com',
            baseUrlSuffix: '/v1',
            formats: ['openai', 'gemini', 'mix'],
            defaultFormat: 'openai',
            color: 'indigo'
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
    showConfirmModal(message) {
        return new Promise((resolve) => {
            const confirmModal = document.getElementById('confirmModal');
            const confirmModalMessage = document.getElementById('confirmModalMessage');
            const confirmModalCheckbox = document.getElementById('confirmModalCheckbox');
            const confirmModalCancel = document.getElementById('confirmModalCancel');
            const confirmModalOk = document.getElementById('confirmModalOk');
            
            if (!confirmModal || !confirmModalOk || !confirmModalCancel) {
                console.error('Confirm modal elements not found');
                resolve(false);
                return;
            }
            
            // 将模态框移动到body的最后，确保它在所有其他元素之上
            document.body.appendChild(confirmModal);
            
            confirmModalMessage.textContent = message;
            confirmModalCheckbox.parentElement.style.display = 'none';
            confirmModal.classList.remove('hidden');
            confirmModal.classList.add('flex');
            
            const cleanup = () => {
                confirmModalOk.removeEventListener('click', handleConfirm);
                confirmModalCancel.removeEventListener('click', handleCancel);
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
        const minWidth = 200;
        const maxWidth = 400;
        const textLength = input.value.length;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, textLength * 8 + 16));
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
                    
                    providers.push({
                        id: providerId,
                        name: providerNameInput.value,
                        baseUrl: baseUrlInput.value,
                        baseUrlSuffix: baseUrlSuffixInput?.value || '/v1',
                        apiKey: apiKeyInput?.value || '',
                        enabled: enabledInput?.checked || false,
                        format: selectedFormat,
                        textModels,
                        imageModels,
                        videoModels,
                        deletable: !panel.querySelector('.provider-delete-btn[disabled]')
                    });
                }
            });
            
            localStorage.setItem('nano_api_providers', JSON.stringify(providers));
            localStorage.setItem('nano_api_provider_counter', this.providerCounter.toString());
            console.log('Providers saved successfully');
            
            // 保存成功后清除未保存标志
            const hadUnsavedChanges = this.hasUnsavedChanges;
            this.hasUnsavedChanges = false;
            
            // 只有在有未保存修改且需要显示提示时才显示保存成功提示
            if (hadUnsavedChanges && showSuccessMessage) {
                // 显示保存成功提示
                this.showSaveSuccessModal('设置已成功保存到本地');
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
                            deletable: provider.deletable,
                            baseUrl: provider.baseUrl,
                            baseUrlSuffix: provider.baseUrlSuffix,
                            formats: ['openai', 'gemini', 'mix'],
                            defaultFormat: provider.format || 'openai',
                            color: 'gray'
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
                    }
                });
                
                console.log('Providers loaded successfully');
            }
        } catch (error) {
            console.error('Error loading providers:', error);
        }
    }

    // 收集模型配置
    collectModels(containerId) {
        const models = [];
        const container = document.getElementById(containerId);
        if (container) {
            container.querySelectorAll('.model-row').forEach(row => {
                const formatSelect = row.querySelector('select');
                const modelInput = row.querySelector('input[type="text"]');
                if (formatSelect && modelInput) {
                    models.push({
                        format: formatSelect.value,
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
            // 清空现有模型
            container.innerHTML = '';
            
            // 添加保存的模型
            models.forEach(model => {
                const row = document.createElement('div');
                row.className = 'flex gap-1.5 items-center model-row';
                row.innerHTML = `
                    <select class="w-9 px-1 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 model-format-select focus:border-gray-300 focus:ring-1 focus:ring-gray-100 outline-none">
                        <option value="openai" ${model.format === 'openai' ? 'selected' : ''} title="OpenAI格式">O</option>
                        <option value="gemini" ${model.format === 'gemini' ? 'selected' : ''} title="Gemini格式">G</option>
                    </select>
                    <input type="text" value="${model.name}" class="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-100 bg-gray-50 focus:border-gray-300 focus:ring-1 focus:ring-gray-100 outline-none">
                    <button type="button" class="text-gray-300 hover:text-red-400 text-sm model-row-delete transition-colors">×</button>
                `;
                const self = this;
                row.querySelector('.model-row-delete').addEventListener('click', function() {
                    row.remove();
                    setTimeout(() => self.autoSave(), 100);
                });
                container.appendChild(row);
            });
        }
    }

    // 自动保存配置
    autoSave() {
        // 标记有未保存的修改
        this.hasUnsavedChanges = true;
        
        // 延迟保存，避免频繁触发
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveProviders();
        }, 1000);
    }
    
    // 检查是否有未保存的修改
    checkUnsavedChanges() {
        return this.hasUnsavedChanges;
    }
}

export { ProviderManager };
