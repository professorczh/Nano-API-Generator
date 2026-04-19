/**
 * History Manager - 资产管理层核心逻辑
 * 负责从 JSONL 读取数据、渲染网格、搜索过滤以及一键复用
 */
import { getIcon } from './icons.js';
import { debugLog } from './utils.js';
import { parseRatio, NodeFactory } from './node-factory.js';
import { AppState, CanvasState } from './app-state.js';
import { selectNode, createImageNode } from './node-manager.js';
import { updateMinimapWithImage } from './canvas-manager.js';

class HistoryManager {
    constructor() {
        this.records = [];
        this.filteredRecords = [];
        this.currentPage = 1;
        this.itemsPerPage = 30;
        this.currentModality = 'all';
        this.searchQuery = '';
        this.isActive = false;
        
        // DOM Elements
        this.elements = {};
        
        // 防抖
        this.searchTimeout = null;
    }

    init() {
        this.elements = {
            layer: document.getElementById('history-layer'),
            grid: document.getElementById('hl-grid'),
            closeBtn: document.getElementById('hl-close-btn'),
            searchInput: document.getElementById('hl-search-input'),
            filterChips: document.querySelectorAll('.hl-filter-chip'),
            stats: document.getElementById('hl-stats'),
            prevBtn: document.getElementById('hl-prev-page'),
            nextBtn: document.getElementById('hl-next-page'),
            pageInfo: document.getElementById('hl-page-info'),
            drawer: document.getElementById('hl-drawer'),
            drawerContent: document.getElementById('hl-drawer-content'),
            drawerHide: document.getElementById('hl-drawer-hide'),
            envTip: document.getElementById('hl-env-tip'),
            canvas: document.getElementById('canvas-container') || document.querySelector('.tl-container') || document.body
        };

        this.bindEvents();
        window.historyManager = this;
    }

