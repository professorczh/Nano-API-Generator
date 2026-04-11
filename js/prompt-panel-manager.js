
import { AppState, CanvasState } from './app-state.js';
import { referenceManager } from './reference-manager.js';
import { CONFIG } from '../config.js';

class PromptPanelManager {
    constructor() {
        this.draft = null;
        this.elements = {};
        this.isSwapping = false;
        // 内存中存储节点的完整状态（包含 File 对象）
        this.nodeSnapshots = new Map();
    }

    init(elements) {
        this.elements = elements;
        console.log('%c[PromptPanelManager] 状态管理器已启动', 'color: #3b82f6; font-weight: bold');
    }

    /**
     * 捕获当前 UI 面板的所有参数
     */
    captureState() {
        const el = this.elements;
        return {
            prompt: el.promptInput.innerHTML,
            mode: CanvasState.currentMode,
            modelName: this._getCurrentModelName(),
            modelProvider: this._getCurrentModelProvider(),
            temperature: el.temperature.value,
            topP: el.topP.value,
            // 模式特定参数
            imageConfig: {
                aspectRatio: el.aspectRatioWrapper?.dataset.value,
                imageSize: el.imageSizeWrapper?.dataset.value
            },
            videoConfig: {
                videoRatio: el.videoRatioWrapper?.dataset.value,
                videoResolution: el.videoResolutionWrapper?.dataset.value,
                videoDuration: el.videoDurationWrapper?.dataset.value
            },
            audioConfig: {
                audioDuration: el.audioDurationWrapper?.dataset.value,
                audioFormat: el.audioFormatWrapper?.dataset.value
            },
            // 参考内容 (直接保留原始对象引用，包含 File 和 Blob URL)
            references: [...referenceManager.getAllReferences()]
        };
    }

    _getCurrentModelName() {
        const mode = CanvasState.currentMode;
        if (mode === 'image') return CONFIG.IMAGE_MODEL_NAME;
        if (mode === 'text') return CONFIG.MODEL_NAME;
        if (mode === 'audio') return CONFIG.AUDIO_MODEL_NAME;
        return CONFIG.VIDEO_MODEL_NAME;
    }

    _getCurrentModelProvider() {
        const mode = CanvasState.currentMode;
        if (mode === 'image') return CONFIG.IMAGE_MODEL_PROVIDER;
        if (mode === 'text') return CONFIG.MODEL_PROVIDER;
        if (mode === 'audio') return CONFIG.AUDIO_MODEL_PROVIDER;
        return CONFIG.VIDEO_MODEL_PROVIDER;
    }

    /**
     * 将状态应用到 UI 面板
     */
    async applyState(state) {
        if (!state) return;
        this.isSwapping = true;
        const el = this.elements;

        try {
            // 1. 恢复模式 (触发 Tab 点击)
            if (state.mode && state.mode !== CanvasState.currentMode) {
                // 根据模式找到对应的 Tab 按钮 ID
                let tabId = 'tabImage';
                if (state.mode === 'text') tabId = 'tabText';
                else if (state.mode === 'video') tabId = 'tabVideo';
                else if (state.mode === 'audio') tabId = 'tabAudio';
                
                const modeBtn = document.getElementById(tabId);
                if (modeBtn) modeBtn.click();
            }

            // 2. 恢复提示词
            el.promptInput.innerHTML = state.prompt || '';

            // 3. 恢复基础参数
            if (state.temperature !== undefined) el.temperature.value = state.temperature;
            if (state.topP !== undefined) el.topP.value = state.topP;

            // 4. 恢复模型选择 (需要配合 ModelSelectManager)
            this._applyModelSelection(state);

            // 5. 恢复模式特定参数
            this._applyModeConfigs(state);

            // 6. 恢复参考内容
            this._applyReferences(state.references || []);

        } catch (error) {
            console.error('[PromptPanelManager] 恢复状态失败:', error);
        } finally {
            this.isSwapping = false;
        }
    }

    _applyModelSelection(state) {
        if (!state.modelName || !state.modelProvider) return;
        
        // 更新全局配置
        const mode = state.mode;
        if (mode === 'image') {
            CONFIG.IMAGE_MODEL_NAME = state.modelName;
            CONFIG.IMAGE_MODEL_PROVIDER = state.modelProvider;
        } else if (mode === 'text') {
            CONFIG.MODEL_NAME = state.modelName;
            CONFIG.MODEL_PROVIDER = state.modelProvider;
        } else if (mode === 'audio') {
            CONFIG.AUDIO_MODEL_NAME = state.modelName;
            CONFIG.AUDIO_MODEL_PROVIDER = state.modelProvider;
        } else {
            CONFIG.VIDEO_MODEL_NAME = state.modelName;
            CONFIG.VIDEO_MODEL_PROVIDER = state.modelProvider;
        }

        // 通知 UI 更新下拉框显示
        if (window.modelSelectManager) {
            window.modelSelectManager.syncFromSettingsToModeSelects();
        }
    }

