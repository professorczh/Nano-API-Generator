import { AppState, CanvasState } from './app-state.js';
import { PinManager } from './pin-manager.js';
import { DebugConsole } from './debug-console.js';
import { debugLog, formatGenerationTime, createNodeToolbar, createNodeHeader, createNodeSidebar, createNodeInfo } from './utils.js';
import { updateMinimapWithImage, updateImageCenterCoordinates, getPanzoom, getImageResponseContainer } from './canvas-manager.js';
import { getIcon } from './icons.js';
import { addLinkerHandle } from './node-factory.js';
import { promptPanelManager } from './prompt-panel-manager.js';

let clipboardNode = null;
let minimapCanvas;

export function initNodeManager() {
    minimapCanvas = document.getElementById('minimapCanvas');
}

export function selectNode(node) {
    if (CanvasState.selectedNode === node) return;

    if (CanvasState.selectedNode) {
        CanvasState.selectedNode.classList.remove('selected');
        CanvasState.selectedNode.style.zIndex = '10';
    } else {
        // 如果是从无选中状态进入选中状态，保存当前面板内容为草稿
        promptPanelManager.saveDraft();
    }
    
    CanvasState.selectedNode = node;
    node.classList.add('selected');
    node.style.zIndex = '100';

    // 载入选中节点的溯源参数
    promptPanelManager.loadFromNode(node);
}

export function deselectAllNodes() {
    if (CanvasState.selectedNode) {
        CanvasState.selectedNode.classList.remove('selected');
        CanvasState.selectedNode = null;
        
        // 恢复之前保存的草稿
        promptPanelManager.restoreDraft();
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
            const dontShowAgain = confirmModalCheckbox ? confirmModalCheckbox.checked : false;
            
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
        const nodeId = CanvasState.selectedNode.dataset.index;
        const minimapImage = minimapCanvas?.querySelector(`[data-node-id="${nodeId}"]`);
        if (minimapImage) {
            minimapImage.remove();
        }
        
        // 清理状态快照
        if (nodeId !== undefined) {
            promptPanelManager.nodeSnapshots.delete(nodeId);
        }

        CanvasState.selectedNode.remove();
        CanvasState.selectedNode = null;
        debugLog(`[删除] 图片完成`, 'info');
        
        // 恢复草稿
        promptPanelManager.restoreDraft();
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
    const node = document.createElement('div');
    node.className = 'canvas-node' + (errorMessage ? ' error-node' : '');
    node.dataset.index = index;
    node.dataset.imageUrl = imageUrl;
    node.dataset.filename = filename || (errorMessage ? 'Error' : `Image ${index + 1}`);
    node.dataset.prompt = prompt || '';
    if (errorMessage) node.dataset.errorMessage = errorMessage;
    if (revisedPrompt) node.dataset.revisedPrompt = revisedPrompt;

    const contentArea = document.createElement('div');
    contentArea.className = 'node-content';
    node.appendChild(contentArea);

    if (errorMessage) {
        contentArea.innerHTML = `
            <div class="node-error-container">
                <div class="error-title">${getIcon('alert-triangle', 14)} 生成失败</div>
                <div class="error-msg">${errorMessage}</div>
            </div>
        `;
    } else {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = filename;
        img.draggable = false;
        
        img.onload = function() {
            const width = this.naturalWidth;
            const height = this.naturalHeight;
            node.dataset.width = width;
            node.dataset.height = height;
            
            const resolutionElement = node.querySelector('.node-resolution');
            if (resolutionElement) resolutionElement.textContent = `${width}x${height}`;
            
            // 修复：只有在最初创建且没有指定明确坐标时才居中。加载完成后不再强行重置，避免位移。
            updateImageCenterCoordinates(node);
        };
        contentArea.appendChild(img);
    }

    // 使用统一组件构建 UI
    node.appendChild(createNodeHeader('image', resolution || (errorMessage ? 'Failed' : 'Loading...'), node.dataset.filename));
    
    const toolbar = createNodeToolbar('image', {
        onCopyPrompt: () => navigator.clipboard.writeText(prompt || ''),
        onInsertPrompt: () => {
            console.log(`[Referencing] Pure citation for node:`, node.dataset.index);
            if (errorMessage) return;
            
            // 核心：仅执行“引用”动作 (上架货架 + 插入标签)
            if (typeof PinManager !== 'undefined' && PinManager.addCanvasImageToPrompt) {
                PinManager.addCanvasImageToPrompt(node);
            }
        },
        onCopyNode: () => { 
            if (!errorMessage) { 
                selectNode(node); 
                copySelectedNode(); 
                console.log(`%c[Copy] Node #${node.dataset.index} copied to clipboard buffer.`, 'color: #10b981; font-weight: bold');
            } 
        },
        onDelete: () => { selectNode(node); deleteSelectedNode(); }
    });
    node.appendChild(toolbar);

    const info = createNodeInfo(prompt, errorMessage ? 'Error' : `Image ${index + 1}`);
    node.appendChild(info);

    const sidebar = createNodeSidebar(generationTime, modelName);
    node.appendChild(sidebar);

    // 调整尺寸手柄
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); e.preventDefault();
        startResizeNode(e, node);
    });
    node.appendChild(resizeHandle);

    // 初始化位置
    const initialWidth = parseInt(resolution?.split('x')[0]) || 500;
    const initialHeight = parseInt(resolution?.split('x')[1]) || 500;
    node.style.width = `${initialWidth}px`;
    node.style.height = `${initialHeight}px`;
    node.style.left = x !== null ? `${x}px` : `${5000 - initialWidth / 2}px`;
    node.style.top = y !== null ? `${y}px` : `${5000 - initialHeight / 2}px`;
    node.style.zIndex = '10';

    // 交互逻辑
    node.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-info') || e.target.closest('.node-toolbar') || e.target.closest('.node-sidebar')) return;
        if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
            e.stopPropagation();
            selectNode(node);
            AppState.isDraggingNode = true; AppState.dragNode = node; AppState.activeNode = node;
            AppState.dragStartX = e.clientX; AppState.dragStartY = e.clientY;
            AppState.dragNodeStartLeft = parseInt(node.style.left);
            AppState.dragNodeStartTop = parseInt(node.style.top);
        }
    });

    node.addEventListener('click', (e) => {
        if (!errorMessage && (e.ctrlKey || e.metaKey)) {
            e.stopPropagation();
            if (node.classList.contains('selected')) PinManager.addPinToImage(node, e);
            else selectNode(node);
        }
    });

    return node;
}


