import { AppState, CanvasState, minimapDragStartX, minimapDragStartY, minimapPanStartX, minimapPanStartY } from './app-state.js';
import { PinManager } from './pin-manager.js';
import { DebugConsole } from './debug-console.js';
import { generateDebugGrid, debugLog } from './utils.js';

let isDraggingMinimapViewport = false;
let canvas, canvasViewport, imageResponseContainer, minimapCanvas, minimapViewport;
let toolbarZoomValue, resetCanvasBtn, debugConsole;

export function initCanvasElements() {
    canvas = document.getElementById('canvas');
    canvasViewport = document.getElementById('canvasViewport');
    imageResponseContainer = document.getElementById('imageResponseContainer');
    minimapCanvas = document.getElementById('minimapCanvas');
    minimapViewport = document.getElementById('minimapViewport');
    toolbarZoomValue = document.getElementById('toolbarZoomValue');
    resetCanvasBtn = document.getElementById('resetCanvasBtn');
    debugConsole = document.getElementById('debugConsole');
}

export function initCanvas() {
    console.log('Initializing canvas...');
    
    if (typeof Panzoom === 'undefined') {
        console.error('Panzoom library not loaded');
        return;
    }
    
    const uiPanel = document.getElementById('uiPanel');
    const uiPanelWidth = uiPanel ? uiPanel.offsetWidth : 400;
    const viewportWidth = window.innerWidth - uiPanelWidth;
    const viewportHeight = window.innerHeight;
    const startX = viewportWidth / 2 - 5000;
    const startY = viewportHeight / 2 - 5000;
    
    CanvasState.panzoom = Panzoom(canvas, {
        maxScale: 2.5,
        minScale: 0.5,
        step: 0.25,
        disablePan: false,
        disableZoom: false,
        excludeClass: 'canvas-node',
        canvas: true,
        noBind: false,
        startX: startX,
        startY: startY,
        setTransform: (el, { x, y, scale }) => {
            el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
            
            AppState.panX = x;
            AppState.panY = y;
            AppState.scale = scale;
            
            updateMinimapViewport();
            updateCenterMarkerCoordinates();
        }
    });
    
    const scale = CanvasState.panzoom.getScale();
    AppState.updateScale(scale);
    AppState.panX = startX;
    AppState.panY = startY;
    
    setTimeout(() => {
        updateCenterMarkerCoordinates();
        updateMinimapViewport();
    }, 0);
    
    generateDebugGrid();
    
    canvasViewport.style.cursor = 'default';
    canvas.style.cursor = 'default';
    
    canvas.addEventListener('panzoomzoom', (e) => {
        const newScale = e.detail.scale;
        AppState.updateScale(newScale);
        
        if (toolbarZoomValue) {
            toolbarZoomValue.textContent = `${Math.round(newScale * 100)}%`;
        }
        
        updateMinimapViewport();
        updateCenterMarkerCoordinates();
        if (!debugConsole.contains(e.target) && DebugConsole.showMouseLogs) {
            debugLog(`[缩放事件] 新缩放比例: ${newScale}`, 'event');
        }
    });
    
    canvas.addEventListener('panzoompan', (e) => {
        const panX = e.detail.x;
        const panY = e.detail.y;
        AppState.panX = panX;
        AppState.panY = panY;
        updateMinimapViewport();
        updateCenterMarkerCoordinates();
        if (!debugConsole.contains(e.target) && DebugConsole.showMouseLogs) {
            debugLog(`[平移事件] panX=${panX}, panY=${panY}`, 'event');
        }
    });
    
    canvasViewport.addEventListener('mousedown', (e) => {
        if (debugConsole.contains(e.target)) return;
        if (DebugConsole.showMouseLogs) {
            debugLog(`[鼠标按下] 画布视口: button=${e.button}, clientX=${e.clientX}, clientY=${e.clientY}`, 'event');
        }
        if (e.button === 1) {
            e.preventDefault();
            AppState.isMiddleMouseDown = true;
            AppState.lastMouseX = e.clientX;
            AppState.lastMouseY = e.clientY;
            // 记录当前的平移量，用于增量计算
            AppState.panStartX = AppState.panX;
            AppState.panStartY = AppState.panY;
            
            canvasViewport.style.cursor = 'grabbing';
            if (DebugConsole.showMouseLogs) {
                debugLog(`[开始拖动] 画布: isMiddleMouseDown=${AppState.isMiddleMouseDown}`, 'info');
            }
        } else {
            canvasViewport.style.cursor = 'default';
        }
    });

    // 补全中键拖拽逻辑
    document.addEventListener('mousemove', (e) => {
        if (AppState.isMiddleMouseDown) {
            const deltaX = e.clientX - AppState.lastMouseX;
            const deltaY = e.clientY - AppState.lastMouseY;
            
            // 抵消缩放带来的阻力，确保物理位移 1:1
            // Panzoom 的 pan 方法接收的是最终绝对坐标
            const newPanX = AppState.panStartX + deltaX;
            const newPanY = AppState.panStartY + deltaY;
            
            CanvasState.panzoom.pan(newPanX, newPanY);
        }
    });
    
    canvasViewport.addEventListener('mouseenter', () => {
        canvasViewport.style.cursor = 'default';
        canvas.style.cursor = 'default';
    });
    
    canvasViewport.addEventListener('mouseup', (e) => {
        if (DebugConsole.showMouseLogs) {
            debugLog(`[鼠标释放] 画布视口: button=${e.button}, clientX=${e.clientX}, clientY=${e.clientY}`, 'event');
        }
        if (e.button === 1) {
            AppState.isMiddleMouseDown = false;
            canvasViewport.style.cursor = 'default';
            if (DebugConsole.showMouseLogs) {
                debugLog(`[停止拖动] 画布: isMiddleMouseDown=${AppState.isMiddleMouseDown}`, 'info');
            }
        }
    });
    
    canvasViewport.addEventListener('mouseleave', () => {
        AppState.isMiddleMouseDown = false;
        canvasViewport.style.cursor = '';
        canvas.style.cursor = '';
    });
    
    canvasViewport.addEventListener('contextmenu', (e) => {
        const targetNode = e.target.closest('.canvas-node');
        if (targetNode) {
            return;
        }
        
        e.preventDefault();
        
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        
        const centerItem = document.createElement('div');
        centerItem.className = 'context-menu-item';
        centerItem.textContent = '回到中心';
        centerItem.addEventListener('click', () => {
            resetCanvas();
            menu.remove();
        });
        
        menu.appendChild(centerItem);
        document.body.appendChild(menu);
        
        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    });
    
    if (resetCanvasBtn) {
        resetCanvasBtn.addEventListener('click', resetCanvas);
    }
    
    initMinimap();
    updateToolbarPosition();
    console.log('Canvas initialized successfully');
}

