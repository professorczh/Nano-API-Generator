import { AppState, CanvasState } from './app-state.js';
import { LinkerManager } from './linker-manager.js';
import { getIcon } from './icons.js';
import { DebugConsole } from './debug-console.js';
import { createNodeHeader, createNodeSidebar, createNodeInfo, renderModelTag, createNodeToolbar, formatGenerationTime } from './utils.js';
import { promptPanelManager } from './prompt-panel-manager.js';

function parseRatio(ratioStr) {
    if (!ratioStr || !ratioStr.includes(':')) return 16/9;
    const [w, h] = ratioStr.split(':').map(Number);
    return (w && h) ? w / h : 16/9;
}

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

        /* 极大化对齐加固：移除所有节点的默认 Padding，让内容占满外壳 */
        .canvas-node { padding: 0 !important; }
        .canvas-node .node-content { width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative; background: transparent; box-shadow: none; border: none !important; }
        
        /* 针对文字节点的平衡：将外层 Padding 移至内部，确保背景颜色贴边 */
        .text-node .text-content, .text-loading-placeholder .loading-text { padding: 16px !important; }
        .text-node, .text-loading-placeholder { width: 400px !important; height: 300px !important; transform-origin: top left !important; }
        .text-node .text-content { height: 100% !important; overflow-y: auto !important; }
        /* 选中态高亮由外层 .canvas-node.selected 统一处理，不在 node-content 上叠加边框 */

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

        /* 侧边栏与模型标签纠偏：挪到下方第一层 */
        .node-sidebar { 
            position: absolute !important; 
            left: 0 !important;
            right: 0 !important;
            top: calc(100% + 10px) !important; 
            display: flex !important; 
            flex-direction: row !important;
            align-items: center !important; 
            gap: 8px !important; 
            z-index: 1001 !important; 
            width: auto !important;
            pointer-events: none;
        }
        
        /* 提示词面板纠偏：挪到下方第二层，并解除 4 行截断限制 */
        .canvas-node .node-info { 
            position: absolute !important; 
            top: calc(100% + 46px) !important; 
            left: 50% !important; 
            transform: translateX(-50%) !important; 
            z-index: 1001 !important; 
            white-space: normal !important; 
            width: 280px !important; 
            max-height: 180px !important;
            overflow-y: auto !important; 
            line-height: 1.5 !important; 
            text-align: left !important;
            background: rgba(255,255,255,0.95) !important; 
            padding: 8px 12px !important; 
            border-radius: 10px !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1) !important; 
            font-size: 11px !important;
            color: #475569 !important;
            pointer-events: auto !important;
            /* 移除截断，改用 max-height + auto scroll */
            display: block !important;
            -webkit-line-clamp: unset !important;
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
        .loading-progress-text { font-family: Inter, system-ui, sans-serif; font-size: 16px; font-weight: 600; color: var(--accent-primary); }
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
        const ratio = parseRatio(aspectRatio);
        const axisSize = 300;
        let nodeWidth, nodeHeight;
        if (ratio > 1) {
            // 横屏：高度固定 300
            nodeHeight = axisSize;
            nodeWidth = Math.round(axisSize * ratio);
        } else {
            // 竖屏与正方形：宽度固定 300
            nodeWidth = axisSize;
            nodeHeight = Math.round(axisSize / ratio);
        }
        
        const node = document.createElement('div');
        node.className = 'canvas-node video-node loading-placeholder';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = `${nodeWidth}px`;
        node.style.height = `${nodeHeight}px`; // 恢复高度
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

        const interval = setInterval(() => {
            if (!node.parentElement) { clearInterval(interval); return; }
            
            const elapsed = (Date.now() - node.dataset.startTime) / 1000;
            const timeStr = formatGenerationTime(elapsed).replace('⏱️', '').trim();
            
            // 确保侧边栏的计时器在生成过程中也是可见且跳动的
            const sidebarTime = node.querySelector('.node-generation-time span');
            if (sidebarTime) sidebarTime.textContent = timeStr;

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
            contentArea.style.cssText = 'position:relative; width:100%; height:100%; background:rgba(15,23,42,0.9); display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:12px; border: 1px solid rgba(255,255,255,0.08);';
            
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
            onRecallNode: () => {
                promptPanelManager.lockCommit();
                promptPanelManager.loadFromNode(node);
                debugLog(`[溯源] 已成功加载视频节点#${node.dataset.index}的历史参数`, 'success');
            },
            onPreviewStart: () => {
                promptPanelManager.saveDraft();
                promptPanelManager.setPreviewMode(true);
                promptPanelManager.loadFromNode(node);
                debugLog(`[预览] 视频节点#${node.dataset.index} 历史参数`, 'info');
            },
            onPreviewEnd: () => {
                if (!promptPanelManager.isPreviewLocked) {
                    promptPanelManager.setPreviewMode(false);
                    promptPanelManager.restoreDraft();
                }
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
                span.textContent = formatGenerationTime(generationTime).replace('⏱️', '').trim();
            }
        }

        node.dataset.prompt = prompt;
        if (typeof updateMinimapWithImage === 'function') updateMinimapWithImage(node);
        return node;
    },

    // --- 音频替换 (重构为非破坏性更新) ---
    replaceWithAudio(node, audioUrl, prompt = '', modelName = '', generationTime = null, format = 'mp3', lyrics = '', caption = '') {
        if (node._loadingInterval) { clearInterval(node._loadingInterval); delete node._loadingInterval; }
        
        // 1. 更新内容区
        const contentArea = node.querySelector('.node-content');
        if (contentArea) {
            contentArea.innerHTML = '';
            contentArea.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:space-between;background:linear-gradient(135deg,rgba(239,246,255,0.95),rgba(219,234,254,0.85));position:relative;border-radius:12px;overflow:hidden;padding:40px 0 24px 0;height:300px;';
            
            // 歌词显示区
            const lyricsContainer = document.createElement('div');
            lyricsContainer.className = 'lyrics-display';
            lyricsContainer.style.cssText = 'flex:1;width:100%;padding:0 40px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
            
            const mainLyric = document.createElement('div');
            mainLyric.style.cssText = 'font-size:26px;line-height:1.4;font-weight:800;color:#1d4ed8;text-align:center;transition:all 0.4s;max-width:100%;word-break:break-all;text-shadow:0 1px 4px rgba(255,255,255,0.6);';
            mainLyric.textContent = '准备就绪';
            
            const subLyric = document.createElement('div');
            subLyric.style.cssText = 'font-size:16px;line-height:1.4;color:#64748b;text-align:center;transition:all 0.4s;opacity:0.7;max-width:90%;word-break:break-all;';
            subLyric.textContent = caption ? (caption.length > 40 ? caption.slice(0, 40) + '...' : caption) : '';

            lyricsContainer.appendChild(mainLyric);
            lyricsContainer.appendChild(subLyric);
            contentArea.appendChild(lyricsContainer);

            // 解析带时间戳的歌词 [0.0:] 文字 或 [0.0:3.4] 文字
            const parseLyrics = (text) => {
                if (!text) return [];
                const lines = text.split('\n');
                const parsed = [];
                const regex = /\[(\d+\.?\d*):?(\d+\.?\d*)?\]\s*(.*)/;
                
                lines.forEach(line => {
                    const match = line.match(regex);
                    if (match) {
                        parsed.push({
                            start: parseFloat(match[1]),
                            end: match[2] ? parseFloat(match[2]) : null,
                            text: match[3].trim()
                        });
                    }
                });
                return parsed.sort((a, b) => a.start - b.start);
            };
            const lyricsData = parseLyrics(lyrics);

            // 自定义播放器 UI
            const playerWrap = document.createElement('div');
            playerWrap.style.cssText = 'position:relative;z-index:10;display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.85);backdrop-filter:blur(12px);padding:10px 16px;border-radius:40px;box-shadow:0 4px 16px rgba(0,0,0,0.06);border:1px solid rgba(255,255,255,0.9);width:92%;';

            const audio = document.createElement('audio');
            audio.src = audioUrl;

            // 播放同步逻辑
            audio.ontimeupdate = () => {
                const fmt = t => {
                    if (isNaN(t) || !isFinite(t)) return "0:00";
                    return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
                };

                if (audio.duration) {
                    progressBar.value = (audio.currentTime / audio.duration) * 100;
                    timeLabel.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;

                    // 寻找当前最匹配的歌词
                    if (lyricsData.length > 0) {
                        const currentTime = audio.currentTime;
                        let foundIndex = -1;
                        for (let i = 0; i < lyricsData.length; i++) {
                            if (currentTime >= lyricsData[i].start) {
                                foundIndex = i;
                            } else {
                                break;
                            }
                        }
                        
                        if (foundIndex !== -1) {
                            const current = lyricsData[foundIndex];
                            if (mainLyric.textContent !== current.text) {
                                mainLyric.style.opacity = '0';
                                setTimeout(() => {
                                    mainLyric.textContent = current.text;
                                    mainLyric.style.opacity = '1';
                                }, 150);
                            }
                            
                            // 预显下一句
                            const next = lyricsData[foundIndex + 1];
                            if (next && subLyric.textContent !== next.text) {
                                subLyric.textContent = next.text;
                            } else if (!next && caption) {
                                // 如果没有下一句，切回风格描述或显示完毕
                                // subLyric.textContent = caption;
                            }
                        }
                    }
                }
            };

            // 播放/暂停按钮
            const playBtn = document.createElement('button');
            playBtn.style.cssText = 'width:30px;height:30px;border-radius:50%;background:#3b82f6;border:none;color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform 0.15s;';
            playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>';
            playBtn.onclick = (e) => { e.stopPropagation(); audio.paused ? audio.play() : audio.pause(); };
            audio.onplay = () => { playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'; };
            audio.onpause = audio.onended = () => { playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>'; };

            // 进度条区域
            const progressWrap = document.createElement('div');
            progressWrap.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;';
            const progressBar = document.createElement('input');
            progressBar.type = 'range'; progressBar.min = 0; progressBar.max = 100; progressBar.value = 0;
            progressBar.style.cssText = 'width:100%;height:3px;accent-color:#3b82f6;cursor:pointer;';
            const timeLabel = document.createElement('div');
            timeLabel.style.cssText = 'font-size:10px;color:#64748b;font-family:monospace;';
            timeLabel.textContent = '0:00 / 0:00';
            
            progressBar.oninput = (e) => { e.stopPropagation(); if(audio.duration) audio.currentTime = (e.target.value/100)*audio.duration; };
            progressWrap.appendChild(progressBar);
            progressWrap.appendChild(timeLabel);

            // 音量控制区域
            const volumeWrap = document.createElement('div');
            volumeWrap.style.cssText = 'display:flex;align-items:center;gap:4px;width:70px;flex-shrink:0;margin-left:4px;';
            const volBtn = document.createElement('button');
            volBtn.style.cssText = 'background:none;border:none;color:#64748b;cursor:pointer;display:flex;padding:0;align-items:center;transition:color 0.2s;';
            volBtn.innerHTML = getIcon('volume-2', 14);
            const volSlider = document.createElement('input');
            volSlider.type = 'range'; volSlider.min = 0; volSlider.max = 1; volSlider.step = 0.05; volSlider.value = audio.volume;
            volSlider.style.cssText = 'width:40px;height:2px;accent-color:#64748b;cursor:pointer;';

            volSlider.oninput = (e) => {
                e.stopPropagation();
                audio.volume = e.target.value;
                audio.muted = (audio.volume == 0);
                volBtn.innerHTML = getIcon(audio.muted ? 'volume-x' : 'volume-2', 14);
            };
            volBtn.onclick = (e) => {
                e.stopPropagation();
                audio.muted = !audio.muted;
                volBtn.innerHTML = getIcon(audio.muted ? 'volume-x' : 'volume-2', 14);
                volSlider.value = audio.muted ? 0 : audio.volume;
            };

            volumeWrap.appendChild(volBtn);
            volumeWrap.appendChild(volSlider);

            playerWrap.appendChild(playBtn);
            playerWrap.appendChild(progressWrap);
            playerWrap.appendChild(volumeWrap);
            contentArea.appendChild(playerWrap);
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
            onRecallNode: () => {
                promptPanelManager.lockCommit();
                promptPanelManager.loadFromNode(node);
                debugLog(`[溯源] 已成功加载音频节点#${node.dataset.index}的历史参数`, 'success');
            },
            onPreviewStart: () => {
                promptPanelManager.saveDraft();
                promptPanelManager.setPreviewMode(true);
                promptPanelManager.loadFromNode(node);
                debugLog(`[预览] 音频节点#${node.dataset.index} 历史参数`, 'info');
            },
            onPreviewEnd: () => {
                if (!promptPanelManager.isPreviewLocked) {
                    promptPanelManager.setPreviewMode(false);
                    promptPanelManager.restoreDraft();
                }
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
            const timeTag = sidebar.querySelector('.node-generation-time');
            if (timeTag) {
                const span = timeTag.querySelector('span') || timeTag;
                span.textContent = formatGenerationTime(generationTime).replace('⏱️', '').trim();
            }
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
        node.style.width = '400px';
        node.style.height = '300px'; 
        node.dataset.nodeType = 'audio';
        node.dataset.startTime = Date.now();

        const dummyName = `audio_${Date.now().toString().slice(-4)}.mp3`;
        node.appendChild(createNodeHeader('audio', 'MP3', dummyName));

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.cssText = 'display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(239,246,255,0.95),rgba(219,234,254,0.85));border-radius:12px;overflow:hidden;position:relative;height:300px;';
        contentArea.innerHTML = `<div class="loading-container" style="background:transparent;"><div class="progress-ring-wrapper" style="color:#3b82f6;">${getIcon('loader', 32, 'animate-spin')}</div><div class="loading-text" style="color:#3b82f6;font-weight:700;margin-top:8px">正在谱写旋律...</div></div>`;
        node.appendChild(contentArea);

        node.appendChild(createNodeInfo(prompt, '音频生成中...'));
        node.appendChild(createNodeSidebar(0, modelName));

        const interval = setInterval(() => {
            if (!node.parentElement) { clearInterval(interval); return; }
            const elapsed = (Date.now() - node.dataset.startTime) / 1000;
            const timeStr = formatGenerationTime(elapsed).replace('⏱️', '').trim();
            const sidebarTime = node.querySelector('.node-generation-time span');
            if (sidebarTime) sidebarTime.textContent = timeStr;
        }, 100);
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
