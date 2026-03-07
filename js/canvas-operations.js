// 画布操作相关逻辑

import { AppState } from "./app-state.js";

export class CanvasOperations {
    constructor(panzoom, canvas, canvasViewport, imageResponseContainer, minimapCanvas, minimapViewport) {
        this.panzoom = panzoom;
        this.canvas = canvas;
        this.canvasViewport = canvasViewport;
        this.imageResponseContainer = imageResponseContainer;
        this.minimapCanvas = minimapCanvas;
        this.minimapViewport = minimapViewport;
        
        this.isDraggingMinimapViewport = false;
        this.minimapDragStartX = 0;
        this.minimapDragStartY = 0;
        this.minimapPanStartX = 0;
        this.minimapPanStartY = 0;
        
        this.debugConsole = document.getElementById('debugConsole');
        this.showMouseLogs = false;
    }
    
    initCanvas() {
        console.log('Initializing canvas...');
        console.log('Canvas element:', this.canvas);
        console.log('CanvasViewport:', this.canvasViewport);
        
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
        
        this.panzoom = Panzoom(this.canvas, {
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
                
                this.updateMinimapViewport();
                this.updateCenterMarkerCoordinates();
            }
        });
        
        const scale = this.panzoom.getScale();
        AppState.updateScale(scale);
        AppState.panX = startX;
        AppState.panY = startY;
        
        setTimeout(() => {
            this.updateCenterMarkerCoordinates();
            this.updateMinimapViewport();
        }, 0);
        
        this.generateDebugGrid();
        
        this.canvasViewport.style.cursor = 'default';
        this.canvas.style.cursor = 'default';
        
