// 应用状态管理
export let minimapDragStartX = 0;
export let minimapDragStartY = 0;
export let minimapPanStartX = 0;
export let minimapPanStartY = 0;

// 应用状态管理
export const AppState = {
    mode: 'VIEW',
    activeNode: null,
    scale: 1,
    isDraggingNode: false,
    dragNode: null,
    dragStartX: 0,
    dragStartY: 0,
    dragNodeStartLeft: 0,
    dragNodeStartTop: 0,
    isMiddleMouseDown: false,
    lastMouseX: 0,
    lastMouseY: 0,
    panX: 0,
    panY: 0,
    isResizingNode: false,
    resizeStart: { x: 0, y: 0, width: 0, height: 0 },
    resizeNode: null,
    nodes: new Map(),
    
    updateScale: function(newScale) {
        this.scale = newScale;
    },
    
    reset: function() {
        this.mode = 'VIEW';
        this.activeNode = null;
        this.isDraggingNode = false;
        this.dragNode = null;
        this.isMiddleMouseDown = false;
        this.isResizingNode = false;
        this.resizeNode = null;
    }
};

// 画布状态管理
export const CanvasState = {
    panzoom: null,
    nodeCounter: 0,
    pinCounter: 0,
    selectedNode: null,
    imagePins: new Map(),
    currentMode: 'image',
    activeRequests: 0,
    currentBlobUrl: null
};
