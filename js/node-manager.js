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


export function createTextNode(text, prompt = '', index = 0, filename = '', resolution = '', generationTime = null, modelName = '', x = null, y = null) {
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

    const mattingItem = document.createElement('div');
    mattingItem.className = 'context-menu-item';
    mattingItem.innerHTML = `${getIcon('crop', 14)} 智能抠图 & 裁剪`;
    mattingItem.addEventListener('click', () => {
        initMattingFlow(node);
        menu.remove();
    });

    menu.appendChild(copyItem);
    menu.appendChild(downloadItem);
    menu.appendChild(insertItem);
    menu.appendChild(panoramaItem);
    menu.appendChild(mattingItem);
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

// =============================================================
// 6. 智能抠图 (Smart Matting) 逻辑
// =============================================================
let mattingState = {
    node: null,
    img: null,
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    selection: null, // {x, y, w, h} in canvas coordinates
    scale: 1,
    dashOffset: 0,
    animationId: null
};

function initMattingFlow(node) {
    const mattingModal = document.getElementById('mattingModal');
    const mattingCanvas = document.getElementById('mattingCanvas');
    
    if (!mattingModal || !mattingCanvas) return;

    // 彻底停止之前的动画和清理旧状态
    if (mattingState.animationId) {
        cancelAnimationFrame(mattingState.animationId);
        mattingState.animationId = null;
    }
    mattingState.img = null;

    mattingState.node = node;
    const originalImg = node.querySelector('img');
    if (!originalImg) return;

    // 重置状态
    mattingState.selection = null;
    mattingModal.style.display = 'flex';

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        mattingState.img = img;
        renderMattingCanvas();
        setupMattingEvents();
        startMattingAnimation();
    };
    img.src = originalImg.src;

    // 绑定按钮逻辑
    const closeBtn = document.getElementById('closeMattingModal');
    const resetBtn = document.getElementById('resetMatting');
    const confirmBtn = document.getElementById('confirmMatting');
    
    // 触发 AI 探测按钮的实时绑定
    if (window._bindAiDetect) window._bindAiDetect();

    const closeModal = () => {
        mattingModal.style.display = 'none';
        stopMattingAnimation();
        cleanupMattingEvents();
    };

    closeBtn.onclick = closeModal;
    resetBtn.onclick = () => {
        mattingState.selection = null;
        renderMattingCanvas();
    };

    // 监听模型切换说明
    const modelSelect = document.getElementById('mattingModelSelect');
    const modelDesc = document.getElementById('mattingModelDesc');
    const descriptions = {
        'u2net': '通用模型，平衡速度与质量。',
        'u2netp': '极速模型，适合低配环境。',
        'u2net_human_seg': '针对人像优化，抠头发效果更佳。',
        'isnet-anime': '二次元/动漫专用，线条还原度高。',
        'bria-rmbg': '商业级高质量模型，细节处理极其细腻。'
    };
    modelSelect.onchange = () => {
        modelDesc.textContent = descriptions[modelSelect.value] || '';
    };

    confirmBtn.onclick = async () => {
        if (!mattingState.selection || mattingState.selection.w < 5 || mattingState.selection.h < 5) {
            debugLog('选区太小或未选择区域', 'warning');
            return;
        }
        await startMattingProcess();
        closeModal();
    };
}