export function createTextNode(text, prompt = '', index = 0, filename = '', resolution = '', generationTime = null, modelName = '') {
    const node = document.createElement('div');
    node.className = 'canvas-node text-node';
    node.dataset.index = index;
    node.dataset.filename = filename || `Text ${index + 1}`;
    node.dataset.nodeType = 'text';

    const contentArea = document.createElement('div');
    contentArea.className = 'node-content';
    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    textContent.textContent = text;
    contentArea.appendChild(textContent);
    node.appendChild(contentArea);

    // 标准页眉
    node.appendChild(createNodeHeader('text', `${text.length} chars`, node.dataset.filename));

    // 统一工具栏
    const toolbar = createNodeToolbar('text', {
        onCopyPrompt: () => navigator.clipboard.writeText(prompt || ''),
        onCopyText: () => navigator.clipboard.writeText(text),
        onDelete: () => { selectNode(node); deleteSelectedNode(); }
    });
    node.appendChild(toolbar);

    // 提示词信息
    node.appendChild(createNodeInfo(prompt, `Text ${index + 1}`));

    // 侧边栏（耗时、模型）
    node.appendChild(createNodeSidebar(generationTime, modelName));

    // 初始化位置与连线
    addLinkerHandle(node);
    node.style.left = '5000px';
    node.style.top = '5000px';
    node.style.zIndex = '10';

    node.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-info') || e.target.closest('.node-toolbar') || e.target.closest('.node-sidebar')) return;
        if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
            e.stopPropagation();
            selectNode(node);
            AppState.isDraggingNode = true; AppState.dragNode = node; AppState.activeNode = node;
            AppState.dragStartX = e.clientX; AppState.dragStartY = e.clientY;
            AppState.dragNodeStartLeft = parseInt(node.style.left) || 5000;
            AppState.dragNodeStartTop = parseInt(node.style.top) || 5000;
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
