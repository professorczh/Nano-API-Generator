import { AppState, CanvasState } from './app-state.js';
import { PinManager } from './pin-manager.js';
import { DebugConsole } from './debug-console.js';
import { debugLog, formatGenerationTime } from './utils.js';
import { updateMinimapWithImage, updateImageCenterCoordinates, getPanzoom, getImageResponseContainer } from './canvas-manager.js';

let clipboardNode = null;
let minimapCanvas;

export function initNodeManager() {
    minimapCanvas = document.getElementById('minimapCanvas');
}

export function selectNode(node) {
    if (CanvasState.selectedNode) {
        CanvasState.selectedNode.classList.remove('selected');
        CanvasState.selectedNode.style.zIndex = '10';
    }
    CanvasState.selectedNode = node;
    node.classList.add('selected');
    node.style.zIndex = '100';
}

export function deselectAllNodes() {
    if (CanvasState.selectedNode) {
        CanvasState.selectedNode.classList.remove('selected');
        CanvasState.selectedNode = null;
    }
}

export function startResizeNode(e, node) {
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

export function copySelectedNode() {
    if (!CanvasState.selectedNode) return;
    
    const img = CanvasState.selectedNode.querySelector('img');
    if (!img) return;
    
    if (img.src.startsWith('data:')) {
        navigator.clipboard.writeText(img.src).then(() => {
            console.log('图片已复制到剪贴板');
            if (DebugConsole.showMouseLogs) {
                debugLog(`[复制] 图片: ${CanvasState.selectedNode.dataset.filename}`, 'info');
            }
            clipboardNode = CanvasState.selectedNode;
        }).catch(err => {
            console.error('复制失败:', err);
            debugLog(`[复制失败] ${err}`, 'error');
        });
    } else {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
            navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]).then(() => {
                console.log('图片已复制到剪贴板');
                if (DebugConsole.showMouseLogs) {
                    debugLog(`[复制] 图片: ${CanvasState.selectedNode.dataset.filename}`, 'info');
                }
                clipboardNode = CanvasState.selectedNode;
            }).catch(err => {
                console.error('复制失败:', err);
                debugLog(`[复制失败] ${err}`, 'error');
            });
        });
    }
}

export function cutSelectedNode() {
    if (!CanvasState.selectedNode) return;
    
    clipboardNode = CanvasState.selectedNode.cloneNode(true);
    deleteSelectedNode(true);
    debugLog(`[剪切] 图片: ${CanvasState.selectedNode?.dataset.filename}`, 'info');
}

export function deleteSelectedNode(skipConfirm = false) {
    if (!CanvasState.selectedNode) return;
    
    const showDeleteConfirm = () => {
        const confirmModal = document.getElementById('confirmModal');
        const confirmModalMessage = document.getElementById('confirmModalMessage');
        const confirmModalCheckbox = document.getElementById('confirmModalCheckbox');
        const confirmModalCancel = document.getElementById('confirmModalCancel');
        const confirmModalOk = document.getElementById('confirmModalOk');
        
        confirmModalMessage.textContent = `确定要删除图片"${CanvasState.selectedNode.dataset.filename}"吗？`;
        confirmModal.classList.remove('hidden');
        confirmModal.classList.add('flex');
        
        const handleConfirm = () => {
            const dontShowAgain = confirmModalCheckbox.checked;
            
            if (dontShowAgain) {
                localStorage.setItem('dontShowDeleteConfirm', 'true');
            }
            
            performDelete();
            closeConfirmModal();
        };
        
        const handleCancel = () => {
            closeConfirmModal();
        };
        
        const closeConfirmModal = () => {
            confirmModal.classList.add('hidden');
            confirmModal.classList.remove('flex');
            confirmModalOk.removeEventListener('click', handleConfirm);
            confirmModalCancel.removeEventListener('click', handleCancel);
        };
        
        confirmModalOk.addEventListener('click', handleConfirm);
        confirmModalCancel.addEventListener('click', handleCancel);
    };
    
    const performDelete = () => {
        const minimapImage = minimapCanvas?.querySelector(`[data-node-id="${CanvasState.selectedNode.dataset.index}"]`);
        if (minimapImage) {
            minimapImage.remove();
        }
        CanvasState.selectedNode.remove();
        CanvasState.selectedNode = null;
        debugLog(`[删除] 图片完成`, 'info');
    };
    
    const dontShowConfirm = localStorage.getItem('dontShowDeleteConfirm') === 'true';
    
    if (skipConfirm || dontShowConfirm) {
        performDelete();
    } else {
        showDeleteConfirm();
    }
}

