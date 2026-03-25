// 模型选择相关逻辑

import { CONFIG, TEXT_MODELS, IMAGE_MODELS, VIDEO_MODELS, VIDEO_RATIOS, IMAGE_RATIOS, IMAGE_SIZES } from "../config.js";

export class ModelSelectManager {
    constructor() {
        this.textModelNameWrapper = document.getElementById('textModelNameWrapper');
        this.imageModelNameWrapper = document.getElementById('imageModelNameWrapper');
        this.videoModelNameWrapper = document.getElementById('videoModelNameWrapper');
        this.aspectRatioWrapper = document.getElementById('aspectRatioWrapper');
        this.imageSizeWrapper = document.getElementById('imageSizeWrapper');
        this.videoDurationWrapper = document.getElementById('videoDurationWrapper');
        this.videoResolutionWrapper = document.getElementById('videoResolutionWrapper');
        this.videoRatioWrapper = document.getElementById('videoRatioWrapper');
        this.settingsDefaultTextModelWrapper = document.getElementById('settingsDefaultTextModelWrapper');
        this.settingsDefaultImageModelWrapper = document.getElementById('settingsDefaultImageModelWrapper');
        this.settingsDefaultVideoModelWrapper = document.getElementById('settingsDefaultVideoModelWrapper');
        
        this.isSyncingModels = false;
        
        this.init();
    }
    
    init() {
        this.populateModelSelects();
        this.updateResolutionOptions();
        this.initVideoOptions();
        this.initImageRatios();
        this.initVideoRatios();
    }
    
    initSimpleDropdown(wrapper, options, defaultKey, onSelect) {
        if (!wrapper) return;
        
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const selectedText = trigger.querySelector('.selected-text');
        
        let dropdown = wrapper._fixedDropdown;
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'custom-select-dropdown-fixed';
            document.body.appendChild(dropdown);
            wrapper._fixedDropdown = dropdown;
        }
        
        dropdown.innerHTML = '';
        
        let defaultValue = null;
        options.forEach((opt, index) => {
            const value = typeof opt === 'string' ? opt : opt.value;
            const name = typeof opt === 'string' ? opt : opt.name;
            
            const option = document.createElement('div');
            option.className = 'custom-option';
            option.dataset.value = value;
            option.textContent = name;
            option.addEventListener('click', () => {
                selectedText.textContent = name;
                wrapper.dataset.value = value;
                dropdown.classList.remove('open');
                wrapper.classList.remove('open');
                console.log(`[UI] User selected: ${wrapper.id} | Value: ${value}`);
                if (onSelect) onSelect(value);
            });
            dropdown.appendChild(option);
            
            if (index === 0 || value === defaultKey) {
                defaultValue = { value, name };
            }
        });
        
        if (defaultValue) {
            wrapper.dataset.value = defaultValue.value;
            selectedText.textContent = defaultValue.name;
        }
        
