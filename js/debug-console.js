// 调试控制台模块

export class DebugConsole {
    static debugConsoleContent = null;
    static debugConsoleHeader = null;
    static debugConsoleClear = null;
    static debugConsole = null;
    static canvasCenterMarker = null;
    static debugGrid = null;
    static imageResponseContainer = null;
    static showMouseLogs = false;
    static showGenerationTime = true;
    static showModelTag = true;
    static sampleImageNode = null;
    
    static init(options) {
        this.debugConsole = options.debugConsole;
        this.debugConsoleContent = options.debugConsoleContent;
        this.debugConsoleHeader = options.debugConsoleHeader;
        this.debugConsoleClear = options.debugConsoleClear;
        this.canvasCenterMarker = options.canvasCenterMarker;
        this.debugGrid = options.debugGrid;
        this.imageResponseContainer = options.imageResponseContainer;
        
        this.showGenerationTime = options.showGenerationTime ?? true;
        this.showModelTag = options.showModelTag ?? true;
        
        this.setupEventListeners();
        this.loadSavedSettings();
    }
    
    static setupEventListeners() {
        console.log('DebugConsole.setupEventListeners called');
        console.log('debugConsoleHeader:', this.debugConsoleHeader);
        console.log('debugConsole:', this.debugConsole);
        
        if (this.debugConsoleHeader) {
            this.debugConsoleHeader.addEventListener('click', () => {
                this.debugConsole.classList.toggle('collapsed');
                if (typeof window.updateToolbarPosition === 'function') {
                    window.updateToolbarPosition();
                }
            });
        }
        
        if (this.debugConsoleClear) {
            this.debugConsoleClear.addEventListener('click', (e) => {
                e.stopPropagation();
                const logs = this.debugConsoleContent.querySelectorAll('.debug-log');
                logs.forEach(log => log.remove());
            });
        }
        
        this.setupToggleMarkers();
        this.setupToggleCoords();
        this.setupToggleGrid();
        this.setupToggleSample();
        this.setupToggleTime();
        this.setupToggleModelTag();
        this.setupToggleMouse();
    }
    
