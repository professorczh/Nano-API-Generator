// 事件处理相关逻辑

import { CONFIG } from "../config.js";
import { maskApiKey, debugLog } from "./utils.js";
import { AppState, CanvasState } from './app-state.js';
import { updateMinimapWithImage, getPanzoom, getImageResponseContainer } from './canvas-manager.js';
import { selectNode, createImageNode } from './node-manager.js';

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
                this.uiPanel.style.bottom = 'auto'; // 确保高度由内容决定，从上往下长
                this.uiPanel.style.right = 'auto';  // 转由 left 接管位置，避免冲突
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDraggingUIPanel) {
                this.isDraggingUIPanel = false;
                this.uiPanel.classList.remove('ui-panel-draggable');
            }
        });
        
        document.addEventListener('paste', async (e) => {
            const promptInput = document.getElementById('promptInput');
            if (document.activeElement === promptInput) return;
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            
            const imageResponseContainer = getImageResponseContainer();
            if (!imageResponseContainer) return;
            
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    
                    const blob = item.getAsFile();
                    if (!blob) continue;
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const imageDataUrl = event.target.result;
                        const img = new Image();
                        img.onload = () => {
                            const width = img.width;
                            const height = img.height;
                            const aspectRatio = width / height;
                            let displayWidth, displayHeight;
                            
                            if (width > height) {
                                displayWidth = Math.min(width, 300);
                                displayHeight = Math.round(displayWidth / aspectRatio);
                            } else {
                                displayHeight = Math.min(height, 300);
                                displayWidth = Math.round(displayHeight * aspectRatio);
                            }
                            
                            const nodeWidth = displayWidth;
                            const nodeHeight = displayHeight;
                            
                            const existingNodes = imageResponseContainer.querySelectorAll('.canvas-node');
                            let x = 5000;
                            let y = 5000;
                            
                            if (existingNodes.length > 0) {
                                const lastNode = existingNodes[existingNodes.length - 1];
                                const lastNodeX = parseInt(lastNode.style.left) || 0;
                                const lastNodeY = parseInt(lastNode.style.top) || 0;
                                const lastNodeWidth = lastNode.offsetWidth;
                                const lastNodeHeight = lastNode.offsetHeight;
                                
                                x = lastNodeX + lastNodeWidth + 50;
                                y = lastNodeY;
                                
                                if (x > 6000) {
                                    x = 5000;
                                    y = lastNodeY + lastNodeHeight + 50;
                                }
                            }
                            
                            const filename = `Clipboard_${Date.now()}`;
                            const resolution = `${Math.round(nodeWidth)}x${Math.round(nodeHeight)}`;
                            const newNode = createImageNode(imageDataUrl, '', CanvasState.nodeCounter++, filename, resolution, null, '', null, x, y);
                            newNode.style.width = `${nodeWidth}px`;
                            newNode.style.height = `${nodeHeight}px`;
                            
                            imageResponseContainer.appendChild(newNode);
                            updateMinimapWithImage(newNode);
                            selectNode(newNode);
                            
                            debugLog(`[粘贴] 从剪贴板粘贴图片: ${filename}`, 'info');
                        };
                        img.src = imageDataUrl;
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        });
    }
    
    bindUIPanelEvents() {
        if (!this.uiPanel) return;
        
        this.uiPanel.addEventListener('mousedown', (e) => {
            const target = e.target;
            // 改进判定：如果点击的是文本节点，取其父元素进行判定
            const element = target.nodeType === 3 ? target.parentElement : target;
            
            const isInteractiveElement = element.closest('button') || 
                                       element.closest('input') || 
                                       element.closest('select') || 
                                       element.closest('textarea') ||
                                       element.closest('[contenteditable="true"]') ||
                                       element.closest('.debug-console-content') ||
                                       element.closest('.node-reference-item'); // 允许点击货架图片
            
            if (element.closest('.pointer-events-auto') && !isInteractiveElement) {
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
            const isHidden = this.promptPanel.classList.toggle('hidden');
            const collapseIcon = document.getElementById('collapseIcon');
            const expandIcon = document.getElementById('expandPanelIcon');
            
            if (collapseIcon && expandIcon) {
                collapseIcon.classList.toggle('hidden', isHidden);
                expandIcon.classList.toggle('hidden', !isHidden);
            }
        });

        const promptContainer = document.getElementById('promptContainer');
        const promptInput = document.getElementById('promptInput');
        if (promptContainer && promptInput) {
            promptContainer.addEventListener('click', (e) => {
                // 只有当点击的是容器边缘或其他非输入区域时，才执行补救聚焦
                // 如果点击的是输入框本身或其内部的任何图片标签、文字，则不干预浏览器默认的光标定位行为
                if (!promptInput.contains(e.target)) {
                    promptInput.focus();
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(promptInput);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            });
        }
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
        
        // 如果鼠标在侧边面板上，不执行缩放
        const uiPanel = document.getElementById('uiPanel');
        if (uiPanel && uiPanel.contains(e.target)) return;

        e.preventDefault();
        
        const currentScale = getPanzoom().getScale();
        const delta = e.deltaY > 0 ? -0.25 : 0.25;
        const newScale = Math.max(0.5, Math.min(2.5, currentScale + delta));
        
        // 关键：透传鼠标坐标
        updateCanvasScale(newScale, e.clientX, e.clientY);
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
