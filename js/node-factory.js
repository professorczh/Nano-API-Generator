import { AppState } from './app-state.js';

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

        const toolbar = document.createElement('div');
        toolbar.className = 'node-toolbar';
        
        const copyPromptBtn = document.createElement('button');
        copyPromptBtn.className = 'toolbar-btn';
        copyPromptBtn.innerHTML = '📝';
        copyPromptBtn.title = '复制提示词';
        copyPromptBtn.disabled = true;
        copyPromptBtn.style.opacity = '0.5';
        
        const insertBtn = document.createElement('button');
        insertBtn.className = 'toolbar-btn';
        insertBtn.innerHTML = '✏️';
        insertBtn.title = '插入到输入框';
        insertBtn.disabled = true;
        insertBtn.style.opacity = '0.5';
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'toolbar-btn';
        copyBtn.innerHTML = '📋';
        copyBtn.title = '复制视频';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const video = node.querySelector('video');
            if (!video) return;
            
            video.play().then(() => {
                video.pause();
                fetch(video.src)
                    .then(res => res.blob())
                    .then(blob => {
                        navigator.clipboard.write([
                            new ClipboardItem({ 'video/webm': blob })
                        ]).then(() => {
                            console.log('视频已复制到剪贴板');
                        }).catch(err => {
                            console.error('复制失败:', err);
                        });
                    });
            });
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'toolbar-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = '取消生成';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.deleteVideoPlaceholder === 'function') {
                window.deleteVideoPlaceholder(node);
            } else {
                node.remove();
            }
        });
        
        toolbar.appendChild(copyPromptBtn);
        toolbar.appendChild(insertBtn);
        toolbar.appendChild(copyBtn);
        toolbar.appendChild(deleteBtn);

        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-container';
        loadingContainer.style.width = '100%';
        loadingContainer.style.height = '100%';
        loadingContainer.style.display = 'flex';
        loadingContainer.style.flexDirection = 'column';
        loadingContainer.style.justifyContent = 'center';
        loadingContainer.style.alignItems = 'center';
        loadingContainer.style.backgroundColor = '#1a1a2e';
        loadingContainer.style.borderRadius = '8px';

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
        statusText.style.color = '#4ade80';
        statusText.style.fontSize = '11px';
        statusText.textContent = '⏳ 等待中';

        loadingContainer.appendChild(progressContainer);
        loadingContainer.appendChild(statusText);

        const info = document.createElement('div');
        info.className = 'node-info';
        info.textContent = prompt || '视频生成中...';

        const centerCoords = document.createElement('div');
        centerCoords.className = 'node-center-coords';
        centerCoords.textContent = '(0, 0)';
        centerCoords.style.display = 'none';

        const sidebar = document.createElement('div');
        sidebar.className = 'node-sidebar';
        
        const timeElement = document.createElement('div');
        timeElement.className = 'node-generation-time';
        timeElement.style.display = typeof window.showGenerationTime !== 'undefined' && window.showGenerationTime ? 'flex' : 'none';
        sidebar.appendChild(timeElement);
        
        if (modelName) {
            const modelTag = document.createElement('div');
            modelTag.className = 'node-model-tag';
            modelTag.style.display = typeof window.showModelTag !== 'undefined' && window.showModelTag ? 'block' : 'none';
            if (typeof modelName === 'object' && modelName.name) {
                modelTag.innerHTML = `<div class="model-name">${modelName.name}</div><div class="model-provider">${modelName.provider}</div>`;
                modelTag.title = `${modelName.name} (${modelName.provider})`;
            } else {
                modelTag.textContent = modelName;
                modelTag.title = modelName;
            }
            sidebar.appendChild(modelTag);
        }

        node.appendChild(header);
        node.appendChild(toolbar);
        node.appendChild(loadingContainer);
        node.appendChild(info);
        node.appendChild(centerCoords);
        node.appendChild(sidebar);

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
        copyPromptBtn.innerHTML = '📝';
        copyPromptBtn.title = '复制提示词';
        copyPromptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(prompt || '').then(() => {
                if (typeof showMouseLogs !== 'undefined' && showMouseLogs) {
                    console.log(`[复制] 提示词: ${node.dataset.filename}`);
                }
            });
        });
        
        const insertBtn = document.createElement('button');
        insertBtn.className = 'toolbar-btn';
        insertBtn.innerHTML = '✏️';
        insertBtn.title = '插入到输入框';
        insertBtn.disabled = true;
        insertBtn.style.opacity = '0.5';
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'toolbar-btn';
        copyBtn.innerHTML = '📋';
        copyBtn.title = '复制视频';
        copyBtn.addEventListener('click', (e) => {
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
                            debugLog('[复制] 视频: 已复制到剪贴板', 'success');
                        }).catch(err => {
                            console.error('复制失败:', err);
                            debugLog('[复制] 视频失败: ' + err.message, 'error');
                        });
                    })
                    .catch(err => {
                        console.error('获取视频失败:', err);
                    });
            }
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'toolbar-btn';
        deleteBtn.innerHTML = '🗑️';
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
        timeElement.style.display = typeof window.showGenerationTime !== 'undefined' && window.showGenerationTime ? 'flex' : 'none';
        if (generationTime !== null) {
            timeElement.textContent = formatGenerationTime(generationTime);
            timeElement.title = `生成耗时: ${generationTime.toFixed(2)}秒`;
        }
        sidebar.appendChild(timeElement);
        
        if (savedModelName) {
            const modelTag = document.createElement('div');
            modelTag.className = 'node-model-tag';
            modelTag.style.display = typeof window.showModelTag !== 'undefined' && window.showModelTag ? 'block' : 'none';
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
    }
};

window.NodeFactory = NodeFactory;