    bindEvents() {
        this.elements.closeBtn.addEventListener('click', () => this.hide());
        this.elements.drawerHide.addEventListener('click', () => this.hideDrawer());
        
        // 搜索防抖
        this.elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchQuery = e.target.value.toLowerCase();
            this.searchTimeout = setTimeout(() => {
                this.currentPage = 1;
                this.applyFilters();
            }, 300);
        });

        // 分型过滤
        this.elements.filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                this.elements.filterChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentModality = chip.dataset.type;
                this.currentPage = 1;
                this.applyFilters();
            });
        });

        // 分页
        this.elements.prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderGrid();
            }
        });
        this.elements.nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredRecords.length / this.itemsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderGrid();
            }
        });
    }

    async show() {
        this.isActive = true;
        this.elements.layer.classList.add('active');
        document.body.classList.add('hl-active');
        
        if (this.records.length === 0) {
            await this.loadData();
        } else {
            this.applyFilters();
        }
    }

    hide() {
        this.isActive = false;
        this.elements.layer.classList.remove('active');
        document.body.classList.remove('hl-active');
        this.hideDrawer();
    }

    async loadData() {
        this.elements.stats.textContent = '正在读取数据库...';
        
        try {
            // 环境检测：尝试读取生产环境 JSONL
            let response = await fetch('./DL/history.jsonl');
            let isOnline = false;

            if (!response.ok) {
                console.warn('[History] 生产环境 history.jsonl 未找到，切换至 Demo 模式');
                response = await fetch('./DL/demo_history.jsonl');
                isOnline = true;
            }

            if (isOnline) {
                this.elements.envTip.style.display = 'block';
            }

            const text = await response.text();
            const lines = text.trim().split('\n');
            
            // 解析并反转 (最新优先)
            this.records = lines
                .filter(line => line.trim())
                .map(line => JSON.parse(line))
                .reverse();

            this.applyFilters();
            debugLog(`[History] 成功加载 ${this.records.length} 条资产记录`, 'success');
        } catch (error) {
            console.error('[History] 加载失败:', error);
            this.elements.stats.textContent = '数据库读取失败';
        }
    }

    applyFilters() {
        this.filteredRecords = this.records.filter(record => {
            const matchesModality = this.currentModality === 'all' || record.type === this.currentModality;
            const matchesSearch = !this.searchQuery || 
                                record.prompt.toLowerCase().includes(this.searchQuery) ||
                                (record.params && record.params.model && record.params.model.toLowerCase().includes(this.searchQuery));
            return matchesModality && matchesSearch;
        });

        this.elements.stats.textContent = `共记录 ${this.records.length} 条 | 筛选出 ${this.filteredRecords.length} 条`;
        this.renderGrid();
    }

    renderGrid() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageItems = this.filteredRecords.slice(start, end);
        
        // 清理旧节点防止内存泄漏
        this.elements.grid.innerHTML = '';
        
        if (pageItems.length === 0) {
            this.elements.grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 100px; color: #64748b;">没有找到相关资产</div>`;
        } else {
            pageItems.forEach(record => {
                const card = this.createCard(record);
                this.elements.grid.appendChild(card);
            });
        }

        this.updatePagination();
    }

    createCard(record) {
        const card = document.createElement('div');
        card.className = 'hl-card';
        
        // 预览内容
        let previewHtml = '';
        const assetPath = `./DL/${record.path}`;

        if (record.type === 'video') {
            const posterAttr = record.thumbnail ? `poster="./DL/${record.thumbnail}"` : '';
            previewHtml = `
                <video muted loop preload="metadata" data-src="${assetPath}" ${posterAttr}>
                    <source src="${assetPath}#t=0.1" type="video/mp4">
                </video>
                <div class="hl-card-type-tag">VIDEO</div>
            `;
        } else if (record.type === 'image') {
            previewHtml = `
                <img src="${assetPath}" loading="lazy" alt="preview">
                <div class="hl-card-type-tag">IMAGE</div>
            `;
        } else if (record.type === 'audio') {
            previewHtml = `
                <div style="height: 100%; display: flex; align-items: center; justify-content: center; background: #1e293b; font-size: 40px;">🎵</div>
                <div class="hl-card-type-tag">AUDIO</div>
            `;
        }

        // 格式化时间
        const date = new Date(record.timestamp);
        const timeStr = isNaN(date.getTime()) ? record.timestamp : date.toLocaleString();
        const displayPrompt = record.prompt && record.prompt !== 'undefined' ? record.prompt : '(无提示词/上传资产)';

        card.innerHTML = `
            <div class="hl-card-preview">${previewHtml}</div>
            <div class="hl-card-info">
                <div class="hl-card-time">${timeStr}</div>
                <div class="hl-card-meta">
                    <div class="hl-card-meta-item model" title="使用模型: ${record.params?.model || '未知'}">
                        ${getIcon('cpu', 12)}
                        <span>${(record.params?.model || '未知').split('/').pop().split('-').slice(0,2).join('-')}</span>
                    </div>
                    ${record.params?.ratio || record.params?.aspectRatio ? `
                    <div class="hl-card-meta-item ratio" title="纵横比">
                        ${getIcon('crop', 10)}
                        <span>${record.params.ratio || record.params.aspectRatio}</span>
                    </div>` : ''}
                    ${record.params?.size ? `
                    <div class="hl-card-meta-item res" title="分辨率/规格">
                        ${getIcon('maximize', 10)}
                        <span>${record.params.size}</span>
                    </div>` : ''}
                    ${record.params?.duration ? `
                    <div class="hl-card-meta-item len" title="时长">
                        ${getIcon('play', 10)}
                        <span>${record.params.duration}s</span>
                    </div>` : ''}
                    <div class="hl-card-meta-item time" title="生成耗时">
                        ${getIcon('clock', 12)}
                        <span>${record.generation_time ? record.generation_time.toFixed(1) + 's' : '--'}</span>
                    </div>
                </div>
                <div class="hl-card-prompt">${displayPrompt}</div>
                <div class="hl-card-actions">
                    <button class="hl-btn-reuse" data-action="reuse">
                        <span>⚡</span> 一键复用
                    </button>
                    <button class="hl-btn-link" title="查看详情">
                        <span>👁️</span>
                    </button>
                </div>
            </div>
        `;

        // 事件监听
        card.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'reuse') {
                this.reuseRecord(record);
            } else {
                this.showDetails(record);
            }
        });

        // 视频 Hover 播放
        if (record.type === 'video') {
            const video = card.querySelector('video');
            card.addEventListener('mouseenter', () => {
                const src = video.dataset.src;
                if (!video.src.includes(src)) video.src = src; // Lazy full load on hover
                video.play().catch(() => {});
            });
            card.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0.1;
            });
        }

        return card;
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredRecords.length / this.itemsPerPage) || 1;
        this.elements.pageInfo.textContent = `第 ${this.currentPage} / ${totalPages} 页`;
        this.elements.prevBtn.disabled = this.currentPage === 1;
        this.elements.nextBtn.disabled = this.currentPage === totalPages;
    }

    showDetails(record) {
        const assetPath = `./DL/${record.path}`;
        let previewHtml = '';
        
        if (record.type === 'video') {
            previewHtml = `<video controls muted style="width: 100%"><source src="${assetPath}" type="video/mp4"></video>`;
        } else if (record.type === 'image') {
            previewHtml = `<img src="${assetPath}" style="width: 100%; border-radius: 8px;">`;
        } else if (record.type === 'audio') {
            previewHtml = `<audio controls style="width: 100%"><source src="${assetPath}"></audio>`;
        }

        this.elements.drawerContent.innerHTML = `
            <div class="hl-drawer-preview">${previewHtml}</div>
            <div>
                <div class="hl-drawer-section-title">Prompt</div>
                <div class="hl-drawer-prompt">${record.prompt}</div>
            </div>
            <div>
                <div class="hl-drawer-section-title">Core Parameters</div>
                <pre class="hl-drawer-params">${JSON.stringify(record.params, null, 2)}</pre>
            </div>
            <button class="hl-btn-reuse" style="height: 44px; margin-top: 20px;" id="hl-detail-reuse">
                <span>⚡</span> 立即应用这些参数到画布
            </button>
        `;

        document.getElementById('hl-detail-reuse').onclick = () => this.reuseRecord(record);
        this.elements.drawer.classList.add('active');
    }

    hideDrawer() {
        this.elements.drawer.classList.remove('active');
    }

    /**
     * 核心功能：将历史记录节点还原到画布
     */
    restoreNodeToCanvas(record) {
        if (!window.NodeFactory) {
            console.error('[History] NodeFactory not found');
            return;
        }

        const recordType = record.type || 'image';

        // 1. 确定位置：优先使用记录中的原始坐标，否则使用屏幕中心
        let targetX, targetY;
        
        // 预估节点尺寸以便居中计算
        let estWidth = 400;
        let estHeight = 300;
        const axisSize = 300; // 基准轴长度

        if (recordType === 'video' || recordType === 'image') {
            const ratioStr = (record.params?.ratio || record.params?.aspectRatio || '1:1').replace('x', ':');
            const ratio = parseRatio(ratioStr);
            if (ratio >= 1) {
                estWidth = Math.round(axisSize * ratio);
                estHeight = axisSize;
            } else {
                estWidth = axisSize;
                estHeight = Math.round(axisSize / ratio);
            }
            debugLog(`[History] 检测到比例 ${ratioStr} (${ratio.toFixed(2)}), 规格化尺寸: ${estWidth}x${estHeight}`, 'info');
        }

        if (record.metadata?.canvas_pos) {
            targetX = record.metadata.canvas_pos.x;
            targetY = record.metadata.canvas_pos.y;
            debugLog(`[History] 使用原始坐标还原: (${targetX}, ${targetY})`, 'info');
        } else {
            // 计算视口中心对应的画布逻辑坐标
            const uiPanelWidth = document.getElementById('uiPanel')?.offsetWidth || 400;
            const viewportCenterX = (window.innerWidth - uiPanelWidth) / 2;
            const viewportCenterY = window.innerHeight / 2;
            
            const scale = AppState.scale || 1;
            const panX = AppState.panX || 0;
            const panY = AppState.panY || 0;
            
            // 计算逻辑上的中心点，并减去节点宽度的一半以达到真正的居中效果
            targetX = Math.round((viewportCenterX - panX) / scale) - (estWidth / 2);
            targetY = Math.round((viewportCenterY - panY) / scale) - (estHeight / 2);
            debugLog(`[History] 使用视口中心还原 (已对齐偏移): (${targetX}, ${targetY})`, 'info');
        }

        // 2. 创建节点外壳 (占位符)
        const prompt = record.prompt || '';
        const rawModel = record.params?.model || 'Unknown';
        const protocol = record.params?.protocol || '';
        const modelDisplayName = { name: rawModel, provider: protocol };
        const genTime = record.generation_time || 0;
        
        let node;
        const container = document.getElementById('imageResponseContainer');
        
        if (recordType === 'video') {
            const ratio = record.params?.ratio || '16:9';
            node = NodeFactory.createVideoPlaceholder(targetX, targetY, prompt, modelDisplayName, ratio);
        } else if (recordType === 'audio') {
            node = NodeFactory.createAudioPlaceholder(targetX, targetY, prompt, modelDisplayName);
        } else {
            // Image (或默认) - 使用计算出的长宽比
            const resStr = record.params?.size || `${estWidth}x${estHeight}`;
            node = createImageNode('', prompt, CanvasState.nodeCounter++, 'Loading', resStr, genTime, modelDisplayName, '');
            node.style.left = `${targetX}px`;
            node.style.top = `${targetY}px`;
            node.style.width = `${estWidth}px`;
            node.style.height = `${estHeight}px`;
        }

        if (container && node) {
            container.appendChild(node);
            
            // 3. 立即填充本地资产路径 (跳过生成过程)
            const assetPath = `./DL/${record.path}`;
            
            if (recordType === 'video') {
                NodeFactory.replaceWithVideo(node, assetPath, prompt, rawModel, genTime, record.params?.ratio);
            } else if (recordType === 'audio') {
                const lyrics = record.params?.lyrics || '';
                const caption = record.params?.caption || '';
                NodeFactory.replaceWithAudio(node, assetPath, prompt, rawModel, genTime, record.params?.format, lyrics, caption);
            } else {
                // Image: 模拟完成替换
                const img = node.querySelector('img');
                if (img) {
                    img.src = assetPath;
                    img.classList.remove('loading-blur');
                    const statusTag = node.querySelector('.status-tag');
                    if (statusTag) statusTag.textContent = 'RESTORED';
                }
            }

            // 4. 选定并更新小地图
            selectNode(node);
            updateMinimapWithImage(node);
            
            // 5. 注入元数据 (确保溯源功能正常)
            // 将历史参数回填至节点 dataset
            if (record.params) {
                node.dataset.modelName = typeof record.params.model === 'object' ? JSON.stringify(record.params.model) : (record.params.model || '');
                node.dataset.protocol = record.params.protocol || '';
                node.dataset.aspectRatio = record.params.ratio || '';
                node.dataset.duration = record.params.duration || '';
            }
            if (record.generation_time !== undefined) {
                node.dataset.generationTime = record.generation_time; 
            }
            if (record.prompt) {
                node.dataset.prompt = record.prompt;
            }
        }
    }

    reuseRecord(record) {
        if (!window.promptPanelManager) {
            console.error('[History] 找不到 PromptPanelManager 实例');
            return;
        }

        debugLog(`[History] 正在迁移资产参数: ${record.prompt.substring(0, 20)}...`, 'info');

        // 构建应用状态
        const state = {
            mode: record.type === 'text' ? 'text' : (record.type || 'image'),
            prompt: record.prompt,
            modelName: record.params?.model || '',
            modelProvider: record.params?.protocol || '',
            temperature: 0.7, // 默认回填
            topP: 0.9,
            imageConfig: {
                aspectRatio: record.params?.ratio,
                imageSize: record.params?.size
            },
            videoConfig: {
                videoRatio: record.params?.ratio,
                videoResolution: record.params?.resolution || record.params?.size,
                videoDuration: record.params?.duration
            },
            audioConfig: {
                audioDuration: record.params?.duration,
                audioFormat: record.params?.format
            }
        };

        // 执行：参数复用
        window.promptPanelManager.applyState(state);
        
        // 执行：节点还原到画布
        this.restoreNodeToCanvas(record);

        // 检查模型匹配
        this.checkModelFidelity(state);

        // 隐藏涂层返回画布
        this.hide();
        this.hideDrawer();
        
        debugLog('[History] 资产已成功复原至画布！提示词已同步回填。', 'success');
    }

    checkModelFidelity(state) {
        // 简单的逻辑判断模型是否存在（简化版，实际需通过 ModelSelectManager 检查）
        if (state.modelName && !document.querySelector(`option[value="${state.modelName}"]`)) {
            // 轻量提示
            debugLog(`⚠️ 历史配置中的模型 [${state.modelName}] 当前不可用，已为您保留当前所选模型。`, 'warning');
        }
    }
}

// 自动初始化
const historyManager = new HistoryManager();
document.addEventListener('DOMContentLoaded', () => {
    historyManager.init();
});

export { historyManager };