export function pasteNode() {
    if (!clipboardNode) return;
    
    const imageUrl = clipboardNode.dataset.imageUrl;
    const prompt = clipboardNode.querySelector('.node-info')?.textContent || '';
    const filename = clipboardNode.dataset.filename;
    const resolution = `${clipboardNode.dataset.width || 500}x${clipboardNode.dataset.height || 500}`;
    
    const newNode = createImageNode(imageUrl, prompt, CanvasState.nodeCounter++, filename, resolution);
    
    const offsetX = 20;
    const offsetY = 20;
    const currentLeft = parseInt(clipboardNode.style.left) || 5000;
    const currentTop = parseInt(clipboardNode.style.top) || 5000;
    newNode.style.left = `${currentLeft + offsetX}px`;
    newNode.style.top = `${currentTop + offsetY}px`;
    
    const imageResponseContainer = getImageResponseContainer();
    if (imageResponseContainer) {
        imageResponseContainer.appendChild(newNode);
    }
    
    selectNode(newNode);
    updateMinimapWithImage(newNode);
    
    debugLog(`[粘贴] 图片: ${newNode.dataset.filename}`, 'info');
}

export function createImageNode(imageUrl, prompt = '', index = 0, filename = '', resolution = '', generationTime = null, modelName = '') {
    console.log('Creating image node...');
    
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
        updateImageCenterCoordinates(node);
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
    
    const toolbar = document.createElement('div');
    toolbar.className = 'node-toolbar';
    
    const copyPromptBtn = document.createElement('button');
    copyPromptBtn.className = 'toolbar-btn';
    copyPromptBtn.innerHTML = '📝';
    copyPromptBtn.title = '复制提示词';
    copyPromptBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(prompt || '').then(() => {
            if (DebugConsole.showMouseLogs) {
                debugLog(`[复制] 提示词: ${node.dataset.filename}`, 'info');
            }
        });
    });
    
    const insertBtn = document.createElement('button');
    insertBtn.className = 'toolbar-btn';
    insertBtn.innerHTML = '✏️';
    insertBtn.title = '插入到输入框';
    insertBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const img = node.querySelector('img');
        if (img) {
            const imageUrl = img.src;
            const filename = node.dataset.filename || 'Image';
            if (window.insertImageToPrompt) {
                window.insertImageToPrompt(imageUrl, filename);
            }
            debugLog(`[工具栏] 插入图片到输入框: node=${node.dataset.filename}`, 'info');
        }
    });
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'toolbar-btn';
    copyBtn.innerHTML = '📋';
    copyBtn.title = '复制图片';
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectNode(node);
        copySelectedNode();
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'toolbar-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = '删除图片';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectNode(node);
        deleteSelectedNode();
    });
    
    toolbar.appendChild(copyPromptBtn);
    toolbar.appendChild(insertBtn);
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(deleteBtn);
    
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
        debugLog(`[node-info 点击] prompt: ${prompt}, infoText: ${info.textContent}, textToCopy: ${textToCopy}`, 'info');
        navigator.clipboard.writeText(textToCopy).then(() => {
            debugLog(`[复制成功] ${textToCopy}`, 'success');
            info.classList.add('copied');
            setTimeout(() => {
                info.classList.remove('copied');
            }, 500);
        }).catch(err => {
            debugLog(`[复制失败] ${err}`, 'error');
        });
    });
    
    node.appendChild(header);
    node.appendChild(toolbar);
    node.appendChild(img);
    node.appendChild(resizeHandle);
    node.appendChild(info);
    node.appendChild(centerCoords);
    
    const sidebar = document.createElement('div');
    sidebar.className = 'node-sidebar';
    
    if (generationTime !== null && generationTime !== undefined) {
        const timeElement = document.createElement('div');
        timeElement.className = 'node-generation-time';
        timeElement.style.display = DebugConsole.showGenerationTime ? 'flex' : 'none';
        timeElement.textContent = formatGenerationTime(generationTime);
        timeElement.title = `生成耗时: ${generationTime.toFixed(2)}秒`;
        sidebar.appendChild(timeElement);
    }
    
    if (modelName) {
        const modelTag = document.createElement('div');
        modelTag.className = 'node-model-tag';
        modelTag.style.display = DebugConsole.showModelTag ? 'block' : 'none';
        if (typeof modelName === 'object' && modelName.name) {
            modelTag.innerHTML = `<div class="model-name">${modelName.name}</div><div class="model-provider">${modelName.provider}</div>`;
            modelTag.title = `${modelName.name} (${modelName.provider})`;
        } else {
            modelTag.textContent = modelName;
            modelTag.title = modelName;
        }
        sidebar.appendChild(modelTag);
    }
    
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
        
        updateImageCenterCoordinates(node);
        updateMinimapWithImage(node);
    };
    
    updateMinimapWithImage(node);
    
    img.addEventListener('click', (e) => {
        e.stopPropagation();
        if (DebugConsole.showMouseLogs) {
            debugLog(`图片点击: button=${e.button}, ctrlKey=${e.ctrlKey}, metaKey=${e.metaKey}, selected=${node.classList.contains('selected')}`, 'event');
        }
        if (e.ctrlKey || e.metaKey) {
            if (node.classList.contains('selected')) {
                if (DebugConsole.showMouseLogs) {
                    debugLog(`添加 PIN: 图片已选中`, 'info');
                }
                PinManager.addPinToImage(node, e);
            } else {
                if (DebugConsole.showMouseLogs) {
                    debugLog(`选中图片: 未选中，按住 Ctrl/Meta`, 'info');
                }
                selectNode(node);
            }
        } else {
            if (DebugConsole.showMouseLogs) {
                debugLog(`选中图片: 左键点击`, 'info');
            }
            selectNode(node);
        }
    });
    
    node.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-info')) return;
        if (DebugConsole.showMouseLogs) {
            debugLog(`[鼠标按下] 节点: button=${e.button}, clientX=${e.clientX}, clientY=${e.clientY}, selected=${node.classList.contains('selected')}, ctrlKey=${e.ctrlKey}, metaKey=${e.metaKey}`, 'event');
        }
        if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
            e.stopPropagation();
            selectNode(node);
            
            AppState.isDraggingNode = true;
            AppState.dragNode = node;
            AppState.activeNode = node;
            
            AppState.dragStartX = e.clientX;
            AppState.dragStartY = e.clientY;
            AppState.dragNodeStartLeft = parseInt(node.style.left || '0');
            AppState.dragNodeStartTop = parseInt(node.style.top || '0');
            
            if (DebugConsole.showMouseLogs) {
                debugLog(`[开始拖动] 图片: node=${node.dataset.filename}`, 'info');
            }
        }
    });
    
    node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showImageContextMenu(e, node, img);
    });
    
    img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showImageContextMenu(e, node, img);
    });
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        startResizeNode(e, node);
    });
    
    console.log('Node created:', node);
    return node;
}

