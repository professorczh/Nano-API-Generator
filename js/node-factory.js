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

        /* 侧边栏与模型标签纠偏：挪到左侧，避免与右侧工具栏冲突 */
        .node-sidebar { position: absolute !important; right: calc(100% + 14px) !important; top: 0 !important; display: flex !important; flex-direction: column !important; align-items: flex-end !important; gap: 6px !important; z-index: 1001 !important; transform-origin: right; }
        .node-model-tag { 
            background: #1e293b !important; color: #f1f5f9 !important; 
            padding: 4px 10px !important; border-radius: 8px !important; 
            font-size: 11px !important; font-weight: 600 !important; border: 1px solid rgba(255,255,255,0.1) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; text-align: right !important;
            white-space: nowrap !important;
        }
        .node-generation-time { 
            background: #3b82f6 !important; color: #fff !important; 
            padding: 2px 8px !important; border-radius: 6px !important; 
            font-size: 10px !important; font-weight: 700 !important; 
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3) !important;
            display: flex !important; align-items: center !important; gap: 4px !important;
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
        .canvas-node.selected .node-toolbar { 
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
    // --- 图片占位符 ---
    createImagePlaceholder(x, y, prompt, modelName) {
        const node = document.createElement('div');
        node.className = 'canvas-node image-node loading-placeholder';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = '300px';
        node.style.height = '300px';
        node.dataset.nodeType = 'image';
        
        const dummyName = `image_${Date.now().toString().slice(-4)}.png`;
        node.appendChild(createNodeHeader('image', '', dummyName));
        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        
        const loader = document.createElement('div');
        loader.className = 'loading-container';
        loader.innerHTML = `<div class="progress-ring-wrapper">${getIcon('loader', 32, 'animate-spin')}</div><div class="loading-text">正在生成图片...</div>`;
        contentArea.appendChild(loader);
        node.appendChild(contentArea);
        
        node.appendChild(createNodeInfo(prompt, '图片生成中...'));
        node.appendChild(createNodeSidebar(null, modelName));
        
        // 添加拖拽支持
        node.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                e.stopPropagation();
                if (typeof window.selectNode === 'function') window.selectNode(node);
                AppState.isDraggingNode = true;
                AppState.dragNode = node;
                AppState.activeNode = node;
                AppState.dragStartX = e.clientX;
                AppState.dragStartY = e.clientY;
                AppState.dragNodeStartLeft = parseInt(node.style.left) || 0;
                AppState.dragNodeStartTop = parseInt(node.style.top) || 0;
            }
        });
        
        if (typeof addLinkerHandle === 'function') addLinkerHandle(node);
        return node;
    },

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
                // 显著减慢虚假进度步进，确保 API 真实进度占主导地位
                if (node._progressValue < 80) node._progressValue += 0.5; 
                else if (node._progressValue < 89) node._progressValue += 0.1;
            } else if (node._progressStage === 'saving') {
                if (node._progressValue < 99) node._progressValue += 1;
            }
            updateRingUI(node._progressValue);
        }, 1000);
        node._loadingInterval = interval;

        // 绑定拖拽逻辑
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

    // --- 最终视频替换 ---
    replaceWithVideo(node, videoUrl, prompt = '', modelName = '', generationTime = null, aspectRatio = '16:9') {
        const ring = node.querySelector('.progress-ring');
        const percentText = node.querySelector('.loading-progress-text');
        if (ring) { ring.style.transition = 'stroke-dashoffset 0.2s ease-out'; ring.style.strokeDashoffset = 0; }
        if (percentText) percentText.textContent = '100%';

        if (node._loadingInterval) { clearInterval(node._loadingInterval); delete node._loadingInterval; }

        const container = node.querySelector('.loading-container');
        if (container) {
            container.classList.add('fade-out');
            setTimeout(() => { if (container.parentNode) container.remove(); }, 800);
        }

        const savedLeft = node.style.left;
        const savedTop = node.style.top;
        const savedModelName = modelName || node.dataset.modelName;
        
        let videoHeight = 169, nodeWidth = 300;
        if (aspectRatio === '9:16') { videoHeight = 320; nodeWidth = 180; }

        node.innerHTML = '';
        node.className = 'canvas-node video-node';
        node.style.left = savedLeft;
        node.style.top = savedTop;
        node.style.width = `${nodeWidth}px`;
        node.style.height = `${videoHeight}px`;
        
        // 1. 页眉 (Top)
        const dummyFileName = `video_${Date.now().toString().slice(-6)}.mp4`;
        node.appendChild(createNodeHeader('video', aspectRatio, dummyFileName));

        // 2. 内容区 (Center)
        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.cssText = 'position:relative; width:100%; height:100%; background:#000; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:12px;';
        
        const video = document.createElement('video');
        video.src = videoUrl;
        video.autoplay = true; 
        video.loop = true; 
        video.muted = true; 
        video.playsInline = true;
        video.controls = true;
        video.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
        
        contentArea.appendChild(video);
        node.appendChild(contentArea);

        // 3. 悬浮工具栏 (Right)
        const toolbar = createNodeToolbar('video', {
            onCopyPrompt: () => {
                navigator.clipboard.writeText(prompt);
                debugLog(`[复制] 提示词: ${prompt.slice(0, 20)}...`, 'info');
            },
            onInsertPrompt: () => {
                if (window.insertImageToPrompt) {
                    window.insertImageToPrompt(videoUrl, dummyFileName);
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
        node.appendChild(toolbar);

        // 4. 辅助面板 (Left & Bottom)
        node.appendChild(createNodeInfo(prompt));
        node.appendChild(createNodeSidebar(generationTime, savedModelName));

        // 绑定拖拽逻辑
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

        if (typeof addLinkerHandle === 'function') addLinkerHandle(node);
        if (typeof updateMinimapWithImage === 'function') updateMinimapWithImage(node);
        return node;
    },

    // --- 音频占位符 (同构版) ---
    createAudioPlaceholder(x, y, prompt = '', modelName = '') {
        const node = document.createElement('div');
        node.className = 'canvas-node audio-node loading-placeholder';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = '300px';
        node.style.height = '169px'; // 16:9 黄金比例
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

        // 绑定拖拽逻辑
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

        if (typeof addLinkerHandle === 'function') addLinkerHandle(node);
        return node;
    },

    replaceWithAudio(node, audioUrl, prompt = '', modelName = '', generationTime = null, format = 'mp3') {
        if (node._loadingInterval) { clearInterval(node._loadingInterval); delete node._loadingInterval; }
        const savedLeft = node.style.left;
        const savedTop = node.style.top;
        node.innerHTML = '';
        node.className = 'canvas-node audio-node';
        node.style.left = savedLeft;
        node.style.top = savedTop;
        node.style.width = '300px';
        node.style.height = '169px'; // 16:9 黄金比例
        node.dataset.nodeType = 'audio';
        node.dataset.audioUrl = audioUrl;

        const dummyName = `audio_${Date.now().toString().slice(-4)}.${format}`;
        node.appendChild(createNodeHeader('audio', format.toUpperCase(), dummyName));

        // 统11致的工具栏
        const toolbar = createNodeToolbar('audio', {
            onCopyPrompt: () => {
                navigator.clipboard.writeText(prompt);
                debugLog(`[复制] 提示词: ${prompt.slice(0, 20)}...`, 'info');
            },
            onInsertPrompt: () => {
                if (window.insertImageToPrompt) {
                    const filename = `audio_${Date.now().toString().slice(-6)}.mp3`;
                    window.insertImageToPrompt(audioUrl, filename);
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
        node.appendChild(toolbar);

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;';
        
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
        audio.style.width = '85%';
        audio.style.height = '40px';
        audio.style.zIndex = '10';
        contentArea.appendChild(audio);
        node.appendChild(contentArea);
        node.appendChild(createNodeInfo(prompt));
        node.appendChild(createNodeSidebar(generationTime, modelName));
        
        // 绑定拖拽逻辑
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
