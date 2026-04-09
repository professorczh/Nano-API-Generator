const fs = require('fs');
const path = 'js/node-factory.js';
let content = fs.readFileSync(path, 'utf8');

// 我们将 createAudioPlaceholder 的内容替换成与 replaceWithAudio 非常接近的结构
const newPlaceholderLogic = `    createAudioPlaceholder(x, y, prompt = '', modelName = '') {
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
        
        renderModelTag(sidebar, modelName);
        node.appendChild(sidebar);

        const info = document.createElement('div');
        info.className = 'node-info';
        info.textContent = prompt || '🎵 正在构思乐律...';
        node.appendChild(info);

        addLinkerHandle(node);

        node.addEventListener('mousedown', (e) => {
            if (e.target.closest('.video-controls-bar')) return;
            if (e.target.closest('.video-controls-overlay')) return;
            if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                e.stopPropagation();
                if (typeof window.selectNode === 'function') {
                    window.selectNode(node);
                }
                if (typeof window.AppState !== 'undefined') {
                    window.AppState.isDraggingNode = true;
                    window.AppState.dragNode = node;
                    window.AppState.activeNode = node;
                    window.AppState.dragStartX = e.clientX;
                    window.AppState.dragStartY = e.clientY;
                    window.AppState.dragNodeStartLeft = parseInt(node.style.left) || 0;
                    window.AppState.dragNodeStartTop = parseInt(node.style.top) || 0;
                }
            }
        });

        if (typeof window.updateMinimapWithImage === 'function') {
            window.updateMinimapWithImage(node);
        }

        return node;
    },`;

// 使用正则替换从 createAudioPlaceholder(x, y, prompt 到 replaceWithAudio 之间的内容
content = content.replace(/createAudioPlaceholder\([\s\S]*?return node;\s*\},[\s\n]*replaceWithAudio\(/, 
    newPlaceholderLogic + '\\n\\n    replaceWithAudio(');

fs.writeFileSync(path, content);
console.log('Successfully unified audio placeholder design.');
