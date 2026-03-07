// 主入口文件 - 整合所有模块

import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG, TEXT_MODELS, IMAGE_MODELS, VIDEO_MODELS, VIDEO_RATIOS, IMAGE_RATIOS, IMAGE_SIZES, getProviderByModelId, migrateOldStorageFormat, getModelDisplayName } from "../config.js";
import { AppState, minimapDragStartX, minimapDragStartY, minimapPanStartX, minimapPanStartY } from "./app-state.js";
import { PinManager } from "./pin-manager.js";
import { apiClient, initializeAPIClient } from "./api-client.js";
import { ProviderManager } from "./providers.js";
import { UIManager } from "./ui.js";
import "./node-factory.js";
import { SettingsPanel } from "./settings-panel.js";
import { ModelSelectManager } from "./model-selects.js";
import { EventHandler } from "./event-handlers.js";
import { CanvasOperations } from "./canvas-operations.js";
import { ApiOperations } from "./api-operations.js";
import { debugLog, updateAllNodeTimeVisibility, updateAllNodeModelTagVisibility } from "./utils.js";

class Application {
    constructor() {
        this.currentMode = 'image';
        this.showMouseLogs = false;
        this.showGenerationTime = true;
        this.showModelTag = true;
        this.nodeCounter = 0;
        this.pinCounter = 0;
        this.imagePins = new Map();
        this.selectedNode = null;
        this.panzoom = null;
        
        this.initElements();
        this.initModules();
        this.initEventListeners();
        this.loadSavedSettings();
    }
    
    initElements() {
        this.sendBtn = document.getElementById('sendBtn');
        this.promptInput = document.getElementById('promptInput');
        this.loader = document.getElementById('loader');
        this.statusTag = document.getElementById('statusTag');
        this.videoModelNameWrapper = document.getElementById('videoModelNameWrapper');
        this.videoRatioSelect = document.getElementById('videoRatioSelect');
        this.tabText = document.getElementById('tabText');
        this.tabImage = document.getElementById('tabImage');
        this.tabVideo = document.getElementById('tabVideo');
        this.imageGenOptions = document.getElementById('imageGenOptions');
        this.aspectRatio = document.getElementById('aspectRatio');
        this.imageSize = document.getElementById('imageSize');
        this.temperature = document.getElementById('temperature');
        this.topP = document.getElementById('topP');
        this.temperatureValue = document.getElementById('temperatureValue');
        this.topPValue = document.getElementById('topPValue');
        this.imageModelNameWrapper = document.getElementById('imageModelNameWrapper');
        this.imageResponseContainer = document.getElementById('imageResponseContainer');
        this.canvasViewport = document.getElementById('canvasViewport');
        this.canvas = document.getElementById('canvas');
        this.debugConsole = document.getElementById('debugConsole');
        this.debugConsoleContent = document.getElementById('debugConsoleContent');
        this.debugConsoleClear = document.getElementById('debugConsoleClear');
        this.debugConsoleHeader = document.querySelector('.debug-console-header');
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapViewport = document.getElementById('minimapViewport');
    }
    
    initModules() {
        PinManager.setPromptInput(this.promptInput);
        
        this.settingsPanel = new SettingsPanel();
        this.modelSelectManager = new ModelSelectManager();
        this.eventHandler = new EventHandler();
        this.apiOperations = new ApiOperations();
        
        this.canvasOperations = new CanvasOperations(
            this.panzoom,
            this.canvas,
            this.canvasViewport,
            this.imageResponseContainer,
            this.minimapCanvas,
            this.minimapViewport
        );
        
        initializeAPIClient({
            promptInput: this.promptInput,
            debugLog: (message, type) => debugLog(message, type, this.debugConsoleContent),
            statusTag: this.statusTag,
            loader: this.loader
        });
    }
    
