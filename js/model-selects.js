// 模型选择相关逻辑
import { CONFIG, TEXT_MODELS, IMAGE_MODELS, VIDEO_MODELS, AUDIO_MODELS, VIDEO_RATIOS, IMAGE_RATIOS, IMAGE_SIZES, AUDIO_DURATIONS, AUDIO_FORMATS } from "../config.js";

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
        this.audioModelNameWrapper = document.getElementById('audioModelNameWrapper');
        this.audioDurationWrapper = document.getElementById('audioDurationWrapper');
        this.audioFormatWrapper = document.getElementById('audioFormatWrapper');

        this.isSyncingModels = false;

        this.init();
        this._bindGlobalClick();
    }

    _bindGlobalClick() {
        if (window._modelSelectGlobalClickBound) return;
        window._modelSelectGlobalClickBound = true;

        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
                w.classList.remove('open');
            });
            document.querySelectorAll('.custom-select-dropdown.open').forEach(d => {
                d.classList.remove('open');
            });
        });
    }

    refreshModelSelects() {
        this.populateModelSelects();
    }

    init() {
        this.populateModelSelects();
        this.updateResolutionOptions();
        this.initVideoOptions();
        this.initAudioOptions();
        this.initImageRatios();
        this.initVideoRatios();
    }

    /**
     * 私有方法：根据屏幕空间智能定位下拉菜单
     */
    _repositionDropdown(trigger, dropdown) {
        const rect = trigger.getBoundingClientRect();
        const dropdownHeight = 220; 
        const spaceBelow = window.innerHeight - rect.bottom;
        
        // Vertical positioning
        if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
            dropdown.style.top = 'auto';
            dropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
        } else {
            dropdown.style.top = (rect.bottom + 4) + 'px';
            dropdown.style.bottom = 'auto';
        }
        
        // Robust grid detection: check class OR inner content
        const isGrid = dropdown.classList.contains('ratio-grid-dropdown') || dropdown.querySelector('.ratio-grid');
        const dropdownWidth = isGrid ? 344 : rect.width;
        
        // Horizontal positioning with edge detection
        let left = rect.left;
        const screenWidth = window.innerWidth;
        if (left + dropdownWidth > screenWidth - 80) {
            // Shift left further for a more balanced layout (avoid being too close to right edge)
            left = Math.max(20, screenWidth - dropdownWidth - 80);
        }

        dropdown.style.left = left + 'px';
        
        // Apply final width
        if (isGrid) {
            dropdown.style.width = '344px';
            dropdown.style.minWidth = '344px';
        } else {
            dropdown.style.width = rect.width + 'px';
            dropdown.style.minWidth = 'auto';
        }
    }

    /**
     * 初始化/创建简单的自定义下拉框
     */
    initSimpleDropdown(wrapper, options, defaultKey, onSelect) {
        if (!wrapper) return;

        const trigger = wrapper.querySelector('.custom-select-trigger');
        const selectedText = trigger.querySelector('.selected-text');

        let dropdown = wrapper._fixedDropdown;
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'custom-select-dropdown';
            dropdown.id = wrapper.id + '-dropdown'; // 统一由 wrapper ID 派生
            document.body.appendChild(dropdown);
            wrapper._fixedDropdown = dropdown;
            dropdown._ownerWrapper = wrapper; // 绑定回溯
        }

        this._renderDropdownContent(dropdown, options, onSelect);

        const defaultValue = options.find(opt => (typeof opt === 'string' ? opt : opt.value) === defaultKey) || options[0];
        if (defaultValue) {
            const val = typeof defaultValue === 'string' ? defaultValue : defaultValue.value;
            const name = typeof defaultValue === 'string' ? defaultValue : defaultValue.name;
            wrapper.dataset.value = val;
            selectedText.textContent = name;
        }

        if (wrapper.dataset.listening) return;
        wrapper.dataset.listening = 'true';

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');
            
            // 关闭其它
            document.querySelectorAll('.custom-select-dropdown.open').forEach(d => d.classList.remove('open'));
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));

            if (!isOpen) {
                this._repositionDropdown(trigger, dropdown);
                dropdown.classList.add('open');
                wrapper.classList.add('open');
            }
        });
    }

    /**
     * 内部方法：渲染下拉内容
     */
    _renderDropdownContent(dropdown, options, onSelect) {
        const wrapper = dropdown._ownerWrapper;
        const selectedText = wrapper ? wrapper.querySelector('.selected-text') : null;

        dropdown.innerHTML = '';
        options.forEach(opt => {
            const value = typeof opt === 'string' ? opt : opt.value;
            const name = typeof opt === 'string' ? opt : opt.name;

            const option = document.createElement('div');
            option.className = 'custom-option';
            option.dataset.value = value;
            option.textContent = name;
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                if (selectedText) selectedText.textContent = name;
                if (wrapper) wrapper.dataset.value = value;
                dropdown.classList.remove('open');
                if (wrapper) wrapper.classList.remove('open');
                if (onSelect) onSelect(value);
            });
            dropdown.appendChild(option);
        });
    }

    /**
     * 对外暴露的动态填充方法
     */
    populateDropdown(wrapper, options, onSelect) {
        if (!wrapper || !wrapper._fixedDropdown) return;
        this._renderDropdownContent(wrapper._fixedDropdown, options, onSelect);
    }

    updateResolutionOptions() {
        const selectedModel = CONFIG.IMAGE_MODEL_NAME;
        const isFirstGroup = selectedModel.includes('3.1-flash-image-preview');

        const filteredRatios = IMAGE_RATIOS.filter(ratio =>
            isFirstGroup || !['8:1', '4:1', '1:4', '1:8'].includes(ratio.value)
        );
        this.initSimpleDropdown(this.aspectRatioWrapper, filteredRatios, CONFIG.ASPECT_RATIO, (value) => {
            CONFIG.ASPECT_RATIO = value;
        });

        const filteredSizes = IMAGE_SIZES.filter(size =>
            isFirstGroup || size.value !== '512px'
        );
        this.initSimpleDropdown(this.imageSizeWrapper, filteredSizes, CONFIG.IMAGE_SIZE, (value) => {
            CONFIG.IMAGE_SIZE = value;
        });
    }

    updateVideoDurationOptions(modelValue) {
        let model = null;
        if (window.dynamicProviderManager) {
            const allModels = window.dynamicProviderManager.getAllModels();
            model = (allModels.video || []).find(m => m.value === modelValue);
        }
        
        const configModel = VIDEO_MODELS.find(m => m.value === modelValue);
        if (configModel && configModel.params) {
            model = { ...model, params: configModel.params };
        } else if (!model) {
            model = configModel;
        }

        let durations = ['4', '6', '8'];
        if (model && model.params && model.params.durations) {
            durations = model.params.durations;
        }

        const durationOptions = durations.map(d => ({ value: d, name: d + ' 秒' }));
        
        // --- 核心重用逻辑 ---
        if (!this.videoDurationWrapper._fixedDropdown) {
            this.initSimpleDropdown(this.videoDurationWrapper, durationOptions, durations[0], (value) => {
                CONFIG.VIDEO_DURATION = value;
                this.updateVideoResolutionOptions(modelValue, value);
            });
        } else {
            this.populateDropdown(this.videoDurationWrapper, durationOptions, (value) => {
                CONFIG.VIDEO_DURATION = value;
                this.updateVideoResolutionOptions(modelValue, value);
            });
        }

        let resolutions = ['480p', '720p', '1080p', '4k'];
        if (model && model.params && model.params.resolutions) {
            resolutions = Array.isArray(model.params.resolutions) ? model.params.resolutions : (model.params.resolutions[durations[0]] || resolutions);
        }

        const resolutionOptions = resolutions.map(r => ({ value: r, name: r }));
        this.updateVideoResolutionOptions(modelValue, durations[0]);
        
        // 智能保持选中值
        const currentDuration = this.videoDurationWrapper.dataset.value;
        if (!durations.includes(currentDuration)) {
            const defaultDuration = durations.includes("5") ? "5" : durations[0];
            this.videoDurationWrapper.dataset.value = defaultDuration;
            this.videoDurationWrapper.querySelector('.selected-text').textContent = defaultDuration + ' 秒';
            CONFIG.VIDEO_DURATION = defaultDuration;
        }

        const currentResolution = this.videoResolutionWrapper.dataset.value;
        if (!resolutions.includes(currentResolution)) {
            const defaultRes = resolutions.includes("720p") ? "720p" : resolutions[0];
            this.videoResolutionWrapper.dataset.value = defaultRes;
            this.videoResolutionWrapper.querySelector('.selected-text').textContent = defaultRes;
            CONFIG.VIDEO_RESOLUTION = defaultRes;
        }
    }

    updateVideoResolutionOptions(modelValue, durationValue) {
        let model = null;
        if (window.dynamicProviderManager) {
            const allModels = window.dynamicProviderManager.getAllModels();
            model = (allModels.video || []).find(m => m.value === modelValue);
        }

        const configModel = VIDEO_MODELS.find(m => m.value === modelValue);
        if (configModel && configModel.params) {
            model = { ...model, params: configModel.params };
        } else if (!model) {
            model = configModel;
        }

        let resolutions = ['480p', '720p', '1080p', '4k'];
        if (model && model.params && model.params.resolutions) {
            if (Array.isArray(model.params.resolutions)) {
                resolutions = model.params.resolutions;
            } else if (model.params.resolutions[durationValue]) {
                resolutions = model.params.resolutions[durationValue];
            }
        }

        const resolutionOptions = resolutions.map(r => ({ value: r, name: r }));
        if (!this.videoResolutionWrapper._fixedDropdown) {
             this.initSimpleDropdown(this.videoResolutionWrapper, resolutionOptions, resolutions[0], (value) => {
                CONFIG.VIDEO_RESOLUTION = value;
            });
        } else {
             this.populateDropdown(this.videoResolutionWrapper, resolutionOptions, (value) => {
                CONFIG.VIDEO_RESOLUTION = value;
            });
        }
    }

    initVideoOptions() {
        this.updateVideoDurationOptions(CONFIG.VIDEO_MODEL_NAME);
    }

    initImageRatios() {
        this.initRatioGridPicker(
            this.aspectRatioWrapper,
            IMAGE_RATIOS,
            '1:1',
            (value) => { CONFIG.ASPECT_RATIO = value; }
        );
    }

    /**
     * Visual ratio grid picker - replaces the standard text dropdown
     */
    initRatioGridPicker(wrapper, options, defaultKey, onSelect) {
        if (!wrapper) return;

        const trigger = wrapper.querySelector('.custom-select-trigger');
        const selectedText = trigger.querySelector('.selected-text');

        let dropdown = wrapper._fixedDropdown;
        if (!dropdown) {
            dropdown = document.createElement('div');
            const isVideo = wrapper.id === 'videoRatioWrapper';
            dropdown.className = `custom-select-dropdown ratio-grid-dropdown ${isVideo ? 'video-grid' : ''}`;
            dropdown.id = wrapper.id + '-dropdown';
            document.body.appendChild(dropdown);
            wrapper._fixedDropdown = dropdown;
            dropdown._ownerWrapper = wrapper;
        }

        this._renderRatioGrid(dropdown, options, defaultKey, onSelect, wrapper, selectedText);

        const defaultOpt = options.find(o => o.value === defaultKey) || options[0];
        if (defaultOpt) {
            wrapper.dataset.value = defaultOpt.value;
            selectedText.textContent = defaultOpt.value;
        }

        if (wrapper.dataset.listening) return;
        wrapper.dataset.listening = 'true';

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');
            document.querySelectorAll('.custom-select-dropdown.open').forEach(d => d.classList.remove('open'));
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
            if (!isOpen) {
                this._repositionDropdown(trigger, dropdown);
                dropdown.classList.add('open');
                wrapper.classList.add('open');
            }
        });
    }

    _renderRatioGrid(dropdown, options, selectedValue, onSelect, wrapper, selectedText) {
        dropdown.innerHTML = '<div class="ratio-grid"></div>';
        const grid = dropdown.querySelector('.ratio-grid');
        
        options.forEach(({ label, value }) => {
            const parts = value.split(':').map(Number);
            const w = parts[0] || 1;
            const h = parts[1] || 1;

            const cell = document.createElement('div');
            cell.className = 'ratio-grid-cell';
            if (value === selectedValue) cell.classList.add('selected');
            cell.dataset.value = value;

            // Scale the preview icon proportionally within a 18x18 container
            const maxDim = 18;
            let pxW, pxH;
            if (w >= h) { pxW = maxDim; pxH = Math.round(maxDim * h / w); }
            else        { pxH = maxDim; pxW = Math.round(maxDim * w / h); }
            pxW = Math.max(pxW, 4);
            pxH = Math.max(pxH, 4);

            const icon = document.createElement('div');
            icon.className = 'ratio-icon';
            icon.style.width  = pxW + 'px';
            icon.style.height = pxH + 'px';

            const labelEl = document.createElement('div');
            labelEl.className = 'ratio-label';
            labelEl.textContent = value;

            cell.appendChild(icon);
            cell.appendChild(labelEl);

            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.querySelectorAll('.ratio-grid-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                if (wrapper)  wrapper.dataset.value = value;
                if (selectedText) selectedText.textContent = value;
                dropdown.classList.remove('open');
                if (wrapper) wrapper.classList.remove('open');
                if (onSelect) onSelect(value);
            });

            grid.appendChild(cell);
        });

        dropdown.appendChild(grid);
    }


    initVideoRatios() {
        this.initRatioGridPicker(this.videoRatioWrapper, VIDEO_RATIOS, '16:9', (value) => {
            CONFIG.VIDEO_RATIO = value;
        });
    }

    initAudioOptions() {
        this.updateAudioOptions(CONFIG.AUDIO_MODEL_NAME);
    }

    updateAudioOptions(modelValue) {
        let model = null;
        if (window.dynamicProviderManager) {
            const allModels = window.dynamicProviderManager.getAllModels();
            model = (allModels.audio || []).find(m => m.value === modelValue);
        }
        if (!model && typeof AUDIO_MODELS !== 'undefined') {
            model = AUDIO_MODELS.find(m => m.value === modelValue);
        }

        let durations = ['15', '30', '60'];
        let formats = ['mp3', 'wav'];

        if (model && model.params) {
            if (model.params.durations) durations = model.params.durations;
            if (model.params.formats) formats = model.params.formats;
        }

        const durationOptions = durations.map(d => ({ value: d, name: d + ' 秒' }));
        this.initSimpleDropdown(this.audioDurationWrapper, durationOptions, durations[0], (value) => {
            CONFIG.AUDIO_DURATION = value;
        });

        const formatOptions = formats.map(f => ({ value: f, name: f.toUpperCase() }));
        this.initSimpleDropdown(this.audioFormatWrapper, formatOptions, formats[0], (value) => {
            CONFIG.AUDIO_FORMAT = value;
        });

        CONFIG.AUDIO_DURATION = durations[0];
        CONFIG.AUDIO_FORMAT = formats[0];
    }

    populateModelSelects() {
        this.textModelNameWrapper = document.getElementById('textModelNameWrapper');
        this.imageModelNameWrapper = document.getElementById('imageModelNameWrapper');
        this.videoModelNameWrapper = document.getElementById('videoModelNameWrapper');
        this.audioModelNameWrapper = document.getElementById('audioModelNameWrapper');

        const allModels = window.dynamicProviderManager ? window.dynamicProviderManager.getAllModels() : { text: TEXT_MODELS, image: IMAGE_MODELS, video: VIDEO_MODELS, audio: AUDIO_MODELS };

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
                this.updateReferenceMode(value, provider);
                this.updateVideoDurationOptions(value);
            }
        );

        this.populateMainCustomSelect(
            this.audioModelNameWrapper,
            allModels.audio,
            CONFIG.AUDIO_MODEL_NAME, CONFIG.AUDIO_MODEL_PROVIDER,
            CONFIG.AUDIO_MODEL_NAME, CONFIG.AUDIO_MODEL_PROVIDER,
            (value, provider) => {
                CONFIG.AUDIO_MODEL_NAME = value;
                CONFIG.AUDIO_MODEL_PROVIDER = provider;
                this.updateAudioOptions(value);
            }
        );
    }

    updateReferenceMode(modelValue, providerId) {
        if (window.currentMode !== 'video') return;

        let model = null;
        if (window.dynamicProviderManager) {
            const allModels = window.dynamicProviderManager.getAllModels();
            model = (allModels.video || []).find(m => m.value === modelValue && m.provider === providerId);
        }
        if (!model) {
            model = VIDEO_MODELS.find(m => m.value === modelValue && m.provider === providerId);
        }

        if (model && model.params && model.params.referenceModes) {
            const modes = model.params.referenceModes;
            if (!modes.includes(window.referenceManager?.currentMode)) {
                window.referenceManager?.setMode(modes[0]);
            }
        } else {
            window.referenceManager?.setMode('omni');
        }
    }

    populateMainCustomSelect(wrapper, models, defaultModelId, defaultProvider, currentModelId, currentProvider, onModelChange) {
        if (!wrapper || !models) return;

        let dropdown = wrapper._fixedDropdown;
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'custom-select-dropdown';
            document.body.appendChild(dropdown);
            wrapper._fixedDropdown = dropdown;
            dropdown._ownerWrapper = wrapper;
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

            document.querySelectorAll('.custom-select-dropdown.open').forEach(d => {
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
                this._repositionDropdown(trigger, dropdown);
                dropdown.classList.add('open');
                wrapper.classList.add('open');
            }
        });
    }

    populateSettingsModelSelects() {
        this.settingsDefaultTextModelWrapper = document.getElementById('settingsDefaultTextModelWrapper');
        this.settingsDefaultImageModelWrapper = document.getElementById('settingsDefaultImageModelWrapper');
        this.settingsDefaultVideoModelWrapper = document.getElementById('settingsDefaultVideoModelWrapper');
        this.settingsDefaultAudioModelWrapper = document.getElementById('settingsDefaultAudioModelWrapper');

        const allModels = window.dynamicProviderManager ? window.dynamicProviderManager.getAllModels() : { text: TEXT_MODELS, image: IMAGE_MODELS, video: VIDEO_MODELS, audio: AUDIO_MODELS };

        this.populateCustomSelect(this.settingsDefaultTextModelWrapper, allModels.text, CONFIG.MODEL_NAME, CONFIG.MODEL_PROVIDER, 'MODEL_NAME', 'MODEL_PROVIDER');
        this.populateCustomSelect(this.settingsDefaultImageModelWrapper, allModels.image, CONFIG.IMAGE_MODEL_NAME, CONFIG.IMAGE_MODEL_PROVIDER, 'IMAGE_MODEL_NAME', 'IMAGE_MODEL_PROVIDER');
        this.populateCustomSelect(this.settingsDefaultVideoModelWrapper, allModels.video, CONFIG.VIDEO_MODEL_NAME, CONFIG.VIDEO_MODEL_PROVIDER, 'VIDEO_MODEL_NAME', 'VIDEO_MODEL_PROVIDER');
        this.populateCustomSelect(this.settingsDefaultAudioModelWrapper, allModels.audio, CONFIG.AUDIO_MODEL_NAME, CONFIG.AUDIO_MODEL_PROVIDER, 'AUDIO_MODEL_NAME', 'AUDIO_MODEL_PROVIDER');
    }

    populateCustomSelect(wrapper, models, defaultModelId, defaultProvider, configKey, providerKey) {
        if (!wrapper || !models) return;

        let dropdown = wrapper._fixedDropdown;
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'custom-select-dropdown';
            document.body.appendChild(dropdown);
            wrapper._fixedDropdown = dropdown;
            dropdown._ownerWrapper = wrapper;
        }
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
                    dropdown.classList.remove('open');
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

        if (wrapper.dataset.listening) return;
        wrapper.dataset.listening = 'true';

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();

            document.querySelectorAll('.custom-select-dropdown.open').forEach(d => {
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
                this._repositionDropdown(trigger, dropdown);
                dropdown.classList.add('open');
                wrapper.classList.add('open');
            }
        });
    }

    syncFromSettingsToModeSelects() {
        if (this.isSyncingModels) return;
        this.isSyncingModels = true;

        const allModels = window.dynamicProviderManager ? window.dynamicProviderManager.getAllModels() : { text: TEXT_MODELS, image: IMAGE_MODELS, video: VIDEO_MODELS, audio: AUDIO_MODELS };

        this.updateMainCustomSelectCurrent(this.textModelNameWrapper, CONFIG.MODEL_NAME, CONFIG.MODEL_PROVIDER, allModels.text);
        this.updateMainCustomSelectCurrent(this.imageModelNameWrapper, CONFIG.IMAGE_MODEL_NAME, CONFIG.IMAGE_MODEL_PROVIDER, allModels.image);
        this.updateMainCustomSelectCurrent(this.videoModelNameWrapper, CONFIG.VIDEO_MODEL_NAME, CONFIG.VIDEO_MODEL_PROVIDER, allModels.video);
        this.updateMainCustomSelectCurrent(this.audioModelNameWrapper, CONFIG.AUDIO_MODEL_NAME, CONFIG.AUDIO_MODEL_PROVIDER, allModels.audio);
        this.isSyncingModels = false;
    }

    syncFromModeToSettingsSelects() {
        if (this.isSyncingModels) return;
        this.isSyncingModels = true;

        this.settingsDefaultTextModelWrapper = document.getElementById('settingsDefaultTextModelWrapper');
        this.settingsDefaultImageModelWrapper = document.getElementById('settingsDefaultImageModelWrapper');
        this.settingsDefaultVideoModelWrapper = document.getElementById('settingsDefaultVideoModelWrapper');
        this.settingsDefaultAudioModelWrapper = document.getElementById('settingsDefaultAudioModelWrapper');

        const allModels = window.dynamicProviderManager ? window.dynamicProviderManager.getAllModels() : { text: TEXT_MODELS, image: IMAGE_MODELS, video: VIDEO_MODELS, audio: AUDIO_MODELS };

        this.updateCustomSelect(this.settingsDefaultTextModelWrapper, CONFIG.MODEL_NAME, CONFIG.MODEL_PROVIDER, allModels.text);
        this.updateCustomSelect(this.settingsDefaultImageModelWrapper, CONFIG.IMAGE_MODEL_NAME, CONFIG.IMAGE_MODEL_PROVIDER, allModels.image);
        this.updateCustomSelect(this.settingsDefaultVideoModelWrapper, CONFIG.VIDEO_MODEL_NAME, CONFIG.VIDEO_MODEL_PROVIDER, allModels.video);
        this.updateCustomSelect(this.settingsDefaultAudioModelWrapper, CONFIG.AUDIO_MODEL_NAME, CONFIG.AUDIO_MODEL_PROVIDER, allModels.audio);
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

            if (dropdown) {
                dropdown.querySelectorAll('.custom-option').forEach(opt => {
                    opt.classList.toggle('current', opt.dataset.value === value && opt.dataset.provider === provider);
                });
            }
        }
    }

    updateCustomSelect(wrapper, value, provider, models) {
        if (!wrapper) return;
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const selectedText = trigger.querySelector('.selected-text');
        const dropdown = wrapper._fixedDropdown;

        if (!dropdown) return;

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
