// 工具函数

import { CONFIG, IMAGE_RATIOS, IMAGE_SIZES, VIDEO_MODELS } from "../config.js";

export function maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 6) return apiKey;
    return apiKey.substring(0, 3) + '*'.repeat(apiKey.length - 6) + apiKey.substring(apiKey.length - 3);
}

export function formatGenerationTime(seconds) {
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

export function updateAllNodeTimeVisibility(showGenerationTime) {
    const timeLabels = document.querySelectorAll('.node-generation-time');
    timeLabels.forEach(label => {
        label.style.display = showGenerationTime ? 'flex' : 'none';
    });
}

export function updateAllNodeModelTagVisibility(showModelTag) {
    const modelTags = document.querySelectorAll('.node-model-tag');
    modelTags.forEach(tag => {
        tag.style.display = showModelTag ? 'block' : 'none';
    });
}

export function adjustBaseUrlInputWidth(input) {
    const measureEl = document.getElementById('text-measure');
    if (!measureEl) return;
    
    measureEl.textContent = input.value || input.placeholder || '';
    const width = Math.max(280, measureEl.offsetWidth + 20);
    input.style.width = width + 'px';
}

export function debugLog(message, type = 'info') {
    const debugConsoleContent = document.getElementById('debugConsoleContent');
    if (!debugConsoleContent) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = `debug-log ${type}`;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    const now = new Date();
    timestamp.textContent = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}]`;
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'message';
    messageSpan.textContent = message;
    
    const copyIcon = document.createElement('span');
    copyIcon.className = 'debug-log-copy';
    copyIcon.innerHTML = '📋';
    copyIcon.title = '复制';
    copyIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(message).then(() => {
            copyIcon.textContent = '✓';
            setTimeout(() => {
                copyIcon.textContent = '📋';
            }, 1000);
        });
    });
    
    logEntry.appendChild(timestamp);
    logEntry.appendChild(messageSpan);
    logEntry.appendChild(copyIcon);
    debugConsoleContent.appendChild(logEntry);
    debugConsoleContent.scrollTop = debugConsoleContent.scrollHeight;
    
    const maxLogs = 100;
    const logs = debugConsoleContent.querySelectorAll('.debug-log');
    if (logs.length > maxLogs) {
        for (let i = 0; i < logs.length - maxLogs; i++) {
            logs[i].remove();
        }
    }
}

export function updateResolutionOptions() {
    const selectedModel = CONFIG.IMAGE_MODEL_NAME;
    
    const isFirstGroup = selectedModel.includes('3.1-flash-image-preview');
    
    const imageRatioSelect = document.getElementById('aspectRatio');
    if (imageRatioSelect) {
        imageRatioSelect.innerHTML = '';
        
        IMAGE_RATIOS.forEach(ratio => {
            if (isFirstGroup || !['8:1', '4:1', '1:4', '1:8'].includes(ratio.value)) {
                const option = document.createElement('option');
                option.value = ratio.value;
                option.textContent = ratio.name;
                imageRatioSelect.appendChild(option);
            }
        });
    }
    
    const imageSizeSelect = document.getElementById('imageSize');
    if (imageSizeSelect) {
        imageSizeSelect.innerHTML = '';
        
        IMAGE_SIZES.forEach(size => {
            if (isFirstGroup || size.value !== '512px') {
                const option = document.createElement('option');
                option.value = size.value;
                option.textContent = size.name;
                imageSizeSelect.appendChild(option);
            }
        });
        
        imageSizeSelect.value = '1K';
    }
}

export function updateApiKeyDisplay(settingsApiKeyInput) {
    const apiKey = CONFIG.API_KEY;
    if (apiKey && settingsApiKeyInput) {
        settingsApiKeyInput.value = maskApiKey(apiKey);
    }
}

export function updateVideoDurationOptions(modelValue, videoDurationSelect, videoResolutionSelect) {
    let model = null;
    if (window.dynamicProviderManager) {
        const allModels = window.dynamicProviderManager.getAllModels();
        const videoModels = allModels.video || [];
        model = videoModels.find(m => m.value === modelValue);
    }
    if (!model) {
        model = VIDEO_MODELS.find(m => m.value === modelValue);
    }
    
    if (model && model.params && model.params.durations) {
        videoDurationSelect.innerHTML = '';
        model.params.durations.forEach(duration => {
            const option = document.createElement('option');
            option.value = duration;
            option.textContent = duration + ' 秒';
            videoDurationSelect.appendChild(option);
        });
        videoDurationSelect.value = model.params.durations[0];
        updateVideoResolutionOptions(modelValue, model.params.durations[0], videoResolutionSelect);
    } else {
        videoDurationSelect.innerHTML = '';
        ['4', '6', '8'].forEach(duration => {
            const option = document.createElement('option');
            option.value = duration;
            option.textContent = duration + ' 秒';
            if (duration === '6') option.selected = true;
            videoDurationSelect.appendChild(option);
        });
        videoResolutionSelect.innerHTML = '';
        ['720p', '1080p', '4k'].forEach(res => {
            const option = document.createElement('option');
            option.value = res;
            option.textContent = res;
            videoResolutionSelect.appendChild(option);
        });
    }
}

export function getSelectedProvider(selectElement) {
    const selectedOption = selectElement.selectedOptions[0];
    return selectedOption ? selectedOption.dataset.provider : 'google';
}

export function setupStatusClose(closeBtn, statusEl, statusContainer) {
    if (closeBtn && statusEl && statusContainer) {
        closeBtn.addEventListener('click', () => {
            statusEl.textContent = '';
        });
    }
}

export function updateAddButtonVisibility(containerId, addBtnId) {
    const container = document.getElementById(containerId);
    const addBtn = document.getElementById(addBtnId);
    if (!container || !addBtn) return;
    addBtn.classList.remove('hidden');
}

export function createModelItem(defaultFormat) {
    const div = document.createElement('div');
    div.className = 'flex gap-1 items-center';
    const openaiSelected = defaultFormat === 'openai' ? 'selected' : '';
    const geminiSelected = defaultFormat === 'gemini' ? 'selected' : '';
    div.innerHTML = `
        <select class="w-10 px-1 py-1 text-xs rounded border border-gray-200 bg-white model-format-select">
            <option value="openai" ${openaiSelected} title="OpenAI格式">O</option>
            <option value="gemini" ${geminiSelected} title="Gemini格式">G</option>
        </select>
        <input type="text" placeholder="模型名称" class="flex-1 px-2 py-1 text-xs rounded border border-gray-200">
        <button type="button" class="text-red-500 hover:text-red-700 text-xs model-delete-btn">×</button>
    `;
    return div;
}

export function generateDebugGrid() {
    const svg = document.getElementById('debugGridSvg');
    if (!svg) return;
    
    let svgContent = '';
    
    for (let i = 0; i <= 100; i++) {
        const pos = i * 100;
        svgContent += `<line x1="${pos}" y1="0" x2="${pos}" y2="10000" stroke="#00ff00" stroke-width="1" stroke-opacity="0.2"/>`;
        svgContent += `<line x1="0" y1="${pos}" x2="10000" y2="${pos}" stroke="#00ff00" stroke-width="1" stroke-opacity="0.2"/>`;
    }
    
    for (let row = 1; row <= 100; row++) {
        for (let col = 1; col <= 100; col++) {
            const x = (col - 1) * 100 + 50;
            const y = (row - 1) * 100 + 50;
            svgContent += `<text x="${x}" y="${y}" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#00ff00" fill-opacity="0.5">${row}.${col}</text>`;
        }
    }
    
    svg.innerHTML = svgContent;
}

