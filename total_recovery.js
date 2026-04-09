const fs = require('fs');
const path = 'js/node-factory.js';

const newContent = `import { AppState, CanvasState } from './app-state.js';
import { LinkerManager } from './linker-manager.js';
import { getIcon } from './icons.js';
import { DebugConsole } from './debug-console.js';
import { createNodeHeader, createNodeSidebar, createNodeInfo, renderModelTag } from './utils.js';

// 强制注入旋转动画 CSS
if (!document.getElementById('loading-animation-style')) {
    const style = document.createElement('style');
    style.id = 'loading-animation-style';
    style.textContent = \\\\\\\`
        @keyframes loading-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .progress-ring-wrapper svg { animation: loading-rotate 2s linear infinite !important; }
        .loading-container.fade-out { opacity: 0; transform: scale(1.05); pointer-events: none; transition: opacity 0.6s, transform 0.6s; }
    \\\\\\\`;
    document.head.appendChild(style);
}

export const NodeFactory = {
    // --- 图片占位符 ---
    createImagePlaceholder(x, y, prompt, modelName) {
        const node = document.createElement('div');
        node.className = 'canvas-node image-node loading-placeholder';
        node.style.left = \\\\\\\`\\\${x}px\\\\\\\`;
        node.style.top = \\\\\\\`\\\${y}px\\\\\\\`;
        node.style.width = '300px';
        node.style.height = '300px';
        node.dataset.nodeType = 'image';
        
        node.appendChild(createNodeHeader('image', '300x300'));
        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        
        const loader = document.createElement('div');
        loader.className = 'loading-container';
        loader.innerHTML = \\\\\\\`<div class="progress-ring-wrapper">\\\${getIcon('loader', 32, 'animate-spin')}</div><div class="loading-text">正在生成图片...</div>\\\\\\\`;
        contentArea.appendChild(loader);
        node.appendChild(contentArea);
        
        node.appendChild(createNodeInfo(prompt, '图片生成中...'));
        node.appendChild(createNodeSidebar(null, modelName));
        
        if (typeof addLinkerHandle === 'function') addLinkerHandle(node);
        return node;
    },

    // --- 视频占位符 (带状态机) ---
    createVideoPlaceholder(x, y, prompt = '', modelName = '', aspectRatio = '16:9') {
        let nodeWidth = 300, nodeHeight = 169;
        if (aspectRatio === '9:16') { nodeWidth = 180; nodeHeight = 320; }
        
        const node = document.createElement('div');
        node.className = 'canvas-node video-node loading-placeholder';
        node.style.left = \\\\\\\`\\\${x}px\\\\\\\`;
        node.style.top = \\\\\\\`\\\${y}px\\\\\\\`;
        node.style.width = \\\\\\\`\\\${nodeWidth}px\\\\\\\`;
        node.style.height = \\\\\\\`\\\${nodeHeight}px\\\\\\\`;
        node.dataset.nodeType = 'video';
        node.dataset.startTime = Date.now();

        node.appendChild(createNodeHeader('video', aspectRatio));

        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-container';
        loadingContainer.innerHTML = \\\\\\\`
            <div class='loading-progress-wrapper progress-ring-wrapper'>
                <svg width='64' height='64' viewBox='0 0 80 80'>
                    <circle cx='40' cy='40' r='35' fill='none' stroke='rgba(255,255,255,0.05)' stroke-width='6'></circle>
                    <circle class='progress-ring' cx='40' cy='40' r='35' fill='none' stroke='var(--accent-primary)' stroke-width='6' stroke-linecap='round' stroke-dasharray='220' stroke-dashoffset='220' transform='rotate(-90 40 40)' style='transition: stroke-dashoffset 0.8s;'></circle>
                </svg>
                <div class='loading-progress-text'>0%</div>
            </div>
            <div class='loading-status-badge'>
                <span class='status-icon'>\\\${getIcon('sparkles', 14)}</span>
                <span class='loading-status-text queuing'>正在准备...</span>
            </div>
            <div class='loading-timer-display'>00:00</div>
        \\\\\\\`;
        contentArea.appendChild(loadingContainer);
        node.appendChild(contentArea);

        node.appendChild(createNodeInfo(prompt, '视频生成中...'));
        node.appendChild(createNodeSidebar(null, modelName));

        node._progressValue = 0;
        node._progressStage = 'generating';

        const updateRingUI = (val) => {
            const ring = loadingContainer.querySelector('.progress-ring');
            const percentText = loadingContainer.querySelector('.loading-progress-text');
            if (ring) ring.style.strokeDashoffset = 220 - (val / 100) * 220;
            if (percentText) percentText.textContent = Math.floor(val) + '%';
        };

        const timerTag = loadingContainer.querySelector('.loading-timer-display');
        const interval = setInterval(() => {
            if (!node.parentElement) { clearInterval(interval); return; }
            
            const elapsed = Math.floor((Date.now() - node.dataset.startTime) / 1000);
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toString().padStart(2, '0');
            if (timerTag) timerTag.textContent = \\\\\\\`\\\${m}:\\\${s}\\\\\\\`;
            const sidebarTime = node.querySelector('.node-generation-time span');
            if (sidebarTime) sidebarTime.textContent = \\\\\\\`\\\${m}:\\\${s}\\\\\\\`;

            if (node._progressStage === 'generating') {
                if (node._progressValue < 80) node._progressValue += 10;
                else if (node._progressValue < 89) node._progressValue += 1;
            } else if (node._progressStage === 'saving') {
                if (node._progressValue < 99) node._progressValue += 1;
            }
            updateRingUI(node._progressValue);
        }, 1000);
        node._loadingInterval = interval;

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
        
        let nodeWidth = 300, nodeHeight = 169;
        if (aspectRatio === '9:16') { nodeWidth = 180; nodeHeight = 320; }
        
        node.innerHTML = '';
        node.className = 'canvas-node video-node';
        node.style.left = savedLeft;
        node.style.top = savedTop;
        node.style.width = \\\\\\\`\\\${nodeWidth}px\\\\\\\`;
        node.style.height = \\\\\\\`\\\${nodeHeight}px\\\\\\\`;
        
        node.appendChild(createNodeHeader('video', aspectRatio));
        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.background = '#000';
        const video = document.createElement('video');
        video.src = videoUrl;
        video.autoplay = true; video.loop = true; video.muted = true; video.playsInline = true;
        video.style.width = '100%'; video.style.height = '100%'; video.style.objectFit = 'cover';
        contentArea.appendChild(video);
        node.appendChild(contentArea);

        node.appendChild(createNodeInfo(prompt));
        node.appendChild(createNodeSidebar(generationTime, savedModelName));

        if (typeof addLinkerHandle === 'function') addLinkerHandle(node);
        if (typeof updateMinimapWithImage === 'function') updateMinimapWithImage(node);
        return node;
    },

    // --- 音频占位符 (简易版) ---
    createAudioPlaceholder(x, y, prompt = '', modelName = '') {
        const node = document.createElement('div');
        node.className = 'canvas-node audio-node loading-placeholder';
        node.style.left = \\\\\\\`\\\${x}px\\\\\\\`;
        node.style.top = \\\\\\\`\\\${y}px\\\\\\\`;
        node.style.width = '300px';
        node.style.height = '180px';
        node.dataset.nodeType = 'audio';
        node.dataset.startTime = Date.now();

        node.appendChild(createNodeHeader('audio', 'MP3'));
        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.innerHTML = \\\\\\\`<div class="loading-container"><div class="progress-ring-wrapper">\\\${getIcon('loader', 32, 'animate-spin')}</div><div class="loading-text">正在生成音频...</div></div>\\\\\\\`;
        node.appendChild(contentArea);

        node.appendChild(createNodeInfo(prompt, '音频生成中...'));
        node.appendChild(createNodeSidebar(null, modelName));

        const interval = setInterval(() => {
            if (!node.parentElement) { clearInterval(interval); return; }
            const elapsed = Math.floor((Date.now() - node.dataset.startTime) / 1000);
            const sidebarTime = node.querySelector('.node-generation-time span');
            if (sidebarTime) {
                const s = elapsed % 60;
                const m = Math.floor(elapsed / 60);
                sidebarTime.textContent = \\\\\\\`\\\${m}:\\\${s.toString().padStart(2, '0')}\\\\\\\`;
            }
        }, 1000);
        node._loadingInterval = interval;

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
        node.style.height = '180px';
        node.dataset.nodeType = 'audio';
        node.dataset.audioUrl = audioUrl;

        node.appendChild(createNodeHeader('audio', format.toUpperCase()));
        const contentArea = document.createElement('div');
        contentArea.className = 'node-content';
        contentArea.style.background = '#0f172a';
        const wave = document.createElement('div');
        wave.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:4px;opacity:0.2;pointer-events:none;';
        for(let i=0;i<15;i++) {
            const b = document.createElement('div');
            b.style.cssText = \\\\\\\`width:4px;background:#60a5fa;height:\${10+Math.random()*30}px;border-radius:2px;\\\\\\\`;
            wave.appendChild(b);
        }
        contentArea.appendChild(wave);
        const audio = document.createElement('audio');
        audio.src = audioUrl;
        audio.controls = true;
        audio.style.width = '90%';
        audio.style.height = '40px';
        contentArea.appendChild(audio);
        node.appendChild(contentArea);
        node.appendChild(createNodeInfo(prompt));
        node.appendChild(createNodeSidebar(generationTime, modelName));
        if (typeof addLinkerHandle === 'function') addLinkerHandle(node);
        return node;
    }
};

window.NodeFactory = NodeFactory;
\`;

// 清理嵌套转义，确保 JS 内容纯净
const finalContent = newContent.replace(/\\\\\\\\\\\\\\/g, ''); 
fs.writeFileSync(path, finalContent);
console.log('--- CRITICAL RECOVERY: NodeFactory.js has been fully restored to its perfect state ---');