export function resetCanvas() {
    if (CanvasState.panzoom) {
        CanvasState.panzoom.reset();
        refreshUI();
    }
}

export function refreshUI() {
    updateCenterMarkerCoordinates();
    updateMinimapViewport();
}

export function updateCenterMarkerCoordinates() {
    const centerMarker = document.getElementById('canvasCenterMarker');
    if (!centerMarker) return;
    
    const uiPanel = document.getElementById('uiPanel');
    const uiPanelWidth = uiPanel ? uiPanel.offsetWidth : 400;
    const viewportCenterX = (window.innerWidth - uiPanelWidth) / 2;
    const viewportCenterY = window.innerHeight / 2;
    
    const scale = CanvasState.panzoom.getScale();
    const displayX = Math.round((viewportCenterX - AppState.panX) / scale);
    const displayY = Math.round((viewportCenterY - AppState.panY) / scale);
    
    const coordText = centerMarker.querySelector('div:nth-child(2)');
    if (coordText) {
        coordText.textContent = `中心坐标: (${displayX}, ${displayY})`;
    }
}

export function updateImageCenterCoordinates(node) {
    if (!node) return;
    
    const left = parseInt(node.style.left) || 0;
    const top = parseInt(node.style.top) || 0;
    const width = parseInt(node.dataset.width) || 500;
    const height = parseInt(node.dataset.height) || 500;
    
    const centerX = Math.round(left + width / 2);
    const centerY = Math.round(top + height / 2);
    
    const coordsElement = node.querySelector('.node-center-coords');
    if (coordsElement) {
        coordsElement.textContent = `(${centerX}, ${centerY})`;
    }
}

