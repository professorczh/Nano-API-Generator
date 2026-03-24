// 设置面板相关逻辑

export class SettingsPanel {
    constructor() {
        this.settingsPanel = document.getElementById('settingsPanel');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        this.settingsApiKeyInput = document.getElementById('settingsApiKeyInput');
        this.settingsApiStatus = document.getElementById('settingsApiStatus');
        this.settingsTestApiKeyBtn = document.getElementById('settingsTestApiKeyBtn');
        this.settingsApiStatusClose = document.getElementById('settingsApiStatusClose');
        
        this.modelConfigs = [
            { containerId: 'geminiTextModels', addBtnId: 'geminiTextModelsAddBtn', colorClass: 'text-blue-600 hover:text-blue-700', defaultFormat: 'gemini' },
            { containerId: 'geminiImageModels', addBtnId: 'geminiImageModelsAddBtn', colorClass: 'text-blue-600 hover:text-blue-700', defaultFormat: 'gemini' },
            { containerId: 'geminiVideoModels', addBtnId: 'geminiVideoModelsAddBtn', colorClass: 'text-blue-600 hover:text-blue-700', defaultFormat: 'gemini' },
            { containerId: '12aiTextModels', addBtnId: '12aiTextModelsAddBtn', colorClass: 'text-purple-600 hover:text-purple-700', defaultFormat: 'openai' },
            { containerId: '12aiImageModels', addBtnId: '12aiImageModelsAddBtn', colorClass: 'text-purple-600 hover:text-purple-700', defaultFormat: 'openai' },
            { containerId: '12aiVideoModels', addBtnId: '12aiVideoModelsAddBtn', colorClass: 'text-purple-600 hover:text-purple-700', defaultFormat: 'openai' },
            { containerId: 'openaiTextModels', addBtnId: 'openaiTextModelsAddBtn', colorClass: 'text-green-600 hover:text-green-700', defaultFormat: 'openai' },
            { containerId: 'openaiImageModels', addBtnId: 'openaiImageModelsAddBtn', colorClass: 'text-green-600 hover:text-green-700', defaultFormat: 'openai' },
            { containerId: 'openaiVideoModels', addBtnId: 'openaiVideoModelsAddBtn', colorClass: 'text-green-600 hover:text-green-700', defaultFormat: 'openai' },
            { containerId: 'claudeTextModels', addBtnId: 'claudeTextModelsAddBtn', colorClass: 'text-orange-600 hover:text-orange-700', defaultFormat: 'openai' },
            { containerId: 'claudeImageModels', addBtnId: 'claudeImageModelsAddBtn', colorClass: 'text-orange-600 hover:text-orange-700', defaultFormat: 'openai' },
            { containerId: 'claudeVideoModels', addBtnId: 'claudeVideoModelsAddBtn', colorClass: 'text-orange-600 hover:text-orange-700', defaultFormat: 'openai' }
        ];
        
        this.formatConfigs = [
            { 
                radioName: 'settingsGeminiFormat', 
                containers: ['geminiTextModels', 'geminiImageModels', 'geminiVideoModels'],
                defaultFormat: 'gemini'
            },
            { 
                radioName: 'settings12AiFormat', 
                containers: ['12aiTextModels', '12aiImageModels', '12aiVideoModels'],
                defaultFormat: 'openai'
            },
            { 
                radioName: 'settingsOpenAIFormat', 
                containers: ['openaiTextModels', 'openaiImageModels', 'openaiVideoModels'],
                defaultFormat: 'openai'
            },
            { 
                radioName: 'settingsClaudeFormat', 
                containers: ['claudeTextModels', 'claudeImageModels', 'claudeVideoModels'],
                defaultFormat: 'openai'
            }
        ];
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.initModelConfigs();
        this.initFormatListeners();
        this.applyInitialFormatState();
    }
    