// ==========================================
// AI 智能探测模块 (Gemini Vision 联动)
// ==========================================
async function performAiDetection() {
    console.log('%c[AI-Detect] >>> 启动全流程探测...', 'color: #a855f7; font-weight: bold');
    
    if (!mattingState.img) {
        console.error('[AI-Detect] 失败: mattingState.img 未就绪');
        debugLog('图片资源未就绪，请稍等', 'warning');
        return;
    }

    const aiDetectBtn = document.getElementById('aiDetectBtn');
    const aiLabelsContainer = document.getElementById('mattingAiLabels');
    
    aiDetectBtn.disabled = true;
    const originalText = aiDetectBtn.innerHTML;
    aiDetectBtn.innerHTML = '<span class="animate-spin inline-block">⏳</span> 正在识别...';
    aiLabelsContainer.innerHTML = '';

    try {
        console.log('[AI-Detect] 1. 正在进行画布采样...');
        const tempCanvas = document.createElement('canvas');
        const maxDim = 1024;
        let w = mattingState.img.naturalWidth || mattingState.img.width;
        let h = mattingState.img.naturalHeight || mattingState.img.height;
        const s = Math.min(maxDim / w, maxDim / h, 1);
        tempCanvas.width = w * s;
        tempCanvas.height = h * s;
        
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(mattingState.img, 0, 0, tempCanvas.width, tempCanvas.height);
        
        console.log('[AI-Detect] 1.1 画布绘制完成，尝试导出字节流...');
        let base64Image;
        try {
            base64Image = tempCanvas.toDataURL('image/jpeg', 0.8);
            console.log('[AI-Detect] 1.2 采样成功，数据长度:', base64Image.length);
        } catch (e) {
            console.error('[AI-Detect] 采样失败 (Canvas Tainted):', e);
            throw new Error('浏览器出于安全限制无法读取此图片');
        }

        let providerInstance = null;
        let model = '';
        let providerId = '';
        
        const aiDetectWrapper = document.getElementById('aiDetectModelNameWrapper');
        if (aiDetectWrapper && aiDetectWrapper.dataset.value) {
            model = aiDetectWrapper.dataset.value;
            providerId = aiDetectWrapper.dataset.provider;
        }

        if (window.dynamicProviderManager && providerId) {
            providerInstance = window.dynamicProviderManager.getProvider(providerId);
        } else if (window.dynamicProviderManager) {
            // 回退逻辑：如果下拉框还没准备好，尝试获取 Gemini
            const allProviders = window.dynamicProviderManager.getStoredProviders();
            const providerConfig = allProviders.find(p => p.id === 'Gemini' || p.protocol === 'gemini' || p.name.toLowerCase().includes('google'));
            if (providerConfig) {
                providerInstance = window.dynamicProviderManager.getProvider(providerConfig.id);
                if (providerConfig.textModels && providerConfig.textModels.length > 0) {
                    model = providerConfig.textModels[0].name;
                }
            }
        }

        if (!providerInstance || !providerInstance.apiKey) {
            throw new Error(`所选的供应商 [${providerId || 'Google/Gemini'}] 未配置有效的 API Key`);
        }

        if (!model) {
            model = window.ENV?.GEMINI_MODEL_NAME || 'gemini-1.5-pro';
        }

        console.log(`[AI-Detect] 2. 发送请求至模型: ${model}`);

        const prompt = "Detect all distinct main objects in this image and return their bounding boxes in strict JSON format. Use this exact JSON array format: [{\"label\": \"<descriptive_object_name>\", \"box_2d\": [ymin, xmin, ymax, xmax]}]. Ensure 'label' is a specific and concise descriptive name for the detected object (e.g., 'car', 'person', 'dog', 'building'). Coordinates are normalized 0-1000. Do not return any other text.";

        // 使用前端标准的 provider 发送请求，确保 baseUrl 和所有网络设置与生图一致
        const response = await providerInstance.generateText({
            modelName: model,
            prompt: prompt,
            media: [{ data: base64Image, mimeType: "image/jpeg" }],
            generationConfig: { 
                temperature: 0, 
                responseMimeType: "application/json",
                response_mime_type: "application/json",
                responseFormat: { text: { mimeType: "application/json" } }
            }
        });

        console.log('[AI-Detect] 3. 收到大模型响应');
        const text = response.raw?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = text.replace(/```json\n?|```/g, '').trim();
        
        let data;
        try {
            data = JSON.parse(cleanJson);
        } catch (e) {
            console.error('[AI-Detect] 解析 JSON 失败:', text);
            throw new Error(`模型未返回有效 JSON。模型回复内容为: ${text}`);
        }

        const objectsList = Array.isArray(data) ? data : (data.objects || []);

        if (objectsList.length > 0) {
            console.log(`[AI-Detect] 4. 识别到 ${objectsList.length} 个目标`);
            objectsList.forEach(obj => {
                const chip = document.createElement('div');
                chip.className = 'ai-label-chip';
                chip.textContent = obj.label;
                chip.onclick = () => {
                    document.querySelectorAll('.ai-label-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    const [ymin, xmin, ymax, xmax] = obj.box_2d;
                    const mattingCanvas = document.getElementById('mattingCanvas');
                    mattingState.selection = {
                        x: (xmin / 1000) * mattingCanvas.width,
                        y: (ymin / 1000) * mattingCanvas.height,
                        w: ((xmax - xmin) / 1000) * mattingCanvas.width,
                        h: ((ymax - ymin) / 1000) * mattingCanvas.height
                    };
                    renderMattingCanvas();
                    debugLog(`AI 对齐: ${obj.label}`, 'success');
                };
                aiLabelsContainer.appendChild(chip);
            });
        } else {
            debugLog('未发现明显目标', 'info');
        }
    } catch (err) {
        console.error('[AI-Detect] 异常:', err);
        debugLog('AI 探测失败: ' + err.message, 'error');
    } finally {
        aiDetectBtn.disabled = false;
        aiDetectBtn.innerHTML = originalText;
    }
}

function bindAiDetectButton() {
    const btn = document.getElementById('aiDetectBtn');
    if (btn) {
        btn.removeEventListener('click', performAiDetection);
        btn.addEventListener('click', performAiDetection);
        console.log('%c[AI-Module] 智能探测按钮已强行绑定就绪！', 'color: #10b981; font-weight: bold');
    }
}

// 暴露出全局绑定方法供初始化调用
window._bindAiDetect = bindAiDetectButton;
document.addEventListener('DOMContentLoaded', bindAiDetectButton);

function startMattingAnimation() {
    const animate = () => {
        mattingState.dashOffset++;
        if (mattingState.dashOffset > 20) mattingState.dashOffset = 0;
        if (mattingState.selection) {
            renderMattingCanvas();
        }
        mattingState.animationId = requestAnimationFrame(animate);
    };
    mattingState.animationId = requestAnimationFrame(animate);
}

function stopMattingAnimation() {
    if (mattingState.animationId) {
        cancelAnimationFrame(mattingState.animationId);
        mattingState.animationId = null;
    }
}

function renderMattingCanvas() {
    const canvas = document.getElementById('mattingCanvas');
    const ctx = canvas.getContext('2d');
    const img = mattingState.img;
    const workspace = document.getElementById('mattingWorkspace');

    const maxWidth = workspace.clientWidth * 0.95;
    const maxHeight = workspace.clientHeight * 0.95;
    
    let displayWidth = img.naturalWidth || img.width;
    let displayHeight = img.naturalHeight || img.height;
    
    const ratio = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
    displayWidth *= ratio;
    displayHeight *= ratio;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
    mattingState.scale = ratio;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

    if (mattingState.selection) {
        const { x, y, w, h } = mattingState.selection;

        // 1. 绘制外部遮罩层 (暗化)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, y);
        ctx.fillRect(0, y + h, canvas.width, canvas.height - (y + h));
        ctx.fillRect(0, y, x, h);
        ctx.fillRect(x + w, y, canvas.width - (x + w), h);

        // 2. 绘制选区描边 (蚂蚁线)
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, w, h);

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -mattingState.dashOffset;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // 3. 绘制角落手柄
        const handleSize = 6;
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x - 3, y - 3, handleSize, handleSize);
        ctx.fillRect(x + w - 3, y - 3, handleSize, handleSize);
        ctx.fillRect(x - 3, y + h - 3, handleSize, handleSize);
        ctx.fillRect(x + w - 3, y + h - 3, handleSize, handleSize);

        // 4. 尺寸标签
        const realW = Math.round(w / mattingState.scale);
        const realH = Math.round(h / mattingState.scale);
        const label = `${realW} × ${realH} px`;
        ctx.font = 'bold 10px Inter, sans-serif';
        const labelWidth = ctx.measureText(label).width;
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.fillRect(x + (w / 2) - (labelWidth / 2) - 6, y + h + 8, labelWidth + 12, 20);
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + (w / 2) - (labelWidth / 2), y + h + 22);
    }
}