export function updateMinimapViewport() {
    const ratio = 200 / 10000;
    const viewportBox = minimapViewport;
    const uiPanel = document.getElementById('uiPanel');
    const uiPanelWidth = uiPanel ? uiPanel.offsetWidth : 400;

    if (!viewportBox || typeof AppState.panX === 'undefined') return;

    const vW_phys = window.innerWidth - uiPanelWidth;
    const vH_phys = window.innerHeight;

    const vW_minimap = (vW_phys / AppState.scale) * ratio;
    const vH_minimap = (vH_phys / AppState.scale) * ratio;

    const logicCenterX = 5000 + (vW_phys / 2 - 5000 - AppState.panX) / AppState.scale;
    const logicCenterY = 5000 + (vH_phys / 2 - 5000 - AppState.panY) / AppState.scale;

    const minimapCenterX = logicCenterX * ratio;
    const minimapCenterY = logicCenterY * ratio;

    viewportBox.style.width = `${vW_minimap}px`;
    viewportBox.style.height = `${vH_minimap}px`;
    viewportBox.style.left = `${minimapCenterX - vW_minimap / 2}px`;
    viewportBox.style.top = `${minimapCenterY - vH_minimap / 2}px`;
}

export function updateMinimapWithImage(node) {
    const minimapScale = 200 / 10000;
    const img = node.querySelector('img');
    const video = node.querySelector('video');
    
    let nodeWidth, nodeHeight, bgColor;
    
    if (img) {
        if (!img.complete) {
            img.onload = () => updateMinimapWithImage(node);
            return;
        }
        nodeWidth = img.offsetWidth || parseInt(img.style.width) || 200;
        nodeHeight = img.offsetHeight || parseInt(img.style.height) || 200;
        bgColor = '#10b981';
    } else if (video) {
        nodeWidth = 320;
        nodeHeight = 180;
        bgColor = '#8b5cf6';
    } else if (node.classList.contains('text-node') || node.classList.contains('text-loading-placeholder')) {
        nodeWidth = 400;
        nodeHeight = 200;
        bgColor = '#3b82f6';
    } else if (node.classList.contains('video-node')) {
        nodeWidth = 320;
        nodeHeight = 180;
        bgColor = '#8b5cf6';
    } else if (node.classList.contains('loading-placeholder')) {
        nodeWidth = parseInt(node.style.width) || 200;
        nodeHeight = parseInt(node.style.height) || 200;
        bgColor = '#10b981';
    } else {
        // 默认处理：为所有未识别的节点提供一个默认的缩略图尺寸和颜色
        nodeWidth = parseInt(node.style.width) || 200;
        nodeHeight = parseInt(node.style.height) || 200;
        bgColor = '#94a3b8'; // 默认灰色
    }
    
    const nodeLeft = parseInt(node.style.left) || 0;
    const nodeTop = parseInt(node.style.top) || 0;
    
    const minimapLeft = 100 + (nodeLeft - 5000) * minimapScale;
    const minimapTop = 100 + (nodeTop - 5000) * minimapScale;
    const minimapWidth = nodeWidth * minimapScale;
    const minimapHeight = nodeHeight * minimapScale;
    
    let minimapImage = minimapCanvas.querySelector(`[data-node-id="${node.dataset.index}"]`);
    
    if (!minimapImage) {
        minimapImage = document.createElement('div');
        minimapImage.className = 'minimap-image';
        minimapImage.dataset.nodeId = node.dataset.index;
        minimapImage.style.zIndex = '1';
        minimapCanvas.appendChild(minimapImage);
    }
    
    minimapImage.style.left = `${minimapLeft}px`;
    minimapImage.style.top = `${minimapTop}px`;
    minimapImage.style.width = `${minimapWidth}px`;
    minimapImage.style.height = `${minimapHeight}px`;
    minimapImage.style.background = bgColor;
}

export function updateAllMinimapImages() {
    const nodes = imageResponseContainer.querySelectorAll('.canvas-node');
    nodes.forEach(node => {
        updateMinimapWithImage(node);
    });
}

