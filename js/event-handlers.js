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
