const fs = require('fs');

const path = 'js/node-factory.js';
let content = fs.readFileSync(path, 'utf8');

// Find the start of createAudioPlaceholder
const startIndex = content.indexOf('    createAudioPlaceholder(x, y');

// Find the end 
let endIndex = content.lastIndexOf('};\\r\\n\\r\\nwindow.NodeFactory');
if (endIndex === -1) endIndex = content.lastIndexOf('};\\n\\nwindow.NodeFactory');
if (endIndex === -1) {
    const backupIndex = content.lastIndexOf('window.NodeFactory = NodeFactory');
    if (backupIndex !== -1) {
        endIndex = content.lastIndexOf('};', backupIndex);
    }
}

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find boundaries.');
    process.exit(1);
}

const prefix = content.substring(0, startIndex);
const suffix = content.substring(endIndex);

const newAudioLogic = `    createAudioPlaceholder(x, y, prompt = '', modelName = '') {
        const nodeWidth = 320;
        const nodeHeight = 160;
        
        const node = document.createElement('div');
        node.className = 'canvas-node audio-node loading-placeholder';
        node.style.position = 'absolute';
        node.style.left = \`\${x}px\`;
        node.style.top = \`\${y}px\`;
        node.style.width = \`\${nodeWidth}px\`;
        node.style.height = \`\${nodeHeight}px\`;
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
        contentArea.style.cssText = \`
            background: #0f172a;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            border-radius: 8px;
        \`;

        // 统一深蓝波形背景，但在生成状态下透明度稍微暗一些
        const waveBg = document.createElement('div');
        waveBg.style.cssText = \`
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            opacity: 0.1;
            pointer-events: none;
        \`;
        for (let i = 0; i < 20; i++) {
            const bar = document.createElement('div');
            bar.style.cssText = \`
                width: 4px;
                background: #60a5fa;
                border-radius: 2px;
                height: \${10 + Math.random() * 40}px;
                animation: audio-bar-pulse \${1 + Math.random()}s infinite ease-in-out;
            \`;
            waveBg.appendChild(bar);
        }
        contentArea.appendChild(waveBg);

        // 占位符版本的控制栏（不可点击）
        const controlsOverlay = document.createElement('div');
        controlsOverlay.style.cssText = \`
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 44px;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            padding: 0 12px;
            gap: 12px;
        \`;

        const playPauseBtn = document.createElement('div');
        playPauseBtn.style.cssText = \`
            background: rgba(255,255,255,0.2);
            color: rgba(255,255,255,0.5);
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
        \`;
        playPauseBtn.innerHTML = '<span style="font-size:12px;">⌛</span>';
        controlsOverlay.appendChild(playPauseBtn);

        const progressBar = document.createElement('div');
        progressBar.style.cssText = \`
            flex: 1;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            position: relative;
        \`;
        // 进度条本身做个加载动画
        const progressFill = document.createElement('div');
        progressFill.style.cssText = \`
            height: 100%;
            background: #3b82f6;
            border-radius: 2px;
            width: 50%;
            opacity: 0.5;
            animation: node-shimmer 2s infinite linear;
        \`;
        progressBar.appendChild(progressFill);
        controlsOverlay.appendChild(progressBar);

        const timeDisplay = document.createElement('div');
        timeDisplay.style.cssText = \`
            color: rgba(255,255,255,0.7);
            font-size: 10px;
            font-family: monospace;
            min-width: 64px;
            text-align: right;
        \`;
        timeDisplay.textContent = 'Generating...';
        controlsOverlay.appendChild(timeDisplay);

        contentArea.appendChild(controlsOverlay);
        node.appendChild(contentArea);

        // 添加统一的节点侧边栏
        const sidebar = document.createElement('div');
        sidebar.className = 'node-sidebar';
        
        const timeElement = document.createElement('div');
        timeElement.className = 'node-generation-time';
        timeElement.style.display = 'flex';
        sidebar.appendChild(timeElement);
        
        if (typeof renderModelTag === 'function') {
            renderModelTag(sidebar, modelName);
        } else {
            const modelTag = document.createElement('div');
            modelTag.className = 'node-model-tag';
            let displayName = modelName;
            let providerName = '';
            if (typeof modelName === 'object' && modelName.name) {
                displayName = modelName.name;
                providerName = modelName.provider;
            } else if (typeof modelName === 'string' && modelName.includes('(')) {
                const parts = modelName.split('(');
                displayName = parts[0];
                providerName = parts[1].replace(')', '');
            }
            if (providerName) {
                modelTag.innerHTML = \`<div class="model-name">\${displayName}</div><div class="model-provider">\${providerName}</div>\`;
            } else {
                modelTag.textContent = displayName;
            }
            sidebar.appendChild(modelTag);
        }
        node.appendChild(sidebar);

        const info = document.createElement('div');
        info.className = 'node-info';
        info.textContent = prompt || '🎵 正在构思乐律...';
        node.appendChild(info);

        if (typeof addLinkerHandle === 'function') {
            addLinkerHandle(node);
        }

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

    replaceWithAudio(node, audioUrl, prompt = '', modelName = '', generationTime = null, format = 'mp3') {
        const savedModelName = node.dataset.modelName || modelName;
        const savedLeft = node.style.left;
        const savedTop = node.style.top;
        const nodeWidth = 320;
        const nodeHeight = 160; 
        
        node.innerHTML = '';
        node.className = 'canvas-node audio-node';
        node.style.left = savedLeft;
        node.style.top = savedTop;
        node.style.width = \`\${nodeWidth}px\`;
        node.style.height = \`\${nodeHeight}px\`;
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
        
        const copyPromptBtn = document.createElement('button');
        copyPromptBtn.className = 'toolbar-btn';
        copyPromptBtn.innerHTML = window.getIcon ? window.getIcon('file-text', 16) : '📝';
        copyPromptBtn.title = '复制提示词';
        copyPromptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(prompt || '').then(() => {
                if (typeof window.DebugConsole !== 'undefined' && window.DebugConsole.showMouseLogs) {
                    window.debugLog(\`[复制] 提示词: \${node.dataset.filename}\`, 'info');
                }
            });
        });

        const insertBtn = document.createElement('button');
        insertBtn.className = 'toolbar-btn';
        insertBtn.innerHTML = window.getIcon ? window.getIcon('edit', 16) : '✏️';
        insertBtn.title = '插入到输入框';
        insertBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.insertImageToPrompt) {
                window.insertImageToPrompt(audioUrl, 'Audio Ref');
            }
        });

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'toolbar-btn';
        downloadBtn.innerHTML = window.getIcon ? window.getIcon('download', 16) : '⬇️';
        downloadBtn.title = '下载音频';
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = \`audio-\${Date.now()}.\${format}\`;
            a.click();
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'toolbar-btn';
        deleteBtn.innerHTML = window.getIcon ? window.getIcon('trash', 16) : '🗑️';
        deleteBtn.title = '删除节点';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.selectNode === 'function') window.selectNode(node);
            if (typeof window.deleteSelectedNode === 'function') window.deleteSelectedNode();
        });
        
        toolbar.appendChild(copyPromptBtn);
        toolbar.appendChild(insertBtn);
        toolbar.appendChild(downloadBtn);
        toolbar.appendChild(deleteBtn);
        node.appendChild(toolbar);

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.cssText = \`
            background: #0f172a;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            border-radius: 8px;
        \`;

        const waveBg = document.createElement('div');
        waveBg.style.cssText = \`
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            opacity: 0.15;
            pointer-events: none;
        \`;
        for (let i = 0; i < 20; i++) {
            const bar = document.createElement('div');
            bar.style.cssText = \`
                width: 4px;
                background: #60a5fa;
                border-radius: 2px;
                height: \${10 + Math.random() * 40}px;
                animation: audio-bar-pulse \${1 + Math.random()}s infinite ease-in-out;
            \`;
            waveBg.appendChild(bar);
        }
        contentArea.appendChild(waveBg);

        let audioUrlObj = audioUrl;
        if (audioUrl && audioUrl.startsWith('data:audio')) {
            try {
                const arr = audioUrl.split(',');
                if (arr.length > 1) {
                    const mime = arr[0].match(/:(.*?);/)[1];
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    const blob = new Blob([u8arr], { type: mime });
                    audioUrlObj = URL.createObjectURL(blob);
                }
            } catch (e) {
                console.error('Error parsing audio data URL', e);
            }
        }
        
        const audio = document.createElement('audio');
        if (audioUrlObj) audio.src = audioUrlObj;

        const controlsOverlay = document.createElement('div');
        controlsOverlay.style.cssText = \`
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 44px;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            padding: 0 12px;
            gap: 12px;
        \`;

        const playPauseBtn = document.createElement('div');
        playPauseBtn.className = 'play-btn';
        playPauseBtn.style.cssText = \`
            background: rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.9);
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
        \`;
        playPauseBtn.innerHTML = window.getIcon ? window.getIcon('play', 12) : '▶️';
        
        playPauseBtn.onmouseover = () => playPauseBtn.style.background = 'rgba(255,255,255,0.2)';
        playPauseBtn.onmouseout = () => playPauseBtn.style.background = 'rgba(255,255,255,0.1)';
        
        controlsOverlay.appendChild(playPauseBtn);

        const progressBar = document.createElement('div');
        progressBar.style.cssText = \`
            flex: 1;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            position: relative;
            cursor: pointer;
        \`;
        
        const progressFill = document.createElement('div');
        progressFill.style.cssText = \`
            height: 100%;
            background: #60a5fa;
            border-radius: 2px;
            width: 0%;
        \`;
        progressBar.appendChild(progressFill);
        controlsOverlay.appendChild(progressBar);

        const timeDisplay = document.createElement('div');
        timeDisplay.style.cssText = \`
            color: rgba(255,255,255,0.9);
            font-size: 10px;
            font-family: monospace;
            min-width: 64px;
            text-align: right;
        \`;
        timeDisplay.textContent = '0:00 / 0:00';
        controlsOverlay.appendChild(timeDisplay);

        contentArea.appendChild(controlsOverlay);
        node.appendChild(contentArea);

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'node-sidebar';
        
        const timeElement = document.createElement('div');
        timeElement.className = 'node-generation-time';
        timeElement.style.display = 'flex';
        
        if (generationTime !== null && generationTime !== undefined) {
            const formatTime = (seconds) => {
                if (seconds < 60) return \`⏱️ \${seconds.toFixed(1)}s\`;
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return \`⏱️ \${mins}:\${secs.toString().padStart(2, '0')}\`;
            };
            timeElement.textContent = formatTime(generationTime);
        }
        sidebar.appendChild(timeElement);
        
        if (typeof renderModelTag === 'function') {
            renderModelTag(sidebar, savedModelName);
        } else {
            const modelTag = document.createElement('div');
            modelTag.className = 'node-model-tag';
            let displayName = savedModelName;
            let providerName = '';
            if (typeof savedModelName === 'object' && savedModelName.name) {
                displayName = savedModelName.name;
                providerName = savedModelName.provider;
            } else if (typeof savedModelName === 'string' && savedModelName.includes('(')) {
                const parts = savedModelName.split('(');
                displayName = parts[0];
                providerName = parts[1].replace(')', '');
            }
            if (providerName) {
                modelTag.innerHTML = \`<div class="model-name">\${displayName}</div><div class="model-provider">\${providerName}</div>\`;
            } else {
                modelTag.textContent = displayName;
            }
            sidebar.appendChild(modelTag);
        }
        
        node.appendChild(sidebar);

        const info = document.createElement('div');
        info.className = 'node-info';
        info.textContent = prompt || '生成的音频';
        info.title = '点击复制提示词';
        info.addEventListener('click', (e) => {
            e.stopPropagation();
            const textToCopy = prompt || info.textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                info.classList.add('copied');
                setTimeout(() => info.classList.remove('copied'), 500);
            });
        });
        node.appendChild(info);

        if (typeof addLinkerHandle === 'function') {
            addLinkerHandle(node);
        }

        // Logic for play/pause and progress
        playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (audio.paused) {
                audio.play();
                playPauseBtn.innerHTML = window.getIcon ? window.getIcon('pause', 12) : '⏸️';
            } else {
                audio.pause();
                playPauseBtn.innerHTML = window.getIcon ? window.getIcon('play', 12) : '▶️';
            }
        });

        audio.addEventListener('timeupdate', () => {
            if (!audio.duration) return;
            const percent = (audio.currentTime / audio.duration) * 100;
            progressFill.style.width = \`\${percent}%\`;
            
            const formatSecs = (time) => {
                const mins = Math.floor(time / 60);
                const secs = Math.floor(time % 60);
                return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
            };
            timeDisplay.textContent = \`\${formatSecs(audio.currentTime)} / \${formatSecs(audio.duration)}\`;
        });
        
        audio.addEventListener('loadedmetadata', () => {
            const formatSecs = (time) => {
                const mins = Math.floor(time / 60);
                const secs = Math.floor(time % 60);
                return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
            };
            timeDisplay.textContent = \`0:00 / \${formatSecs(audio.duration)}\`;
        });

        audio.addEventListener('ended', () => {
            playPauseBtn.innerHTML = window.getIcon ? window.getIcon('play', 12) : '▶️';
            progressFill.style.width = '0%';
        });

        progressBar.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = progressBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            if (audio.duration) {
                audio.currentTime = pos * audio.duration;
            }
        });

        if (typeof window.updateMinimapWithImage === 'function') {
            window.updateMinimapWithImage(node);
        }

        return node;
    }
`;

fs.writeFileSync(path, prefix + newAudioLogic + '\n' + suffix);
console.log('Successfully completely rebuilt audio node factory functions!');