export function initMinimap() {
    updateMinimapViewport();
    updateAllMinimapImages();
    
    minimapCanvas.addEventListener('click', (e) => {
        if (e.target === minimapViewport) return;
        
        const rect = minimapCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        const minimapScale = 200 / 10000;
        const scale = CanvasState.panzoom.getScale();
        
        const targetLogicX = clickX / minimapScale;
        const targetLogicY = clickY / minimapScale;
        
        const uiPanel = document.getElementById('uiPanel');
        const uiPanelWidth = uiPanel ? uiPanel.offsetWidth : 400;
        const vW_phys = window.innerWidth - uiPanelWidth;
        const vH_phys = window.innerHeight;

        const newPanX = vW_phys / 2 - 5000 - (targetLogicX - 5000) * scale;
        const newPanY = vH_phys / 2 - 5000 - (targetLogicY - 5000) * scale;
        
        CanvasState.panzoom.pan(newPanX, newPanY);
    });
    
    minimapViewport.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDraggingMinimapViewport = true;
        window.minimapDragStartX = e.clientX;
        window.minimapDragStartY = e.clientY;
        window.minimapPanStartX = AppState.panX;
        window.minimapPanStartY = AppState.panY;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDraggingMinimapViewport) {
            const deltaX = e.clientX - window.minimapDragStartX;
            const deltaY = e.clientY - window.minimapDragStartY;
            
            const minimapScale = 200 / 10000;
            const scale = CanvasState.panzoom.getScale();
            
            const newPanX = window.minimapPanStartX - (deltaX / minimapScale) * scale;
            const newPanY = window.minimapPanStartY - (deltaY / minimapScale) * scale;
            
            CanvasState.panzoom.pan(newPanX, newPanY);
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDraggingMinimapViewport) {
            isDraggingMinimapViewport = false;
        }
    });
}

export function updateCanvasScale(newScale, x, y) {
    const uiPanel = document.getElementById('uiPanel');
    const uiPanelWidth = uiPanel ? uiPanel.offsetWidth : 400;
    
    let pointX, pointY;
    
    // 如果传入了坐标（来自鼠标滚轮），则以鼠标为中心缩放
    if (x !== undefined && y !== undefined) {
        pointX = x;
        pointY = y;
    } else {
        // 否则（来自快捷键等），以屏幕中心为中心缩放
        pointX = (window.innerWidth - uiPanelWidth) / 2;
        pointY = window.innerHeight / 2;
    }
    
    const isWheel = (x !== undefined);
    const panzoom = CanvasState.panzoom;
    const oldScale = panzoom.getScale();
    
    if (newScale === oldScale) return;
    
    const pan = panzoom.getPan();
    const oldX = pan.x;
    const oldY = pan.y;
    
    const ratio = newScale / oldScale;
    const cx = 5000;
    const cy = 5000;
    
    // 1. 算出完美的物理最终坐标（完全符合 5000px 中心和 CSS Transform 机制）
    const TargetX = pointX - cx - (pointX - cx - oldX) * ratio;
    const TargetY = pointY - cy - (pointY - cy - oldY) * ratio;
    
    // 2. 逆向计算出能让泛型 panzoom 库在其存在缺陷的公式中算出我们 TargetX/Y 的“伪造聚点 (Focal point)”
    // panzoom 的公式：a = (focal.x/newS - focal.x/oldS + oldX*newS) / newS -> 让它算出 a = TargetX
    const denominator = oldScale - newScale;
    const focalX = newScale * (TargetX - oldX) * (newScale * oldScale) / denominator;
    const focalY = newScale * (TargetY - oldY) * (newScale * oldScale) / denominator;
    
    // 3. 将伪造的焦点传回 panzoom，完美白嫖其内部的状态机和 transition 渲染动画，且仅产生一帧更新消除抖动！
    panzoom.zoom(newScale, { 
        focal: { x: focalX, y: focalY },
        animate: true,
        duration: isWheel ? 100 : 200
    });
    
    if (toolbarZoomValue) {
        toolbarZoomValue.textContent = `${Math.round(newScale * 100)}%`;
    }
    debugLog(`[缩放] 新缩放: ${Math.round(newScale * 100)}% (伪造原点修正应用)`, 'info');
}

export function updateToolbarPosition() {
    const canvasMinimap = document.getElementById('canvasMinimap');
    const miniToolbar = document.getElementById('miniToolbar');
    const debugConsole = document.getElementById('debugConsole');
    
    if (!miniToolbar || !debugConsole) return;
    
    const isCollapsed = debugConsole.classList.contains('collapsed');
    const debugConsoleHeight = isCollapsed ? 24 : 364;
    const toolbarBottom = debugConsoleHeight + 16;
    
    miniToolbar.style.bottom = `${toolbarBottom}px`;
    
    if (canvasMinimap) {
        canvasMinimap.style.bottom = `${debugConsoleHeight + 16}px`;
    }
}

export function getPanzoom() {
    return CanvasState.panzoom;
}

export function getImageResponseContainer() {
    return imageResponseContainer;
}
