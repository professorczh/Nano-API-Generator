// 模型选择相关逻辑

import { CONFIG, TEXT_MODELS, IMAGE_MODELS, VIDEO_MODELS, VIDEO_RATIOS, IMAGE_RATIOS, IMAGE_SIZES } from "../config.js";

export class ModelSelectManager {
    constructor() {
        this.textModelNameWrapper = document.getElementById('textModelNameWrapper');
        this.imageModelNameWrapper = document.getElementById('imageModelNameWrapper');
        this.videoModelNameWrapper = document.getElementById('videoModelNameWrapper');
        this.aspectRatio = document.getElementById('aspectRatio');
        this.imageSize = document.getElementById('imageSize');
        this.videoDurationSelect = document.getElementById('videoDurationSelect');
        this.videoResolutionSelect = document.getElementById('videoResolutionSelect');
        this.videoRatioSelect = document.getElementById('videoRatioSelect');
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
    
    updateResolutionOptions() {
        const selectedModel = CONFIG.IMAGE_MODEL_NAME;
        const isFirstGroup = selectedModel.includes('3.1-flash-image-preview');
        
        const imageRatioSelect = document.getElementById('aspectRatio');
        if (imageRatioSelect) {
            imageRatioSelect.innerHTML = '';
            
            IMAGE_RATIOS.forEach(ratio => {
                if (isFirstGroup || !['8:1', '4:1', '1:4', '1:8'].includes(ratio.value)) {
                    const option = document.createElement('option');
                    option.value = ratio.value;
                    option.textContent = ratio.name;
                    imageRatioSelect.appendChild(option);
                }
            });
        }
        
        const imageSizeSelect = document.getElementById('imageSize');
        if (imageSizeSelect) {
            imageSizeSelect.innerHTML = '';
            
            IMAGE_SIZES.forEach(size => {
                if (isFirstGroup || size.value !== '512px') {
                    const option = document.createElement('option');
                    option.value = size.value;
                    option.textContent = size.name;
                    imageSizeSelect.appendChild(option);
                }
            });
            
            imageSizeSelect.value = '1K';
        }
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
        
        if (model && model.params && model.params.durations) {
            this.videoDurationSelect.innerHTML = '';
            model.params.durations.forEach(duration => {
                const option = document.createElement('option');
                option.value = duration;
                option.textContent = duration + ' 秒';
                this.videoDurationSelect.appendChild(option);
            });
            this.videoDurationSelect.value = model.params.durations[0];
            this.updateVideoResolutionOptions(modelValue, model.params.durations[0]);
        } else {
            this.videoDurationSelect.innerHTML = '';
            ['4', '6', '8'].forEach(duration => {
                const option = document.createElement('option');
                option.value = duration;
                option.textContent = duration + ' 秒';
                if (duration === '6') option.selected = true;
                this.videoDurationSelect.appendChild(option);
            });
            this.videoResolutionSelect.innerHTML = '';
            ['720p', '1080p', '4k'].forEach(res => {
                const option = document.createElement('option');
                option.value = res;
                option.textContent = res;
                this.videoResolutionSelect.appendChild(option);
            });
        }
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
        
        if (model && model.params && model.params.resolutions && model.params.resolutions[durationValue]) {
            const resolutions = model.params.resolutions[durationValue];
            this.videoResolutionSelect.innerHTML = '';
            resolutions.forEach(res => {
                const option = document.createElement('option');
                option.value = res;
                option.textContent = res;
                this.videoResolutionSelect.appendChild(option);
            });
            this.videoResolutionSelect.value = resolutions[0];
        } else if (model && model.params && Object.keys(model.params.resolutions).length === 0) {
            this.videoResolutionSelect.innerHTML = '';
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '不支持指定';
            option.disabled = true;
            this.videoResolutionSelect.appendChild(option);
        } else {
            this.videoResolutionSelect.innerHTML = '';
            ['720p', '1080p', '4k'].forEach(res => {
                const option = document.createElement('option');
                option.value = res;
                option.textContent = res;
                this.videoResolutionSelect.appendChild(option);
            });
        }
    }
    
    initVideoOptions() {
        this.updateVideoDurationOptions(CONFIG.VIDEO_MODEL_NAME);
        
        if (this.videoDurationSelect) {
            this.videoDurationSelect.addEventListener('change', () => {
                this.updateVideoResolutionOptions(CONFIG.VIDEO_MODEL_NAME, this.videoDurationSelect.value);
            });
        }
    }
    
    initImageRatios() {
        if (this.aspectRatio) {
            IMAGE_RATIOS.forEach(ratio => {
                const option = document.createElement('option');
                option.value = ratio.value;
                option.textContent = ratio.name;
                if (ratio.value === '1:1') {
                    option.selected = true;
                }
                this.aspectRatio.appendChild(option);
            });
        }
    }
    
    initVideoRatios() {
        if (this.videoRatioSelect) {
            this.videoRatioSelect.innerHTML = '';
            VIDEO_RATIOS.forEach(ratio => {
                const option = document.createElement('option');
                option.value = ratio.value;
                option.textContent = ratio.name;
                if (ratio.value === '16:9') {
                    option.selected = true;
                }
                this.videoRatioSelect.appendChild(option);
            });
        }
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
                    dropdown.style.display = 'none';
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
            
            document.querySelectorAll('.custom-select-dropdown-fixed').forEach(d => {
                if (d !== dropdown) d.style.display = 'none';
            });
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });
            
            const isOpen = dropdown.style.display === 'block';
            if (isOpen) {
                dropdown.style.display = 'none';
                wrapper.classList.remove('open');
            } else {
                const rect = trigger.getBoundingClientRect();
                dropdown.style.top = (rect.bottom + 4) + 'px';
                dropdown.style.left = rect.left + 'px';
                dropdown.style.width = rect.width + 'px';
                dropdown.style.display = 'block';
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
            document.querySelectorAll('.custom-select-dropdown-fixed').forEach(d => {
                d.style.display = 'none';
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
