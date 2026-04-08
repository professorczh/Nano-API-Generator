import { AppState, CanvasState } from './app-state.js';
import { referenceManager } from './reference-manager.js';
import { debugLog } from './utils.js';

export const LinkerManager = {
    init() {
        this.overlay = document.getElementById('linkerOverlay');
        this.path = document.getElementById('linkerPath');
        this.endCircle = document.getElementById('linkerEndCircle');
        this.promptBox = document.getElementById('promptInput');
        this.refShelf = document.getElementById('referenceShelf');
        
        // 我们不需要全局监听，App.js 会分发事件过来
    },

    startLinking(node, e) {
        e.stopPropagation();
        e.preventDefault();

        AppState.isLinking = true;
        AppState.linkStartNode = node;
        
        // 计算起始点 (节点右侧中心)
        const rect = node.getBoundingClientRect();
        // 我们需要相对于视口的坐标
        const startX = rect.right;
        const startY = rect.top + rect.height / 2;
        
        AppState.linkStartX = startX;
        AppState.linkStartY = startY;
        
        this.overlay.style.display = 'block';
        this.updateLine(e.clientX, e.clientY);
        
        debugLog(`[Linker] Start linking from node: ${node.dataset.filename || 'Unknown'}`, 'info');
    },

    updateLinking(e) {
        if (!AppState.isLinking) return;
        
        this.updateLine(e.clientX, e.clientY);
        
        // 碰撞检测：检查是否划过目标区域
        this.checkTargets(e.clientX, e.clientY);
    },

    updateLine(endX, endY) {
        const startX = AppState.linkStartX;
        const startY = AppState.linkStartY;
        
        // 绘制贝塞尔曲线
        // 控制点在水平方向延伸
        const cp1x = startX + (endX - startX) * 0.5;
        const cp1y = startY;
        const cp2x = startX + (endX - startX) * 0.5;
        const cp2y = endY;
        
        const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
        this.path.setAttribute('d', d);
        
        // 更新终端小圆点
        this.endCircle.setAttribute('cx', endX);
        this.endCircle.setAttribute('cy', endY);
        this.endCircle.style.display = 'block';
    },

    checkTargets(x, y) {
        const elements = document.elementsFromPoint(x, y);
        
        // 清理原有高亮
        document.querySelectorAll('.drop-target-active').forEach(el => el.classList.remove('drop-target-active'));
        
        for (const el of elements) {
            // 优先级 1: 特定插槽
            if (el.classList.contains('reference-drop-zone')) {
                el.classList.add('drop-target-active');
                return; // 找到最具体的立马返回
            }
            // 优先级 2: 参考架整体
            if (el === this.refShelf || this.refShelf?.contains(el)) {
                this.refShelf.classList.add('drop-target-active');
                return;
            }
            // 优先级 3: 提示词框
            if (el === this.promptBox || this.promptBox?.contains(el)) {
                this.promptBox.classList.add('drop-target-active');
                return;
            }
        }
    },

    async endLinking(e) {
        if (!AppState.isLinking) return;
        
        const x = e.clientX;
        const y = e.clientY;
        const elements = document.elementsFromPoint(x, y);
        
        let targetArea = null;
        let targetSlot = null;

        for (const el of elements) {
            if (el.classList.contains('reference-drop-zone')) {
                targetArea = 'shelf';
                targetSlot = el.dataset.slot !== '' ? parseInt(el.dataset.slot) : null;
                break;
            }
            if (el === this.refShelf || this.refShelf?.contains(el)) {
                targetArea = 'shelf';
                break;
            }
            if (el === this.promptBox || this.promptBox?.contains(el)) {
                targetArea = 'prompt';
                break;
            }
        }

        if (targetArea) {
            await this.handleLinkSuccess(AppState.linkStartNode, targetArea, targetSlot);
        }

        // 清理工作
        this.overlay.style.display = 'none';
        this.path.setAttribute('d', '');
        this.endCircle.style.display = 'none';
        document.querySelectorAll('.drop-target-active').forEach(el => el.classList.remove('drop-target-active'));
        
        AppState.isLinking = false;
        AppState.linkStartNode = null;
    },

    async handleLinkSuccess(node, targetArea, slotIndex = null) {
        const nodeType = node.dataset.nodeType;
        const filename = node.dataset.filename || 'Asset';
        
        // 获取资源 URL
        let url = '';
        if (nodeType === 'video') url = node.dataset.videoUrl || node.querySelector('video')?.src;
        else if (nodeType === 'image') url = node.querySelector('img')?.src;
        else if (nodeType === 'audio') url = node.dataset.audioUrl || node.querySelector('audio')?.src;

        if (!url) {
            debugLog('[Linker] No URL found for node', 'error');
            return;
        }

        // --- 核心改进：统一调用逻辑 ---
        
        // 情况 A: 目标是提示词框 -> 使用统一的 insertImageToPrompt (内部会处理 shelf 同步)
        if (targetArea === 'prompt') {
            if (window.insertImageToPrompt) {
                await window.insertImageToPrompt(url, filename);
                this.promptBox.focus();
                return;
            }
        }

        // 情况 B: 目标是参考架特定位 -> 保持手动添加到 shelf 的逻辑
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const extension = blob.type.split('/')[1] || 'bin';
            const fileNameWithExt = filename.includes('.') ? filename : `${filename}.${extension}`;
            const file = new File([blob], fileNameWithExt, { type: blob.type });
            
            const ref = await referenceManager.addReference(file, fileNameWithExt, null, slotIndex);
            
            if (ref) {
                debugLog(`[Linker] Reference added successfully to ${slotIndex !== null ? 'slot ' + slotIndex : 'shelf'}: ${fileNameWithExt}`, 'success');
            }
        } catch (err) {
            console.error('[Linker] Failed to fetch or add node data:', err);
            debugLog('[Linker] 获取或添加节点数据失败: ' + err.message, 'error');
        }
    }
};

window.LinkerManager = LinkerManager;