export function createTextNode(text, prompt = '', index = 0, filename = '', resolution = '', generationTime = null, modelName = '') {
    const node = document.createElement('div');
    node.className = 'canvas-node text-node';
    node.dataset.index = index;
    node.dataset.filename = filename || `Text ${index + 1}`;
    node.dataset.nodeType = 'text';
    if (modelName) {
        node.dataset.modelName = modelName;
    }
    
    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    textContent.textContent = text;
    
    const toolbar = document.createElement('div');
    toolbar.className = 'node-toolbar';
    
    const copyPromptBtn = document.createElement('button');
    copyPromptBtn.className = 'toolbar-btn';
    copyPromptBtn.innerHTML = '📝';
    copyPromptBtn.title = '复制提示词';
    copyPromptBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(prompt || '').then(() => {
            if (DebugConsole.showMouseLogs) {
                debugLog(`[复制] 提示词: ${node.dataset.filename}`, 'info');
            }
        });
    });
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'toolbar-btn';
    copyBtn.innerHTML = '📋';
    copyBtn.title = '复制文本';
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
            if (DebugConsole.showMouseLogs) {
                debugLog(`[复制] 文本节点: ${node.dataset.filename}`, 'info');
            }
        });
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'toolbar-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = '删除节点';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectNode(node);
        deleteSelectedNode();
    });
    
    toolbar.appendChild(copyPromptBtn);
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(deleteBtn);
    
    node.appendChild(textContent);
    node.appendChild(toolbar);
    
    const sidebar = document.createElement('div');
    sidebar.className = 'node-sidebar';
    
    const timeElement = document.createElement('div');
    timeElement.className = 'node-generation-time';
    timeElement.style.display = DebugConsole.showGenerationTime ? 'flex' : 'none';
    if (generationTime !== null && generationTime !== undefined) {
        timeElement.textContent = formatGenerationTime(generationTime);
        timeElement.title = `生成耗时: ${generationTime.toFixed(2)}秒`;
    }
    sidebar.appendChild(timeElement);
    
    if (modelName) {
        const modelTag = document.createElement('div');
        modelTag.className = 'node-model-tag';
        modelTag.style.display = DebugConsole.showModelTag ? 'block' : 'none';
        if (typeof modelName === 'object' && modelName.name) {
            modelTag.innerHTML = `<div class="model-name">${modelName.name}</div><div class="model-provider">${modelName.provider}</div>`;
            modelTag.title = `${modelName.name} (${modelName.provider})`;
        } else {
            modelTag.textContent = modelName;
            modelTag.title = modelName;
        }
        sidebar.appendChild(modelTag);
    }
    node.appendChild(sidebar);
    
    const info = document.createElement('div');
    info.className = 'node-info';
    info.textContent = prompt || '文本回复';
    info.title = '点击复制提示词';
    info.addEventListener('click', (e) => {
        e.stopPropagation();
        const textToCopy = prompt || info.textContent;
        debugLog(`[node-info 点击] prompt: ${prompt}, textToCopy: ${textToCopy}`, 'info');
        navigator.clipboard.writeText(textToCopy).then(() => {
            debugLog(`[复制成功] ${textToCopy}`, 'success');
            info.classList.add('copied');
            setTimeout(() => {
                info.classList.remove('copied');
            }, 500);
        }).catch(err => {
            debugLog(`[复制失败] ${err}`, 'error');
        });
    });
    node.appendChild(info);
    
    node.style.left = '5000px';
    node.style.top = '5000px';
    node.style.zIndex = '10';
    
    node.addEventListener('mousedown', (e) => {
        if (e.button === 0 && !e.target.closest('.toolbar-btn')) {
            if (DebugConsole.showMouseLogs) {
                debugLog(`[开始拖动] 文本节点: ${node.dataset.filename}`, 'info');
            }
            selectNode(node);
            AppState.isDraggingNode = true;
            AppState.dragNode = node;
            AppState.dragStartX = e.clientX;
            AppState.dragStartY = e.clientY;
            AppState.dragNodeStartLeft = parseInt(node.style.left) || 5000;
            AppState.dragNodeStartTop = parseInt(node.style.top) || 5000;
            node.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });
    
    return node;
}

