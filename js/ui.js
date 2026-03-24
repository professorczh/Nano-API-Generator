// UI相关的逻辑和事件处理
import { CanvasState } from './app-state.js';

class UIManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupTabEvents();
        this.setupResizeListener();
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
            { id: '12AI', element: document.getElementById('settingsTab12AI') },
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
            tab.className = 'py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-600 rounded-full transition-all flex items-center gap-2';
            const deleteSpan = tab.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.add('hidden');
        });

        // 设置当前标签样式（显示删除按钮）
        const currentTab = document.getElementById(`settingsTab${providerId}`);
        if (currentTab) {
            currentTab.className = 'py-1.5 px-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-full transition-all flex items-center gap-2';
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
            tab.className = 'py-1.5 px-3 text-sm font-medium text-gray-500 hover:text-gray-600 rounded-full transition-all flex items-center gap-2';
            const deleteSpan = tab.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.add('hidden');
        });

        // 设置当前标签样式（显示删除按钮）
        const currentTab = document.querySelector(`#settingsTabs button[data-provider-id="${providerId}"]`);
        if (currentTab) {
            currentTab.className = 'py-1.5 px-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-full transition-all flex items-center gap-2';
            const deleteSpan = currentTab.querySelector('.tab-delete');
            if (deleteSpan) deleteSpan.classList.remove('hidden');
        }
    }

    setupResizeListener() {
        // 动态监听resize事件，当窗口大小改变时自动刷新UI
        window.addEventListener('resize', () => {
            this.refreshUI();
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
    
    if (tabText) tabText.addEventListener('click', switchToTextMode);
    if (tabImage) tabImage.addEventListener('click', switchToImageMode);
    if (tabVideo) tabVideo.addEventListener('click', switchToVideoMode);
    
    switchToImageMode();
}

export function switchToTextMode() {
    currentMode = 'text';
    window.currentMode = 'text';
    CanvasState.currentMode = 'text';
    if (tabText) tabText.className = 'flex-1 py-2 px-3 text-sm font-medium bg-blue-600 text-white';
    if (tabImage) tabImage.className = 'flex-1 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50';
    if (tabVideo) tabVideo.className = 'flex-1 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-purple-50';
    
    const textParams = document.getElementById('textParams');
    const imageParams = document.getElementById('imageParams');
    const videoParams = document.getElementById('videoParams');
    if (textParams) textParams.classList.remove('hidden');
    if (imageParams) imageParams.classList.add('hidden');
    if (videoParams) videoParams.classList.add('hidden');
    
    window.modelSelectManager?.populateModelSelects();
}

export function switchToImageMode() {
    currentMode = 'image';
    window.currentMode = 'image';
    CanvasState.currentMode = 'image';
    if (tabText) tabText.className = 'flex-1 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50';
    if (tabImage) tabImage.className = 'flex-1 py-2 px-3 text-sm font-medium bg-blue-600 text-white';
    if (tabVideo) tabVideo.className = 'flex-1 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-purple-50';
    
    const textParams = document.getElementById('textParams');
    const imageParams = document.getElementById('imageParams');
    const videoParams = document.getElementById('videoParams');
    if (textParams) textParams.classList.add('hidden');
    if (imageParams) imageParams.classList.remove('hidden');
    if (videoParams) videoParams.classList.add('hidden');
    
    window.modelSelectManager?.populateModelSelects();
}

export function switchToVideoMode() {
    currentMode = 'video';
    window.currentMode = 'video';
    CanvasState.currentMode = 'video';
    if (tabText) tabText.className = 'flex-1 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50';
    if (tabImage) tabImage.className = 'flex-1 py-2 px-3 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-blue-50';
    if (tabVideo) tabVideo.className = 'flex-1 py-2 px-3 text-sm font-medium bg-purple-600 text-white';
    
    const textParams = document.getElementById('textParams');
    const imageParams = document.getElementById('imageParams');
    const videoParams = document.getElementById('videoParams');
    if (textParams) textParams.classList.add('hidden');
    if (imageParams) imageParams.classList.add('hidden');
    if (videoParams) videoParams.classList.remove('hidden');
    
    window.modelSelectManager?.populateModelSelects();
}

export function getCurrentMode() {
    return currentMode;
}

export { UIManager };