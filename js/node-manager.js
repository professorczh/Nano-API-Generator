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
        
        const nodeType = CanvasState.selectedNode.dataset.nodeType || 'image';
        const typeLabel = nodeType === 'video' ? '视频' : '图片';
        confirmModalMessage.textContent = `确定要删除${typeLabel}"${CanvasState.selectedNode.dataset.filename}"吗？`;
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
    
    const nodeType = clipboardNode.dataset.nodeType;
    let newNode;
    
    if (nodeType === 'video') {
        const videoUrl = clipboardNode.dataset.videoUrl;
        const prompt = clipboardNode.querySelector('.node-info')?.textContent || '';
        const filename = clipboardNode.dataset.filename || 'Video';
        const resolution = `${clipboardNode.dataset.width || 1920}x${clipboardNode.dataset.height || 1080}`;
        
        if (!videoUrl) {
            debugLog('[粘贴] 视频节点缺少 videoUrl', 'error');
            return;
        }
        
        const currentLeft = parseInt(clipboardNode.style.left) || 5000;
        const currentTop = parseInt(clipboardNode.style.top) || 5000;
        
        newNode = NodeFactory.createVideoPlaceholder(currentLeft + 20, currentTop + 20, prompt, '', '16:9');
        newNode.style.left = `${currentLeft + 20}px`;
        newNode.style.top = `${currentTop + 20}px`;
        
        NodeFactory.replaceWithVideo(newNode, videoUrl, prompt, '', null, '16:9');
        
        const imageResponseContainer = getImageResponseContainer();
        if (imageResponseContainer) {
            imageResponseContainer.appendChild(newNode);
        }
        
        debugLog(`[粘贴] 视频: ${filename}`, 'info');
        
        selectNode(newNode);
        updateMinimapWithImage(newNode);
    } else {
        const imageUrl = clipboardNode.dataset.imageUrl;
        if (!imageUrl) {
            debugLog('[粘贴] 剪贴板中无图片数据', 'warning');
            return;
        }
        
        const prompt = clipboardNode.querySelector('.node-info')?.textContent || '';
        const filename = clipboardNode.dataset.filename;
        const resolution = `${clipboardNode.dataset.width || 500}x${clipboardNode.dataset.height || 500}`;
        
        const currentLeft = parseInt(clipboardNode.style.left) || 5000;
        const currentTop = parseInt(clipboardNode.style.top) || 5000;
        
        newNode = createImageNode(imageUrl, prompt, CanvasState.nodeCounter++, filename, resolution);
        newNode.style.left = `${currentLeft + 20}px`;
        newNode.style.top = `${currentTop + 20}px`;
        
        const imageResponseContainer = getImageResponseContainer();
        if (imageResponseContainer) {
            imageResponseContainer.appendChild(newNode);
        }
        
        selectNode(newNode);
        updateMinimapWithImage(newNode);
        
        debugLog(`[粘贴] 图片: ${newNode.dataset.filename}`, 'info');
    }
}

