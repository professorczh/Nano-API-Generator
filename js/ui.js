import { AppState, CanvasState } from './app-state.js';
import { getIcon } from './icons.js';
import { PersistenceManager } from './persistence-manager.js';

class UIManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupTabEvents();
        this.setupResizeListener();
        this.setupCanvasManager();
        this.setupPromptPanelExpansion();
        this.setupPromptSettingsModal();
    }

    setupTabEvents() {
        // 统一的标签页点击处理
        this.setupDefaultTabEvents();
        this.setupDynamicTabEvents();
    }

    setupDefaultTabEvents() {
        // 为现有标签页添加事件处理
        const tabs = [
            { id: 'Gemini', element: document.getElementById('settingsTabGemini') },
            { id: 'OpenAI', element: document.getElementById('settingsTabOpenAI') },
            { id: 'Claude', element: document.getElementById('settingsTabClaude') }
        ];

        tabs.forEach(({ id, element }) => {
            if (element) {
                // 移除可能存在的旧事件监听器
                element.replaceWith(element.cloneNode(true));
                const newElement = document.getElementById(`settingsTab${id}`);
                if (newElement) {
                    newElement.addEventListener('click', () => {
                        this.switchTab(id);
                    });
                }
            }
        });
    }

    setupDynamicTabEvents() {
        // 为动态添加的标签页添加事件委托
        const settingsTabs = document.getElementById('settingsTabs');
        if (!settingsTabs) return;
        
        settingsTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('button[data-provider-id]');
            if (tab) {
                const providerId = tab.dataset.providerId;
                this.switchDynamicTab(providerId);
            }
        });
    }

    switchTab(providerId) {
        // 隐藏所有面板
        document.querySelectorAll('#settingsAPIConfig > div').forEach(panel => {
            panel.classList.add('hidden');
        });

        // 显示当前面板
        const currentPanel = document.getElementById(`settings${providerId}Config`);
        if (currentPanel) {
            currentPanel.classList.remove('hidden');
        }

        // 重置所有标签样式（隐藏删除按钮）
        document.querySelectorAll('#settingsTabs button:not(#settingsTabAdd)').forEach(tab => {
            tab.className = 'py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-600 rounded-full transition-all flex items-center ';
            const deleteSpan = tab.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.add('hidden');
        });

        // 设置当前标签样式（显示删除按钮）
        const currentTab = document.getElementById(`settingsTab${providerId}`);
        if (currentTab) {
            currentTab.className = 'py-1.5 px-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-full transition-all flex items-center ';
            const deleteSpan = currentTab.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.remove('hidden');
        }
    }

    switchDynamicTab(providerId) {
        // 隐藏所有面板
        document.querySelectorAll('#settingsAPIConfig > div').forEach(panel => {
            panel.classList.add('hidden');
        });

        // 显示当前面板
        const currentPanel = document.getElementById(`settings${providerId}Config`);
        if (currentPanel) {
            currentPanel.classList.remove('hidden');
        }

        // 重置所有标签样式（隐藏删除按钮）
        document.querySelectorAll('#settingsTabs button:not(#settingsTabAdd)').forEach(tab => {
            tab.className = 'py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-600 rounded-full transition-all flex items-center ';
            const deleteSpan = tab.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.add('hidden');
        });

        // 设置当前标签样式（显示删除按钮）
        const currentTab = document.querySelector(`#settingsTabs button[data-provider-id="${providerId}"]`);
        if (currentTab) {
            currentTab.className = 'py-1.5 px-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-full transition-all flex items-center ';
            const deleteSpan = currentTab.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.remove('hidden');
        }
    }

    setupResizeListener() {
        // 动态监听resize事件，当窗口大小改变时自动刷新UI
        window.addEventListener('resize', () => {
            this.refreshUI();
        });
        // 实时同步监听：确保标签变动时货架立即响应
        const promptInput = document.getElementById('promptInput');
        if (promptInput) {
            promptInput.addEventListener('input', () => {
                if (window.PinManager && typeof window.PinManager.updateImageDataList === 'function') {
                    window.PinManager.updateImageDataList();
                }
            });
        }
    }

    setupCanvasManager() {
        const btn = document.getElementById('canvasManagerBtn');
        const panel = document.getElementById('canvasManagerPanel');
        const exportBtn = document.getElementById('exportCanvasBtn');
        const importBtn = document.getElementById('importCanvasBtn');
        
        if (!btn || !panel) return;

        // 注入图标
        const icons = {
            'canvasIconContainer': getIcon('maximize', 16, 'text-gray-400'),
            'panelTitleIcon': getIcon('settings', 16),
            'exportIcon': getIcon('download', 18),
            'importIcon': getIcon('upload', 18)
        };
        
        Object.entries(icons).forEach(([id, html]) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        });

        // 切换面板显示
        btn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = panel.classList.toggle('hidden');
            if (!isHidden) {
                btn.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-600');
            } else {
                btn.classList.remove('bg-blue-50', 'border-blue-200', 'text-blue-600');
            }
        };

        // 点击外部关闭面板
        document.addEventListener('click', (e) => {
            if (panel && !panel.classList.contains('hidden')) {
                if (!panel.contains(e.target) && !btn.contains(e.target)) {
                    panel.classList.add('hidden');
                    btn.classList.remove('bg-blue-50', 'border-blue-200', 'text-blue-600');
                }
            }
        });

        // 导出/导入功能逻辑挂载
        if (exportBtn) {
            exportBtn.onclick = (e) => {
                e.stopPropagation();
                panel.classList.add('hidden');
                PersistenceManager.exportCanvas();
            };
        }

        if (importBtn) {
            const fileInput = document.getElementById('canvasImportInput');
            importBtn.onclick = (e) => {
                e.stopPropagation();
                panel.classList.add('hidden');
                if (fileInput) fileInput.click();
            };

            if (fileInput) {
                fileInput.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        await PersistenceManager.importCanvas(file);
                        // 清除 input 值以便下次触发相同文件的 onchange
                        fileInput.value = '';
                    }
                };
            }
        }
    }
    
    setupPromptPanelExpansion() {
        const toggleBtn = document.getElementById('toggleExpandPrompt');
        const uiPanel = document.getElementById('uiPanel');
        
        if (!toggleBtn || !uiPanel) return;
        
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isExpanded = uiPanel.classList.toggle('prompt-panel-expanded');
            
            // 模式切换时自动刷新UI (如货架渲染)
            if (window.referenceManager) {
                window.referenceManager.render();
            }
            
            // 切换按钮语义化提示
            toggleBtn.title = isExpanded ? '退出沉浸模式' : '沉浸模式';
            
            console.log(`[UI] 切换沉浸模式: ${isExpanded ? '开启' : '关闭'}`);
        };

        // RAW 模式切换绑定
        const rawBtn = document.getElementById('toggleRawMode');
        if (rawBtn) {
            rawBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.promptPanelManager) {
                    window.promptPanelManager.toggleRawMode();
                }
            };
        }
    }

    setupPromptSettingsModal() {
        const openBtn = document.getElementById('openPromptSettings');
        const overlay = document.getElementById('promptSettingsOverlay');
        const panel = document.getElementById('promptSettingsPanel');
        const closeBtn = document.getElementById('closePromptSettings');
        
        if (!openBtn || !overlay || !panel) return;

        const openModal = () => {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            // 触发动画
            setTimeout(() => {
                panel.classList.replace('scale-95', 'scale-100');
                panel.classList.replace('opacity-0', 'opacity-100');
            }, 10);
        };

        const closeModal = () => {
            panel.classList.replace('scale-100', 'scale-95');
            panel.classList.replace('opacity-100', 'opacity-0');
            // 等待动画结束
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
            }, 200);
        };

        openBtn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = overlay.classList.contains('hidden');
            if (isHidden) {
                openModal();
            } else {
                closeModal();
            }
        };

        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeModal();
        };

        // 点击遮罩背景关闭
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        };

        // 阻止面板内部点击冒泡导致关闭
        panel.onclick = (e) => e.stopPropagation();

        // --- 逻辑配置管理 (Persistence) ---
        const settings = {
            autoInsert: document.getElementById('settingAutoInsert'),
            allowDuplicate: document.getElementById('settingAllowDuplicate'),
            syncRemoval: document.getElementById('settingSyncRemoval')
        };

        // 初始化配置加载
        const savedSettings = JSON.parse(localStorage.getItem('PromptPanelSettings') || '{"autoInsert":true,"allowDuplicate":true,"syncRemoval":true}');
        
        // 应用到 UI 并同步到全局状态
        AppState.PromptSettings = savedSettings;
        Object.keys(settings).forEach(key => {
            if (settings[key]) {
                settings[key].checked = savedSettings[key];
                settings[key].onchange = () => {
                    AppState.PromptSettings[key] = settings[key].checked;
                    localStorage.setItem('PromptPanelSettings', JSON.stringify(AppState.PromptSettings));
                    console.log(`[Settings] 更新配置 ${key}: ${settings[key].checked}`);
                };
            }
        });
    }

    refreshUI() {
        // 这里可以添加窗口大小改变时需要执行的UI刷新逻辑
        console.log('UI refreshed');
    }

    // 其他UI相关的方法
    showNotification(message, type = 'info') {
        // 显示通知的方法
        console.log(`${type}: ${message}`);
    }

    showLoader(show = true) {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.toggle('hidden', !show);
        }
    }

    updateStatus(message, type = 'info') {
        const statusTag = document.getElementById('statusTag');
        if (statusTag) {
            statusTag.textContent = message;
            // 根据类型设置不同的样式
            statusTag.className = `inline-block px-2 py-1 rounded-full text-xs font-medium ${this.getStatusClass(type)}`;
        }
    }

    getStatusClass(type) {
        switch (type) {
            case 'success':
                return 'bg-green-100 text-green-800';
            case 'error':
                return 'bg-red-100 text-red-800';
            case 'warning':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-blue-100 text-blue-800';
        }
    }
}

