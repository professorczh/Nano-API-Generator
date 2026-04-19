// 应用状态管理
export let minimapDragStartX = 0;
export let minimapDragStartY = 0;
export let minimapPanStartX = 0;
export let minimapPanStartY = 0;

// ── V2: 项目身份标识（localStorage 持久化）
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function initProjectIdentity() {
    const DEFAULT_USER_ID = 'admin';
    const stored = localStorage.getItem('nano_project_id');
    const projectId = stored || generateUUID();
    if (!stored) localStorage.setItem('nano_project_id', projectId);
    return { userId: DEFAULT_USER_ID, projectId };
}

const _identity = initProjectIdentity();

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
    panStartX: 0,
    panStartY: 0,
    isResizingNode: false,
    resizeStart: { x: 0, y: 0, width: 0, height: 0 },
    resizeNode: null,
    nodes: new Map(),

    // 连线引用状态
    isLinking: false,
    linkStartNode: null,
    linkCurrentX: 0,
    linkCurrentY: 0,

    // ── V2: 项目身份
    userId: _identity.userId,
    projectId: _identity.projectId,

    updateScale: function(newScale) {
        this.scale = newScale;
    },

    /** 切换项目 (更新 id 并持久化) */
    switchProject: function(projectId) {
        if (this.projectId === projectId) return;
        this.projectId = projectId;
        localStorage.setItem('nano_project_id', projectId);
        // 派发全局事件
        window.dispatchEvent(new CustomEvent('projectSwitched', { detail: { projectId } }));
    },

    reset: function() {
        this.mode = 'VIEW';
        this.activeNode = null;
        this.isDraggingNode = false;
        this.dragNode = null;
        this.isMiddleMouseDown = false;
        this.isResizingNode = false;
        this.resizeNode = null;
        this.isLinking = false;
        this.linkStartNode = null;
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