export function createImageNode(imageUrl, prompt = '', index = 0, filename = '', resolution = '', generationTime = null, modelName = '', errorMessage = null, x = null, y = null, revisedPrompt = null) {
    console.log('Creating image node...');
    
    const node = document.createElement('div');
    node.className = 'canvas-node' + (errorMessage ? ' error-node' : '');
    node.dataset.index = index;
    node.dataset.imageUrl = imageUrl;
    node.dataset.filename = filename || (errorMessage ? 'Error' : `Image ${index + 1}`);
    node.dataset.prompt = prompt || '';
    if (errorMessage) {
        node.dataset.errorMessage = errorMessage;
    }
    if (revisedPrompt) {
        node.dataset.revisedPrompt = revisedPrompt;
    }
    
    if (errorMessage) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-container';
        errorContainer.style.width = '100%';
        errorContainer.style.height = '100%';
        errorContainer.style.display = 'flex';
        errorContainer.style.flexDirection = 'column';
        errorContainer.style.justifyContent = 'center';
        errorContainer.style.alignItems = 'center';
        errorContainer.style.padding = '16px';
        errorContainer.style.boxSizing = 'border-box';
        errorContainer.style.backgroundColor = '#fef2f2';
        errorContainer.style.borderRadius = '8px';
        
        const errorIcon = document.createElement('div');
        errorIcon.innerHTML = '⚠️';
        errorIcon.style.fontSize = '24px';
        errorIcon.style.marginBottom = '8px';
        
        const errorText = document.createElement('div');
        errorText.textContent = errorMessage.length > 60 ? errorMessage.substring(0, 60) + '...' : errorMessage;
        errorText.style.fontSize = '11px';
        errorText.style.color = '#dc2626';
        errorText.style.textAlign = 'center';
        errorText.style.wordBreak = 'break-word';
        errorText.style.maxHeight = '80px';
        errorText.style.overflow = 'hidden';
        errorText.title = errorMessage;
        
        errorContainer.appendChild(errorIcon);
        errorContainer.appendChild(errorText);
        node.appendChild(errorContainer);
    } else {
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
        
        node.appendChild(img);
        
        if (revisedPrompt) {
            const promptContainer = document.createElement('div');
            promptContainer.className = 'revised-prompt-container';
            promptContainer.style.marginTop = '4px';
            promptContainer.style.borderTop = '1px solid #e5e7eb';
            promptContainer.style.paddingTop = '4px';
            
            const promptHeader = document.createElement('div');
            promptHeader.className = 'revised-prompt-header';
            promptHeader.style.display = 'flex';
            promptHeader.style.alignItems = 'center';
            promptHeader.style.cursor = 'pointer';
            promptHeader.style.fontSize = '11px';
            promptHeader.style.color = '#6b7280';
            promptHeader.style.userSelect = 'none';
            
            const promptIcon = document.createElement('span');
            promptIcon.textContent = '📝';
            promptIcon.style.marginRight = '4px';
            
            const promptTitle = document.createElement('span');
            promptTitle.textContent = 'Revised Prompt';
            promptTitle.style.fontWeight = '500';
            
            const promptArrow = document.createElement('span');
            promptArrow.textContent = ' ▼';
            promptArrow.style.marginLeft = 'auto';
            promptArrow.style.fontSize = '8px';
            
            promptHeader.appendChild(promptIcon);
            promptHeader.appendChild(promptTitle);
            promptHeader.appendChild(promptArrow);
            
            const promptContent = document.createElement('div');
            promptContent.className = 'revised-prompt-content';
            promptContent.style.display = 'none';
            promptContent.style.fontSize = '10px';
            promptContent.style.color = '#4b5563';
            promptContent.style.marginTop = '4px';
            promptContent.style.lineHeight = '1.4';
            promptContent.style.wordBreak = 'break-word';
            promptContent.style.maxHeight = '80px';
            promptContent.style.overflowY = 'auto';
            promptContent.textContent = revisedPrompt;
            
            promptHeader.addEventListener('click', () => {
                const isExpanded = promptContent.style.display !== 'none';
                promptContent.style.display = isExpanded ? 'none' : 'block';
                promptArrow.textContent = isExpanded ? ' ▼' : ' ▲';
                console.log(`%c[UI] User clicked: revisedPromptToggle | Provider: ${modelName || 'unknown'} | Expanded: ${!isExpanded}`, 'color: #3b82f6; font-weight: bold');
            });
            
            promptContainer.appendChild(promptHeader);
            promptContainer.appendChild(promptContent);
            node.appendChild(promptContainer);
        }
    }
    
    const header = document.createElement('div');
    header.className = 'node-header';
    
    const filenameElement = document.createElement('div');
    filenameElement.className = 'node-filename';
    filenameElement.textContent = filename || (errorMessage ? 'Error' : `Image ${index + 1}`);
    
    const resolutionElement = document.createElement('div');
    resolutionElement.className = 'node-resolution';
    resolutionElement.textContent = errorMessage ? 'Failed' : (resolution || 'Loading...');
    
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
        if (errorMessage) return;
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
    if (errorMessage) {
        insertBtn.style.opacity = '0.5';
        insertBtn.disabled = true;
    }
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'toolbar-btn';
    copyBtn.innerHTML = '📋';
    copyBtn.title = '复制图片';
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (errorMessage) return;
        selectNode(node);
        copySelectedNode();
    });
    if (errorMessage) {
        copyBtn.style.opacity = '0.5';
        copyBtn.disabled = true;
    }
    
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
    if (!errorMessage) {
        const img = node.querySelector('img');
        if (img) node.appendChild(img);
    }
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
    
    if (errorMessage) {
        node.style.width = '320px';
        node.style.height = '180px';
    }
    
    const width = errorMessage ? (parseInt(node.style.width) || 320) : (parseInt(resolution?.split('x')[0]) || 500);
    const height = errorMessage ? (parseInt(node.style.height) || 180) : (parseInt(resolution?.split('x')[1]) || 500);
    node.style.left = x !== null ? `${x}px` : `${5000 - width / 2}px`;
    node.style.top = y !== null ? `${y}px` : `${5000 - height / 2}px`;
    node.style.zIndex = '10';
    
    if (!errorMessage) {
        node.style.width = `${width}px`;
        node.style.height = `${height}px`;
    }
    
    if (!errorMessage) {
        const img = node.querySelector('img');
        if (img) {
            img.onload = function() {
                const actualWidth = this.naturalWidth || parseInt(this.style.width) || 500;
                const actualHeight = this.naturalHeight || parseInt(this.style.height) || 500;
                
                if (x !== null) {
                    node.style.left = `${x}px`;
                } else {
                    node.style.left = `${5000 - actualWidth / 2}px`;
                }
                if (y !== null) {
                    node.style.top = `${y}px`;
                } else {
                    node.style.top = `${5000 - actualHeight / 2}px`;
                }
                
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
        }
    }
    
    if (!errorMessage) {
        const img = node.querySelector('img');
        if (img) {
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
        }
    }
    
    if (!errorMessage) {
        const img = node.querySelector('img');
        if (img) {
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
        }
    } else {
        node.addEventListener('mousedown', (e) => {
            if (e.target.closest('.node-info')) return;
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
            }
        });
    }
    
    node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!errorMessage) {
            const img = node.querySelector('img');
            showImageContextMenu(e, node, img);
        } else {
            selectNode(node);
        }
    });
    
    if (!errorMessage) {
        const img = node.querySelector('img');
        if (img) {
            img.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showImageContextMenu(e, node, img);
            });
        }
    }
    
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