        this.bindCanvasEvents();
        this.initMinimap();
        this.updateToolbarPosition();
        console.log('Canvas initialized successfully');
    }
    
    bindCanvasEvents() {
        const toolbarZoomValue = document.getElementById('toolbarZoomValue');
        
        this.canvas.addEventListener('panzoomzoom', (e) => {
            const newScale = e.detail.scale;
            AppState.updateScale(newScale);
            
            if (toolbarZoomValue) {
                toolbarZoomValue.textContent = `${Math.round(newScale * 100)}%`;
            }
            
            this.updateMinimapViewport();
            this.updateCenterMarkerCoordinates();
        });
        
        this.canvas.addEventListener('panzoompan', (e) => {
            const panX = e.detail.x;
            const panY = e.detail.y;
            AppState.panX = panX;
            AppState.panY = panY;
            this.updateMinimapViewport();
            this.updateCenterMarkerCoordinates();
        });
        
        this.canvasViewport.addEventListener('mousedown', (e) => {
            if (this.debugConsole && this.debugConsole.contains(e.target)) return;
            if (e.button === 1) {
                e.preventDefault();
                AppState.isMiddleMouseDown = true;
                AppState.lastMouseX = e.clientX;
                AppState.lastMouseY = e.clientY;
                this.canvasViewport.style.cursor = 'grabbing';
            } else {
                this.canvasViewport.style.cursor = 'default';
            }
        });
        
        this.canvasViewport.addEventListener('mouseenter', () => {
            this.canvasViewport.style.cursor = 'default';
            this.canvas.style.cursor = 'default';
        });
        
        this.canvasViewport.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                AppState.isMiddleMouseDown = false;
                this.canvasViewport.style.cursor = 'default';
            }
        });
        
        this.canvasViewport.addEventListener('mouseleave', () => {
            AppState.isMiddleMouseDown = false;
            this.canvasViewport.style.cursor = '';
            this.canvas.style.cursor = '';
        });
        
        this.canvasViewport.addEventListener('contextmenu', (e) => {
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
                this.resetCanvas();
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
    }
    
    generateDebugGrid() {
        const svg = document.getElementById('debugGridSvg');
        if (!svg) return;
        
        let svgContent = '';
        
        for (let i = 0; i <= 100; i++) {
            const pos = i * 100;
            svgContent += `<line x1="${pos}" y1="0" x2="${pos}" y2="10000" stroke="#00ff00" stroke-width="1" stroke-opacity="0.2"/>`;
            svgContent += `<line x1="0" y1="${pos}" x2="10000" y2="${pos}" stroke="#00ff00" stroke-width="1" stroke-opacity="0.2"/>`;
        }
        
        for (let row = 1; row <= 100; row++) {
            for (let col = 1; col <= 100; col++) {
                const x = (col - 1) * 100 + 50;
                const y = (row - 1) * 100 + 50;
                svgContent += `<text x="${x}" y="${y}" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#00ff00" fill-opacity="0.5">${row}.${col}</text>`;
            }
        }
        
        svg.innerHTML = svgContent;
    }
    
    resetCanvas() {
        if (this.panzoom) {
            this.panzoom.reset();
            this.refreshUI();
        }
    }
    
    refreshUI() {
        this.updateCenterMarkerCoordinates();
        this.updateMinimapViewport();
    }
    
    updateCenterMarkerCoordinates() {
        const centerMarker = document.getElementById('canvasCenterMarker');
        if (!centerMarker) return;
        
        const uiPanel = document.getElementById('uiPanel');
        const uiPanelWidth = uiPanel ? uiPanel.offsetWidth : 400;
        const viewportCenterX = (window.innerWidth - uiPanelWidth) / 2;
        const viewportCenterY = window.innerHeight / 2;
        
        const scale = this.panzoom.getScale();
        const displayX = Math.round((viewportCenterX - AppState.panX) / scale);
        const displayY = Math.round((viewportCenterY - AppState.panY) / scale);
        
        const coordText = centerMarker.querySelector('div:nth-child(2)');
        if (coordText) {
            coordText.textContent = `中心坐标: (${displayX}, ${displayY})`;
        }
    }
    
    updateImageCenterCoordinates(node) {
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
    
    updateMinimapViewport() {
        const ratio = 200 / 10000;
        const viewportBox = document.getElementById('minimapViewport');
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
    
    updateMinimapWithImage(node) {
        const minimapScale = 200 / 10000;
        const img = node.querySelector('img');
        const video = node.querySelector('video');
        
        let nodeWidth, nodeHeight, bgColor;
        
        if (img) {
            if (!img.complete) {
                img.onload = () => this.updateMinimapWithImage(node);
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
            return;
        }
        
        const nodeLeft = parseInt(node.style.left) || 0;
        const nodeTop = parseInt(node.style.top) || 0;
        
        const minimapLeft = 100 + (nodeLeft - 5000) * minimapScale;
        const minimapTop = 100 + (nodeTop - 5000) * minimapScale;
        const minimapWidth = nodeWidth * minimapScale;
        const minimapHeight = nodeHeight * minimapScale;
        
        let minimapImage = this.minimapCanvas.querySelector(`[data-node-id="${node.dataset.index}"]`);
        
        if (!minimapImage) {
            minimapImage = document.createElement('div');
            minimapImage.className = 'minimap-image';
            minimapImage.dataset.nodeId = node.dataset.index;
            minimapImage.style.zIndex = '1';
            this.minimapCanvas.appendChild(minimapImage);
        }
        
        minimapImage.style.left = `${minimapLeft}px`;
        minimapImage.style.top = `${minimapTop}px`;
        minimapImage.style.width = `${minimapWidth}px`;
        minimapImage.style.height = `${minimapHeight}px`;
        minimapImage.style.background = bgColor;
    }
    
    updateAllMinimapImages() {
        const nodes = this.imageResponseContainer.querySelectorAll('.canvas-node');
        nodes.forEach(node => {
            this.updateMinimapWithImage(node);
        });
    }
    
    initMinimap() {
        this.updateMinimapViewport();
        this.updateAllMinimapImages();
        
        this.minimapCanvas.addEventListener('click', (e) => {
            if (e.target === this.minimapViewport) return;
            
            const rect = this.minimapCanvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            const minimapScale = 200 / 10000;
            const scale = this.panzoom.getScale();
            
            const targetLogicX = clickX / minimapScale;
            const targetLogicY = clickY / minimapScale;
            
            const uiPanel = document.getElementById('uiPanel');
            const uiPanelWidth = uiPanel ? uiPanel.offsetWidth : 400;
            const vW_phys = window.innerWidth - uiPanelWidth;
            const vH_phys = window.innerHeight;

            const newPanX = vW_phys / 2 - 5000 - (targetLogicX - 5000) * scale;
            const newPanY = vH_phys / 2 - 5000 - (targetLogicY - 5000) * scale;
            
            this.panzoom.pan(newPanX, newPanY);
        });
        
        this.minimapViewport.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isDraggingMinimapViewport = true;
            this.minimapDragStartX = e.clientX;
            this.minimapDragStartY = e.clientY;
            this.minimapPanStartX = AppState.panX;
            this.minimapPanStartY = AppState.panY;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingMinimapViewport) {
                const deltaX = e.clientX - this.minimapDragStartX;
                const deltaY = e.clientY - this.minimapDragStartY;
                
                const minimapScale = 200 / 10000;
                const scale = this.panzoom.getScale();
                
                const newPanX = this.minimapPanStartX - (deltaX / minimapScale) * scale;
                const newPanY = this.minimapPanStartY - (deltaY / minimapScale) * scale;
                
                this.panzoom.pan(newPanX, newPanY);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDraggingMinimapViewport) {
                this.isDraggingMinimapViewport = false;
            }
        });
    }
    
    updateCanvasScale(newScale) {
        if (this.panzoom) {
            this.panzoom.zoom(newScale);
        }
    }
    
    updateToolbarPosition() {
        const toolbar = document.getElementById('canvasToolbar');
        if (toolbar) {
            const uiPanel = document.getElementById('uiPanel');
            const uiPanelWidth = uiPanel ? uiPanel.offsetWidth : 400;
            toolbar.style.right = `${uiPanelWidth + 20}px`;
        }
    }
}