    initEventListeners() {
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.handleSend());
        }
        
        if (this.promptInput) {
            this.promptInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSend();
                }
            });
        }
        
        if (this.tabText) {
            this.tabText.addEventListener('click', () => this.switchMode('text'));
        }
        if (this.tabImage) {
            this.tabImage.addEventListener('click', () => this.switchMode('image'));
        }
        if (this.tabVideo) {
            this.tabVideo.addEventListener('click', () => this.switchMode('video'));
        }
        
        if (this.temperature) {
            this.temperature.addEventListener('input', (e) => {
                this.temperatureValue.textContent = e.target.value;
            });
        }
        
        if (this.topP) {
            this.topP.addEventListener('input', (e) => {
                this.topPValue.textContent = e.target.value;
            });
        }
        
        if (this.debugConsoleHeader) {
            this.debugConsoleHeader.addEventListener('click', () => {
                this.debugConsole.classList.toggle('collapsed');
                this.updateToolbarPosition();
            });
        }
        
        if (this.debugConsoleClear) {
            this.debugConsoleClear.addEventListener('click', (e) => {
                e.stopPropagation();
                const logs = this.debugConsoleContent.querySelectorAll('.debug-log');
                logs.forEach(log => log.remove());
            });
        }
    }
    
    loadSavedSettings() {
        const saved12AIKey = window.ENV?.['12AI_API_KEY'] || localStorage.getItem('12AI_API_KEY') || '';
        
        migrateOldStorageFormat();
        
        if (saved12AIKey) {
            CONFIG.TWELVE_AI_API_KEY = saved12AIKey;
            apiClient.update12AIKey(saved12AIKey);
        }
        
        const savedModelName = localStorage.getItem('GEMINI_MODEL_NAME');
        const savedModelProvider = localStorage.getItem('GEMINI_MODEL_PROVIDER');
        if (savedModelName) {
            CONFIG.MODEL_NAME = savedModelName;
        }
        if (savedModelProvider) {
            CONFIG.MODEL_PROVIDER = savedModelProvider;
        }
        
        const savedImageModelName = localStorage.getItem('GEMINI_IMAGE_MODEL_NAME');
        const savedImageModelProvider = localStorage.getItem('GEMINI_IMAGE_MODEL_PROVIDER');
        if (savedImageModelName) {
            CONFIG.IMAGE_MODEL_NAME = savedImageModelName;
        }
        if (savedImageModelProvider) {
            CONFIG.IMAGE_MODEL_PROVIDER = savedImageModelProvider;
        }
        
        const savedVideoModelName = localStorage.getItem('GEMINI_VIDEO_MODEL_NAME');
        const savedVideoModelProvider = localStorage.getItem('GEMINI_VIDEO_MODEL_PROVIDER');
        if (savedVideoModelName) {
            CONFIG.VIDEO_MODEL_NAME = savedVideoModelName;
        }
        if (savedVideoModelProvider) {
            CONFIG.VIDEO_MODEL_PROVIDER = savedVideoModelProvider;
        }
        
        const savedShowTime = localStorage.getItem('showGenerationTime');
        if (savedShowTime !== null) {
            this.showGenerationTime = savedShowTime === 'true';
            window.showGenerationTime = this.showGenerationTime;
        }
        
        const savedShowModelTag = localStorage.getItem('showModelTag');
        if (savedShowModelTag !== null) {
            this.showModelTag = savedShowModelTag === 'true';
            window.showModelTag = this.showModelTag;
        }
    }
    
    switchMode(mode) {
        this.currentMode = mode;
        window.currentMode = mode;
        
        [this.tabText, this.tabImage, this.tabVideo].forEach(tab => {
            if (tab) {
                tab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
                tab.classList.add('text-gray-500');
            }
        });
        
        const activeTab = mode === 'text' ? this.tabText : mode === 'image' ? this.tabImage : this.tabVideo;
        if (activeTab) {
            activeTab.classList.remove('text-gray-500');
            activeTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        }
        
        if (this.imageGenOptions) {
            this.imageGenOptions.style.display = mode === 'image' ? 'block' : 'none';
        }
    }
    
    handleSend() {
        const prompt = this.promptInput.value.trim();
        if (!prompt) return;
        
        if (this.currentMode === 'text') {
            this.handleTextGeneration(prompt);
        } else if (this.currentMode === 'image') {
            this.handleImageGeneration(prompt);
        } else if (this.currentMode === 'video') {
            this.handleVideoGeneration(prompt);
        }
    }
    
    handleTextGeneration(prompt) {
        debugLog(`[文本生成] 开始生成: ${prompt}`, 'info', this.debugConsoleContent);
    }
    
    handleImageGeneration(prompt) {
        debugLog(`[图片生成] 开始生成: ${prompt}`, 'info', this.debugConsoleContent);
    }
    
    handleVideoGeneration(prompt) {
        debugLog(`[视频生成] 开始生成: ${prompt}`, 'info', this.debugConsoleContent);
    }
    
    updateToolbarPosition() {
        const miniToolbar = document.getElementById('miniToolbar');
        const canvasMinimap = document.getElementById('canvasMinimap');
        
        if (!miniToolbar || !this.debugConsole) return;
        
        const isCollapsed = this.debugConsole.classList.contains('collapsed');
        const debugConsoleHeight = isCollapsed ? 24 : 364;
        const toolbarBottom = debugConsoleHeight + 16;
        
        miniToolbar.style.bottom = `${toolbarBottom}px`;
        
        const minimapBottom = debugConsoleHeight + 16;
        if (canvasMinimap) {
            canvasMinimap.style.bottom = `${minimapBottom}px`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new Application();
});
