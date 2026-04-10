/**
 * PERSISTENCE MANAGER
 * 处理画布状态的序列化与反序列化 (导出/导入)
 */

import { AppState, CanvasState } from './app-state.js';
import { NodeFactory } from './node-factory.js';
import { debugLog, createNodeHeader, createNodeToolbar, createNodeSidebar, createNodeInfo } from './utils.js';

export const PersistenceManager = {
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

        // 提取模型名称 (兼容对象形式)
        let modelName = node.dataset.modelName || '';
        if (modelName === '[object Object]') {
            const tag = node.querySelector('.node-model-tag');
            if (tag) modelName = tag.textContent.trim();
        }

        return {
            type,
            rect,
            prompt,
            modelName,
            filename: node.dataset.filename || '',
            resourceUrl,
            pins: JSON.parse(node.dataset.pins || '[]'),
            metadata: {
                generationTime: node.querySelector('.node-generation-time span')?.textContent || '',
                isError: node.classList.contains('error-state'),
                textContent: type === 'text' ? (node.querySelector('.text-content')?.textContent || '') : ''
            }
        };
    },

    /**
     * 导入并重建画布
     */
    async importCanvas(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    console.log("[持久化/DEBUG] 开始解析快照文件成功", data);
                    
                    if (!data || !data.nodes || !Array.isArray(data.nodes)) {
                        console.error("[持久化/ERROR] 数据结构校验失败，nodes 缺失或格式错误");
                        throw new Error('该文件不符合 Nano 画布快照格式，无法识别节点数据。');
                    }

                    console.log(`[持久化/DEBUG] 格式校验通过。版本: ${data.version}, 节点数: ${data.nodes.length}`);

                    // 1. 清空当前画布 
                    const container = document.getElementById('imageResponseContainer');
                    if (!container) {
                        console.error("[持久化/ERROR] 找不到 imageResponseContainer 画布容器！");
                        throw new Error('系统错误：找不到画布容器。');
                    }
                    
                    const existingNodes = container.querySelectorAll('.canvas-node');
                    console.log(`[持久化/DEBUG] 正在清理旧节点... 当前数量: ${existingNodes.length}`);
                    existingNodes.forEach(n => n.remove());

                    // 2. 还原画布坐标
                    if (data.global && CanvasState.panzoom) {
                        console.log("[持久化/DEBUG] 正在同步画布视口 (Pan/Zoom)...", data.global);
                        CanvasState.panzoom.zoom(data.global.scale || 1);
                        CanvasState.panzoom.pan(data.global.pan.x || 0, data.global.pan.y || 0);
                    }

                    // 3. 逐个重建节点
                    console.log("[持久化/DEBUG] --- 开始重建节点序列 ---");
                    let successCount = 0;
                    for (let i = 0; i < data.nodes.length; i++) {
                        const n = data.nodes[i];
                        console.log(`[持久化/RECONSTRUCT] 处理第 ${i+1} 个节点: [${n.type}]`, n);
                        const result = this.reconstructNode(n, container);
                        if (result) successCount++;
                    }

                    const statusMsg = `[持久化] 快照还原完毕。成功: ${successCount}, 失败: ${data.nodes.length - successCount}`;
                    console.log(`[持久化/FINAL] ${statusMsg}`);
                    if (window.debugLog) window.debugLog(statusMsg, 'info');
                    resolve(true);
                } catch (err) {
                    console.error('[持久化/CRITICAL] 导入重建过程崩溃:', err);
                    if (window.debugLog) {
                        window.debugLog(`[持久化] 导入失败: ${err.message}`, 'error');
                    } else {
                        alert(`导入失败: ${err.message}`);
                    }
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
        const { rect, prompt, modelName, resourceUrl, filename } = data;
        console.log(`[持久化/CREATE] 正在通过 NodeFactory 创建图片节点... 来源: ${resourceUrl?.slice(0,30)}...`);
        const node = NodeFactory.createImagePlaceholder(rect.x, rect.y, prompt, modelName);
        
        const content = node.querySelector('.node-content');
        if (content) {
            content.innerHTML = `<img src="${resourceUrl}" style="width:100%; height:100%; object-fit:contain; display:block;">`;
            node.classList.remove('loading-placeholder');
            node.dataset.imageUrl = resourceUrl;
            node.dataset.filename = filename;
            node.dataset.prompt = prompt;
            node.dataset.modelName = modelName;
        }
        return node;
    },

    // 辅助：解析时间字符串为数字
    parseTimeToSeconds(timeStr) {
        if (!timeStr) return 0;
        if (typeof timeStr === 'number') return timeStr;
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
        }
        return parseFloat(timeStr) || 0;
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
            onDelete: () => {
                if (window.selectNode) window.selectNode(node);
                if (window.deleteSelectedNode) window.deleteSelectedNode();
            }
        });
        node.appendChild(toolbar);

        node.appendChild(PersistenceManager.utils.createNodeInfo(prompt));
        node.appendChild(PersistenceManager.utils.createNodeSidebar(timeValue, modelName));

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

        this.bindDrag(node);
        return node;
    },

    createFinalTextNode(data) {
        const { rect, prompt, modelName, metadata } = data;
        const textStr = metadata?.textContent || prompt || '';
        
        console.log(`[持久化/CREATE] 正在通过 NodeManager 创建文本节点... 内容: ${textStr.slice(0, 20)}...`);
        
        const timeValue = this.parseTimeToSeconds(metadata?.generationTime);

        const createFn = window.createTextNode || PersistenceManager.utils.createTextNodeFallback;
        const node = createFn(textStr, prompt, 0, data.filename, '', timeValue, modelName);
        
        if (node) {
            node.style.left = `${rect.x}px`;
            node.style.top = `${rect.y}px`;
            node.style.width = `${rect.width}px`;
            node.style.height = `${rect.height}px`;
        }
        
        return node;
    },

    bindDrag(node) {
        node.addEventListener('mousedown', (e) => {
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
