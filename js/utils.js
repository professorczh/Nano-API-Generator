// 工具函数

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

export function debugLog(message, type = 'info', debugConsoleContent) {
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