let currentMode = 'image';
let tabText, tabImage, tabVideo;

export function initModeSwitchers() {
    tabText = document.getElementById('tabText');
    tabImage = document.getElementById('tabImage');
    tabVideo = document.getElementById('tabVideo');
    const tabAudio = document.getElementById('tabAudio');
    
    if (tabText) tabText.addEventListener('click', switchToTextMode);
    if (tabImage) tabImage.addEventListener('click', switchToImageMode);
    if (tabVideo) tabVideo.addEventListener('click', switchToVideoMode);
    if (tabAudio) tabAudio.addEventListener('click', switchToAudioMode);
    
    // 从缓存恢复上次的模式，如果没有则默认图片模式
    const lastMode = localStorage.getItem('partta_last_mode');
    if (lastMode === 'text') switchToTextMode();
    else if (lastMode === 'video') switchToVideoMode();
    else if (lastMode === 'audio') switchToAudioMode();
    else switchToImageMode();
}

export function switchToTextMode() {
    currentMode = 'text';
    window.currentMode = 'text';
    CanvasState.currentMode = 'text';
    localStorage.setItem('partta_last_mode', 'text');
    const tabAudio = document.getElementById('tabAudio');
    if (tabText) tabText.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-blue-600 text-white flex items-center justify-center';
    if (tabImage) tabImage.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50 flex items-center justify-center';
    if (tabVideo) tabVideo.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-purple-50 flex items-center justify-center';
    if (tabAudio) {
    if (tabAudio) tabAudio.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-pink-50 flex items-center justify-center';
        tabAudio.style.backgroundColor = '';
    }
    
    const textParams = document.getElementById('textParams');
    const imageParams = document.getElementById('imageParams');
    const videoParams = document.getElementById('videoParams');
    const audioParams = document.getElementById('audioParams');
    if (textParams) textParams.classList.remove('hidden');
    if (imageParams) imageParams.classList.add('hidden');
    if (videoParams) videoParams.classList.add('hidden');
    if (audioParams) audioParams.classList.add('hidden');
    
    window.modelSelectManager?.populateModelSelects();
    
    // 统11致的渲染时序：确保 DOM 已就绪
    setTimeout(() => {
        const textModelGroup = document.getElementById('textModelNameWrapper');
        const currentModelValue = textModelGroup?.dataset.value;
        const currentProviderId = textModelGroup?.dataset.provider;
        if (currentModelValue && currentProviderId) {
            window.modelSelectManager?.updateReferenceMode(currentModelValue, currentProviderId);
        }
        window.referenceManager?.render();
    }, 0);
}

