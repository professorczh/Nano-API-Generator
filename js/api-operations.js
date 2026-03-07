// API操作相关逻辑

import { CONFIG } from "../config.js";
import { AppState } from "./app-state.js";
import { formatGenerationTime } from "./utils.js";

export class ApiOperations {
    constructor() {
        this.selectedNode = null;
        this.clipboardNode = null;
        this.showMouseLogs = false;
        this.showGenerationTime = true;
        this.showModelTag = true;
        this.debugConsoleContent = document.getElementById('debugConsoleContent');
        this.imageResponseContainer = document.getElementById('imageResponseContainer');
        this.promptInput = document.getElementById('promptInput');
    }
    
    createImageNode(imageUrl, prompt = '', index = 0, filename = '', resolution = '', generationTime = null, modelName = '') {
        console.log('Creating image node...');
        console.log('Image URL:', imageUrl);
        console.log('Prompt:', prompt);
        console.log('Index:', index);
        console.log('Filename:', filename);
        console.log('Resolution:', resolution);
        
        const node = document.createElement('div');
        node.className = 'canvas-node';
        node.dataset.index = index;
        node.dataset.imageUrl = imageUrl;
        node.dataset.filename = filename || `Image ${index + 1}`;
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `Generated image ${index + 1}`;
        img.draggable = false;
        
        img.onload = function() {
            const width = this.naturalWidth;
            const height = this.naturalHeight;
            const resolutionText = `${width}x${height}`;
            const resolutionElement = node.querySelector('.node-resolution');
            if (resolutionElement) {
                resolutionElement.textContent = resolutionText;
            }
            node.dataset.width = width;
            node.dataset.height = height;
        };
        
        const header = document.createElement('div');
        header.className = 'node-header';
        
        const filenameElement = document.createElement('div');
        filenameElement.className = 'node-filename';
        filenameElement.textContent = filename || `Image ${index + 1}`;
        
        const resolutionElement = document.createElement('div');
        resolutionElement.className = 'node-resolution';
        resolutionElement.textContent = resolution || 'Loading...';
        
        header.appendChild(filenameElement);
        header.appendChild(resolutionElement);
        
        const toolbar = this.createNodeToolbar(node, prompt, img);
        
        const centerCoords = document.createElement('div');
        centerCoords.className = 'node-center-coords';
        centerCoords.textContent = '(0, 0)';
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        
        const info = document.createElement('div');
        info.className = 'node-info';
        info.textContent = prompt || `Image ${index + 1}`;
        info.title = '点击复制提示词';
        info.addEventListener('click', (e) => {
            e.stopPropagation();
            const textToCopy = prompt || info.textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                info.classList.add('copied');
                setTimeout(() => {
                    info.classList.remove('copied');
                }, 500);
            }).catch(err => {
                console.error('复制失败:', err);
            });
        });
        
        node.appendChild(header);
        node.appendChild(toolbar);
        node.appendChild(img);
        node.appendChild(resizeHandle);
        node.appendChild(info);
        node.appendChild(centerCoords);
        
        const sidebar = this.createNodeSidebar(generationTime, modelName);
        if (sidebar.children.length > 0) {
            node.appendChild(sidebar);
        }
        
        node.dataset.pins = JSON.stringify([]);
        
        const width = parseInt(img.style.width) || 500;
        const height = parseInt(img.style.height) || 500;
        node.style.left = `${5000 - width / 2}px`;
        node.style.top = `${5000 - height / 2}px`;
        node.style.zIndex = '10';
        
        img.onload = function() {
            const actualWidth = this.naturalWidth || parseInt(this.style.width) || 500;
            const actualHeight = this.naturalHeight || parseInt(this.style.height) || 500;
            node.style.left = `${5000 - actualWidth / 2}px`;
            node.style.top = `${5000 - actualHeight / 2}px`;
            
            const resolutionText = `${actualWidth}x${actualHeight}`;
            const resolutionElement = node.querySelector('.node-resolution');
            if (resolutionElement) {
                resolutionElement.textContent = resolutionText;
            }
            
            node.dataset.width = actualWidth;
            node.dataset.height = actualHeight;
        };
        
        this.bindNodeEvents(node, img);
        
        console.log('Node created:', node);
        return node;
    }
    
    createNodeToolbar(node, prompt, img) {
        const toolbar = document.createElement('div');
        toolbar.className = 'node-toolbar';
        
        const copyPromptBtn = document.createElement('button');
        copyPromptBtn.className = 'toolbar-btn';
        copyPromptBtn.innerHTML = '📝';
        copyPromptBtn.title = '复制提示词';
        copyPromptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(prompt || '').then(() => {
                console.log('提示词已复制');
            });
        });
        
        const insertBtn = document.createElement('button');
        insertBtn.className = 'toolbar-btn';
        insertBtn.innerHTML = '✏️';
        insertBtn.title = '插入到输入框';
        insertBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (img) {
                const imageUrl = img.src;
                const filename = node.dataset.filename || 'Image';
                this.insertImageToPrompt(imageUrl, filename);
            }
        });
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'toolbar-btn';
        copyBtn.innerHTML = '📋';
        copyBtn.title = '复制图片';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(node);
            this.copySelectedNode();
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'toolbar-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = '删除图片';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(node);
            this.deleteSelectedNode();
        });
        
        toolbar.appendChild(copyPromptBtn);
        toolbar.appendChild(insertBtn);
        toolbar.appendChild(copyBtn);
        toolbar.appendChild(deleteBtn);
        
        return toolbar;
    }
    
    createNodeSidebar(generationTime, modelName) {
        const sidebar = document.createElement('div');
        sidebar.className = 'node-sidebar';
        
        if (generationTime !== null && generationTime !== undefined) {
            const timeElement = document.createElement('div');
            timeElement.className = 'node-generation-time';
            timeElement.style.display = this.showGenerationTime ? 'flex' : 'none';
            timeElement.textContent = formatGenerationTime(generationTime);
            timeElement.title = `生成耗时: ${generationTime.toFixed(2)}秒`;
            sidebar.appendChild(timeElement);
        }
        
        if (modelName) {
            const modelTag = document.createElement('div');
            modelTag.className = 'node-model-tag';
            modelTag.style.display = this.showModelTag ? 'block' : 'none';
            if (typeof modelName === 'object' && modelName.name) {
                modelTag.innerHTML = `<div class="model-name">${modelName.name}</div><div class="model-provider">${modelName.provider}</div>`;
                modelTag.title = `${modelName.name} (${modelName.provider})`;
            } else {
                modelTag.textContent = modelName;
                modelTag.title = modelName;
            }
            sidebar.appendChild(modelTag);
        }
        
        return sidebar;
    }
    
    bindNodeEvents(node, img) {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) {
                if (node.classList.contains('selected')) {
                    // PinManager.addPinToImage(node, e);
                } else {
                    this.selectNode(node);
                }
            } else {
                this.selectNode(node);
            }
        });
        
        node.addEventListener('mousedown', (e) => {
            if (e.target.closest('.node-info')) return;
            if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                e.stopPropagation();
                this.selectNode(node);
                
                AppState.isDraggingNode = true;
                AppState.dragNode = node;
                AppState.activeNode = node;
                
                AppState.dragStartX = e.clientX;
                AppState.dragStartY = e.clientY;
                AppState.dragNodeStartLeft = parseInt(node.style.left || '0');
                AppState.dragNodeStartTop = parseInt(node.style.top || '0');
            }
        });
        
        node.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showImageContextMenu(e, node, img);
        });
        
        img.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showImageContextMenu(e, node, img);
        });
        
        const resizeHandle = node.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startResizeNode(e, node);
            });
        }
    }
    
    selectNode(node) {
        if (this.selectedNode) {
            this.selectedNode.classList.remove('selected');
            this.selectedNode.style.zIndex = '10';
        }
        this.selectedNode = node;
        node.classList.add('selected');
        node.style.zIndex = '100';
    }
    
    deselectAllNodes() {
        if (this.selectedNode) {
            this.selectedNode.classList.remove('selected');
            this.selectedNode = null;
        }
    }
    
    copySelectedNode() {
        if (!this.selectedNode) return;
        
        const img = this.selectedNode.querySelector('img');
        if (!img) return;
        
        this.clipboardNode = {
            imageUrl: img.src,
            prompt: this.selectedNode.dataset.prompt || '',
            filename: this.selectedNode.dataset.filename || 'Image'
        };
        
        console.log('Node copied to clipboard');
    }
    
    deleteSelectedNode() {
        if (!this.selectedNode) return;
        
        this.selectedNode.remove();
        this.selectedNode = null;
        
        console.log('Node deleted');
    }
    
    startResizeNode(e, node) {
        AppState.isResizingNode = true;
        AppState.resizeNode = node;
        const img = node.querySelector('img');
        AppState.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: img.width,
            height: img.height
        };
        document.body.style.cursor = 'nwse-resize';
    }
    
    insertImageToPrompt(imageUrl, filename) {
        if (this.promptInput) {
            const currentText = this.promptInput.value;
            const imageTag = `![${filename}](${imageUrl})`;
            this.promptInput.value = currentText + (currentText ? '\n' : '') + imageTag;
        }
    }
    
    showImageContextMenu(e, node, img) {
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = '删除图片';
        deleteItem.addEventListener('click', () => {
            this.selectNode(node);
            this.deleteSelectedNode();
            menu.remove();
        });
        
        menu.appendChild(deleteItem);
        document.body.appendChild(menu);
        
        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }
}
