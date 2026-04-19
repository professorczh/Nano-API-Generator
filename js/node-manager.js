import { AppState, CanvasState } from './app-state.js';
import { PinManager } from './pin-manager.js';
import { DebugConsole } from './debug-console.js';
import { debugLog, formatGenerationTime, createNodeToolbar, createNodeHeader, createNodeSidebar, createNodeInfo } from './utils.js';
import { updateMinimapWithImage, updateImageCenterCoordinates, getPanzoom, getImageResponseContainer } from './canvas-manager.js';
import { getIcon } from './icons.js';
import { addLinkerHandle } from './node-factory.js';
import { promptPanelManager } from './prompt-panel-manager.js';
import { PersistenceManager } from './persistence-manager.js';
import { PanoramaRenderer } from './panorama-renderer.js';

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

    // 统一清除：点选不再触发面板更新，由工具栏按钮显式触发
    console.log(`[NodeManager] 选中节点[${node.dataset.index}]，面板保持原状`);
}

export function deselectAllNodes() {
    if (CanvasState.selectedNode) {
        CanvasState.selectedNode.classList.remove('selected');
        CanvasState.selectedNode = null;
        
        // 核心加固：仅在非锁定预览状态下恢复草稿
        if (!promptPanelManager.isPreviewLocked) {
            promptPanelManager.restoreDraft();
        } else {
            // 如果已提交历史，重置锁，为下次预览做准备
            promptPanelManager.isPreviewLocked = false;
        }
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

        // 核心加固：处理 3D 渲染器释放
        if (CanvasState.selectedNode.panoramaRenderer) {
            CanvasState.selectedNode.panoramaRenderer.dispose();
        }

        CanvasState.selectedNode.remove();
        CanvasState.selectedNode = null;
        debugLog(`[删除] 节点完成`, 'info');
        
        // V2: ActionTracker - Node deleted
        PersistenceManager.trackAction('DELETE');

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
    node.className = 'canvas-node image-node' + (errorMessage ? ' error-node' : '');
    node.dataset.index = index;
    node.dataset.imageUrl = imageUrl;
    node.dataset.filename = filename || (errorMessage ? 'Error' : `Image ${index + 1}`);
    node.dataset.prompt = prompt || '';
    node.dataset.generationTime = generationTime !== null ? generationTime : '';
    node.dataset.modelName = typeof modelName === 'object' ? JSON.stringify(modelName) : modelName;
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
            
            if (typeof PinManager !== 'undefined' && PinManager.addCanvasImageToPrompt) {
                PinManager.addCanvasImageToPrompt(node);
            }
        },
        onRecallNode: () => {
            if (errorMessage) return;
            promptPanelManager.lockCommit();
            promptPanelManager.loadFromNode(node);
            debugLog(`[溯源] 已成功加载图片节点#${node.dataset.index}的历史参数`, 'success');
        },
        onPreviewStart: () => {
            if (errorMessage) return;
            promptPanelManager.saveDraft();
            promptPanelManager.setPreviewMode(true);
            promptPanelManager.loadFromNode(node);
            debugLog(`[预览] 图片节点#${node.dataset.index} 历史参数`, 'info');
        },
        onPreviewEnd: () => {
            if (errorMessage) return;
            if (!promptPanelManager.isPreviewLocked) {
                promptPanelManager.setPreviewMode(false);
                promptPanelManager.restoreDraft();
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

    // 初始化位置：不再硬化 5000px。如果未提供坐标，默认放置在视野左上角或由调用方决定。
    const initialWidth = parseInt(resolution?.split('x')[0]) || 400;
    const initialHeight = parseInt(resolution?.split('x')[1]) || 300;
    node.style.width = `${initialWidth}px`;
    node.style.height = `${initialHeight}px`;
    node.style.left = x !== null ? `${x}px` : '0px';
    node.style.top = y !== null ? `${y}px` : '0px';
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

    node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const img = node.querySelector('img');
        if (img) showImageContextMenu(e, node, img);
    });

    return node;
}


export function createTextNode(text, prompt = '', index = 0, filename = '', resolution = '', generationTime = null, modelName = '') {
    const node = document.createElement('div');
    node.className = 'canvas-node text-node';
    node.dataset.index = index;
    node.dataset.filename = filename || `Text ${index + 1}`;
    node.dataset.nodeType = 'text';
    node.dataset.prompt = prompt || '';
    node.dataset.generationTime = generationTime !== null ? generationTime : '';
    node.dataset.modelName = typeof modelName === 'object' ? JSON.stringify(modelName) : modelName;

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

    // 坐标初始化：由调用方传入，默认不在此处硬化 5000px
    addLinkerHandle(node);
    if (x !== null) node.style.left = `${x}px`;
    if (y !== null) node.style.top = `${y}px`;
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
    
    const panoramaItem = document.createElement('div');
    panoramaItem.className = 'context-menu-item';
    panoramaItem.innerHTML = `${getIcon('globe', 14)} 转换为 360° 全景`;
    panoramaItem.addEventListener('click', () => {
        createPanoramaNode(node);
        menu.remove();
    });

    menu.appendChild(copyItem);
    menu.appendChild(downloadItem);
    menu.appendChild(insertItem);
    menu.appendChild(panoramaItem);
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', (clickEvent) => {
            if (!menu.contains(clickEvent.target)) {
                menu.remove();
            }
        }, { once: true });
    }, 100);
}