    _applyModeConfigs(state) {
        const el = this.elements;
        if (state.mode === 'image' && state.imageConfig) {
            this._updateCustomSelect(el.aspectRatioWrapper, state.imageConfig.aspectRatio);
            this._updateCustomSelect(el.imageSizeWrapper, state.imageConfig.imageSize);
        } else if (state.mode === 'video' && state.videoConfig) {
            this._updateCustomSelect(el.videoRatioWrapper, state.videoConfig.videoRatio);
            this._updateCustomSelect(el.videoDurationWrapper, state.videoConfig.videoDuration);
            // 启动分辨率更新逻辑
            if (window.modelSelectManager) {
                window.modelSelectManager.updateVideoResolutionOptions(state.modelName, state.videoConfig.videoDuration);
                // 延迟一下确保下拉选项已生成
                setTimeout(() => {
                    this._updateCustomSelect(el.videoResolutionWrapper, state.videoConfig.videoResolution);
                }, 50);
            }
        } else if (state.mode === 'audio' && state.audioConfig) {
            this._updateCustomSelect(el.audioDurationWrapper, state.audioConfig.audioDuration);
            this._updateCustomSelect(el.audioFormatWrapper, state.audioConfig.audioFormat);
        }
    }

    _updateCustomSelect(wrapper, value) {
        if (!wrapper || value === undefined) return;
        wrapper.dataset.value = value;
        const trigger = wrapper.querySelector('.selected-text');
        if (trigger) {
            // 尝试从选项中查找对应的显示文本（美化显示）
            let displayName = value;
            const options = wrapper._fixedDropdown?.querySelectorAll('.custom-option');
            if (options) {
                options.forEach(opt => {
                    if (opt.dataset.value === value) displayName = opt.textContent;
                });
            }
            trigger.textContent = displayName; 
        }
    }

    _applyReferences(references) {
        // 重要：不调用 referenceManager.clear()，因为那会 revoke URL
        // 我们直接替换 referenceManager 内部的 references 数组
        referenceManager.references = [...references];
        referenceManager.render();
    }

    /**
     * 专门保存节点的快照到内存 Map
     */
    saveNodeSnapshot(node, snapshot) {
        if (!node || !snapshot) return;
        const nodeId = node.dataset.index;
        if (nodeId !== undefined) {
            this.nodeSnapshots.set(nodeId, snapshot);
            // 同时存一份字符串到 dataset 以备导出
            node.dataset.snapshot = JSON.stringify(snapshot, (key, value) => {
                if (value instanceof File) return undefined; // File 对象不进 JSON
                return value;
            });
        }
    }

    /**
     * 从选中节点加载状态
     */
    async loadFromNode(node) {
        if (!node) return;
        const nodeId = node.dataset.index;
        
        // 优先从内存 Map 中读取 (保留了 File 对象)
        let snapshot = this.nodeSnapshots.get(nodeId);
        
        // 如果内存没有，再尝试从 dataset 解析
        if (!snapshot && node.dataset.snapshot) {
            try {
                snapshot = JSON.parse(node.dataset.snapshot);
            } catch (e) {
                console.error('解析节点快照失败:', e);
            }
        }

        if (snapshot) {
            await this.applyState(snapshot);
            console.log(`%c[PromptPanelManager] 已加载节点[${nodeId}]的历史参数`, 'color: #a855f7');
        }
    }

    /**
     * 保存当前草稿
     */
    saveDraft() {
        this.draft = this.captureState();
        console.log('%c[PromptPanelManager] 草稿已保存', 'color: #22c55e');
    }

    /**
     * 恢复草稿
     */
    async restoreDraft() {
        if (this.draft) {
            await this.applyState(this.draft);
            console.log('%c[PromptPanelManager] 草稿已恢复', 'color: #22c55e');
        } else {
            // 如果没有草稿，清空面板
            this._clearPanel();
        }
    }

    _clearPanel() {
        this.elements.promptInput.innerHTML = '';
        referenceManager.references = []; // 不调用 clear 以防误伤
        referenceManager.render();
    }
}

export const promptPanelManager = new PromptPanelManager();
window.promptPanelManager = promptPanelManager;