        if (wrapper.dataset.listening) return;
        wrapper.dataset.listening = 'true';
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });
            document.querySelectorAll('.custom-select-dropdown-fixed.open').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) {
                dropdown.classList.remove('open');
                wrapper.classList.remove('open');
            } else {
                const rect = trigger.getBoundingClientRect();
                dropdown.style.top = (rect.bottom + 4) + 'px';
                dropdown.style.left = rect.left + 'px';
                dropdown.style.width = rect.width + 'px';
                dropdown.classList.add('open');
                wrapper.classList.add('open');
            }
        });
    }
    
    updateResolutionOptions() {
        const selectedModel = CONFIG.IMAGE_MODEL_NAME;
        const isFirstGroup = selectedModel.includes('3.1-flash-image-preview');
        
        const filteredRatios = IMAGE_RATIOS.filter(ratio => 
            isFirstGroup || !['8:1', '4:1', '1:4', '1:8'].includes(ratio.value)
        );
        this.initSimpleDropdown(this.aspectRatioWrapper, filteredRatios, '1:1', (value) => {
            CONFIG.ASPECT_RATIO = value;
        });
        
        const filteredSizes = IMAGE_SIZES.filter(size => 
            isFirstGroup || size.value !== '512px'
        );
        this.initSimpleDropdown(this.imageSizeWrapper, filteredSizes, '1K', (value) => {
            CONFIG.IMAGE_SIZE = value;
        });
    }
    
    updateVideoDurationOptions(modelValue) {
        let model = null;
        if (window.dynamicProviderManager) {
            const allModels = window.dynamicProviderManager.getAllModels();
            model = (allModels.video || []).find(m => m.value === modelValue);
        }
        if (!model) {
            model = VIDEO_MODELS.find(m => m.value === modelValue);
        }
        
        let durations = ['4', '6', '8'];
        if (model && model.params && model.params.durations) {
            durations = model.params.durations;
        }
        
        const durationOptions = durations.map(d => ({ value: d, name: d + ' 秒' }));
        this.initSimpleDropdown(this.videoDurationWrapper, durationOptions, durations[0], (value) => {
            this.updateVideoResolutionOptions(modelValue, value);
        });
        
        this.updateVideoResolutionOptions(modelValue, durations[0]);
    }
    
    updateVideoResolutionOptions(modelValue, durationValue) {
        let model = null;
        if (window.dynamicProviderManager) {
            const allModels = window.dynamicProviderManager.getAllModels();
            model = (allModels.video || []).find(m => m.value === modelValue);
        }
        if (!model) {
            model = VIDEO_MODELS.find(m => m.value === modelValue);
        }
        
        let resolutions = ['720p', '1080p', '4k'];
        if (model && model.params && model.params.resolutions && model.params.resolutions[durationValue]) {
            resolutions = model.params.resolutions[durationValue];
        }
        
        const resolutionOptions = resolutions.map(r => ({ value: r, name: r }));
        this.initSimpleDropdown(this.videoResolutionWrapper, resolutionOptions, resolutions[0]);
    }
    
    initVideoOptions() {
        this.updateVideoDurationOptions(CONFIG.VIDEO_MODEL_NAME);
    }
    
    initImageRatios() {
        this.initSimpleDropdown(this.aspectRatioWrapper, IMAGE_RATIOS, '1:1', (value) => {
            CONFIG.ASPECT_RATIO = value;
        });
    }
    
    initVideoRatios() {
        this.initSimpleDropdown(this.videoRatioWrapper, VIDEO_RATIOS, '16:9', (value) => {
            CONFIG.VIDEO_RATIO = value;
        });
    }
    
    populateModelSelects() {
        // 重新获取 wrapper 元素（每次都重新获取，确保获取最新的）
        this.textModelNameWrapper = document.getElementById('textModelNameWrapper');
        this.imageModelNameWrapper = document.getElementById('imageModelNameWrapper');
        this.videoModelNameWrapper = document.getElementById('videoModelNameWrapper');
        
        const allModels = window.dynamicProviderManager ? window.dynamicProviderManager.getAllModels() : { text: TEXT_MODELS, image: IMAGE_MODELS, video: VIDEO_MODELS };
        
        this.populateMainCustomSelect(
            this.textModelNameWrapper, 
            allModels.text, 
            CONFIG.MODEL_NAME, CONFIG.MODEL_PROVIDER,
            CONFIG.MODEL_NAME, CONFIG.MODEL_PROVIDER,
            (value, provider) => {
                CONFIG.MODEL_NAME = value;
                CONFIG.MODEL_PROVIDER = provider;
            }
        );
        
        this.populateMainCustomSelect(
            this.imageModelNameWrapper, 
            allModels.image, 
            CONFIG.IMAGE_MODEL_NAME, CONFIG.IMAGE_MODEL_PROVIDER,
            CONFIG.IMAGE_MODEL_NAME, CONFIG.IMAGE_MODEL_PROVIDER,
            (value, provider) => {
                CONFIG.IMAGE_MODEL_NAME = value;
                CONFIG.IMAGE_MODEL_PROVIDER = provider;
                this.updateResolutionOptions();
            }
        );
        
        this.populateMainCustomSelect(
            this.videoModelNameWrapper, 
            allModels.video, 
            CONFIG.VIDEO_MODEL_NAME, CONFIG.VIDEO_MODEL_PROVIDER,
            CONFIG.VIDEO_MODEL_NAME, CONFIG.VIDEO_MODEL_PROVIDER,
            (value, provider) => {
                CONFIG.VIDEO_MODEL_NAME = value;
                CONFIG.VIDEO_MODEL_PROVIDER = provider;
            }
        );
        
        this.populateSettingsModelSelects();
    }
    
    populateMainCustomSelect(wrapper, models, defaultModelId, defaultProvider, currentModelId, currentProvider, onModelChange) {
        if (!wrapper) return;
        
        let dropdown = wrapper._fixedDropdown;
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'custom-select-dropdown-fixed';
            document.body.appendChild(dropdown);
            wrapper._fixedDropdown = dropdown;
        }
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const selectedText = trigger.querySelector('.selected-text');
        
        dropdown.innerHTML = '';
        
        const groups = {};
        let currentModel = null;
        
        models.forEach(model => {
            const groupName = model.group || 'Other';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(model);
            
            if (model.value === currentModelId && model.provider === currentProvider) {
                currentModel = model;
            }
        });
        
        Object.keys(groups).forEach(groupName => {
            if (!groups[groupName] || groups[groupName].length === 0) return;
            
            const groupLabel = document.createElement('div');
            groupLabel.className = 'custom-option-group';
            groupLabel.textContent = groupName;
            dropdown.appendChild(groupLabel);
            
            groups[groupName].forEach(model => {
                const option = document.createElement('div');
                option.className = 'custom-option';
                option.dataset.value = model.value;
                option.dataset.provider = model.provider;
                
                const isDefault = model.value === defaultModelId && model.provider === defaultProvider;
                const isCurrent = model.value === currentModelId && model.provider === currentProvider;
                
                if (isCurrent) {
                    option.classList.add('current');
                }
                
                const textSpan = document.createElement('span');
                textSpan.textContent = model.name;
                option.appendChild(textSpan);
                
                if (isDefault) {
                    const dot = document.createElement('span');
                    dot.className = 'default-dot';
                    dot.textContent = ' •';
                    option.appendChild(dot);
                }
                
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    dropdown.querySelectorAll('.custom-option').forEach(opt => {
                        opt.classList.remove('current');
                    });
                    
                    option.classList.add('current');
                    selectedText.textContent = model.name;
                    dropdown.classList.remove('open');
                    wrapper.classList.remove('open');
                    
                    if (onModelChange) {
                        onModelChange(model.value, model.provider);
                    }
                });
                
                dropdown.appendChild(option);
            });
        });
        
        if (currentModel) {
            selectedText.textContent = currentModel.name;
        }
        
        if (wrapper.dataset.listening) return;
        wrapper.dataset.listening = 'true';
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            
            document.querySelectorAll('.custom-select-dropdown-fixed.open').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });
            
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) {
                dropdown.classList.remove('open');
                wrapper.classList.remove('open');
            } else {
                const rect = trigger.getBoundingClientRect();
                dropdown.style.top = (rect.bottom + 4) + 'px';
                dropdown.style.left = rect.left + 'px';
                dropdown.style.width = rect.width + 'px';
                dropdown.classList.add('open');
                wrapper.classList.add('open');
            }
        });
    }
    
    populateSettingsModelSelects() {
        if (this._settingsSelectInitialized) return;
        this._settingsSelectInitialized = true;
        
        this.settingsDefaultTextModelWrapper = document.getElementById('settingsDefaultTextModelWrapper');
        this.settingsDefaultImageModelWrapper = document.getElementById('settingsDefaultImageModelWrapper');
        this.settingsDefaultVideoModelWrapper = document.getElementById('settingsDefaultVideoModelWrapper');
        
        const allModels = window.dynamicProviderManager ? window.dynamicProviderManager.getAllModels() : { text: TEXT_MODELS, image: IMAGE_MODELS, video: VIDEO_MODELS };
        
        this.populateCustomSelect(this.settingsDefaultTextModelWrapper, allModels.text, CONFIG.MODEL_NAME, CONFIG.MODEL_PROVIDER, 'MODEL_NAME', 'MODEL_PROVIDER');
        this.populateCustomSelect(this.settingsDefaultImageModelWrapper, allModels.image, CONFIG.IMAGE_MODEL_NAME, CONFIG.IMAGE_MODEL_PROVIDER, 'IMAGE_MODEL_NAME', 'IMAGE_MODEL_PROVIDER');
        this.populateCustomSelect(this.settingsDefaultVideoModelWrapper, allModels.video, CONFIG.VIDEO_MODEL_NAME, CONFIG.VIDEO_MODEL_PROVIDER, 'VIDEO_MODEL_NAME', 'VIDEO_MODEL_PROVIDER');
        
        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
                w.classList.remove('open');
            });
            document.querySelectorAll('.custom-select-dropdown-fixed.open').forEach(d => {
                d.classList.remove('open');
            });
        });
    }
    
    populateCustomSelect(wrapper, models, defaultModelId, defaultProvider, configKey, providerKey) {
        if (!wrapper) return;
        
        const dropdown = wrapper.querySelector('.custom-select-dropdown');
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const selectedText = trigger.querySelector('.selected-text');
        
        dropdown.innerHTML = '';
        
        const groups = {};
        let selectedModel = null;
        
        models.forEach(model => {
            const groupName = model.group || 'Other';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(model);
            
            if (model.value === defaultModelId && model.provider === defaultProvider) {
                selectedModel = model;
            }
        });
        
        Object.keys(groups).forEach(groupName => {
            if (!groups[groupName] || groups[groupName].length === 0) return;
            
            const groupLabel = document.createElement('div');
            groupLabel.className = 'custom-option-group';
            groupLabel.textContent = groupName;
            dropdown.appendChild(groupLabel);
            
            groups[groupName].forEach(model => {
                const option = document.createElement('div');
                option.className = 'custom-option';
                option.dataset.value = model.value;
                option.dataset.provider = model.provider;
                
                const isSelected = model.value === defaultModelId && model.provider === defaultProvider;
                if (isSelected) {
                    option.classList.add('selected');
                }
                
                const textSpan = document.createElement('span');
                textSpan.textContent = model.name;
                option.appendChild(textSpan);
                
                if (isSelected) {
                    const dot = document.createElement('span');
                    dot.className = 'default-dot';
                    dot.textContent = ' •';
                    option.appendChild(dot);
                }
                
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    dropdown.querySelectorAll('.custom-option').forEach(opt => {
                        opt.classList.remove('selected');
                        const dot = opt.querySelector('.default-dot');
                        if (dot) dot.remove();
                    });
                    
                    option.classList.add('selected');
                    const newDot = document.createElement('span');
                    newDot.className = 'default-dot';
                    newDot.textContent = ' •';
                    option.appendChild(newDot);
                    
                    selectedText.textContent = model.name;
                    wrapper.classList.remove('open');
                    
                    CONFIG[configKey] = model.value;
                    CONFIG[providerKey] = model.provider;
                    localStorage.setItem('GEMINI_' + configKey, model.value);
                    localStorage.setItem('GEMINI_' + providerKey, model.provider);
                    
                    if (window.dynamicProviderManager && typeof window.dynamicProviderManager.markDirty === 'function') {
                        window.dynamicProviderManager.markDirty();
                    }
                    
                    this.syncFromSettingsToModeSelects();
                });
                
                dropdown.appendChild(option);
            });
        });
        
        if (selectedModel) {
            selectedText.textContent = selectedModel.name;
        }
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });
            wrapper.classList.toggle('open');
        });
    }
    
    syncFromSettingsToModeSelects() {
        if (this.isSyncingModels) return;
        this.isSyncingModels = true;

        const allModels = window.dynamicProviderManager ? window.dynamicProviderManager.getAllModels() : { text: TEXT_MODELS, image: IMAGE_MODELS, video: VIDEO_MODELS };
        
        this.updateMainCustomSelectCurrent(this.textModelNameWrapper, CONFIG.MODEL_NAME, CONFIG.MODEL_PROVIDER, allModels.text);
        this.updateMainCustomSelectCurrent(this.imageModelNameWrapper, CONFIG.IMAGE_MODEL_NAME, CONFIG.IMAGE_MODEL_PROVIDER, allModels.image);
        this.updateMainCustomSelectCurrent(this.videoModelNameWrapper, CONFIG.VIDEO_MODEL_NAME, CONFIG.VIDEO_MODEL_PROVIDER, allModels.video);

        this.isSyncingModels = false;
    }
    
    syncFromModeToSettingsSelects() {
        if (this.isSyncingModels) return;
        this.isSyncingModels = true;
        
        this.settingsDefaultTextModelWrapper = document.getElementById('settingsDefaultTextModelWrapper');
        this.settingsDefaultImageModelWrapper = document.getElementById('settingsDefaultImageModelWrapper');
        this.settingsDefaultVideoModelWrapper = document.getElementById('settingsDefaultVideoModelWrapper');
        
        const allModels = window.dynamicProviderManager ? window.dynamicProviderManager.getAllModels() : { text: TEXT_MODELS, image: IMAGE_MODELS, video: VIDEO_MODELS };
        
        this.updateCustomSelect(this.settingsDefaultTextModelWrapper, CONFIG.MODEL_NAME, CONFIG.MODEL_PROVIDER, allModels.text);
        this.updateCustomSelect(this.settingsDefaultImageModelWrapper, CONFIG.IMAGE_MODEL_NAME, CONFIG.IMAGE_MODEL_PROVIDER, allModels.image);
        this.updateCustomSelect(this.settingsDefaultVideoModelWrapper, CONFIG.VIDEO_MODEL_NAME, CONFIG.VIDEO_MODEL_PROVIDER, allModels.video);

        this.isSyncingModels = false;
    }
    
    updateMainCustomSelectCurrent(wrapper, value, provider, models) {
        if (!wrapper) return;
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const selectedText = trigger.querySelector('.selected-text');
        const dropdown = wrapper._fixedDropdown;
        
        const model = models.find(m => m.value === value && m.provider === provider);
        if (model) {
            selectedText.textContent = model.name;
            
            dropdown.querySelectorAll('.custom-option').forEach(opt => {
                opt.classList.toggle('current', opt.dataset.value === value && opt.dataset.provider === provider);
            });
        }
    }
    
    updateCustomSelect(wrapper, value, provider, models) {
        if (!wrapper) return;
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const selectedText = trigger.querySelector('.selected-text');
        const dropdown = wrapper.querySelector('.custom-select-dropdown');
        
        const model = models.find(m => m.value === value && m.provider === provider);
        if (model) {
            selectedText.textContent = model.name;
            
            dropdown.querySelectorAll('.custom-option').forEach(opt => {
                const isSelected = opt.dataset.value === value && opt.dataset.provider === provider;
                opt.classList.toggle('selected', isSelected);
                
                let dot = opt.querySelector('.default-dot');
                if (isSelected && !dot) {
                    dot = document.createElement('span');
                    dot.className = 'default-dot';
                    dot.textContent = ' •';
                    opt.appendChild(dot);
                } else if (!isSelected && dot) {
                    dot.remove();
                }
            });
        }
    }
}