export function getSelectedNode() {
    return CanvasState.selectedNode;
}

export function getNodeCounter() {
    return CanvasState.nodeCounter;
}

export function incrementNodeCounter() {
    return CanvasState.nodeCounter++;
}

export function showImageContextMenu(e, node, img) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    
    const copyItem = document.createElement('div');
    copyItem.className = 'context-menu-item';
    copyItem.textContent = '复制图片';
    copyItem.addEventListener('click', () => {
        if (img.src.startsWith('data:')) {
            navigator.clipboard.writeText(img.src).then(() => {
                console.log('图片已复制到剪贴板');
            }).catch(err => {
                console.error('复制失败:', err);
            });
        } else {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
                navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ]).then(() => {
                    console.log('图片已复制到剪贴板');
                }).catch(err => {
                    console.error('复制失败:', err);
                });
            });
        }
        menu.remove();
    });
    
    const downloadItem = document.createElement('div');
    downloadItem.className = 'context-menu-item';
    downloadItem.textContent = '下载图片';
    downloadItem.addEventListener('click', () => {
        const filename = node.dataset.filename || 'image.png';
        const link = document.createElement('a');
        link.href = img.src;
        link.download = filename;
        link.click();
        menu.remove();
    });
    
    const insertItem = document.createElement('div');
    insertItem.className = 'context-menu-item';
    insertItem.textContent = '插入到输入框';
    insertItem.addEventListener('click', () => {
        if (window.addCanvasImageToPrompt) {
            window.addCanvasImageToPrompt(node);
        }
        menu.remove();
    });
    
    menu.appendChild(copyItem);
    menu.appendChild(downloadItem);
    menu.appendChild(insertItem);
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', (clickEvent) => {
            if (!menu.contains(clickEvent.target)) {
                menu.remove();
            }
        }, { once: true });
    }, 100);
}
