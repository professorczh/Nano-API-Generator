/**
 * PERSISTENCE MANAGER
 * 处理画布状态的序列化与反序列化 (导出/导入)
 */

import { AppState, CanvasState } from './app-state.js';
import { NodeFactory } from './node-factory.js';
import { debugLog, createNodeHeader, createNodeToolbar, createNodeSidebar, createNodeInfo } from './utils.js';
import { createImageNode, createTextNode } from './node-manager.js';
import { getIcon } from './icons.js';

export const PersistenceManager = {
    // ── V2: 动作防抖与云端保存 ──
    saveTimeout: null,
    
    /**
     * 捕获用户动作 (MOVE, RESIZE, DELETE, CREATE 等)
     */
    trackAction(actionType, details = {}) {
        if (window.debugLog) window.debugLog(`[Action] ${actionType}`, 'info');
        this.triggerAutoSave();
    },

    triggerAutoSave() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveStateToServer();
        }, 3000); // 3秒防抖
    },

    async saveStateToServer() {
        try {
            const nodes = Array.from(document.querySelectorAll('.canvas-node'));
            const nodeData = nodes.map(node => this.serializeNode(node));
            const panzoom = CanvasState.panzoom;
            
            const state = {
                metadata: {
                    userId: AppState.userId,
                    projectId: AppState.projectId
                },
                global: {
                    scale: panzoom ? panzoom.getScale() : 1,
                    pan: panzoom ? panzoom.getPan() : { x: 0, y: 0 }
                },
                nodes: nodeData
            };

            const response = await fetch('/api/project/state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': AppState.userId,
                    'x-project-id': AppState.projectId
                },
                body: JSON.stringify(state)
            });

            const result = await response.json();
            if (result.success) {
                // 将成功日志打印到前端调试控制台以便验证
                if (window.debugLog) window.debugLog(`[持久化] 自动保存成功`, 'info');
                else console.log(`💾 [自动保存] 成功 (项目: ${AppState.projectId})`);
            }
        } catch (e) {
            console.error('[持久化] 自动保存失败:', e);
            if (window.debugLog) window.debugLog(`[持久化] 保存失败: ${e.message}`, 'error');
        }
    },

    /**
     * 加载云端项目状态
     */
    async loadProjectState(userId = AppState.userId, projectId = AppState.projectId) {
        try {
            const response = await fetch(`/api/project/state?userId=${userId}&projectId=${projectId}`);
            if (!response.ok) return false;
            const data = await response.json();
            await this.restoreFromData(data);
            return true;
        } catch (e) {
            console.error('[持久化] 项目加载失败:', e);
            return false;
        }
    },

    /**
     * 从数据对象重建画布 (分离自 importCanvas)
     */
    async restoreFromData(data) {
        console.log("[持久化/DEBUG] 开始解析快照数据", data);
        
        if (!data || !data.nodes || !Array.isArray(data.nodes)) {
            console.error("[持久化/ERROR] 数据结构校验失败，nodes 缺失或格式错误");
            throw new Error('格式校验失败');
        }

        const container = document.getElementById('imageResponseContainer');
        if (!container) throw new Error('找不到画布容器。');
        
        const existingNodes = container.querySelectorAll('.canvas-node');
        existingNodes.forEach(n => n.remove());

        if (data.global && CanvasState.panzoom) {
            CanvasState.panzoom.zoom(data.global.scale || 1);
            CanvasState.panzoom.pan(data.global.pan.x || 0, data.global.pan.y || 0);
        }

        let successCount = 0;
        for (let i = 0; i < data.nodes.length; i++) {
            const n = data.nodes[i];
            n.id = Date.now() + "_" + i; 
            const result = this.reconstructNode(n, container);
            if (result) successCount++;
        }
        console.log(`[持久化] 还原完毕。成功: ${successCount}`);
        return true;
    },
    /**
     * 导出当前画布快照
     */
    exportCanvas() {
        try {
            const nodes = Array.from(document.querySelectorAll('.canvas-node'));
            const nodeData = nodes.map(node => this.serializeNode(node));
            
            // 获取画布全局状态
            const panzoom = CanvasState.panzoom;
            const canvasData = {
                version: "1.1.2",
                timestamp: Date.now(),
                global: {
                    scale: panzoom ? panzoom.getScale() : 1,
                    pan: panzoom ? panzoom.getPan() : { x: 0, y: 0 }
                },
                nodes: nodeData
            };

            const blob = new Blob([JSON.stringify(canvasData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.href = url;
            a.download = `canvas-snapshot-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (window.debugLog) window.debugLog('[持久化] 画布快照导出成功', 'info');
            return true;
        } catch (error) {
            console.error('Export failed:', error);
            if (window.debugLog) window.debugLog(`[持久化] 导出失败: ${error.message}`, 'error');
            return false;
        }
    },

    /**
     * 序列化单个节点
     */
    serializeNode(node) {
        // 提取模型名称 (优先使用 dataset)
        let modelName = node.dataset.modelName || '';
        // 兼容处理：如果是转义后的 JSON 对象字符串，后续重建时会处理，此处保持原样
        if (!modelName || modelName === '[object Object]') {
            const tag = node.querySelector('.node-model-tag');
            if (tag) modelName = tag.textContent.trim();
        }

        const type = node.dataset.nodeType || 'image';
        const rect = {
            x: parseFloat(node.style.left) || 0,
            y: parseFloat(node.style.top) || 0,
            width: parseFloat(node.style.width) || 300,
            height: parseFloat(node.style.height) || 300
        };

        // 提取 Prompt
        let prompt = node.dataset.prompt || '';
        if (!prompt) {
            const infoEl = node.querySelector('.node-info');
            if (infoEl) prompt = infoEl.textContent.trim();
        }

        // 提取资源 URL
        let resourceUrl = '';
        if (type === 'image') resourceUrl = node.dataset.imageUrl || node.querySelector('img')?.src;
        else if (type === 'video') resourceUrl = node.querySelector('video')?.src;
        else if (type === 'audio') resourceUrl = node.dataset.audioUrl || node.querySelector('audio')?.src;
        else if (type === 'panorama') resourceUrl = node.dataset.imageUrl;

        return {
            type,
            rect,
            prompt,
            modelName,
            filename: node.dataset.filename || '',
            resourceUrl,
            pins: JSON.parse(node.dataset.pins || '[]'),
            aspectRatio: node.dataset.aspectRatio || '1:1',
            cameraLocked: node.dataset.cameraLocked === 'true',
            metadata: {
                // 优先从数据层获取纯净的耗时数字
                generationTime: node.dataset.generationTime || node.querySelector('.node-generation-time span')?.textContent || '',
                isError: node.classList.contains('error-state'),
                textContent: type === 'text' ? (node.querySelector('.text-content')?.textContent || '') : '',
                snapshot: node.dataset.snapshot,
                revisedPrompt: node.dataset.revisedPrompt || ''
            }
        };
    },

    /**
     * 导入并重建画布 (从本地 JSON 文件)
     */
    async importCanvas(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    await this.restoreFromData(data);
                    // 导入后触发自动保存到云端
                    this.trackAction('IMPORT_CANVAS');
                    resolve(true);
                } catch (err) {
                    console.error('[持久化/CRITICAL] 导入重建过程崩溃:', err);
                    if (window.debugLog) window.debugLog(`[持久化] 导入失败: ${err.message}`, 'error');
                    resolve(false);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    /**
     * 根据序列化数据重建 DOM 节点
     */
    reconstructNode(data, container) {
        let node;
        const { type } = data;

        try {
            if (type === 'image') {
                node = this.createFinalImageNode(data);
            } else if (type === 'video') {
                node = this.createFinalVideoNode(data);
            } else if (type === 'audio') {
                node = this.createFinalAudioNode(data);
            } else if (type === 'text') {
                node = this.createFinalTextNode(data);
            } else if (type === 'panorama') {
                node = this.createFinalPanoramaNode(data);
            } else {
                console.warn(`[持久化/WARN] 未知的节点类型: ${type}`);
            }

            if (node && container) {
                container.appendChild(node);
                if (window.updateMinimapWithImage) window.updateMinimapWithImage(node);
                console.log(`[持久化/SUCCESS] 节点已挂载: [${type}]`);
                return true;
            }
            return false;
        } catch (err) {
            console.error(`[持久化/ERROR] 节点 [${type}] 重建失败:`, err, data);
            return false;
        }
    },

    createFinalImageNode(data) {
        const { rect, prompt, modelName, resourceUrl, filename, metadata } = data;
        const genTime = this.parseTimeToSeconds(metadata?.generationTime);
        
        console.log(`[持久化/CREATE] 正在重建图片节点... 来源: ${resourceUrl?.slice(0,30)}...`);
        
        // 直接使用标准的创建函数，确保 UI 组件一致
        const node = createImageNode(
            resourceUrl, 
            prompt, 
            0, 
            filename, 
            `${rect.width}x${rect.height}`, 
            genTime, // 使用解析后的数值
            modelName, 
            null, 
            rect.x, 
            rect.y,
            metadata?.revisedPrompt || null
        );
        
        if (node) {
            node.dataset.index = data.id || Date.now();
            
            // 还原快照逻辑
            if (metadata?.snapshot) {
                node.dataset.snapshot = metadata.snapshot;
                try {
                    const snapObj = JSON.parse(metadata.snapshot);
                    if (window.promptPanelManager) {
                        window.promptPanelManager.nodeSnapshots.set(node.dataset.index, snapObj);
                    }
                } catch(e) {}
            }
        }
        return node;
    },

    // 辅助：解析时间字符串为数字
    parseTimeToSeconds(timeStr) {
        if (!timeStr) return 0;
        if (typeof timeStr === 'number') return timeStr;
        
        // 鲁棒性改进：剔除 emoji 和单位，仅保留数字、点和冒号
        let cleanStr = timeStr.toString().replace(/[^\d\.:]/g, '').trim();
        if (!cleanStr) return 0;

        if (cleanStr.includes(':')) {
            const parts = cleanStr.split(':');
            return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
        }
        return parseFloat(cleanStr) || 0;
    },

    createFinalVideoNode(data) {
        const { rect, prompt, modelName, resourceUrl, filename, metadata } = data;
        const timeValue = this.parseTimeToSeconds(metadata?.generationTime);

        // 借用 factory 的样式逻辑，但手动填充 content
        const node = document.createElement('div');
        node.className = 'canvas-node video-node';
        node.style.cssText = `left:${rect.x}px; top:${rect.y}px; width:${rect.width}px; height:${rect.height}px;`;
        node.dataset.nodeType = 'video';
        node.dataset.prompt = prompt;
        node.dataset.modelName = modelName;
        node.dataset.filename = filename;
        node.dataset.index = data.id || Date.now();

        // 还原快照逻辑
        if (metadata?.snapshot) {
            node.dataset.snapshot = metadata.snapshot;
            try {
                const snapObj = JSON.parse(metadata.snapshot);
                if (window.promptPanelManager) {
                    window.promptPanelManager.nodeSnapshots.set(node.dataset.index, snapObj);
                }
            } catch(e) {}
        }

        // 组装内部结构
        node.appendChild(PersistenceManager.utils.createNodeHeader('video', '16:9', filename));
        
        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.cssText = 'position:relative; width:100%; height:100%; background:#000; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:12px;';
        
        const video = document.createElement('video');
        video.src = resourceUrl;
        video.controls = true;
        video.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
        contentArea.appendChild(video);
        node.appendChild(contentArea);

        // 工具栏
        const toolbar = PersistenceManager.utils.createNodeToolbar('video', {
            onCopyPrompt: () => navigator.clipboard.writeText(prompt),
            onInsertPrompt: () => {
                if (window.PinManager && window.PinManager.addCanvasImageToPrompt) {
                    window.PinManager.addCanvasImageToPrompt(node);
                }
            },
            onDelete: () => {
                if (window.selectNode) window.selectNode(node);
                if (window.deleteSelectedNode) window.deleteSelectedNode();
            }
        });
        node.appendChild(toolbar);

        node.appendChild(PersistenceManager.utils.createNodeInfo(prompt));
        node.appendChild(PersistenceManager.utils.createNodeSidebar(timeValue, modelName));

        // 注入持久化 dataset
        node.dataset.generationTime = timeValue;
        node.dataset.modelName = modelName;

        // 重新绑定拖拽
        this.bindDrag(node);
        return node;
    },

    createFinalAudioNode(data) {
        const { rect, prompt, modelName, resourceUrl, filename, metadata } = data;
        const timeValue = this.parseTimeToSeconds(metadata?.generationTime);

        const node = document.createElement('div');
        node.className = 'canvas-node audio-node';
        node.style.cssText = `left:${rect.x}px; top:${rect.y}px; width:${rect.width}px; height:${rect.height}px;`;
        node.dataset.nodeType = 'audio';
        node.dataset.prompt = prompt;
        node.dataset.modelName = modelName;
        node.dataset.filename = filename;
        node.dataset.audioUrl = resourceUrl;
        node.dataset.index = data.id || Date.now();

        // 还原快照逻辑
        if (metadata?.snapshot) {
            node.dataset.snapshot = metadata.snapshot;
            try {
                const snapObj = JSON.parse(metadata.snapshot);
                if (window.promptPanelManager) {
                    window.promptPanelManager.nodeSnapshots.set(node.dataset.index, snapObj);
                }
            } catch(e) {}
        }

        node.appendChild(PersistenceManager.utils.createNodeHeader('audio', 'MP3', filename));
        
        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;';
        contentArea.innerHTML = `<audio src="${resourceUrl}" controls style="width:85%; height:40px; z-index:10;"></audio>`;
        node.appendChild(contentArea);

        const toolbar = PersistenceManager.utils.createNodeToolbar('audio', {
            onDelete: () => {
                if (window.selectNode) window.selectNode(node);
                if (window.deleteSelectedNode) window.deleteSelectedNode();
            }
        });
        node.appendChild(toolbar);

        node.appendChild(PersistenceManager.utils.createNodeInfo(prompt));
        node.appendChild(PersistenceManager.utils.createNodeSidebar(timeValue, modelName));

        // 注入持久化 dataset
        node.dataset.generationTime = timeValue;
        node.dataset.modelName = modelName;

        this.bindDrag(node);
        return node;
    },

    createFinalTextNode(data) {
        const { rect, prompt, modelName, metadata } = data;
        const textStr = metadata?.textContent || prompt || '';
        const timeValue = this.parseTimeToSeconds(metadata?.generationTime);

        console.log(`[持久化/CREATE] 正在通过 NodeManager 重建文本节点...`);
        
        const node = createTextNode(textStr, prompt, 0, data.filename, '', timeValue, modelName);
        
        if (node) {
            node.style.left = `${rect.x}px`;
            node.style.top = `${rect.y}px`;
            node.style.width = `${rect.width}px`;
            node.style.height = `${rect.height}px`;
            node.dataset.index = data.id || Date.now();

            // 还原快照逻辑
            if (metadata?.snapshot) {
                node.dataset.snapshot = metadata.snapshot;
                try {
                    const snapObj = JSON.parse(metadata.snapshot);
                    if (window.promptPanelManager) {
                        window.promptPanelManager.nodeSnapshots.set(node.dataset.index, snapObj);
                    }
                } catch(e) {}
            }
        }
        
        return node;
    },

    createFinalPanoramaNode(data) {
        const { rect, prompt, resourceUrl, filename, metadata, aspectRatio, cameraLocked } = data;
        
        console.log(`[持久化/CREATE] 正在重建全景节点... 比例: ${aspectRatio || '1:1'}, 锁定: ${cameraLocked}`);

        const node = document.createElement('div');
        node.className = 'canvas-node panorama-node';
        node.style.cssText = `left:${rect.x}px; top:${rect.y}px; width:${rect.width}px; height:${rect.height}px;`;
        node.dataset.nodeType = 'panorama';
        node.dataset.prompt = prompt;
        node.dataset.filename = filename;
        node.dataset.imageUrl = resourceUrl;
        node.dataset.index = data.id || Date.now();
        node.dataset.aspectRatio = aspectRatio || '1:1';
        node.dataset.cameraLocked = cameraLocked ? 'true' : 'false';

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.cssText = 'width: 100%; height: 100%; background: #000; overflow: hidden; position: relative;';
        node.appendChild(contentArea);

        // 标准页眉
        node.appendChild(this.utils.createNodeHeader('image', '360° Pan', filename));
        
        // 工具栏
        const toolbar = this.utils.createNodeToolbar('image', {
            onCopyPrompt: () => navigator.clipboard.writeText(prompt),
            onDelete: () => { 
                if (window.selectNode) window.selectNode(node); 
                if (window.deleteSelectedNode) window.deleteSelectedNode(); 
            }
        });
        node.appendChild(toolbar);

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
            btn.className = 'ratio-btn' + (r.label === (aspectRatio || '1:1') ? ' active' : '');
            btn.textContent = r.label;
            btn.onclick = (e) => {
                e.stopPropagation();
                ratioSwitcher.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                node.style.width = `${r.w}px`;
                node.style.height = `${r.h}px`;
                node.dataset.aspectRatio = r.label;
                if (node.panoramaRenderer) node.panoramaRenderer.onResize();
            };
            ratioSwitcher.appendChild(btn);
        });
        node.appendChild(ratioSwitcher);

        // 相机锁定切换器
        const lockToggle = document.createElement('div');
        lockToggle.className = 'camera-lock-toggle' + (cameraLocked ? ' locked' : '');
        lockToggle.innerHTML = `${getIcon(cameraLocked ? 'lock' : 'unlock', 14)} <span>${cameraLocked ? 'Camera Locked' : 'Camera Unlocked'}</span>`;
        lockToggle.onclick = (e) => {
            e.stopPropagation();
            const isLocked = node.dataset.cameraLocked === 'true';
            const newLocked = !isLocked;
            node.dataset.cameraLocked = newLocked.toString();
            lockToggle.classList.toggle('locked', newLocked);
            lockToggle.innerHTML = `${getIcon(newLocked ? 'lock' : 'unlock', 14)} <span>${newLocked ? 'Camera Locked' : 'Camera Unlocked'}</span>`;
        };
        node.appendChild(lockToggle);

        node.appendChild(this.utils.createNodeInfo(prompt, filename));

        // 重新绑定拖拽
        this.bindDrag(node);

        import('./panorama-renderer.js').then(module => {
            const { PanoramaRenderer } = module;
            const renderer = new PanoramaRenderer(contentArea, resourceUrl);
            node.panoramaRenderer = renderer;
            if (renderer.controls) {
                renderer.controls.enabled = !(node.dataset.cameraLocked === 'true');
            }
        });

        return node;
    },

    bindDrag(node) {
        node.addEventListener('mousedown', (e) => {
            // 核心修复：防止 3D 画布旋转冲突
            const isCameraLocked = node.dataset.cameraLocked === 'true';
            if (e.target.tagName.toLowerCase() === 'canvas' && !isCameraLocked) return;
            if (e.target.closest('.panorama-ratio-switcher') || e.target.closest('.camera-lock-toggle')) return;

            if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                e.stopPropagation();
                if (typeof window.selectNode === 'function') window.selectNode(node);
                AppState.isDraggingNode = true; AppState.dragNode = node; AppState.activeNode = node;
                AppState.dragStartX = e.clientX; AppState.dragStartY = e.clientY;
                AppState.dragNodeStartLeft = parseInt(node.style.left) || 0;
                AppState.dragNodeStartTop = parseInt(node.style.top) || 0;
            }
        });
    }
};

// 注入工具方法引用以简化代码 (带路径追踪日志)
PersistenceManager.utils = {
    createNodeHeader: (t, m, f) => { 
        return createNodeHeader(t, m, f);
    },
    createNodeToolbar: (t, c) => { 
        return createNodeToolbar(t, c);
    },
    createNodeInfo: (p) => { 
        return createNodeInfo(p);
    },
    createNodeSidebar: (g, m) => { 
        return createNodeSidebar(g, m);
    },
    // 兜底文本节点创建 (如果全局函数失效)
    createTextNodeFallback: (text, prompt, index, filename, res, time, model) => {
        const node = document.createElement('div');
        node.className = 'canvas-node text-node';
        node.innerHTML = `<div class="text-content" style="padding:15px; background:white; border-radius:12px; height:100%; overflow:auto;">${text}</div>`;
        return node;
    }
};

window.PersistenceManager = PersistenceManager;