    static setupToggleMarkers() {
        const toggleMarker = document.getElementById('debugConsoleToggleMarker');
        if (toggleMarker && this.canvasCenterMarker) {
            this.canvasCenterMarker.classList.add('hidden');
            toggleMarker.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.canvasCenterMarker.classList.remove('hidden');
                } else {
                    this.canvasCenterMarker.classList.add('hidden');
                }
            });
        }
    }
    
    static setupToggleCoords() {
        const toggleCoords = document.getElementById('debugConsoleToggleCoords');
        if (toggleCoords) {
            const allCoordsElements = document.querySelectorAll('.node-center-coords');
            allCoordsElements.forEach(element => {
                element.style.display = 'none';
            });
            
            toggleCoords.addEventListener('change', (e) => {
                const allCoordsElements = document.querySelectorAll('.node-center-coords');
                allCoordsElements.forEach(element => {
                    element.style.display = e.target.checked ? 'block' : 'none';
                });
            });
        }
    }
    
    static setupToggleGrid() {
        const toggleGrid = document.getElementById('debugConsoleToggleGrid');
        if (toggleGrid && this.debugGrid) {
            this.debugGrid.classList.add('hidden');
            toggleGrid.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.debugGrid.classList.remove('hidden');
                } else {
                    this.debugGrid.classList.add('hidden');
                }
            });
        }
    }
    
    static setupToggleSample() {
        const toggleSample = document.getElementById('debugConsoleToggleSample');
        if (toggleSample) {
            toggleSample.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!this.sampleImageNode) {
                        this.sampleImageNode = this.imageResponseContainer?.querySelector('[data-filename="sample_image.png"]');
                        if (!this.sampleImageNode && typeof window.addSampleImage === 'function') {
                            window.addSampleImage();
                            this.sampleImageNode = this.imageResponseContainer?.querySelector('[data-filename="sample_image.png"]');
                        }
                    }
                    if (this.sampleImageNode) {
                        this.sampleImageNode.classList.remove('hidden');
                    }
                } else {
                    this.sampleImageNode = this.imageResponseContainer?.querySelector('[data-filename="sample_image.png"]');
                    if (this.sampleImageNode) {
                        this.sampleImageNode.classList.add('hidden');
                    }
                }
            });
        }
    }
    
    static setupToggleTime() {
        const toggleTime = document.getElementById('debugConsoleToggleTime');
        if (toggleTime) {
            toggleTime.addEventListener('change', (e) => {
                this.showGenerationTime = e.target.checked;
                window.showGenerationTime = this.showGenerationTime;
                localStorage.setItem('showGenerationTime', this.showGenerationTime);
                this.updateAllNodeTimeVisibility();
                this.log(`[生成耗时] ${this.showGenerationTime ? '显示' : '隐藏'}`, 'info');
            });
        }
    }
    
    static setupToggleModelTag() {
        const toggleModelTag = document.getElementById('debugConsoleToggleModelTag');
        if (toggleModelTag) {
            toggleModelTag.addEventListener('change', (e) => {
                this.showModelTag = e.target.checked;
                window.showModelTag = this.showModelTag;
                localStorage.setItem('showModelTag', this.showModelTag);
                this.updateAllNodeModelTagVisibility();
                this.log(`[模型标签] ${this.showModelTag ? '显示' : '隐藏'}`, 'info');
            });
        }
    }
    
    static setupToggleMouse() {
        const toggleMouse = document.getElementById('debugConsoleToggleMouse');
        if (toggleMouse) {
            toggleMouse.addEventListener('change', (e) => {
                this.showMouseLogs = e.target.checked;
                this.log(`[鼠标日志] ${this.showMouseLogs ? '启用' : '禁用'}`, 'info');
            });
        }
    }
    
    static loadSavedSettings() {
        const savedShowTime = localStorage.getItem('showGenerationTime');
        if (savedShowTime !== null) {
            this.showGenerationTime = savedShowTime === 'true';
            window.showGenerationTime = this.showGenerationTime;
            const toggleTime = document.getElementById('debugConsoleToggleTime');
            if (toggleTime) toggleTime.checked = this.showGenerationTime;
        }
        
        const savedShowModelTag = localStorage.getItem('showModelTag');
        if (savedShowModelTag !== null) {
            this.showModelTag = savedShowModelTag === 'true';
            window.showModelTag = this.showModelTag;
            const toggleModelTag = document.getElementById('debugConsoleToggleModelTag');
            if (toggleModelTag) toggleModelTag.checked = this.showModelTag;
        }
    }
    
    static log(message, type = 'info') {
        if (!this.debugConsoleContent) return;
        
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
        this.debugConsoleContent.appendChild(logEntry);
        this.debugConsoleContent.scrollTop = this.debugConsoleContent.scrollHeight;
        
        const maxLogs = 100;
        const logs = this.debugConsoleContent.querySelectorAll('.debug-log');
        if (logs.length > maxLogs) {
            for (let i = 0; i < logs.length - maxLogs; i++) {
                logs[i].remove();
            }
        }
    }
    
    static maskApiKey(apiKey) {
        if (!apiKey || apiKey.length < 6) return apiKey;
        return apiKey.substring(0, 3) + '*'.repeat(apiKey.length - 6) + apiKey.substring(apiKey.length - 3);
    }
    
    static formatGenerationTime(seconds) {
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
    
    static updateAllNodeTimeVisibility() {
        const timeLabels = document.querySelectorAll('.node-generation-time');
        timeLabels.forEach(label => {
            label.style.display = this.showGenerationTime ? 'flex' : 'none';
        });
    }
    
    static updateAllNodeModelTagVisibility() {
        const modelTags = document.querySelectorAll('.node-model-tag');
        modelTags.forEach(tag => {
            tag.style.display = this.showModelTag ? 'block' : 'none';
        });
    }
}

window.debugLog = (message, type = 'info') => DebugConsole.log(message, type);
