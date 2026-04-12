import { AppState } from './app-state.js';
import { CanvasState } from './app-state.js';
import { DebugConsole } from './debug-console.js';
import { selectNode, deleteSelectedNode, copySelectedNode } from './node-manager.js';
import { updateMinimapWithImage, updateImageCenterCoordinates } from './canvas-manager.js';
import { formatGenerationTime, debugLog, createNodeToolbar } from './utils.js';
import { PinManager } from './pin-manager.js';
import { getIcon } from './icons.js';
import { promptPanelManager } from './prompt-panel-manager.js';

function incrementNodeCounter() {
    return CanvasState.nodeCounter++;
}

export function createTextLoadingPlaceholder(prompt, x, y, modelName = '') {
    const node = document.createElement('div');
    node.className = 'canvas-node text-loading-placeholder';
    node.dataset.index = incrementNodeCounter();
    node.dataset.filename = 'Response';
    node.dataset.modelName = modelName;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = '400px';
    node.style.height = '300px';

    // 1. 标准页眉
    const header = document.createElement('div');
    header.className = 'node-header';
    header.innerHTML = `<div class="node-filename">${getIcon('message-square', 12)} Response</div><div class="node-resolution">Generating...</div>`;
    
    // 2. 统一内容容器
    const contentArea = document.createElement('div');
    contentArea.className = 'node-content';
    contentArea.style.cssText = 'display:flex;align-items:center;justify-content:center;background:rgba(239,246,255,0.5);border-radius:12px;';
    contentArea.innerHTML = `<div class="loading-text" style="color:#3b82f6;font-weight:600;">正在生成回复...</div>`;
    
    // 3. 预制工具栏
    const toolbar = createNodeToolbar('text', {
        onCopyPrompt: () => navigator.clipboard.writeText(prompt || ''),
        onCopyNode: () => { 
            selectNode(node); 
            copySelectedNode(); 
            console.log(`%c[Copy] Node #${node.dataset.index} copied to clipboard buffer.`, 'color: #10b981; font-weight: bold');
        },
        onDelete: () => { node.remove(); }
    });
    toolbar.querySelectorAll('.toolbar-btn').forEach(b => { 
        if(!b.classList.contains('danger')) { b.disabled = true; b.style.opacity = '0.5'; }
    });

    // 4. 信息与侧边栏
    const info = document.createElement('div');
    info.className = 'node-info';
    info.textContent = prompt || '文本回复';

    const sidebar = document.createElement('div');
    sidebar.className = 'node-sidebar';
    
    // 标准化注入
    node.appendChild(header);
    node.appendChild(contentArea);
    node.appendChild(toolbar);
    node.appendChild(info);
    node.appendChild(sidebar);

    const timeElement = document.createElement('div');
    timeElement.className = 'node-generation-time';
    timeElement.style.display = (typeof DebugConsole !== 'undefined' && DebugConsole.showGenerationTime === false) ? 'none' : 'flex';
    timeElement.innerHTML = `${getIcon('clock', 12)} <span>0.0s</span>`;
    sidebar.appendChild(timeElement);

    if (modelName) {
        const modelTag = document.createElement('div');
        modelTag.className = 'node-model-tag';
        let _dn = modelName, _pn = '';
        if (typeof modelName === 'object' && modelName && modelName.name) {
            _dn = modelName.name; _pn = modelName.provider || '';
        }
        if (_pn) {
            modelTag.innerHTML = `<span class="model-name">${_dn}</span><span class="model-sep">·</span><span class="model-provider">${_pn.toUpperCase()}</span>`;
            modelTag.title = `${_dn} (${_pn})`;
        } else {
            modelTag.innerHTML = `<span class="model-name">${_dn}</span>`;
            modelTag.title = _dn;
        }
        sidebar.appendChild(modelTag);
    }
    
    node.addEventListener('mousedown', (e) => {
        if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
            e.stopPropagation();
            selectNode(node);
            AppState.isDraggingNode = true; AppState.dragNode = node; AppState.activeNode = node;
            AppState.dragStartX = e.clientX; AppState.dragStartY = e.clientY;
            AppState.dragNodeStartLeft = parseInt(node.style.left || '0');
            AppState.dragNodeStartTop = parseInt(node.style.top || '0');
        }
    });
    
    return node;
}