    bindEvents() {
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', () => {
                const activeTab = document.querySelector('#settingsTabs button.text-blue-600');
                const activeProvider = activeTab?.dataset.providerId || 'unknown';
                console.log(`[UI] User clicked: saveSettingsBtn | ActiveProvider: ${activeProvider}`);
                if (window.dynamicProviderManager) {
                    window.dynamicProviderManager.saveProviders();
                }
            });
        }
        
        const settingsTabAdd = document.getElementById('settingsTabAdd');
        if (settingsTabAdd) {
            settingsTabAdd.addEventListener('click', () => {
                console.log('[UI] User clicked: addProviderBtn | Action: createNewProvider');
                if (window.dynamicProviderManager) {
                    window.dynamicProviderManager.addNewProvider();
                }
            });
        }
        
        if (this.settingsPanel) {
            this.settingsPanel.addEventListener('click', (e) => {
                if (e.target === this.settingsPanel) {
                    console.log('[UI] User clicked: settingsPanel overlay | Action: close');
                    this.handleClose();
                }
            });
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.settingsPanel && this.settingsPanel.classList.contains('flex')) {
                console.log('[UI] User pressed: ESC key | Action: closeSettings');
                this.handleClose();
            }
        });
    }
    
    initModelConfigs() {
        this.modelConfigs.forEach(config => {
            const container = document.getElementById(config.containerId);
            const addBtn = document.getElementById(config.addBtnId);
            
            if (container && addBtn) {
                addBtn.addEventListener('click', () => {
                    const newItem = this.createModelItem(config.defaultFormat);
                    container.appendChild(newItem);
                    this.updateAddButtonVisibility(config.containerId, config.addBtnId);
                    
                    const formatConfig = this.formatConfigs.find(fc => fc.containers.includes(config.containerId));
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
                        this.updateAddButtonVisibility(config.containerId, config.addBtnId);
                    }
                });
            }
        });
    }
    
    createModelItem(defaultFormat) {
        const div = document.createElement('div');
        div.className = 'flex gap-1 items-center';
        const openaiSelected = defaultFormat === 'openai' ? 'selected' : '';
        const geminiSelected = defaultFormat === 'gemini' ? 'selected' : '';
        div.innerHTML = `
            <select class="w-10 px-1 py-1 text-xs rounded border border-gray-200 bg-white model-format-select">
                <option value="openai" ${openaiSelected} title="OpenAI格式">O</option>
                <option value="gemini" ${geminiSelected} title="Gemini格式">G</option>
            </select>
            <input type="text" placeholder="模型名称" class="flex-1 px-2 py-1 text-xs rounded border border-gray-200">
            <button type="button" class="text-red-500 hover:text-red-700 text-xs model-delete-btn">×</button>
        `;
        return div;
    }
    
    updateAddButtonVisibility(containerId, addBtnId) {
        const container = document.getElementById(containerId);
        const addBtn = document.getElementById(addBtnId);
        if (!container || !addBtn) return;
        addBtn.classList.remove('hidden');
    }
    
    updateModelSelectsState(containers, format) {
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
    
    initFormatListeners() {
        this.formatConfigs.forEach(config => {
            const radios = document.querySelectorAll(`input[name="${config.radioName}"]`);
            radios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const selectedFormat = e.target.value;
                    this.updateModelSelectsState(config.containers, selectedFormat);
                });
            });
        });
    }
    
    applyInitialFormatState() {
        this.formatConfigs.forEach(config => {
            const checkedRadio = document.querySelector(`input[name="${config.radioName}"]:checked`);
            if (checkedRadio) {
                this.updateModelSelectsState(config.containers, checkedRadio.value);
            }
        });
    }
    
    async handleClose() {
        const hasUnsavedChanges = window.dynamicProviderManager && window.dynamicProviderManager.checkUnsavedChanges();
        console.log(`[UI] User clicked: closeSettingsBtn | HasUnsavedChanges: ${hasUnsavedChanges}`);
        if (hasUnsavedChanges) {
            const confirmed = await window.dynamicProviderManager.showConfirmModal('有未保存的修改，是否保存？');
            if (confirmed) {
                window.dynamicProviderManager.saveProviders();
            }
            this.close();
        } else {
            this.close();
        }
    }
    
    open() {
        console.log('[State] Settings panel opened');
        if (this.settingsPanel) {
            this.settingsPanel.classList.remove('hidden');
            this.settingsPanel.classList.add('flex');
            
            if (typeof window.syncFromModeToSettingsSelects === 'function') {
                window.syncFromModeToSettingsSelects();
            }
            
            this.applyInitialFormatState();
            
            const firstTab = document.querySelector('#settingsTabs button:not(#settingsTabAdd)');
            if (firstTab) {
                firstTab.click();
            }
        }
    }
    
    close() {
        console.log('[State] Settings panel closed');
        if (this.settingsPanel) {
            this.settingsPanel.classList.add('hidden');
            this.settingsPanel.classList.remove('flex');
        }
    }
}
