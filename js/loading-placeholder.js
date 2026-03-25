import { AppState } from './app-state.js';
import { CanvasState } from './app-state.js';
import { DebugConsole } from './debug-console.js';
import { selectNode, deleteSelectedNode, copySelectedNode } from './node-manager.js';
import { updateMinimapWithImage, updateImageCenterCoordinates } from './canvas-manager.js';
import { formatGenerationTime, debugLog } from './utils.js';
import { PinManager } from './pin-manager.js';

function incrementNodeCounter() {
    return CanvasState.nodeCounter++;
}

export function createTextLoadingPlaceholder(prompt, x, y, modelName = '') {
    const node = document.createElement('div');
    node.className = 'canvas-node text-loading-placeholder';
    node.dataset.index = incrementNodeCounter();
    node.dataset.filename = 'Loading...';
    node.dataset.modelName = modelName;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    
    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.textContent = '正在生成回复...';
    
    node.appendChild(loadingText);
    
    const sidebar = document.createElement('div');
    sidebar.className = 'node-sidebar';
    
    const timeElement = document.createElement('div');
    timeElement.className = 'node-generation-time';
    timeElement.style.display = DebugConsole.showGenerationTime ? 'flex' : 'none';
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
    
    const centerCoords = document.createElement('div');
    centerCoords.className = 'node-center-coords';
    centerCoords.textContent = '(0, 0)';
    centerCoords.style.display = 'none';
    node.appendChild(centerCoords);
    
    node.style.width = '400px';
    node.style.height = '200px';
    
    node.addEventListener('mousedown', (e) => {
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
    
    return node;
}

export function updateTextLoadingPlaceholder(node, text, prompt, generationTime = null, modelName = '') {
    node.classList.remove('text-loading-placeholder');
    node.classList.add('text-node');
    node.dataset.filename = `Text ${node.dataset.index}`;
    node.dataset.nodeType = 'text';
    if (modelName) {
        node.dataset.modelName = modelName;
    }
    node.style.height = '';
    
    const loadingText = node.querySelector('.loading-text');
    if (loadingText) {
        loadingText.remove();
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
    
    setTimeout(() => {
        const left = parseInt(node.style.left) || 0;
        const top = parseInt(node.style.top) || 0;
        const width = node.offsetWidth || 400;
        const height = node.offsetHeight || 200;
        const centerX = Math.round(left + width / 2);
        const centerY = Math.round(top + height / 2);
        const coordsElement = node.querySelector('.node-center-coords');
        if (coordsElement) {
            coordsElement.textContent = `(${centerX}, ${centerY})`;
        }
    }, 0);
    
    const sidebar = node.querySelector('.node-sidebar');
    if (sidebar) {
        const timeElement = sidebar.querySelector('.node-generation-time');
        if (timeElement) {
            timeElement.style.display = DebugConsole.showGenerationTime ? 'flex' : 'none';
            if (generationTime !== null && generationTime !== undefined) {
                timeElement.textContent = formatGenerationTime(generationTime);
                timeElement.title = `生成耗时: ${generationTime.toFixed(2)}秒`;
            }
        }
        
        if (modelName) {
            const existingModelTag = sidebar.querySelector('.node-model-tag');
            if (!existingModelTag) {
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
        }
    }
    
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
}

export function createLoadingPlaceholder(width, height, x, y, modelName = '') {
    const node = document.createElement('div');
    node.className = 'canvas-node loading-placeholder';
    node.dataset.index = incrementNodeCounter();
    node.dataset.filename = 'Loading...';
    node.dataset.modelName = modelName;
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.zIndex = '10';
    
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    loadingContainer.style.width = '100%';
    loadingContainer.style.height = '100%';
    loadingContainer.style.display = 'flex';
    loadingContainer.style.flexDirection = 'column';
    loadingContainer.style.justifyContent = 'center';
    loadingContainer.style.alignItems = 'center';
    loadingContainer.style.backgroundColor = '#f3f4f6';
    loadingContainer.style.borderRadius = '8px';
    loadingContainer.style.border = '1px solid #e5e7eb';
    
    const loadingBar = document.createElement('div');
    loadingBar.className = 'loading-bar';
    loadingBar.style.width = '60%';
    loadingBar.style.height = '4px';
    loadingBar.style.backgroundColor = '#e5e7eb';
    loadingBar.style.borderRadius = '2px';
    loadingBar.style.overflow = 'hidden';
    
    const loadingProgress = document.createElement('div');
    loadingProgress.className = 'loading-progress';
    loadingProgress.style.width = '100%';
    loadingProgress.style.height = '100%';
    loadingProgress.style.backgroundColor = '#3b82f6';
    loadingProgress.style.borderRadius = '2px';
    loadingProgress.style.animation = 'loading 1.5s ease-in-out infinite';
    
    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.textContent = '正在生成图片...';
    loadingText.style.marginTop = '12px';
    loadingText.style.fontSize = '14px';
    loadingText.style.color = '#6b7280';
    
    loadingBar.appendChild(loadingProgress);
    loadingContainer.appendChild(loadingBar);
    loadingContainer.appendChild(loadingText);
    
    const header = document.createElement('div');
    header.className = 'node-header';
    
    const filenameElement = document.createElement('div');
    filenameElement.className = 'node-filename';
    filenameElement.textContent = 'Loading...';
    
    const resolutionElement = document.createElement('div');
    resolutionElement.className = 'node-resolution';
    resolutionElement.textContent = 'Generating...';
    
    header.appendChild(filenameElement);
    header.appendChild(resolutionElement);
    
    const toolbar = document.createElement('div');
    toolbar.className = 'node-toolbar';
    
    const copyPromptBtn = document.createElement('button');
    copyPromptBtn.className = 'toolbar-btn';
    copyPromptBtn.innerHTML = '📝';
    copyPromptBtn.title = '复制提示词';
    copyPromptBtn.disabled = true;
    copyPromptBtn.style.opacity = '0.5';
    
    const insertBtn = document.createElement('button');
    insertBtn.className = 'toolbar-btn';
    insertBtn.innerHTML = '✏️';
    insertBtn.title = '插入到输入框';
    insertBtn.disabled = true;
    insertBtn.style.opacity = '0.5';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'toolbar-btn';
    copyBtn.innerHTML = '📋';
    copyBtn.title = '复制图片';
    copyBtn.disabled = true;
    copyBtn.style.opacity = '0.5';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'toolbar-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = '删除图片';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const confirmModal = document.getElementById('confirmModal');
        const confirmModalMessage = document.getElementById('confirmModalMessage');
        const confirmModalCheckbox = document.getElementById('confirmModalCheckbox');
        const confirmModalCancel = document.getElementById('confirmModalCancel');
        const confirmModalOk = document.getElementById('confirmModalOk');
        
        confirmModalMessage.textContent = '确定要取消生成吗？';
        confirmModalCheckbox.parentElement.style.display = 'none';
        confirmModal.classList.remove('hidden');
        confirmModal.classList.add('flex');
        
        const handleConfirm = () => {
            const minimapCanvas = document.getElementById('minimapCanvas');
            const minimapImage = minimapCanvas.querySelector(`[data-node-id="${node.dataset.index}"]`);
            if (minimapImage) {
                minimapImage.remove();
            }
            node.remove();
            closeConfirmModal();
        };
        
        const handleCancel = () => {
            closeConfirmModal();
        };
        
        const closeConfirmModal = () => {
            confirmModal.classList.add('hidden');
            confirmModal.classList.remove('flex');
            confirmModalCheckbox.parentElement.style.display = 'flex';
            confirmModalOk.removeEventListener('click', handleConfirm);
            confirmModalCancel.removeEventListener('click', handleCancel);
        };
        
        confirmModalOk.addEventListener('click', handleConfirm);
        confirmModalCancel.addEventListener('click', handleCancel);
    });
    
    toolbar.appendChild(copyPromptBtn);
    toolbar.appendChild(insertBtn);
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(deleteBtn);
    
    const info = document.createElement('div');
    info.className = 'node-info';
    info.textContent = 'Loading...';
    
    node.appendChild(header);
    node.appendChild(toolbar);
    node.appendChild(loadingContainer);
    node.appendChild(info);
    
    const sidebar = document.createElement('div');
    sidebar.className = 'node-sidebar';
    
    const timeElement = document.createElement('div');
    timeElement.className = 'node-generation-time';
    timeElement.style.display = DebugConsole.showGenerationTime ? 'flex' : 'none';
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
    
    node.addEventListener('mousedown', (e) => {
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
    
    return node;
}

export function updateLoadingPlaceholder(node, imageUrl, prompt, filename, resolution, generationTime = null, modelName = '', revisedPrompt = null) {
    node.classList.remove('loading-placeholder');
    node.dataset.imageUrl = imageUrl;
    node.dataset.filename = filename || `Image ${node.dataset.index}`;
    if (modelName) {
        node.dataset.modelName = modelName;
    }
    if (revisedPrompt) {
        node.dataset.revisedPrompt = revisedPrompt;
    }
    
    const loadingContainer = node.querySelector('.loading-container');
    if (loadingContainer) {
        loadingContainer.remove();
    }
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `Generated image ${node.dataset.index}`;
    img.draggable = false;
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    
    const centerCoords = document.createElement('div');
    centerCoords.className = 'node-center-coords';
    centerCoords.textContent = '(0, 0)';
    
    const filenameElement = node.querySelector('.node-filename');
    if (filenameElement) {
        filenameElement.textContent = filename || `Image ${node.dataset.index}`;
    }
    
    const resolutionElement = node.querySelector('.node-resolution');
    if (resolutionElement) {
        resolutionElement.textContent = resolution || 'Loading...';
    }
    
    const info = node.querySelector('.node-info');
    if (info) {
        info.textContent = prompt || `Image ${node.dataset.index}`;
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
    }
    
    const toolbarButtons = node.querySelectorAll('.toolbar-btn');
    toolbarButtons.forEach((btn, index) => {
        if (index < 3) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (index === 0) {
                    navigator.clipboard.writeText(prompt || '').then(() => {
                        if (DebugConsole.showMouseLogs) {
                            debugLog(`[复制] 提示词: ${node.dataset.filename}`, 'info');
                        }
                    });
                } else if (index === 1) {
                    const imgElement = node.querySelector('img');
                    if (imgElement) {
                        if (typeof window.insertImageToPrompt === 'function') {
                            window.insertImageToPrompt(imgElement.src, node.dataset.filename || 'Image');
                        }
                        debugLog(`[工具栏] 插入图片到输入框: node=${node.dataset.filename}`, 'info');
                    }
                } else if (index === 2) {
                    selectNode(node);
                    copySelectedNode();
                    debugLog(`[工具栏] 复制图片: node=${node.dataset.filename}`, 'info');
                }
            });
        }
    });
    
    img.onload = function() {
        const actualWidth = this.naturalWidth || parseInt(this.style.width) || 500;
        const actualHeight = this.naturalHeight || parseInt(this.style.height) || 500;
        
        const maxWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvas-node-max-width')) || 300;
        const maxHeight = 300;
        
        let displayWidth = actualWidth;
        let displayHeight = actualHeight;
        
        if (displayWidth > maxWidth) {
            const ratio = maxWidth / displayWidth;
            displayWidth = maxWidth;
            displayHeight = Math.floor(displayHeight * ratio);
        }
        
        if (displayHeight > maxHeight) {
            const ratio = maxHeight / displayHeight;
            displayHeight = maxHeight;
            displayWidth = Math.floor(displayWidth * ratio);
        }
        
        node.style.width = `${displayWidth}px`;
        node.style.height = `${displayHeight}px`;
        
        this.style.width = '100%';
        this.style.height = '100%';
        this.style.objectFit = 'contain';
        
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
    
    const header = node.querySelector('.node-header');
    const toolbar = node.querySelector('.node-toolbar');
    const infoElement = node.querySelector('.node-info');
    const sidebar = node.querySelector('.node-sidebar');
    
    if (header && toolbar && infoElement) {
        const children = [...node.children];
        children.forEach(child => {
            if (child !== header && child !== toolbar && child !== infoElement && child !== sidebar) {
                child.remove();
            }
        });
        
        node.insertBefore(img, infoElement);
        node.insertBefore(resizeHandle, infoElement);
        node.insertBefore(centerCoords, infoElement);
        
        if (revisedPrompt) {
            const existingPromptContainer = node.querySelector('.revised-prompt-container');
            if (existingPromptContainer) {
                existingPromptContainer.remove();
            }
            
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
                const providerName = typeof modelName === 'object' ? (modelName?.name || modelName?.provider || 'unknown') : (modelName || 'unknown');
                console.log(`%c[UI] User clicked: revisedPromptToggle | Provider: ${providerName} | Expanded: ${!isExpanded}`, 'color: #3b82f6; font-weight: bold');
            });
            
            promptContainer.appendChild(promptHeader);
            promptContainer.appendChild(promptContent);
            node.insertBefore(promptContainer, infoElement);
        }
    }
    
    if (sidebar) {
        const existingModelTag = sidebar.querySelector('.node-model-tag');
        if (modelName && !existingModelTag) {
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
        
        const timeElement = sidebar.querySelector('.node-generation-time');
        if (timeElement && generationTime !== null) {
            timeElement.textContent = formatGenerationTime(generationTime);
            timeElement.title = `生成耗时: ${generationTime.toFixed(2)}秒`;
        }
    }
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        AppState.isResizingNode = true;
        AppState.resizeNode = node;
        AppState.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: img.width,
            height: img.height
        };
        document.body.style.cursor = 'nwse-resize';
    });
    
    node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const img = node.querySelector('img');
        if (typeof window.showImageContextMenu === 'function') {
            window.showImageContextMenu(e, node, img);
        }
    });
    
    img.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
            if (node.classList.contains('selected')) {
                PinManager.addPinToImage(node, e);
            }
        }
    });
    
    node.dataset.pins = JSON.stringify([]);
    
    selectNode(node);
    updateMinimapWithImage(node);
    
    return node;
}