export function createPanoramaNode(sourceNode) {
    const imageUrl = sourceNode.dataset.imageUrl;
    const prompt = sourceNode.dataset.prompt || '';
    const filename = `Panorama_${sourceNode.dataset.filename || 'Source'}`;
    
    const rect = {
        x: parseFloat(sourceNode.style.left) || 0,
        y: parseFloat(sourceNode.style.top) || 0,
        width: parseFloat(sourceNode.style.width) || 400
    };

    // 旁边创建：右侧偏移 40px
    const newX = rect.x + rect.width + 40;
    const newY = rect.y;

    const node = document.createElement('div');
    node.className = 'canvas-node panorama-node';
    node.dataset.index = CanvasState.nodeCounter++;
    node.dataset.imageUrl = imageUrl;
    node.dataset.filename = filename;
    node.dataset.prompt = prompt;
    node.dataset.nodeType = 'panorama';

    const contentArea = document.createElement('div');
    contentArea.className = 'node-content';
    contentArea.style.cssText = 'width: 100%; height: 100%; background: #000; overflow: hidden; position: relative;';
    node.appendChild(contentArea);

    // 标准页眉 (metadata 显示 "360° Pan")
    node.appendChild(createNodeHeader('image', '360° Pan', filename));
    
    // 简化工具栏 (仅保留复制提示词和删除)
    const toolbar = createNodeToolbar('image', {
        onCopyPrompt: () => navigator.clipboard.writeText(prompt),
        onDelete: () => { selectNode(node); deleteSelectedNode(); }
    });
    node.appendChild(toolbar);

    node.appendChild(createNodeInfo(prompt, filename));
    
    // 坐标与尺寸：默认 512x512
    node.dataset.aspectRatio = '1:1';
    node.dataset.cameraLocked = 'false';
    node.style.width = '512px';
    node.style.height = '512px';
    node.style.left = `${newX}px`;
    node.style.top = `${newY}px`;
    node.style.zIndex = '10';

    // 画幅切换器
    const ratioSwitcher = document.createElement('div');
    ratioSwitcher.className = 'panorama-ratio-switcher';
    const ratios = [
        { label: '1:1', w: 512, h: 512 },
        { label: '16:9', w: 640, h: 360 },
        { label: '9:16', w: 360, h: 640 }
    ];

    ratios.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'ratio-btn' + (r.label === '1:1' ? ' active' : '');
        btn.textContent = r.label;
        btn.onclick = (e) => {
            e.stopPropagation();
            ratioSwitcher.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            node.style.width = `${r.w}px`;
            node.style.height = `${r.h}px`;
            node.dataset.aspectRatio = r.label;
            
            if (node.panoramaRenderer) {
                node.panoramaRenderer.onResize();
            }
        };
        ratioSwitcher.appendChild(btn);
    });
    node.appendChild(ratioSwitcher);

    // 相机锁定切换器
    const lockToggle = document.createElement('div');
    lockToggle.className = 'camera-lock-toggle';
    lockToggle.innerHTML = `${getIcon('unlock', 14)} <span>Camera Unlocked</span>`;
    lockToggle.onclick = (e) => {
        e.stopPropagation();
        const isLocked = node.dataset.cameraLocked === 'true';
        const newLocked = !isLocked;
        node.dataset.cameraLocked = newLocked.toString();
        
        lockToggle.classList.toggle('locked', newLocked);
        lockToggle.innerHTML = `${getIcon(newLocked ? 'lock' : 'unlock', 14)} <span>${newLocked ? 'Camera Locked' : 'Camera Unlocked'}</span>`;
        
        // 如果锁定，不仅要更新 UI，还要立即同步到 renderer 控制器
        if (node.panoramaRenderer && node.panoramaRenderer.controls) {
            node.panoramaRenderer.controls.enabled = !newLocked;
            // 如果锁定，同时停止自动旋转
            if (newLocked) node.panoramaRenderer.controls.autoRotate = false;
        }
        
        console.log(`[Panorama] Camera ${newLocked ? 'Locked (Dragging enabled)' : 'Unlocked (Rotation enabled)'}`);
    };
    node.appendChild(lockToggle);

    const container = getImageResponseContainer();
    if (container) {
        container.appendChild(node);
    }

    // 启动 3D 渲染
    node.panoramaRenderer = new PanoramaRenderer(contentArea, imageUrl);

    // 交互逻辑
    node.addEventListener('mousedown', (e) => {
        // 如果相机锁定，点击 Canvas 应该像点击其他区域一样触发节点拖拽
        const isCameraLocked = node.dataset.cameraLocked === 'true';

        // 核心修复：如果点击的是 canvas (3D 交互区) 且相机未锁定，跳过节点拖拽逻辑，让 OrbitControls 处理
        if (e.target.tagName.toLowerCase() === 'canvas' && !isCameraLocked) {
            selectNode(node);
            return; 
        }

        if (e.target.closest('.node-info') || e.target.closest('.node-toolbar') || 
            e.target.closest('.panorama-ratio-switcher') || e.target.closest('.camera-lock-toggle')) return;
        if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
            e.stopPropagation();
            selectNode(node);
            AppState.isDraggingNode = true; AppState.dragNode = node; AppState.activeNode = node;
            AppState.dragStartX = e.clientX; AppState.dragStartY = e.clientY;
            AppState.dragNodeStartLeft = parseInt(node.style.left);
            AppState.dragNodeStartTop = parseInt(node.style.top);
        }
    });

    selectNode(node);
    updateMinimapWithImage(node);
    
    // 触发自动保存
    PersistenceManager.trackAction('CREATE_PANORAMA');
    
    return node;
}