export function updateTextLoadingPlaceholder(node, text, prompt, generationTime = null, modelName = '') {
    node.classList.remove('text-loading-placeholder');
    node.classList.add('text-node');
    node.dataset.filename = `Response #${node.dataset.index}`;
    node.dataset.nodeType = 'text';
    // 核心稳定性加固：不再在这里重置 style.height，由 CSS 或原始 inline 样式维持 300px 以对齐坐标计算。
    
    // 1. 更新核心内容区
    const contentArea = node.querySelector('.node-content');
    if (contentArea) {
        contentArea.innerHTML = '';
        const textContent = document.createElement('div');
        textContent.className = 'text-content';
        textContent.textContent = text;
        contentArea.appendChild(textContent);
    }
    
    // 2. 激活工具栏按钮并绑定事件
    const toolbar = node.querySelector('.node-toolbar');
    if (toolbar) {
        const buttons = toolbar.querySelectorAll('.toolbar-btn');
        const copyBtn = toolbar.querySelector('[title="复制文本内容"]');
        const recallBtn = toolbar.querySelector('[id="editNode"]'); // 📝
        
        buttons.forEach(btn => {
            // 核心对齐：文字节点只有 2 号位 (@) 保持禁用，其余物理开启
            if (btn.title.includes("引用到输入框")) {
                btn.disabled = true;
                btn.setAttribute('disabled', 'true');
            } else {
                btn.disabled = false;
                btn.removeAttribute('disabled');
                btn.style.opacity = '1';
            }
        });
        
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(text);
                debugLog(`[复制] 文本内容: ${node.dataset.filename}`, 'info');
                copyBtn.classList.add('text-green-500');
                setTimeout(() => copyBtn.classList.remove('text-green-500'), 1000);
            };
        }

        if (recallBtn) {
            // 使用全局统一逻辑绑定
            promptPanelManager.attachRecallListeners(node, recallBtn);
        }
    }
    
    // 3. 更新页眉与侧边栏
    const resolution = node.querySelector('.node-resolution');
    if (resolution) resolution.textContent = `${text.length} chars`;

    const sidebar = node.querySelector('.node-sidebar');
    if (sidebar) {
        // 更新时间 (使用标准结构：图标 + Span)
        const timeElement = sidebar.querySelector('.node-generation-time');
        if (timeElement && generationTime !== null) {
            timeElement.style.display = 'flex';
            const displayTime = formatGenerationTime(generationTime).replace('⏱️', '').trim();
            timeElement.innerHTML = `${getIcon('clock', 12)} <span>${displayTime}</span>`;
            timeElement.title = `生成耗时: ${generationTime.toFixed(2)}秒`;
        }

        // 更新提示词信息 (底部)
        const info = node.querySelector('.node-info');
        if (info) {
            info.textContent = prompt || 'No prompt info';
            info.title = prompt;
            node.dataset.prompt = prompt;
        }

        // 更新模型标签 (如果之前没有则注入)
        const existingModelTag = sidebar.querySelector('.node-model-tag');
        const finalModelName = modelName || node.dataset.modelName;
        if (finalModelName && !existingModelTag) {
            import('./utils.js').then(utils => {
                utils.renderModelTag(sidebar, finalModelName);
            });
        }
        
        // 更新头部信息
        const header = node.querySelector('.node-header');
        if (header) {
            const filenameEl = header.querySelector('.node-filename');
            const resolutionEl = header.querySelector('.node-resolution');
            if (filenameEl) filenameEl.textContent = node.dataset.filename || `Text Node #${node.dataset.index}`;
            if (resolutionEl) resolutionEl.textContent = `${text.length} 字符`;
        }
    }
}