export function createErrorNode(errorMessage, x, y, modelName = '') {
    const node = document.createElement('div');
    node.className = 'canvas-node error-node';
    node.dataset.index = incrementNodeCounter();
    node.dataset.filename = 'Error';
    node.dataset.modelName = modelName;
    node.dataset.errorMessage = errorMessage;
    node.style.width = '320px';
    node.style.height = '180px';
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.zIndex = '10';
    node.style.backgroundColor = '#fef2f2';
    node.style.border = '2px solid #fecaca';
    node.style.borderRadius = '8px';
    
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
    errorContainer.style.cursor = 'pointer';
    
    const errorIcon = document.createElement('div');
    errorIcon.innerHTML = '⚠️';
    errorIcon.style.fontSize = '32px';
    errorIcon.style.marginBottom = '8px';
    
    const errorTitle = document.createElement('div');
    errorTitle.textContent = '生成失败';
    errorTitle.style.fontSize = '14px';
    errorTitle.style.fontWeight = '600';
    errorTitle.style.color = '#dc2626';
    errorTitle.style.marginBottom = '8px';
    
    const errorText = document.createElement('div');
    errorText.textContent = errorMessage.length > 80 ? errorMessage.substring(0, 80) + '...' : errorMessage;
    errorText.style.fontSize = '11px';
    errorText.style.color = '#991b1b';
    errorText.style.textAlign = 'center';
    errorText.style.wordBreak = 'break-word';
    errorText.style.maxHeight = '60px';
    errorText.style.overflow = 'hidden';
    errorText.title = errorMessage;
    
    errorContainer.appendChild(errorIcon);
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorText);
    
    const header = document.createElement('div');
    header.className = 'node-header';
    
    const filenameElement = document.createElement('div');
    filenameElement.className = 'node-filename';
    filenameElement.textContent = 'Error';
    
    const resolutionElement = document.createElement('div');
    resolutionElement.className = 'node-resolution';
    resolutionElement.textContent = 'Failed';
    
    header.appendChild(filenameElement);
    header.appendChild(resolutionElement);
    
    const toolbar = document.createElement('div');
    toolbar.className = 'node-toolbar';
    
    const copyErrorBtn = document.createElement('button');
    copyErrorBtn.className = 'toolbar-btn';
    copyErrorBtn.innerHTML = '📋';
    copyErrorBtn.title = '复制错误信息';
    copyErrorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(errorMessage).then(() => {
            const originalTitle = copyErrorBtn.title;
            copyErrorBtn.title = '已复制!';
            setTimeout(() => copyErrorBtn.title = originalTitle, 1500);
        });
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'toolbar-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = '删除';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const confirmModal = document.getElementById('confirmModal');
        const confirmModalMessage = document.getElementById('confirmModalMessage');
        const confirmModalCheckbox = document.getElementById('confirmModalCheckbox');
        const confirmModalCancel = document.getElementById('confirmModalCancel');
        const confirmModalOk = document.getElementById('confirmModalOk');
        
        confirmModalMessage.textContent = '确定要删除这个错误节点吗？';
        confirmModalCheckbox.parentElement.style.display = 'none';
        confirmModal.classList.remove('hidden');
        confirmModal.classList.add('flex');
        
        const handleConfirm = () => {
            const minimapCanvas = document.getElementById('minimapCanvas');
            if (minimapCanvas) {
                const minimapImage = minimapCanvas.querySelector(`[data-node-id="${node.dataset.index}"]`);
                if (minimapImage) minimapImage.remove();
            }
            node.remove();
            closeConfirmModal();
        };
        
        const handleCancel = () => {
            closeConfirmModal();
        };
        
        confirmModalOk.onclick = handleConfirm;
        confirmModalCancel.onclick = handleCancel;
    });
    
    toolbar.appendChild(copyErrorBtn);
    toolbar.appendChild(deleteBtn);
    
    const infoElement = document.createElement('div');
    infoElement.className = 'node-info';
    infoElement.style.display = 'none';
    
    const sidebar = document.createElement('div');
    sidebar.className = 'node-sidebar';
    
    const generationTimeElement = document.createElement('div');
    generationTimeElement.className = 'node-generation-time';
    generationTimeElement.style.display = DebugConsole.showGenerationTime ? 'flex' : 'none';
    generationTimeElement.textContent = new Date().toLocaleTimeString();
    generationTimeElement.title = `生成时间: ${generationTimeElement.textContent}`;
    sidebar.appendChild(generationTimeElement);
    
    if (modelName) {
        const modelTag = document.createElement('div');
        modelTag.className = 'node-model-tag';
        modelTag.style.display = DebugConsole.showModelTag ? 'block' : 'none';
        modelTag.textContent = modelName;
        modelTag.title = modelName;
        sidebar.appendChild(modelTag);
    }
    
    node.appendChild(errorContainer);
    node.appendChild(header);
    node.appendChild(toolbar);
    node.appendChild(infoElement);
    node.appendChild(sidebar);
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    
    const centerCoords = document.createElement('div');
    centerCoords.className = 'node-center-coords';
    
    node.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-toolbar')) return;
        if (DebugConsole.showMouseLogs) {
            debugLog(`[鼠标按下] 节点: button=${e.button}, ctrlKey=${e.ctrlKey}, metaKey=${e.metaKey}`, 'event');
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
                debugLog(`[开始拖动] 错误节点`, 'info');
            }
        }
    });
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });
    
    errorContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(errorMessage).then(() => {
            debugLog(`[复制] 错误信息已复制`, 'info');
        });
    });
    
    node.dataset.pins = JSON.stringify([]);
    
    selectNode(node);
    updateMinimapWithImage(node);
    
    return node;
}
