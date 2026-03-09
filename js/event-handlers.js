// 事件处理相关逻辑

import { CONFIG } from "../config.js";
import { maskApiKey } from "./utils.js";

export class EventHandler {
    constructor() {
        this.uiPanel = document.getElementById('uiPanel');
        this.promptPanel = document.getElementById('promptPanel');
        this.togglePromptPanel = document.getElementById('togglePromptPanel');
        this.settingsApiKeyInput = document.getElementById('settingsApiKeyInput');
        
        this.isDraggingUIPanel = false;
        this.uiPanelStartX = 0;
        this.uiPanelStartY = 0;
        this.uiPanelStartLeft = 0;
        this.uiPanelStartTop = 0;
        
        this.init();
    }
    
    init() {
        this.bindGlobalEvents();
        this.bindUIPanelEvents();
        this.bindPromptPanelEvents();
        this.bindApiKeyEvents();
    }
    
    bindGlobalEvents() {
        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingUIPanel) {
                const deltaX = e.clientX - this.uiPanelStartX;
                const deltaY = e.clientY - this.uiPanelStartY;
                const newLeft = this.uiPanelStartLeft + deltaX;
                const newTop = this.uiPanelStartTop + deltaY;
                
                const maxLeft = window.innerWidth - this.uiPanel.offsetWidth;
                const maxTop = window.innerHeight - this.uiPanel.offsetHeight;
                const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));
                const clampedTop = Math.max(0, Math.min(newTop, maxTop));
                
                this.uiPanel.style.left = `${clampedLeft}px`;
                this.uiPanel.style.top = `${clampedTop}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDraggingUIPanel) {
                this.isDraggingUIPanel = false;
                this.uiPanel.classList.remove('ui-panel-draggable');
            }
        });
    }
    
    bindUIPanelEvents() {
        if (!this.uiPanel) return;
        
        this.uiPanel.addEventListener('mousedown', (e) => {
            const target = e.target;
            const isInteractiveElement = target.closest('button') || 
                                       target.closest('input') || 
                                       target.closest('select') || 
                                       target.closest('textarea') ||
                                       target.closest('[contenteditable="true"]') ||
                                       target.closest('.debug-console-content');
            
            if (target.closest('.pointer-events-auto') && !isInteractiveElement) {
                this.isDraggingUIPanel = true;
                this.uiPanelStartX = e.clientX;
                this.uiPanelStartY = e.clientY;
                this.uiPanelStartLeft = parseInt(this.uiPanel.style.left) || parseInt(getComputedStyle(this.uiPanel).left);
                this.uiPanelStartTop = parseInt(this.uiPanel.style.top) || parseInt(getComputedStyle(this.uiPanel).top);
                this.uiPanel.classList.add('ui-panel-draggable');
                e.preventDefault();
            }
        });
    }
    
    bindPromptPanelEvents() {
        if (!this.togglePromptPanel || !this.promptPanel) return;
        
        this.togglePromptPanel.addEventListener('click', () => {
            if (this.promptPanel.classList.contains('hidden')) {
                this.promptPanel.classList.remove('hidden');
                this.togglePromptPanel.textContent = '折叠';
            } else {
                this.promptPanel.classList.add('hidden');
                this.togglePromptPanel.textContent = '展开';
            }
        });
    }
    
    bindApiKeyEvents() {
        if (!this.settingsApiKeyInput) return;
        
        this.settingsApiKeyInput.value = CONFIG.API_KEY ? maskApiKey(CONFIG.API_KEY) : '';

        this.settingsApiKeyInput.addEventListener('focus', () => {
            this.settingsApiKeyInput.value = CONFIG.API_KEY;
        });

        this.settingsApiKeyInput.addEventListener('blur', () => {
            const newValue = this.settingsApiKeyInput.value.trim();
            if (newValue && newValue !== maskApiKey(CONFIG.API_KEY)) {
                CONFIG.API_KEY = newValue;
            }
            this.updateApiKeyDisplay();
        });

        this.settingsApiKeyInput.addEventListener('input', () => {
            const newValue = this.settingsApiKeyInput.value.trim();
            if (newValue && !newValue.includes('*')) {
                CONFIG.API_KEY = newValue;
            }
        });
    }
    
    updateApiKeyDisplay() {
        const apiKey = CONFIG.API_KEY;
        if (apiKey && this.settingsApiKeyInput) {
            this.settingsApiKeyInput.value = maskApiKey(apiKey);
        }
    }
}

export function initCanvasEvents(options) {
    const { 
        promptInput, 
        debugConsole, 
        handleAPICall, 
        getPanzoom, 
        updateCanvasScale, 
        updateToolbarPosition,
        getSelectedNode,
        copySelectedNode,
        cutSelectedNode,
        deleteSelectedNode
    } = options;
    
    document.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        
        if (document.activeElement === promptInput) {
            e.preventDefault();
            return;
        }
        
        e.preventDefault();
        
        const currentScale = getPanzoom().getScale();
        const delta = e.deltaY > 0 ? -0.25 : 0.25;
        const newScale = Math.max(0.5, Math.min(2.5, currentScale + delta));
        updateCanvasScale(newScale);
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === '`') {
            e.preventDefault();
            const isCollapsed = debugConsole.classList.contains('collapsed');
            debugConsole.classList.toggle('collapsed');
            void debugConsole.offsetHeight;
            if (isCollapsed) {
                debugConsole.style.transform = 'translateY(0)';
            } else {
                debugConsole.style.transform = 'translateY(calc(100% - 24px))';
            }
            updateToolbarPosition();
            return;
        }
        
        if (document.activeElement === promptInput) return;
        if (debugConsole.contains(document.activeElement)) return;
        
        if (e.ctrlKey && !e.shiftKey && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            const currentScale = getPanzoom().getScale();
            const newScale = Math.min(2.5, currentScale + 0.25);
            updateCanvasScale(newScale);
            return;
        }
        
        if (e.ctrlKey && !e.shiftKey && (e.key === '-' || e.key === '_')) {
            e.preventDefault();
            const currentScale = getPanzoom().getScale();
            const newScale = Math.max(0.5, currentScale - 0.25);
            updateCanvasScale(newScale);
            return;
        }
        
        if (getSelectedNode()) {
            if (e.ctrlKey || e.metaKey) {
                const selection = window.getSelection();
                if (selection.toString().length > 0) return;
                
                if (e.key === 'c' || e.key === 'C') {
                    e.preventDefault();
                    copySelectedNode();
                    return;
                }
                if (e.key === 'x' || e.key === 'X') {
                    e.preventDefault();
                    cutSelectedNode();
                    return;
                }
            }
            
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteSelectedNode();
                return;
            }
            
            const step = 10;
            const currentLeft = parseInt(getSelectedNode().style.left) || 0;
            const currentTop = parseInt(getSelectedNode().style.top) || 0;
            
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    getSelectedNode().style.top = `${currentTop - step}px`;
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    getSelectedNode().style.top = `${currentTop + step}px`;
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    getSelectedNode().style.left = `${currentLeft - step}px`;
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    getSelectedNode().style.left = `${currentLeft + step}px`;
                    break;
            }
        }
    });
}