export function switchToImageMode() {
    currentMode = 'image';
    window.currentMode = 'image';
    CanvasState.currentMode = 'image';
    localStorage.setItem('partta_last_mode', 'image');
    const tabAudio = document.getElementById('tabAudio');
    if (tabText) tabText.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50 flex items-center justify-center ';
    if (tabImage) tabImage.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-blue-600 text-white flex items-center justify-center ';
    if (tabVideo) tabVideo.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-purple-50 flex items-center justify-center ';
    if (tabAudio) {
        tabAudio.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-pink-50 flex items-center justify-center ';
        tabAudio.style.backgroundColor = '';
    }
    
    const textParams = document.getElementById('textParams');
    const imageParams = document.getElementById('imageParams');
    const videoParams = document.getElementById('videoParams');
    const audioParams = document.getElementById('audioParams');
    if (textParams) textParams.classList.add('hidden');
    if (imageParams) imageParams.classList.remove('hidden');
    if (videoParams) videoParams.classList.add('hidden');
    if (audioParams) audioParams.classList.add('hidden');
    
    window.modelSelectManager?.populateModelSelects();

    // 统11致的渲染时序
    setTimeout(() => {
        const imageModelGroup = document.getElementById('imageModelNameWrapper');
        const currentModelValue = imageModelGroup?.dataset.value;
        const currentProviderId = imageModelGroup?.dataset.provider;
        if (currentModelValue && currentProviderId) {
            window.modelSelectManager?.updateReferenceMode(currentModelValue, currentProviderId);
        }
        window.referenceManager?.render();
    }, 0);
}

