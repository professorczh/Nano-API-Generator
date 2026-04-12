// 工具函数

import { CONFIG, IMAGE_RATIOS, IMAGE_SIZES, VIDEO_MODELS } from "../config.js";
import { getIcon } from "./icons.js";
import { DebugConsole } from "./debug-console.js";

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

/**
 * 渲染模型标签
 */
export function renderModelTag(container, modelName) {
    if (!modelName) return;
    
    const modelTag = document.createElement('div');
    modelTag.className = 'node-model-tag';
    modelTag.style.display = (typeof DebugConsole !== 'undefined' && DebugConsole.showModelTag) ? 'block' : 'none';
    
    let displayName = modelName;
    let providerName = '';
    
    if (typeof modelName === 'object' && modelName.name) {
        displayName = modelName.name;
        providerName = modelName.provider || '';
    } else if (typeof modelName === 'string' && modelName.includes('(')) {
        const parts = modelName.split('(');
        displayName = parts[0].trim();
        providerName = parts[1].replace(')', '').trim();
    }
    
    if (providerName) {
        modelTag.innerHTML = `<span class="model-name">${displayName}</span><span class="model-sep">·</span><span class="model-provider">${providerName.toUpperCase()}</span>`;
        modelTag.title = `${displayName} (${providerName})`;
    } else {
        modelTag.innerHTML = `<span class="model-name">${displayName}</span>`;
        modelTag.title = displayName;
    }
    
    container.appendChild(modelTag);
}

/**
 * 统一创建节点页眉
 */
export function createNodeHeader(type, metadataText, fileName) {
    const header = document.createElement('div');
    header.className = 'node-header';
    
    const iconName = type === 'image' ? 'image' : 
                   type === 'video' ? 'video' : 
                   type === 'audio' ? 'music' : 'file-text';
    
    const displayName = fileName || (type.charAt(0).toUpperCase() + type.slice(1));

    header.innerHTML = `
        <div class="node-filename">
            ${getIcon(iconName, 14)}
            <span>${displayName}</span>
        </div>
        <div class="node-resolution">${metadataText || ''}</div>
    `;
    return header;
}

/**
 * 统一创建节点侧边栏
 */
export function createNodeSidebar(generationTime, modelName) {
    const sidebar = document.createElement('div');
    sidebar.className = 'node-sidebar';
    
    // 计时器 - 确保在生成中和完成后都以一致的 UI 显示
    const timeElement = document.createElement('div');
    timeElement.className = 'node-generation-time';
    // 默认可见，除非 DEBUG 模式明确关闭
    timeElement.style.display = (typeof DebugConsole !== 'undefined' && DebugConsole.showGenerationTime === false) ? 'none' : 'flex';
    
    const displayTime = generationTime ? formatGenerationTime(generationTime).replace('⏱️', '').trim() : '0.0s';
    timeElement.innerHTML = `${getIcon('clock', 12)} <span>${displayTime}</span>`;
    timeElement.title = generationTime ? `生成耗时: ${generationTime.toFixed(2)}秒` : '计时中...';
    sidebar.appendChild(timeElement);
    
    if (modelName) {
        renderModelTag(sidebar, modelName);
    }
    
    return sidebar;
}

/**
 * 统一创建节点信息面板 (Prompt)
 */
export function createNodeInfo(prompt, fallbackText) {
    const info = document.createElement('div');
    info.className = 'node-info';
    info.textContent = prompt || fallbackText;
    info.title = '点击复制提示词';
    
    info.addEventListener('click', (e) => {
        e.stopPropagation();
        const textToCopy = prompt || info.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            info.classList.add('copied');
            setTimeout(() => info.classList.remove('copied'), 500);
        });
    });
    
    return info;
}
/**
 * 统一创建节点工具栏
 */
export function createNodeToolbar(type, callbacks = {}) {
    const toolbar = document.createElement('div');
    toolbar.className = 'node-toolbar';
    
    // 终极标准化：全模态固定 4 位工具栏配置
    const buttons = [
        { 
            id: 'copyContent', 
            icon: 'copy', 
            title: (type === 'text') ? '复制文本内容' : '复制生成提示词', 
            action: callbacks.onCopyText || callbacks.onCopyPrompt,
            disabled: !(callbacks.onCopyText || callbacks.onCopyPrompt)
        },
        { 
            id: 'insertPrompt', 
            icon: 'at-sign', 
            title: '引用到输入框 (@)', 
            action: callbacks.onInsertPrompt,
            // 文字节点目前暂不支持引用，或者待进一步指令，目前根据模态开启
            disabled: (type === 'text') || !callbacks.onInsertPrompt 
        },
        { 
            id: 'editNode', 
            icon: 'edit', 
            title: '加载溯源参数 (悬停预览 / 点击编辑)', 
            action: callbacks.onRecallNode,             // 点击确认
            enter: callbacks.onPreviewStart,          // 悬停进入
            leave: callbacks.onPreviewEnd,            // 悬停离开
            disabled: !callbacks.onRecallNode 
        },
        { 
            id: 'deleteNode', 
            icon: 'trash', 
            title: '删除节点', 
            action: callbacks.onDelete, 
            danger: true,
            disabled: !callbacks.onDelete 
        }
    ];

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `toolbar-btn ${btn.danger ? 'danger' : ''}`;
        button.id = btn.id;   // 核心修复：确保 btn.id 实际赋值到 DOM 的 id 属性
        button.title = btn.title;
        button.innerHTML = getIcon(btn.icon, 14); 
        
        if (btn.disabled) {
            button.disabled = true;
        }

        button.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        }, { capture: true });

        // 处理悬停预览 (核心修复：移除 !btn.disabled 判断，确保监听器始终挂载)
        if (btn.enter) {
            button.addEventListener('mouseenter', (e) => {
                if (!button.disabled) btn.enter(e);
            });
        }
        if (btn.leave) {
            button.addEventListener('mouseleave', (e) => {
                if (!button.disabled) btn.leave(e);
            });
        }

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!button.disabled && typeof btn.action === 'function') {
                btn.action(e);
            }
        });
        
        toolbar.appendChild(button);
    });

    return toolbar;
}
