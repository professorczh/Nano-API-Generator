import { AppState, CanvasState } from './app-state.js';
import { LinkerManager } from './linker-manager.js';
import { getIcon } from './icons.js';
import { DebugConsole } from './debug-console.js';
import { createNodeHeader, createNodeSidebar, createNodeInfo, renderModelTag, createNodeToolbar } from './utils.js';

/* 强制注入旋转动画和视频节点布局修正 */
if (!document.getElementById('loading-animation-style')) {
    const style = document.createElement('style');
    style.id = 'loading-animation-style';
    style.textContent = `
        @keyframes loading-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .progress-ring-wrapper svg { animation: loading-rotate 2s linear infinite !important; }
        .loading-container.fade-out { opacity: 0; transform: scale(1.05); pointer-events: none; transition: opacity 0.6s, transform 0.6s; }
        
        .canvas-node .node-filename { display: flex !important; align-items: center !important; gap: 6px !important; white-space: nowrap !important; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
        .canvas-node .node-filename svg { flex-shrink: 0 !important; }

        /* 视频/图片/音频节点内部布局极致对齐加固 */
        .video-node, .image-node, .audio-node { display: block !important; overflow: visible !important; }
        .canvas-node .node-content { width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative; background: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.05); }
        .canvas-node.selected .node-content { border: 2px solid #3b82f6 !important; box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }

        /* 页眉纠偏：对齐图片节点的精致感 */
        .node-header { 
            position: absolute !important; top: -38px !important; left: 0 !important; right: 0 !important; 
            display: flex !important; justify-content: space-between !important; z-index: 1001 !important; 
            pointer-events: none; height: 28px !important; align-items: center !important; gap: 8px !important;
        }
        .node-filename, .node-resolution { 
            background: #fff !important; color: #334155 !important; 
            padding: 4px 10px !important; border-radius: 6px !important; 
            font-size: 11px !important; font-weight: 600 !important;
            box-shadow: 0 2px 6px rgba(0,0,0,0.05) !important; border: 1px solid rgba(0,0,0,0.05) !important;
        }

        /* 侧边栏与模型标签纠偏：挪到右侧外部 (对应红框位置) */
        .node-sidebar { 
            position: absolute !important; 
            left: calc(100% + 12px) !important; 
            top: 0 !important; 
            display: flex !important; 
            flex-direction: column !important; 
            align-items: flex-start !important; 
            gap: 8px !important; 
            z-index: 1001 !important; 
            width: auto !important;
            max-width: 200px !important;
            pointer-events: none;
        }
        .node-model-tag { 
            background: rgba(15, 23, 42, 0.85) !important; 
            color: #f1f5f9 !important; 
            padding: 6px 10px !important; 
            border-radius: 8px !important; 
            font-size: 11px !important; 
            font-weight: 600 !important; 
            border: 1px solid rgba(255,255,255,0.1) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important; 
            text-align: left !important;
            white-space: normal !important; /* 允许折行防止撑太宽 */
            word-break: break-all;
            backdrop-filter: blur(12px);
            pointer-events: auto;
        }
        .node-generation-time { 
            background: #3b82f6 !important; color: #fff !important; 
            padding: 4px 10px !important; border-radius: 6px !important; 
            font-size: 11px !important; font-weight: 700 !important; 
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3) !important;
            display: flex !important; align-items: center !important; gap: 6px !important;
            pointer-events: auto;
        }

        .canvas-node .node-info { 
            position: absolute !important; bottom: -54px !important; left: 50% !important; 
            transform: translateX(-50%) !important; z-index: 1001 !important; 
            white-space: normal !important; width: 260px !important; max-height: 80px !important;
            display: -webkit-box !important; -webkit-line-clamp: 4 !important; -webkit-box-orient: vertical !important;
            overflow-y: auto !important; line-height: 1.4 !important; text-align: center !important;
            background: rgba(255,255,255,0.9) !important; padding: 6px 12px !important; border-radius: 12px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important; font-size: 11px !important;
        }
        .node-toolbar { 
            position: absolute !important; 
            left: calc(100% + 14px) !important; 
            top: 50% !important; 
            transform: translateY(-50%) translateX(-10px) !important;
            display: none !important; 
            flex-direction: column !important; 
            align-items: center !important;
            gap: 10px !important; 
            z-index: 1002 !important; 
            background: rgba(255,255,255,0.85) !important; 
            backdrop-filter: blur(20px) saturate(180%) !important; 
            padding: 12px 0 !important; 
            width: 34px !important;
            border-radius: 20px !important; 
            border: 1px solid rgba(255,255,255,0.5) !important; 
            box-shadow: 0 10px 30px -5px rgba(0,0,0,0.1), 0 4px 12px -2px rgba(0,0,0,0.05) !important;
            transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1) !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        .canvas-node.selected .node-toolbar,
        .always-show-toolbar .node-toolbar { 
            display: flex !important; 
            transform: translateY(-50%) translateX(0) !important;
            opacity: 1 !important;
            pointer-events: auto !important;
        }
        .node-toolbar .toolbar-btn {
            width: 26px !important;
            height: 26px !important;
            border-radius: 8px !important;
            border: none !important;
            background: transparent !important;
            color: #64748b !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            cursor: pointer !important;
            position: relative !important;
        }
        .node-toolbar .toolbar-btn:hover {
            background: rgba(59, 130, 246, 0.1) !important;
            color: #2563eb !important;
            transform: scale(1.1) !important;
        }
        .node-toolbar .toolbar-btn.danger:hover {
            background: rgba(239, 68, 68, 0.1) !important;
            color: #ef4444 !important;
        }
        .node-toolbar .toolbar-btn svg {
            width: 16px !important;
            height: 16px !important;
            stroke-width: 2.2 !important;
        }

        /* 错误状态样式 */
        .node-error-container {
            position: absolute; inset: 0; background: rgba(220, 38, 38, 0.05);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            border-radius: 12px; padding: 12px; border: 1px dashed #ef4444; color: #ef4444;
            pointer-events: none;
        }
        .error-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
        .error-msg { font-size: 11px; opacity: 0.8; text-align: center; line-height: 1.3; }

        /* 现代化的加载 UI */
        .loading-progress-wrapper { position: relative; margin-bottom: 20px; pointer-events: none; }
        .progress-ring { stroke-width: 3px !important; filter: drop-shadow(0 0 5px #3b82f6); }
        .loading-progress-text { font-family: Inter, system-ui, sans-serif; font-size: 16px; font-weight: 600; color: #fff; }
        .loading-status-badge { 
            background: rgba(15, 23, 42, 0.8) !important; backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.15); padding: 6px 16px; border-radius: 20px;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}

export function addLinkerHandle(node) {
    const handle = document.createElement('div');
    handle.className = 'node-linker-handle';
    handle.title = '拖拽引出线进行节点引用 (Cite this node)';
    handle.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            e.stopPropagation();
            LinkerManager.startLinking(node, e);
        }
    });
    node.appendChild(handle);
}

export const NodeFactory = {
    // --- 视频占位符 (带状态机) ---
    createVideoPlaceholder(x, y, prompt = '', modelName = '', aspectRatio = '16:9') {
        let videoHeight = 169, nodeWidth = 300;
        if (aspectRatio === '9:16') { videoHeight = 320; nodeWidth = 180; }
        
        const node = document.createElement('div');
        node.className = 'canvas-node video-node loading-placeholder';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = `${nodeWidth}px`;
        node.style.height = `${videoHeight}px`; // 恢复高度
        node.dataset.nodeType = 'video';
        node.dataset.startTime = Date.now();

        const dummyFileName = `video_${Date.now().toString().slice(-6)}.mp4`;
        node.appendChild(createNodeHeader('video', aspectRatio, dummyFileName));

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-container';
        loadingContainer.innerHTML = `
            <div class='loading-progress-wrapper progress-ring-wrapper'>
                <svg width='64' height='64' viewBox='0 0 80 80'>
                    <circle cx='40' cy='40' r='35' fill='none' stroke='rgba(255,255,255,0.05)' stroke-width='6'></circle>
                    <circle class='progress-ring' cx='40' cy='40' r='35' fill='none' stroke='var(--accent-primary)' stroke-width='6' stroke-linecap='round' stroke-dasharray='220' stroke-dashoffset='220' transform='rotate(-90 40 40)' style='transition: stroke-dashoffset 0.8s;'></circle>
                </svg>
                <div class='loading-progress-text'>0%</div>
            </div>
            <div class='loading-status-badge'>
                <span class='status-icon'>${getIcon('sparkles', 14)}</span>
                <span class='loading-status-text queuing'>正在准备...</span>
            </div>
        `;
        contentArea.appendChild(loadingContainer);
        node.appendChild(contentArea);

        node.appendChild(createNodeInfo(prompt, '视频生成中...'));
        
        // 修正：传 0 (数字) 以兼容 utils.js 内部的 .toFixed(1)
        node.appendChild(createNodeSidebar(0, modelName)); 

        node._progressValue = 0;
        node._progressStage = 'generating';

        const updateRingUI = (val) => {
            const ring = loadingContainer.querySelector('.progress-ring');
            const percentText = loadingContainer.querySelector('.loading-progress-text');
            if (ring) ring.style.strokeDashoffset = 220 - (val / 100) * 220;
            if (percentText) percentText.textContent = Math.floor(val) + '%';
        };

        const timerTag = loadingContainer.querySelector('.loading-progress-text');
        const interval = setInterval(() => {
            if (!node.parentElement) { clearInterval(interval); return; }
            
            const elapsed = Math.floor((Date.now() - node.dataset.startTime) / 1000);
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toString().padStart(2, '0');
            
            // 确保侧边栏的计时器在生成过程中也是可见且跳动的
            const sidebarTime = node.querySelector('.node-generation-time span');
            if (sidebarTime) sidebarTime.textContent = `${m}:${s}`;

            if (node._progressStage === 'generating') {
                // 每秒增长 1%，确保在 10s 轮询周期时刚好对齐 10% 的步进
                if (node._progressValue < 80) node._progressValue += 1.0; 
                else if (node._progressValue < 99) node._progressValue += 0.1;
            } else if (node._progressStage === 'saving') {
                if (node._progressValue < 99) node._progressValue += 1;
            }
            updateRingUI(node._progressValue);
        }, 1000);
        node._loadingInterval = interval;

        // 绑定拖拽逻辑 (使用捕获模式，确保在视频控件响应前先选中节点)
        node.addEventListener('mousedown', (e) => {
            const targetEl = e.target;
            if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                // 如果不是点击了工具栏按钮，则执行选中
                if (!targetEl.closest('.node-sidebar') && !targetEl.closest('.node-toolbar')) {
                    if (typeof window.selectNode === 'function') {
                        window.selectNode(node);
                    }
                }
                
                AppState.isDraggingNode = true; 
                AppState.dragNode = node; 
                AppState.activeNode = node;
                AppState.dragStartX = e.clientX; 
                AppState.dragStartY = e.clientY;
                AppState.dragNodeStartLeft = parseInt(node.style.left) || 0;
                AppState.dragNodeStartTop = parseInt(node.style.top) || 0;
            }
        }, { capture: true });

        if (typeof addLinkerHandle === 'function') addLinkerHandle(node);
        return node;
    },

    // --- 状态更新逻辑 ---
    updateVideoLoadingStatus(node, status, progress) {
        const container = node.querySelector('.loading-container');
        if (!container) return;
        const textTag = container.querySelector('.loading-status-text');
        const iconTag = container.querySelector('.status-icon');

        if (status === 'generating') {
            node._progressStage = 'generating';
            if (textTag) { textTag.textContent = '生成中...'; textTag.className = 'loading-status-text generating'; }
            if (iconTag) iconTag.innerHTML = getIcon('loader', 14, 'animate-spin');
            if (progress !== undefined && progress > node._progressValue) node._progressValue = Math.floor(progress);
        } else if (status === 'saving') {
            node._progressStage = 'saving';
            node._progressValue = Math.max(90, node._progressValue);
            if (textTag) { textTag.textContent = '正在本地保存...'; textTag.className = 'loading-status-text saving'; }
            if (iconTag) iconTag.innerHTML = getIcon('download', 14);
            const timerDisplay = container.querySelector('.loading-timer-display');
            if (timerDisplay) timerDisplay.style.color = '#4ade80';
        }
    },

    updateAudioLoadingStatus(node, status) {
        if (!node) return;
        
        if (status === 'saving') {
            // 锁定计时器
            if (node._loadingInterval) {
                clearInterval(node._loadingInterval);
                delete node._loadingInterval;
            }

            const loadingText = node.querySelector('.loading-text');
            const ringWrapper = node.querySelector('.progress-ring-wrapper');
            
            if (loadingText) {
                loadingText.textContent = '正在保存到本地...';
                loadingText.style.color = '#60a5fa'; // 统一存盘蓝
            }
            if (ringWrapper) {
                ringWrapper.innerHTML = getIcon('download', 32);
                ringWrapper.style.color = '#60a5fa';
            }

            // 侧边栏计时器半透明锁定
            const sidebarTime = node.querySelector('.node-generation-time');
            if (sidebarTime) {
                sidebarTime.style.opacity = '0.5';
                sidebarTime.classList.add('saving-locked');
            }
        }
    },

    // --- 最终视频替换 (重构为非破坏性更新) ---
    replaceWithVideo(node, videoUrl, prompt = '', modelName = '', generationTime = null, aspectRatio = '16:9') {
        const ring = node.querySelector('.progress-ring');
        const percentText = node.querySelector('.loading-progress-text');
        if (ring) { ring.style.transition = 'stroke-dashoffset 0.2s ease-out'; ring.style.strokeDashoffset = 0; }
        if (percentText) percentText.textContent = '100%';

        if (node._loadingInterval) { clearInterval(node._loadingInterval); delete node._loadingInterval; }

        // 1. 仅移除加载遮罩，不干扰外壳
        const container = node.querySelector('.loading-container');
        if (container) {
            container.classList.add('fade-out');
            setTimeout(() => { if (container.parentNode) container.remove(); }, 800);
        }

        const savedModelName = modelName || node.dataset.modelName;
        
        // 2. 更新内容区核心组件
        const contentArea = node.querySelector('.node-content');
        if (contentArea) {
            contentArea.innerHTML = '';
            contentArea.style.cssText = 'position:relative; width:100%; height:100%; background:#000; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:12px; border: 1px solid rgba(255,255,255,0.1);';
            
            const video = document.createElement('video');
            video.src = videoUrl;
            video.autoplay = true; video.loop = true; video.muted = true; 
            video.playsInline = true; video.controls = true;
            video.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
            contentArea.appendChild(video);
        }

        // 3. 动态注入/激活工具栏
        const existingToolbar = node.querySelector('.node-toolbar');
        if (existingToolbar) existingToolbar.remove();
        
        const toolbar = createNodeToolbar('video', {
            onCopyPrompt: () => {
                navigator.clipboard.writeText(prompt);
                debugLog(`[复制] 提示词: ${prompt.slice(0, 20)}...`, 'info');
            },
            onInsertPrompt: () => {
                if (window.PinManager && window.PinManager.addCanvasImageToPrompt) {
                    window.PinManager.addCanvasImageToPrompt(node);
                }
            },
            onCopyNode: () => {
                if (typeof window.selectNode === 'function') window.selectNode(node);
                if (typeof window.copySelectedNode === 'function') window.copySelectedNode();
            },
            onDelete: () => {
                if (typeof window.selectNode === 'function') window.selectNode(node);
                if (typeof window.deleteSelectedNode === 'function') window.deleteSelectedNode();
            }
        });
        
        // 物理对齐：插入到 Content 之后，Info 之前
        const info = node.querySelector('.node-info');
        node.insertBefore(toolbar, info);

        // 4. 更新侧边栏状态
        const sidebar = node.querySelector('.node-sidebar');
        if (sidebar) {
            const timeTag = sidebar.querySelector('.node-generation-time');
            if (timeTag && generationTime !== null) {
                const span = timeTag.querySelector('span') || timeTag;
                span.textContent = `${generationTime.toFixed(1)}s`;
            }
        }

        node.dataset.prompt = prompt;
        if (typeof updateMinimapWithImage === 'function') updateMinimapWithImage(node);
        return node;
    },

    // --- 音频替换 (重构为非破坏性更新) ---
    replaceWithAudio(node, audioUrl, prompt = '', modelName = '', generationTime = null, format = 'mp3') {
        if (node._loadingInterval) { clearInterval(node._loadingInterval); delete node._loadingInterval; }
        
        // 1. 更新内容区
        const contentArea = node.querySelector('.node-content');
        if (contentArea) {
            contentArea.innerHTML = '';
            contentArea.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;position:relative;';
            
            const wave = document.createElement('div');
            wave.className = 'audio-wave-anim';
            wave.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:4px;opacity:0.25;pointer-events:none;';
            for(let i=0;i<20;i++) {
                const b = document.createElement('div');
                b.style.cssText = `width:3px;background:#60a5fa;height:${15+Math.random()*45}px;border-radius:2px;`;
                wave.appendChild(b);
            }
            contentArea.appendChild(wave);
            
            const audio = document.createElement('audio');
            audio.src = audioUrl;
            audio.controls = true;
            audio.style.cssText = 'width:85%; height:40px; z-index:10;';
            contentArea.appendChild(audio);
        }

        // 2. 注入工具栏
        const existingToolbar = node.querySelector('.node-toolbar');
        if (existingToolbar) existingToolbar.remove();

        const toolbar = createNodeToolbar('audio', {
            onCopyPrompt: () => navigator.clipboard.writeText(prompt),
            onInsertPrompt: () => {
                if (window.PinManager && window.PinManager.addCanvasImageToPrompt) {
                    window.PinManager.addCanvasImageToPrompt(node);
                }
            },
            onCopyNode: () => {
                if (window.selectNode) window.selectNode(node);
                if (window.copySelectedNode) window.copySelectedNode();
            },
            onDelete: () => {
                if (window.selectNode) window.selectNode(node);
                if (window.deleteSelectedNode) window.deleteSelectedNode();
            }
        });
        
        const info = node.querySelector('.node-info');
        node.insertBefore(toolbar, info);

        // 3. 更新辅助信息
        const sidebar = node.querySelector('.node-sidebar');
        if (sidebar && generationTime !== null) {
            const timeTag = sidebar.querySelector('.node-generation-time span') || sidebar.querySelector('.node-generation-time');
            if (timeTag) timeTag.textContent = `${generationTime.toFixed(1)}s`;
        }

        node.dataset.audioUrl = audioUrl;
        node.dataset.prompt = prompt;
        return node;
    },
    // --- 音频占位符 (同构版) ---
    createAudioPlaceholder(x, y, prompt = '', modelName = '') {
        const node = document.createElement('div');
        node.className = 'canvas-node audio-node loading-placeholder';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = '300px';
        node.style.height = '169px'; 
        node.dataset.nodeType = 'audio';
        node.dataset.startTime = Date.now();

        const dummyName = `audio_${Date.now().toString().slice(-4)}.mp3`;
        node.appendChild(createNodeHeader('audio', 'MP3', dummyName));

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#000;';
        contentArea.innerHTML = `<div class="loading-container" style="background:transparent;"><div class="progress-ring-wrapper">${getIcon('loader', 32, 'animate-spin')}</div><div class="loading-text" style="color:#60a5fa;font-weight:700">正在谱写旋律...</div></div>`;
        node.appendChild(contentArea);

        node.appendChild(createNodeInfo(prompt, '音频生成中...'));
        node.appendChild(createNodeSidebar(0, modelName));

        const interval = setInterval(() => {
            if (!node.parentElement) { clearInterval(interval); return; }
            const elapsed = Math.floor((Date.now() - node.dataset.startTime) / 1000);
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toString().padStart(2, '0');
            const sidebarTime = node.querySelector('.node-generation-time span');
            if (sidebarTime) sidebarTime.textContent = `${m}:${s}`;
        }, 1000);
        node._loadingInterval = interval;

        // 绑定拖拽逻辑 (捕获模式对齐)
        node.addEventListener('mousedown', (e) => {
            const targetEl = e.target;
            if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                if (!targetEl.closest('.node-sidebar') && !targetEl.closest('.node-toolbar')) {
                    if (typeof window.selectNode === 'function') {
                        window.selectNode(node);
                    }
                }
                AppState.isDraggingNode = true; AppState.dragNode = node; AppState.activeNode = node;
                AppState.dragStartX = e.clientX; AppState.dragStartY = e.clientY;
                AppState.dragNodeStartLeft = parseInt(node.style.left) || 0;
                AppState.dragNodeStartTop = parseInt(node.style.top) || 0;
            }
        }, { capture: true }); 

        if (typeof addLinkerHandle === 'function') addLinkerHandle(node);
        return node;
    },

    // --- 错误状态处理 (核心健壮性) ---
    markAsError(node, title, message) {
        if (node._loadingInterval) { clearInterval(node._loadingInterval); delete node._loadingInterval; }
        
        const contentArea = node.querySelector('.node-content');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <div class="node-error-container">
                <div class="error-title">${getIcon('alert-triangle', 14)} ${title}</div>
                <div class="error-msg">${message}</div>
            </div>
        `;
        
        // 更新占位符状态
        node.classList.add('error-state');
        node.classList.remove('loading-placeholder');

        // 发送到控制台
        DebugConsole.log('ERROR', `${title}: ${message}`);
    }
};

window.NodeFactory = NodeFactory;