export function switchToVideoMode() {
    currentMode = 'video';
    window.currentMode = 'video';
    CanvasState.currentMode = 'video';
    localStorage.setItem('partta_last_mode', 'video');
    const tabAudio = document.getElementById('tabAudio');
    if (tabText) tabText.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50 flex items-center justify-center ';
    if (tabImage) tabImage.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50 flex items-center justify-center ';
    if (tabVideo) tabVideo.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-purple-600 text-white flex items-center justify-center ';
    if (tabAudio) {
        tabAudio.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-pink-50 flex items-center justify-center ';
        tabAudio.style.backgroundColor = '';
    }
    
    const textParams = document.getElementById('textParams');
    const imageParams = document.getElementById('imageParams');
    const videoParams = document.getElementById('videoParams');
    const audioParams = document.getElementById('audioParams');
    if (textParams) textParams.classList.add('hidden');
    if (imageParams) imageParams.classList.add('hidden');
    if (videoParams) videoParams.classList.remove('hidden');
    if (audioParams) audioParams.classList.add('hidden');
    
    window.modelSelectManager?.populateModelSelects();
    
    // 统11致的渲染时序
    setTimeout(() => {
        const videoModelGroup = document.getElementById('videoModelNameWrapper');
        const currentModelValue = videoModelGroup?.dataset.value;
        const currentProviderId = videoModelGroup?.dataset.provider;
        if (currentModelValue && currentProviderId) {
            window.modelSelectManager?.updateReferenceMode(currentModelValue, currentProviderId);
        }
        window.referenceManager?.render();
    }, 0);
}

export function switchToAudioMode() {
    currentMode = 'audio';
    window.currentMode = 'audio';
    CanvasState.currentMode = 'audio';
    localStorage.setItem('partta_last_mode', 'audio');
    const tabAudio = document.getElementById('tabAudio');
    if (tabText) tabText.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50 flex items-center justify-center ';
    if (tabImage) tabImage.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50 flex items-center justify-center ';
    if (tabVideo) tabVideo.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-purple-50 flex items-center justify-center ';
    if (tabAudio) {
        tabAudio.className = 'flex-1 min-w-0 py-2 px-3 text-sm font-medium text-white flex items-center justify-center ';
        tabAudio.style.backgroundColor = '#db2777';
    }
    
    const textParams = document.getElementById('textParams');
    const imageParams = document.getElementById('imageParams');
    const videoParams = document.getElementById('videoParams');
    const audioParams = document.getElementById('audioParams');
    if (textParams) textParams.classList.add('hidden');
    if (imageParams) imageParams.classList.add('hidden');
    if (videoParams) videoParams.classList.add('hidden');
    if (audioParams) audioParams.classList.remove('hidden');
    
    window.modelSelectManager?.populateModelSelects();

    // 统11致的渲染时序
    setTimeout(() => {
        const audioModelGroup = document.getElementById('audioModelNameWrapper');
        const currentModelValue = audioModelGroup?.dataset.value;
        const currentProviderId = audioModelGroup?.dataset.provider;
        if (currentModelValue && currentProviderId) {
            window.modelSelectManager?.updateReferenceMode(currentModelValue, currentProviderId);
        }
        window.referenceManager?.render();
    }, 0);
}

export function getCurrentMode() {
    return currentMode;
}

export { UIManager };