function setupMattingEvents() {
    const canvas = document.getElementById('mattingCanvas');
    
    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        mattingState.isSelecting = true;
        mattingState.startX = e.clientX - rect.left;
        mattingState.startY = e.clientY - rect.top;
        mattingState.selection = null;
    };

    canvas.onmousemove = (e) => {
        if (!mattingState.isSelecting) return;
        const rect = canvas.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        
        mattingState.selection = {
            x: Math.min(mattingState.startX, curX),
            y: Math.min(mattingState.startY, curY),
            w: Math.abs(mattingState.startX - curX),
            h: Math.abs(mattingState.startY - curY)
        };
        
        renderMattingCanvas();
    };

    const handleMouseUp = () => {
        mattingState.isSelecting = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    mattingState._mouseUpHandler = handleMouseUp;
}

function cleanupMattingEvents() {
    const canvas = document.getElementById('mattingCanvas');
    if (canvas) {
        canvas.onmousedown = null;
        canvas.onmousemove = null;
    }
    if (mattingState._mouseUpHandler) {
        window.removeEventListener('mouseup', mattingState._mouseUpHandler);
    }
}

async function startMattingProcess() {
    const confirmBtn = document.getElementById('confirmMatting');
    const originalText = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `${getIcon('loader', 14, 'animate-spin')} 处理中...`;

    const sel = mattingState.selection;
    const img = mattingState.img;
    const scale = mattingState.scale;
    const model = document.getElementById('mattingModelSelect').value;
    const useAlpha = document.getElementById('mattingAlphaToggle').checked;

    const sourceX = sel.x / scale;
    const sourceY = sel.y / scale;
    const sourceW = sel.w / scale;
    const sourceH = sel.h / scale;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = sourceW;
    canvas.height = sourceH;
    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
    
    try {
        debugLog(`正在执行抠图: 模型=${model}, Alpha=${useAlpha}`, 'info');
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const formData = new FormData();
        formData.append('file', blob);
        
        const apiUrl = `/api/rembg?model=${model}${useAlpha ? '&om=true' : ''}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `服务异常 (${response.status})`);
        }

        const resultBlob = await response.blob();
        let finalUrl = URL.createObjectURL(resultBlob);

        // 尝试持久化保存到本地，防止刷新后丢失
        try {
            debugLog('正在持久化保存抠图结果...', 'info');
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'x-filename': `matted_${Date.now()}.png`,
                        'content-type': 'image/png',
                        'x-add-history': 'true',
                        'x-prompt': encodeURIComponent('智能抠图 (AI Matting)'),
                        'x-model': 'Rembg API'
                    },
                    body: resultBlob
                });
            const uploadData = await uploadRes.json();
            if (uploadData.success && uploadData.path) {
                finalUrl = uploadData.path.startsWith('/DL/') ? uploadData.path : 
                          (uploadData.path.startsWith('DL/') ? '/' + uploadData.path : '/DL/' + uploadData.path);
                debugLog('抠图结果已安全存档', 'success');
                
                // 如果系统支持追加到历史记录面板，也可以在此处调用
                // window.HistoryManager.addLocalRecord(...)
            }
        } catch (e) {
            console.warn('持久化保存抠图结果失败，回退到临时内存缓存:', e);
        }

        const newNode = createImageNode(
            finalUrl, 
            (mattingState.node.dataset.prompt || '') + ` [Matted]`, 
            CanvasState.nodeCounter++, 
            'Matted_' + (mattingState.node.dataset.filename || 'Image'),
            `${Math.round(sourceW)}x${Math.round(sourceH)}`
        );

        const currentLeft = parseInt(mattingState.node.style.left) || 5000;
        const currentTop = parseInt(mattingState.node.style.top) || 5000;
        newNode.style.left = `${currentLeft + 120}px`;
        newNode.style.top = `${currentTop + 120}px`;

        const container = getImageResponseContainer();
        if (container) container.appendChild(newNode);

        selectNode(newNode);
        updateMinimapWithImage(newNode);
        PersistenceManager.trackAction('CREATE_MATTING');
        
        debugLog(`智能抠图完成: ${newNode.dataset.filename}`, 'success');

    } catch (err) {
        console.error('处理失败:', err);
        debugLog('处理失败: ' + err.message, 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
    }
}
