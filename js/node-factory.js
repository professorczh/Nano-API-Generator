import { AppState, CanvasState } from './app-state.js';
import { LinkerManager } from './linker-manager.js';
import { getIcon } from './icons.js';
import { DebugConsole } from './debug-console.js';

function formatGenerationTime(seconds) {
    if (seconds < 60) {
        return `⏱️ ${seconds.toFixed(1)}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `⏱️ ${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `⏱️ ${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
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
    createVideoPlaceholder(x, y, prompt = '', modelName = '', aspectRatio = '16:9') {
        let nodeWidth, nodeHeight;
        if (aspectRatio === '9:16') {
            nodeWidth = 180;
            nodeHeight = 320;
        } else {
            nodeWidth = 300;
            nodeHeight = 169;
        }
        
        const node = document.createElement('div');
        node.className = 'canvas-node video-node loading-placeholder';
        node.style.position = 'absolute';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = `${nodeWidth}px`;
        node.style.height = `${nodeHeight}px`;
        node.style.zIndex = '10';
        node.dataset.modelName = modelName;
        node.dataset.nodeType = 'video';
        node.dataset.videoUrl = '';
        node.dataset.filename = 'Video';
        node.dataset.width = nodeWidth;
        node.dataset.height = nodeHeight;

        const header = document.createElement('div');
        header.className = 'node-header';
        
        const filenameElement = document.createElement('div');
        filenameElement.className = 'node-filename';
        filenameElement.textContent = 'Video...';
        
        const resolutionElement = document.createElement('div');
        resolutionElement.className = 'node-resolution';
        resolutionElement.textContent = aspectRatio;
        
        header.appendChild(filenameElement);
        header.appendChild(resolutionElement);
        node.appendChild(header);

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        node.appendChild(contentArea);

        const info = document.createElement('div');
        info.className = 'node-info';
        info.textContent = prompt || '视频生成中...';
        node.appendChild(info);

        const sidebar = document.createElement('div');
        sidebar.className = 'node-sidebar';
        
        const timeElement = document.createElement('div');
        timeElement.className = 'node-generation-time';
        timeElement.style.display = DebugConsole.showGenerationTime ? 'flex' : 'none';
        sidebar.appendChild(timeElement);

        if (modelName) {
            const modelTag = document.createElement('div');
            modelTag.className = 'node-model-tag';
            modelTag.style.display = DebugConsole.showModelTag ? 'block' : 'none';
            if (typeof modelName === 'object' && modelName.name) {
                modelTag.innerHTML = `<div class="model-name">${modelName.name}</div><div class="model-provider">${modelName.provider}</div>`;
                modelTag.title = `${modelName.name} (${modelName.provider})`;
            } else {
                modelTag.textContent = modelName;
                modelTag.title = modelName;
            }
            sidebar.appendChild(modelTag);
        }
        node.appendChild(sidebar);

        // 添加连线引用手柄
        addLinkerHandle(node);

        // 恢复必要的生成中状态容器 (使用毛玻璃风格)
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-container';
        loadingContainer.style.width = '100%';
        loadingContainer.style.height = '100%';
        loadingContainer.style.display = 'flex';
        loadingContainer.style.flexDirection = 'column';
        loadingContainer.style.justifyContent = 'center';
        loadingContainer.style.alignItems = 'center';
        loadingContainer.style.backgroundColor = 'rgba(15, 15, 20, 0.6)'; // 更细腻的深色背景
        loadingContainer.style.backdropFilter = 'blur(10px)'; // 毛玻璃效果
        loadingContainer.style.borderRadius = '8px';
        loadingContainer.style.position = 'absolute';
        loadingContainer.style.top = '0';
        loadingContainer.style.left = '0';
        loadingContainer.style.zIndex = '1'; // 确保在 Header (通常是 5+) 之下

        // 进度环和状态文本
        const progressContainer = document.createElement('div');
        progressContainer.style.position = 'relative';
        progressContainer.style.width = '60px';
        progressContainer.style.height = '60px';

        const svgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgCircle.setAttribute('width', '60');
        svgCircle.setAttribute('height', '60');
        svgCircle.setAttribute('viewBox', '0 0 80 80');

        const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        backgroundCircle.setAttribute('cx', '40');
        backgroundCircle.setAttribute('cy', '40');
        backgroundCircle.setAttribute('r', '35');
        backgroundCircle.setAttribute('fill', 'none');
        backgroundCircle.setAttribute('stroke', 'rgba(255,255,255,0.1)');
        backgroundCircle.setAttribute('stroke-width', '6');

        const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        progressCircle.setAttribute('cx', '40');
        progressCircle.setAttribute('cy', '40');
        progressCircle.setAttribute('r', '35');
        progressCircle.setAttribute('fill', 'none');
        progressCircle.setAttribute('stroke', '#4ade80');
        progressCircle.setAttribute('stroke-width', '6');
        progressCircle.setAttribute('stroke-linecap', 'round');
        progressCircle.setAttribute('stroke-dasharray', '220');
        progressCircle.setAttribute('stroke-dashoffset', '220');
        progressCircle.setAttribute('transform', 'rotate(-90 40 40)');
        progressCircle.style.transition = 'stroke-dashoffset 0.3s ease';

        svgCircle.appendChild(backgroundCircle);
        svgCircle.appendChild(progressCircle);
        progressContainer.appendChild(svgCircle);

        const progressText = document.createElement('div');
        progressText.className = 'video-progress-text';
        progressText.style.position = 'absolute';
        progressText.style.top = '50%';
        progressText.style.left = '50%';
        progressText.style.transform = 'translate(-50%, -50%)';
        progressText.style.color = '#fff';
        progressText.style.fontSize = '12px';
        progressText.style.fontWeight = 'bold';
        progressText.textContent = '0%';
        progressContainer.appendChild(progressText);

        const statusText = document.createElement('div');
        statusText.className = 'video-status';
        statusText.style.marginTop = '8px';
        statusText.style.color = '#fbbf24'; // 使用 Amber 色调
        statusText.style.fontSize = '11px';
        statusText.style.fontWeight = '500';
        statusText.textContent = '⏳ 排队中';

        loadingContainer.appendChild(progressContainer);
        loadingContainer.appendChild(statusText);
        contentArea.appendChild(loadingContainer);

        node._updateProgress = function(percent) {
            const clampedPercent = Math.min(100, Math.max(0, percent));
            const offset = 220 - (220 * clampedPercent / 100);
            progressCircle.setAttribute('stroke-dashoffset', offset);
            progressText.textContent = `${Math.round(clampedPercent)}%`;
            
            if (clampedPercent < 30) {
                statusText.textContent = '⏳ 排队中';
                statusText.style.color = '#fbbf24';
            } else if (clampedPercent < 100) {
                statusText.textContent = '🎬 生成中';
                statusText.style.color = '#4ade80';
            } else {
                statusText.textContent = '✅ 完成';
                statusText.style.color = '#22c55e';
            }
        };

        node._setStatus = function(status) {
            if (status === 'queued') {
                statusText.textContent = '⏳ 排队中';
                statusText.style.color = '#fbbf24';
            } else if (status === 'in_progress') {
                statusText.textContent = '🎬 生成中';
                statusText.style.color = '#4ade80';
            }
        };

        node.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                e.stopPropagation();
                if (typeof window.selectNode === 'function') {
                    window.selectNode(node);
                }
                AppState.isDraggingNode = true;
                AppState.dragNode = node;
                AppState.activeNode = node;
                AppState.dragStartX = e.clientX;
                AppState.dragStartY = e.clientY;
                AppState.dragNodeStartLeft = parseInt(node.style.left) || 0;
                AppState.dragNodeStartTop = parseInt(node.style.top) || 0;
            }
        });

        return node;
    },

    replaceWithVideo(node, videoUrl, prompt = '', modelName = '', generationTime = null, aspectRatio = '16:9') {
        const savedModelName = node.dataset.modelName || modelName;
        const savedLeft = node.style.left;
        const savedTop = node.style.top;
        
        let nodeWidth, nodeHeight;
        if (aspectRatio === '9:16') {
            nodeWidth = 180;
            nodeHeight = 320;
        } else {
            nodeWidth = 300;
            nodeHeight = 169;
        }
        
        node.innerHTML = '';
        node.style.position = 'absolute';
        node.style.left = savedLeft;
        node.style.top = savedTop;
        node.style.width = `${nodeWidth}px`;
        node.style.height = `${nodeHeight}px`;
        node.style.zIndex = '10';
        node.className = 'canvas-node video-node';
        if (savedModelName) {
            node.dataset.modelName = savedModelName;
        }
        node.dataset.nodeType = 'video';
        node.dataset.videoUrl = videoUrl;
        node.dataset.filename = 'Video';
        node.dataset.width = nodeWidth;
        node.dataset.height = nodeHeight;

        const header = document.createElement('div');
        header.className = 'node-header';
        
        const filenameElement = document.createElement('div');
        filenameElement.className = 'node-filename';
        filenameElement.textContent = 'Video';
        
        const resolutionElement = document.createElement('div');
        resolutionElement.className = 'node-resolution';
        resolutionElement.textContent = aspectRatio;
        
        header.appendChild(filenameElement);
        header.appendChild(resolutionElement);

        const toolbar = document.createElement('div');
        toolbar.className = 'node-toolbar';
        
        const copyPromptBtn = document.createElement('button');
        copyPromptBtn.className = 'toolbar-btn';
        copyPromptBtn.innerHTML = getIcon('file-text', 16);
        copyPromptBtn.title = '复制提示词';
        copyPromptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(prompt || '').then(() => {
                if (DebugConsole.showMouseLogs) {
                    console.log(`[复制] 提示词: ${node.dataset.filename}`);
                }
            });
        });
        
        const insertBtn = document.createElement('button');
        insertBtn.className = 'toolbar-btn';
        insertBtn.innerHTML = getIcon('edit', 16);
        insertBtn.title = '插入到输入框';
        insertBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const video = node.querySelector('video');
            if (video) {
                const url = node.dataset.videoUrl || video.src;
                const filename = node.dataset.filename || 'Video';
                if (window.insertImageToPrompt) {
                    window.insertImageToPrompt(url, filename);
                    console.log(`[工具栏] 插入视频到输入框: node=${filename}`, 'info');
                }
            }
        });
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'toolbar-btn';
        copyBtn.innerHTML = getIcon('clipboard', 16);
        copyBtn.title = '复制视频';
        copyBtn.addEventListener('click', (e) => {
            // ... (blob logic remains)
            e.stopPropagation();
            const video = node.querySelector('video');
            if (!video) return;
            
            const videoUrl = node.dataset.videoUrl || video.src;
            if (videoUrl) {
                fetch(videoUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                        ]).then(() => {
                            console.log('视频已复制到剪贴板');
                        }).catch(err => {
                            console.error('复制失败:', err);
                        });
                    })
                    .catch(err => {
                        console.error('获取视频失败:', err);
                    });
            }
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'toolbar-btn';
        deleteBtn.innerHTML = getIcon('trash', 16);
        deleteBtn.title = '删除视频';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.selectNode === 'function') {
                window.selectNode(node);
            }
            if (typeof window.deleteSelectedNode === 'function') {
                window.deleteSelectedNode();
            }
        });
        
        toolbar.appendChild(copyPromptBtn);
        toolbar.appendChild(insertBtn);
        toolbar.appendChild(copyBtn);
        toolbar.appendChild(deleteBtn);

        const videoContainer = document.createElement('div');
        videoContainer.style.position = 'relative';
        videoContainer.style.width = '100%';
        videoContainer.style.height = '100%';
        videoContainer.style.backgroundColor = '#000';
        videoContainer.style.borderRadius = '8px';
        videoContainer.style.overflow = 'hidden';

        const video = document.createElement('video');
        video.src = videoUrl;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';

        const controlsOverlay = document.createElement('div');
        controlsOverlay.className = 'video-controls-overlay';
        controlsOverlay.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.8));
            padding: 20px 8px 8px 8px;
            opacity: 0;
            transition: opacity 0.3s ease;
            border-radius: 0 0 8px 8px;
            pointer-events: none;
        `;

        const controlsBar = document.createElement('div');
        controlsBar.className = 'video-controls-bar';
        controlsBar.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            pointer-events: auto;
        `;

        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'video-ctrl-btn video-play-btn';
        playPauseBtn.innerHTML = '⏸️';
        playPauseBtn.title = '播放/暂停';
        playPauseBtn.style.cssText = `
            background: none;
            border: none;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            padding: 2px;
            line-height: 1;
            opacity: 0.9;
        `;

        const progressBar = document.createElement('div');
        progressBar.className = 'video-progress-bar';
        progressBar.style.cssText = `
            flex: 1;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            cursor: pointer;
            position: relative;
        `;

        const progressFill = document.createElement('div');
        progressFill.className = 'video-progress-fill';
        progressFill.style.cssText = `
            height: 100%;
            background: #8b5cf6;
            border-radius: 2px;
            width: 0%;
            transition: width 0.1s linear;
        `;
        progressBar.appendChild(progressFill);

        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'video-time-display';
        timeDisplay.textContent = '0:00 / 0:00';
        timeDisplay.style.cssText = `
            color: #fff;
            font-size: 10px;
            min-width: 60px;
            text-align: center;
            opacity: 0.9;
        `;

        const volumeBtn = document.createElement('button');
        volumeBtn.className = 'video-ctrl-btn video-volume-btn';
        volumeBtn.innerHTML = '🔇';
        volumeBtn.title = '静音/取消静音';
        volumeBtn.style.cssText = `
            background: none;
            border: none;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            padding: 2px;
            line-height: 1;
            opacity: 0.9;
        `;

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'video-ctrl-btn video-fullscreen-btn';
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = '全屏';
        fullscreenBtn.style.cssText = `
            background: none;
            border: none;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            padding: 2px;
            line-height: 1;
            opacity: 0.9;
        `;

        controlsBar.appendChild(playPauseBtn);
        controlsBar.appendChild(progressBar);
        controlsBar.appendChild(timeDisplay);
        controlsBar.appendChild(volumeBtn);
        controlsBar.appendChild(fullscreenBtn);
        controlsOverlay.appendChild(controlsBar);

        const formatTime = (seconds) => {
            if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const updateTimeDisplay = () => {
            const current = formatTime(video.currentTime);
            const duration = formatTime(video.duration);
            timeDisplay.textContent = `${current} / ${duration}`;
        };

        const updateProgress = () => {
            if (video.duration > 0) {
                const percent = (video.currentTime / video.duration) * 100;
                progressFill.style.width = `${percent}%`;
            }
            updateTimeDisplay();
        };

        video.addEventListener('timeupdate', updateProgress);
        video.addEventListener('loadedmetadata', () => {
            updateTimeDisplay();
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            if (videoWidth && videoHeight) {
                resolutionElement.textContent = `${videoWidth}x${videoHeight}`;
                node.dataset.width = videoWidth;
                node.dataset.height = videoHeight;
            }
        });

        playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (video.paused) {
                video.play();
                playPauseBtn.innerHTML = '⏸️';
            } else {
                video.pause();
                playPauseBtn.innerHTML = '▶️';
            }
        });

        progressBar.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            if (video.duration > 0) {
                video.currentTime = percent * video.duration;
            }
        });

        volumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            video.muted = !video.muted;
            volumeBtn.innerHTML = video.muted ? '🔇' : '🔊';
        });

        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (video.requestFullscreen) {
                video.requestFullscreen();
            } else if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
            }
        });

        videoContainer.addEventListener('mouseenter', () => {
            controlsOverlay.style.opacity = '1';
        });
        videoContainer.addEventListener('mouseleave', () => {
            controlsOverlay.style.opacity = '0';
        });

        videoContainer.appendChild(video);
        videoContainer.appendChild(controlsOverlay);

        const info = document.createElement('div');
        info.className = 'node-info';
        info.textContent = prompt || '生成的视频';
        info.title = '点击复制提示词';
        info.addEventListener('click', (e) => {
            e.stopPropagation();
            const textToCopy = prompt || info.textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                info.classList.add('copied');
                setTimeout(() => {
                    info.classList.remove('copied');
                }, 500);
            }).catch(err => {
                console.error('复制失败:', err);
            });
        });

        const centerCoords = document.createElement('div');
        centerCoords.className = 'node-center-coords';
        centerCoords.textContent = '(0, 0)';
        centerCoords.style.display = 'none';

        const sidebar = document.createElement('div');
        sidebar.className = 'node-sidebar';
        
        const timeElement = document.createElement('div');
        timeElement.className = 'node-generation-time';
        timeElement.style.display = DebugConsole.showGenerationTime ? 'flex' : 'none';
        if (generationTime !== null) {
            timeElement.textContent = formatGenerationTime(generationTime);
            timeElement.title = `生成耗时: ${generationTime.toFixed(2)}秒`;
        }
        sidebar.appendChild(timeElement);
        
        if (savedModelName) {
            const modelTag = document.createElement('div');
            modelTag.className = 'node-model-tag';
            modelTag.style.display = DebugConsole.showModelTag ? 'block' : 'none';
            if (typeof savedModelName === 'object' && savedModelName.name) {
                modelTag.innerHTML = `<div class="model-name">${savedModelName.name}</div><div class="model-provider">${savedModelName.provider}</div>`;
                modelTag.title = `${savedModelName.name} (${savedModelName.provider})`;
            } else {
                modelTag.textContent = savedModelName;
                modelTag.title = savedModelName;
            }
            sidebar.appendChild(modelTag);
        }

        node.appendChild(header);
        node.appendChild(toolbar);
        node.appendChild(videoContainer);
        node.appendChild(info);
        node.appendChild(centerCoords);
        node.appendChild(sidebar);

        // 添加连线引用手柄
        addLinkerHandle(node);

        const left = parseInt(node.style.left) || 0;
        const top = parseInt(node.style.top) || 0;
        const centerX = Math.round(left + nodeWidth / 2);
        const centerY = Math.round(top + nodeHeight / 2);
        centerCoords.textContent = `(${centerX}, ${centerY})`;

        node.addEventListener('mousedown', (e) => {
            if (e.target.closest('.video-controls-bar')) return;
            if (e.target.closest('.video-controls-overlay')) return;
            if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                e.stopPropagation();
                if (typeof window.selectNode === 'function') {
                    window.selectNode(node);
                }
                AppState.isDraggingNode = true;
                AppState.dragNode = node;
                AppState.activeNode = node;
                AppState.dragStartX = e.clientX;
                AppState.dragStartY = e.clientY;
                AppState.dragNodeStartLeft = parseInt(node.style.left) || 0;
                AppState.dragNodeStartTop = parseInt(node.style.top) || 0;
            }
        });

        if (typeof window.updateMinimapWithImage === 'function') {
            window.updateMinimapWithImage(node);
        }

        return node;
    },

    createAudioPlaceholder(x, y, prompt = '', modelName = '') {
        const nodeWidth = 300;
        const nodeHeight = 120;
        
        const node = document.createElement('div');
        node.className = 'canvas-node audio-node loading-placeholder';
        node.style.position = 'absolute';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = `${nodeWidth}px`;
        node.style.height = `${nodeHeight}px`;
        node.style.zIndex = '10';
        node.dataset.modelName = modelName;
        node.dataset.nodeType = 'audio';
        node.dataset.audioUrl = '';
        node.dataset.filename = 'Audio';

        const header = document.createElement('div');
        header.className = 'node-header';
        
        const filenameElement = document.createElement('div');
        filenameElement.className = 'node-filename';
        filenameElement.textContent = 'Audio...';
        
        const resolutionElement = document.createElement('div');
        resolutionElement.className = 'node-resolution';
        resolutionElement.textContent = 'Generating';
        
        header.appendChild(filenameElement);
        header.appendChild(resolutionElement);
        node.appendChild(header);

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.background = 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)';
        node.appendChild(contentArea);

        // 添加连线引用手柄
        addLinkerHandle(node);

        const sidebar = document.createElement('div');
        sidebar.className = 'node-sidebar';
        
        const timeElement = document.createElement('div');
        timeElement.className = 'node-generation-time';
        timeElement.style.display = typeof window.showGenerationTime !== 'undefined' && window.showGenerationTime ? 'flex' : 'none';
        sidebar.appendChild(timeElement);
        
        const modelTag = document.createElement('div');
        modelTag.className = 'node-model-tag';
        modelTag.style.display = typeof window.showModelTag !== 'undefined' && window.showModelTag ? 'block' : 'none';
        modelTag.textContent = typeof modelName === 'object' ? modelName.name : modelName;
        sidebar.appendChild(modelTag);
        
        node.appendChild(sidebar);

        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-container';
        loadingContainer.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(4px);
            border-radius: 8px;
        `;

        const spinner = document.createElement('div');
        spinner.className = 'audio-spinner';
        spinner.innerHTML = '🎵';
        spinner.style.fontSize = '24px';
        spinner.style.animation = 'bounce 1s infinite';
        loadingContainer.appendChild(spinner);

        const statusText = document.createElement('div');
        statusText.style.color = '#db2777';
        statusText.style.fontSize = '12px';
        statusText.style.fontWeight = 'bold';
        statusText.style.marginTop = '4px';
        statusText.textContent = '音频生成中...';
        loadingContainer.appendChild(statusText);

        contentArea.appendChild(loadingContainer);

        node.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                e.stopPropagation();
                if (typeof window.selectNode === 'function') {
                    window.selectNode(node);
                }
                AppState.isDraggingNode = true;
                AppState.dragNode = node;
                AppState.activeNode = node;
                AppState.dragStartX = e.clientX;
                AppState.dragStartY = e.clientY;
                AppState.dragNodeStartLeft = parseInt(node.style.left) || 0;
                AppState.dragNodeStartTop = parseInt(node.style.top) || 0;
            }
        });

        return node;
    },

    replaceWithAudio(node, audioUrl, prompt = '', modelName = '', generationTime = null, format = 'mp3') {
        const savedModelName = node.dataset.modelName || modelName;
        const savedLeft = node.style.left;
        const savedTop = node.style.top;
        const nodeWidth = 300;
        const nodeHeight = 120;
        
        node.innerHTML = '';
        node.className = 'canvas-node audio-node';
        node.style.left = savedLeft;
        node.style.top = savedTop;
        node.style.width = `${nodeWidth}px`;
        node.style.height = `${nodeHeight}px`;
        node.dataset.nodeType = 'audio';
        node.dataset.audioUrl = audioUrl;

        const header = document.createElement('div');
        header.className = 'node-header';
        const filenameElement = document.createElement('div');
        filenameElement.className = 'node-filename';
        filenameElement.textContent = 'Audio Result';
        const resolutionElement = document.createElement('div');
        resolutionElement.className = 'node-resolution';
        resolutionElement.textContent = format.toUpperCase();
        header.appendChild(filenameElement);
        header.appendChild(resolutionElement);
        node.appendChild(header);

        const toolbar = document.createElement('div');
        toolbar.className = 'node-toolbar';
        
        const insertBtn = document.createElement('button');
        insertBtn.className = 'toolbar-btn';
        insertBtn.innerHTML = '✏️';
        insertBtn.title = '插入到输入框';
        insertBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const filename = node.dataset.filename || 'Audio';
            if (window.insertImageToPrompt) {
                window.insertImageToPrompt(audioUrl, filename);
                debugLog(`[工具栏] 插入音频到输入框: node=${filename}`, 'info');
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'toolbar-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            node.remove();
        });
        
        toolbar.appendChild(insertBtn);
        toolbar.appendChild(deleteBtn);
        node.appendChild(toolbar);

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.background = 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)';
        node.appendChild(contentArea);

        // 添加连线引用手柄
        addLinkerHandle(node);

        const audio = document.createElement('audio');
        audio.src = audioUrl;

        const controls = document.createElement('div');
        controls.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            padding: 0 15px;
            gap: 12px;
        `;

        const playBtn = document.createElement('button');
        playBtn.innerHTML = '▶️';
        playBtn.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: #db2777;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        `;

        const progressContainer = document.createElement('div');
        progressContainer.style.flex = '1';
        progressContainer.style.height = '6px';
        progressContainer.style.background = '#f9a8d4';
        progressContainer.style.borderRadius = '3px';
        progressContainer.style.position = 'relative';
        progressContainer.style.cursor = 'pointer';

        const progressFill = document.createElement('div');
        progressFill.style.height = '100%';
        progressFill.style.width = '0%';
        progressFill.style.background = '#db2777';
        progressFill.style.borderRadius = '3px';
        progressContainer.appendChild(progressFill);

        const timeDisplay = document.createElement('div');
        timeDisplay.style.fontSize = '10px';
        timeDisplay.style.color = '#db2777';
        timeDisplay.style.minWidth = '40px';
        timeDisplay.textContent = '0:00';

        controls.appendChild(playBtn);
        controls.appendChild(progressContainer);
        controls.appendChild(timeDisplay);
        contentArea.appendChild(controls);

        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (audio.paused) {
                audio.play();
                playBtn.innerHTML = '⏸️';
            } else {
                audio.pause();
                playBtn.innerHTML = '▶️';
            }
        });

        audio.addEventListener('timeupdate', () => {
            const percent = (audio.currentTime / audio.duration) * 100;
            progressFill.style.width = `${percent}%`;
            const mins = Math.floor(audio.currentTime / 60);
            const secs = Math.floor(audio.currentTime % 60);
            timeDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        });

        audio.addEventListener('ended', () => {
            playBtn.innerHTML = '▶️';
            progressFill.style.width = '0%';
        });

        const sidebar = document.createElement('div');
        sidebar.className = 'node-sidebar';
        const timeElement = document.createElement('div');
        timeElement.className = 'node-generation-time';
        timeElement.style.display = typeof window.showGenerationTime !== 'undefined' && window.showGenerationTime ? 'flex' : 'none';
        if (generationTime) timeElement.textContent = `⏱️ ${generationTime.toFixed(1)}s`;
        sidebar.appendChild(timeElement);
        node.appendChild(sidebar);

        return node;
    }
};

window.NodeFactory = NodeFactory;