export function findNodeByImageUrl(imageUrl, container) {
    const nodes = container.querySelectorAll('.canvas-node');
    for (let node of nodes) {
        if (node.dataset.imageUrl === imageUrl) {
            return node;
        }
    }
    return null;
}

export function adjustTooltipPosition(tooltip, targetElement) {
    if (!tooltip || !targetElement) return;
    
    const targetRect = targetElement.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 300;
    const tooltipHeight = tooltipRect.height || 300;
    
    let left = targetRect.left - tooltipWidth - 12;
    let top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
    
    if (left < 10) {
        left = targetRect.right + 12;
    }
    if (top < 10) top = 10;
    if (top + tooltipHeight > windowHeight - 10) {
        top = windowHeight - tooltipHeight - 10;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

export function updateVideoResolutionOptions(modelValue, durationValue, videoResolutionSelect) {
    let model = null;
    if (window.dynamicProviderManager) {
        const allModels = window.dynamicProviderManager.getAllModels();
        const videoModels = allModels.video || [];
        model = videoModels.find(m => m.value === modelValue);
    }
    if (!model) {
        model = VIDEO_MODELS.find(m => m.value === modelValue);
    }
    
    if (model && model.params && model.params.resolutions && model.params.resolutions[durationValue]) {
        const resolutions = model.params.resolutions[durationValue];
        videoResolutionSelect.innerHTML = '';
        resolutions.forEach(res => {
            const option = document.createElement('option');
            option.value = res;
            option.textContent = res;
            videoResolutionSelect.appendChild(option);
        });
        videoResolutionSelect.value = resolutions[0];
    } else if (model && model.params && Object.keys(model.params.resolutions).length === 0) {
        videoResolutionSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '不支持指定';
        option.disabled = true;
        videoResolutionSelect.appendChild(option);
    } else {
        videoResolutionSelect.innerHTML = '';
        ['720p', '1080p', '4k'].forEach(res => {
            const option = document.createElement('option');
            option.value = res;
            option.textContent = res;
            videoResolutionSelect.appendChild(option);
        });
    }
}