export function createLoadingPlaceholder(width, height, x, y, modelName = '', type = 'image') {
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

    const sidebar = document.createElement('div');
    sidebar.className = 'node-sidebar';

    // 引入统一的内容容器
    const contentArea = document.createElement('div');
    contentArea.className = 'node-content';
    
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    loadingContainer.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;';
    
    const iconMap = {
        'image': getIcon('image', 32),
        'text': getIcon('message', 32),
        'video': getIcon('video', 32)
    };

    const loadingIcon = document.createElement('div');
    loadingIcon.className = 'loading-icon';
    loadingIcon.innerHTML = iconMap[type] || '';
    
    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.style.marginTop = '8px';
    loadingText.textContent = `正在生成${type === 'image' ? '图片' : type === 'text' ? '回复' : '视频'}...`;
    
    loadingContainer.appendChild(loadingIcon);
    loadingContainer.appendChild(loadingText);
    contentArea.appendChild(loadingContainer);
    
    // 3. 统一使用工厂函数创建预制工具栏
    const toolbar = createNodeToolbar('image', {
        onCopyPrompt: () => {}, // 待生成后激活
        onInsertPrompt: () => {}, 
        onCopyNode: () => {}, 
        onDelete: (e) => {
            const confirmModal = document.getElementById('confirmModal');
            const confirmModalMessage = document.getElementById('confirmModalMessage');
            const confirmModalCheckbox = document.getElementById('confirmModalCheckbox');
            const confirmModalCancel = document.getElementById('confirmModalCancel');
            const confirmModalOk = document.getElementById('confirmModalOk');
            
            confirmModalMessage.textContent = '确定要取消生成吗？';
            confirmModalCheckbox.parentElement.style.display = 'none';
            confirmModal.classList.remove('hidden');
            confirmModal.classList.add('flex');
            
            const closeConfirmModal = () => {
                confirmModal.classList.add('hidden');
                confirmModal.classList.remove('flex');
                confirmModalCheckbox.parentElement.style.display = 'flex';
                confirmModalOk.onclick = null;
                confirmModalCancel.onclick = null;
            };

            confirmModalOk.onclick = () => {
                const minimapCanvas = document.getElementById('minimapCanvas');
                const minimapImage = minimapCanvas.querySelector(`[data-node-id="${node.dataset.index}"]`);
                if (minimapImage) minimapImage.remove();
                node.remove();
                closeConfirmModal();
            };
            
            confirmModalCancel.onclick = () => closeConfirmModal();
        }
    });

    // 加载中状态，禁用除删除外的所有按钮
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        if (!btn.title.includes('删除')) {
            btn.disabled = true;
            btn.style.opacity = '0.4';
        }
    });
    
    const info = document.createElement('div');
    info.className = 'node-info';
    info.textContent = 'Loading...';

    // 按标准骨架顺序注入
    node.appendChild(header);      // 1
    node.appendChild(contentArea);  // 2
    node.appendChild(toolbar);      // 3
    node.appendChild(info);         // 4
    node.appendChild(sidebar);      // 5
    
    const timeElement = document.createElement('div');
    timeElement.className = 'node-generation-time';
    timeElement.style.display = (typeof DebugConsole !== 'undefined' && DebugConsole.showGenerationTime === false) ? 'none' : 'flex';
    timeElement.innerHTML = `${getIcon('clock', 12)} <span>0.0s</span>`;
    sidebar.appendChild(timeElement);

    if (modelName) {
        const modelTag = document.createElement('div');
        modelTag.className = 'node-model-tag';
        modelTag.style.display = DebugConsole.showModelTag ? 'block' : 'none';
        let _dn = modelName, _pn = '';
        if (typeof modelName === 'object' && modelName && modelName.name) {
            _dn = modelName.name; _pn = modelName.provider || '';
        }
        modelTag.innerHTML = _pn ? `<span class="model-name">${_dn}</span><span class="model-sep">·</span><span class="model-provider">${_pn.toUpperCase()}</span>` : `<span class="model-name">${_dn}</span>`;
        sidebar.appendChild(modelTag);
    }
    
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
    
    // 1. 清理加载状态
    const contentArea = node.querySelector('.node-content');
    if (contentArea) {
        contentArea.innerHTML = '';
    }
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `Generated image ${node.dataset.index}`;
    img.draggable = false;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    
    const centerCoords = document.createElement('div');
    centerCoords.className = 'node-center-coords';
    centerCoords.textContent = '(0, 0)';
    
    // 2. 将正文内容注入到 Content 容器中
    if (contentArea) {
        contentArea.appendChild(img);
        contentArea.appendChild(resizeHandle);
        contentArea.appendChild(centerCoords);
    }
    
    // 3. 更新页眉与信息
    const filenameElement = node.querySelector('.node-filename');
    if (filenameElement) filenameElement.textContent = filename || `Image ${node.dataset.index}`;
    
    const resolutionElement = node.querySelector('.node-resolution');
    if (resolutionElement) resolutionElement.textContent = resolution || 'Loading...';
    
    const info = node.querySelector('.node-info');
    if (info) {
        info.textContent = prompt || `Image ${node.dataset.index}`;
        info.title = '点击复制提示词';
    }
    
    // 4. 重建并注入真实的工具栏 (核心修复：替换掉占位阶段的空函数工具栏)
    const oldToolbar = node.querySelector('.node-toolbar');
    if (oldToolbar) {
        const newToolbar = createNodeToolbar('image', {
            onCopyPrompt: () => navigator.clipboard.writeText(prompt || ''),
            onInsertPrompt: () => {
                if (typeof PinManager !== 'undefined' && PinManager.addCanvasImageToPrompt) {
                    PinManager.addCanvasImageToPrompt(node);
                }
            },
            onRecallNode: () => {
                promptPanelManager.lockCommit();
                promptPanelManager.loadFromNode(node);
                debugLog(`[溯源] 已成功加载图片节点#${node.dataset.index}的历史参数`, 'success');
            },
            onPreviewStart: () => {
                promptPanelManager.saveDraft();
                promptPanelManager.setPreviewMode(true);
                promptPanelManager.loadFromNode(node);
                debugLog(`[预览] 图片节点#${node.dataset.index} 历史参数`, 'info');
            },
            onPreviewEnd: () => {
                if (!promptPanelManager.isPreviewLocked) {
                    promptPanelManager.setPreviewMode(false);
                    promptPanelManager.restoreDraft();
                }
            },
            onDelete: () => { selectNode(node); deleteSelectedNode(); }
        });
        oldToolbar.replaceWith(newToolbar);
    }
        
        if (revisedPrompt) {
            const existingPromptContainer = node.querySelector('.revised-prompt-container');
            if (existingPromptContainer) {
                existingPromptContainer.remove();
            }
            
            const promptContainer = document.createElement('div');
            promptContainer.className = 'revised-prompt-container';
            
            const promptHeader = document.createElement('div');
            promptHeader.className = 'revised-prompt-header';
            promptHeader.style.display = 'flex';
            promptHeader.style.alignItems = 'center';
            promptHeader.style.cursor = 'pointer';
            promptHeader.style.fontSize = '11px';
            promptHeader.style.color = 'var(--text-muted)';
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
            promptContent.style.marginTop = '4px';
            promptContent.style.lineHeight = '1.4';
            promptContent.style.wordBreak = 'break-word';
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
            node.appendChild(promptContainer);
        }
    
        const sidebar = node.querySelector('.node-sidebar');
        if (sidebar) {
            const existingModelTag = sidebar.querySelector('.node-model-tag');
            if (modelName && !existingModelTag) {
                const modelTag = document.createElement('div');
                modelTag.className = 'node-model-tag';
                modelTag.style.display = DebugConsole.showModelTag ? 'block' : 'none';
                let _dn = modelName, _pn = '';
                if (typeof modelName === 'object' && modelName && modelName.name) {
                    _dn = modelName.name; _pn = modelName.provider || '';
                } else if (typeof modelName === 'string' && modelName.includes('(')) {
                    const _p = modelName.split('(');
                    _dn = _p[0].trim(); _pn = _p[1].replace(')', '').trim();
                }
                if (_pn) {
                    modelTag.innerHTML = `<div class="model-name">${_dn}</div><div class="model-provider">${_pn}</div>`;
                    modelTag.title = `${_dn} (${_pn})`;
                } else {
                    modelTag.textContent = _dn;
                    modelTag.title = _dn;
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
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.zIndex = '10';
    
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-container';
    
    const errorIcon = document.createElement('div');
    errorIcon.className = 'error-icon';
    errorIcon.innerHTML = '⚠️';
    
    const errorTitle = document.createElement('div');
    errorTitle.className = 'error-title';
    errorTitle.textContent = '生成失败';
    
    const errorText = document.createElement('div');
    errorText.className = 'error-text';
    errorText.textContent = errorMessage;
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
    
    // 统一工具栏
    const toolbar = createNodeToolbar('image', {
        onCopyPrompt: () => {
            navigator.clipboard.writeText(errorMessage);
            debugLog(`[复制] 错误信息`, 'info');
        },
        onDelete: (e) => {
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
            
            const closeConfirmModal = () => {
                confirmModal.classList.add('hidden');
                confirmModal.classList.remove('flex');
                confirmModalCheckbox.parentElement.style.display = 'flex';
                confirmModalOk.removeEventListener('click', handleConfirm);
                confirmModalCancel.removeEventListener('click', handleCancel);
            };
            
            confirmModalOk.onclick = handleConfirm;
            confirmModalCancel.onclick = () => closeConfirmModal();
        }
    });

    // 错误节点，禁用部分功能
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        if (!btn.title.includes('删除') && !btn.title.includes('复制提示词')) {
            btn.disabled = true;
            btn.style.opacity = '0.4';
        }
    });
    
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
