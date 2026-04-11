/**
 * 引用提及管理器 (MentionManager)
 * 负责监听 @ 触发器，弹出引用选择面板，并向输入框插入 Mention Tag
 */

import { referenceManager } from './reference-manager.js';
import { debugLog } from './utils.js';

class MentionManager {
    constructor() {
        this.promptInput = null;
        this.panel = null;
        this.activeRange = null; // 记录 @ 符号所在的位置
    }

    init(promptInput) {
        debugLog(`[Mention] 正在初始化管理器...`, 'info');
        if (this.initialized) {
            debugLog(`[Mention] 管理器已在运行中，跳过重复初始化`, 'warn');
            return;
        }
        this.promptInput = promptInput;
        this.selectedIndex = 0;
        this.activeRefs = [];
        this.lastAtTime = 0; // 冷却计时器
        
        this.statusIcon = document.getElementById('atStatusIcon');
        
        this._createPanel();
        this._bindEvents();
        
        // 初始化时更新一次指示器状态
        this.updateAtStatus();
        
        // 绑定货架更新监听
        if (referenceManager) {
            referenceManager.addUpdateListener(() => {
                this.updateAtStatus();
            });
        }

        // 绑定图标点击直接弹出面板
        if (this.statusIcon) {
            this.statusIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.statusIcon.classList.contains('active')) {
                    debugLog(`[Mention] 点击图标触发面板`, 'info');
                    this.promptInput.focus();
                    // 如果末尾没有 @，辅助插入一个（可选，根据用户习惯，这里先仅弹出面板）
                    this.showPanel(this.statusIcon);
                } else {
                    debugLog(`[Mention] 货架为空，图标点击无效`, 'warn');
                }
            });
        }

        this.initialized = true;
        debugLog(`[Mention] 管理器初始化完毕`, 'success');
    }

    updateAtStatus() {
        if (!this.statusIcon || !referenceManager) return;
        
        const refs = referenceManager.getAllReferences();
        const isActive = refs.length > 0;
        
        if (isActive) {
            this.statusIcon.classList.remove('inactive');
            this.statusIcon.classList.add('active');
            this.statusIcon.title = `@ 引用功能已激活 (当前货架有 ${refs.length} 个素材)`;
        } else {
            this.statusIcon.classList.remove('active');
            this.statusIcon.classList.add('inactive');
            this.statusIcon.title = `货架为空，@ 提及不可用`;
        }
    }

    _createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'mentionPanel';
        this.panel.className = 'mention-panel hidden';
        document.body.appendChild(this.panel);
    }

    _insertAtSymbol() {
        // 极速输入拦截：50ms 内不重复触发相同逻辑
        const now = Date.now();
        if (now - this.lastAtTime < 50) {
            debugLog(`[Mention] @ 触发过快，已拦截`, 'warn');
            return;
        }
        this.lastAtTime = now;

        const selection = window.getSelection();
        if (!selection.rangeCount) {
            debugLog(`[Mention] 无法获取选区，插入失败`, 'error');
            return;
        }
        
        const range = selection.getRangeAt(0);

        // 核心加固：检查光标处是否已经有了 @ (防止 preventDefault 失效导致的 @@)
        const textBefore = range.startContainer.textContent.substring(0, range.startOffset);
        if (textBefore.endsWith('@')) {
            debugLog(`[Mention] 检测到已有 @，跳过手动插入`, 'info');
            this.activeRange = range.cloneRange();
            return;
        }

        range.deleteContents();
        
        // 核心加固：创建特定的文本节点
        this.atTextNode = document.createTextNode('@');
        range.insertNode(this.atTextNode);
        
        // 移动光标到 @ 之后
        range.setStartAfter(this.atTextNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 记录当前状态
        this.activeRange = range.cloneRange();
        debugLog(`[Mention] 手动插入 @ 成功并更新 activeRange`, 'success');
    }

    _bindEvents() {
        // 组合输入保护 (针对于中文输入法等)
        this.promptInput.addEventListener('compositionstart', () => {
            this.isComposing = true;
        });
        this.promptInput.addEventListener('compositionend', () => {
            this.isComposing = false;
        });

        // 核心加固：使用 beforeinput 拦截字符插入，并移除 isComposing 限制
        this.promptInput.addEventListener('beforeinput', (e) => {
            if (e.data === '@') {
                e.preventDefault();
                debugLog(`[Mention] beforeinput 拦截到 @ (${e.inputType})`, 'info');
                this._insertAtSymbol();
                this.showPanel();
            }
        });

        this.promptInput.addEventListener('keydown', (e) => {
            // 面板可见时，接管特定按键
            if (this.panel && !this.panel.classList.contains('hidden')) {
                const keys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
                if (keys.includes(e.key)) {
                    // 如果正在输入拼音，且是 Enter，允许输入法完成输入，不拦截
                    if (this.isComposing && e.key === 'Enter') return;
                    
                    e.preventDefault();
                    e.stopPropagation(); // 绝对拦截，防止触发发送等逻辑

                    if (e.key === 'ArrowDown') {
                        this._moveSelection(1);
                    } else if (e.key === 'ArrowUp') {
                        this._moveSelection(-1);
                    } else if (e.key === 'Enter') {
                        this._confirmSelection();
                    } else if (e.key === 'Escape' || e.key === 'Tab') {
                        this.hidePanel();
                    }
                }
            }
        });

        // 停止监听 keyup @，统一归口到 beforeinput 
        this.promptInput.addEventListener('keyup', (e) => {
            // 已搬迁
        });

        // 点击页面其他地方关闭面板
        document.addEventListener('mousedown', (e) => {
            if (this.panel && !this.panel.contains(e.target) && e.target !== this.promptInput) {
                this.hidePanel();
            }
        });
    }

    insertPinMention(suggestion) {
        if (!this.activeRange) return;
        const { data: pin, parentRef: ref } = suggestion;

        // 1. 精确删除触发面板的那个 @ 符号 (仅当是键盘输入触发时)
        if (this.triggerType === 'input') {
            if (this.atTextNode && this.atTextNode.parentNode) {
                this.atTextNode.parentNode.removeChild(this.atTextNode);
                this.atTextNode = null;
            } else {
                this.activeRange.setStart(this.activeRange.startContainer, Math.max(0, this.activeRange.startOffset - 1));
                this.activeRange.deleteContents();
            }
        }

        // 2. 使用 PinManager 创建标记点标签
        if (window.PinManager && window.PinManager.createPinnedImageTag) {
            const tag = window.PinManager.createPinnedImageTag(ref.data, ref.name, pin.number, pin.x, pin.y, ref.id);
            this.activeRange.insertNode(tag);

            // 3. 在标签后插入一个空格并移动光标
            const space = document.createTextNode('\u00A0');
            tag.after(space);
            
            const nextRange = document.createRange();
            nextRange.setStartAfter(space);
            nextRange.collapse(true);
            
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(nextRange);
        }

        this.hidePanel();
        this.promptInput.focus();
    }

    hidePanel() {
        if (this.panel) {
            this.panel.classList.add('hidden');
        }
    }

    _moveSelection(direction) {
        if (!this.activeSuggestions || this.activeSuggestions.length === 0) return;
        const total = this.activeSuggestions.length;
        this.selectedIndex = (this.selectedIndex + direction + total) % total;
        
        console.log(`[Mention] Selection moved to index: ${this.selectedIndex}, Item: ${this.activeSuggestions[this.selectedIndex].type}`);
        this._updateListHighlight();
    }

    _confirmSelection() {
        const suggestion = this.activeSuggestions[this.selectedIndex];
        if (!suggestion) return;

        if (suggestion.type === 'ref') {
            this.insertMention(suggestion.data);
        } else if (suggestion.type === 'pin') {
            this.insertPinMention(suggestion);
        }
    }

    _updateListHighlight() {
        const items = this.panel.querySelectorAll('.mention-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    showPanel(anchorElement = null) {
        debugLog(`[Mention] 尝试显示面板...`, 'info');
        const refs = referenceManager.getAllReferences();
        if (refs.length === 0) {
            debugLog(`[Mention] 货架为空，不满足弹出条件`, 'warn');
            return;
        }
        
        this.activeSuggestions = [];
        refs.forEach(ref => {
            this.activeSuggestions.push({ type: 'ref', data: ref });
            
            // 扫描图片中的标记点并平铺到建议列表
            if (ref.type === 'image' && window.PinManager) {
                const node = window.PinManager.findNodeByImageUrl(ref.data, ref.id);
                if (node) {
                    const pins = JSON.parse(node.dataset.pins || '[]');
                    pins.forEach(pin => {
                        this.activeSuggestions.push({ 
                            type: 'pin', 
                            data: pin, 
                            parentRef: ref 
                        });
                    });
                }
            }
        });

        debugLog(`[Mention] 面板备选项准备就绪，数量: ${this.activeSuggestions.length}`, 'info');

        this.selectedIndex = 0;
        this.triggerType = anchorElement ? 'click' : 'input';

        // 2. 捕获当前选区
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.activeRange = selection.getRangeAt(0).cloneRange();
        }

        // 3. 渲染并显示
        this._renderPanel();
        this._positionPanel(anchorElement);
        this.panel.classList.remove('hidden');
        
        // 核心加固：强制执行一次高亮和焦点同步
        this._updateListHighlight();
        this.promptInput.focus();

        // 核心日志报告
        console.group('%c[Mention] 引用建议生成报告', 'color: #3b82f6; font-weight: bold;');
        console.log(`总建议项: ${this.activeSuggestions.length}`);
        let refCount = 0, pinCount = 0;
        this.activeSuggestions.forEach(s => s.type === 'ref' ? refCount++ : pinCount++);
        console.log(`其中: 主体素材 ${refCount} 个, 细节点标记 ${pinCount} 个`);
        console.groupEnd();

        debugLog(`[Mention] 面板已弹出，建议项总数: ${this.activeSuggestions.length}`, 'info');
    }

    _renderPanel() {
        const suggestionsHtml = this.activeSuggestions.map((sug, index) => {
            const isActive = index === this.selectedIndex;
            if (sug.type === 'ref') {
                const ref = sug.data;
                const icon = ref.type === 'image' ? `<img src="${ref.data}">` : 
                             ref.type === 'video' ? '🎬' : '🎵';
                return `
                    <div class="mention-item ${isActive ? 'active' : ''}" data-index="${index}">
                        <div class="mention-thumb">${icon}</div>
                        <div class="mention-label">${ref.name}</div>
                    </div>
                `;
            } else {
                return `
                    <div class="mention-item mention-item-pin ${isActive ? 'active' : ''}" data-index="${index}">
                        <div class="mention-pin-icon">📍</div>
                        <div class="mention-label">标记点 #${sug.data.number}</div>
                    </div>
                `;
            }
        }).join('');

        this.panel.innerHTML = `
            <div class="mention-panel-header">选择引用主体或标记 (↑↓切换)</div>
            <div class="mention-list">${suggestionsHtml}</div>
            <div class="mention-panel-footer">
                <div class="mention-add-btn" id="mentionAddReference"><span>+</span> 上传新素材</div>
            </div>
        `;

        // 绑定点击事件
        this.panel.querySelectorAll('.mention-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                this.selectedIndex = parseInt(item.dataset.index);
                this._confirmSelection();
            };
        });

        const addBtn = this.panel.querySelector('#mentionAddReference');
        if (addBtn) {
            addBtn.onclick = (e) => {
                e.stopPropagation();
                document.getElementById('shelfFileInput')?.click();
                this.hidePanel();
            };
        }
    }

    _positionPanel(anchorElement = null) {
        try {
            // 如果指定了锚点元素（如点击图标触发）
            if (anchorElement) {
                const rect = anchorElement.getBoundingClientRect();
                const panelWidth = this.panel.offsetWidth || 220;
                const panelHeight = this.panel.offsetHeight || 180;
                
                // 紧贴图标左侧弹出，对齐底部
                let left = rect.left + window.scrollX - panelWidth - 8;
                let top = rect.bottom + window.scrollY - panelHeight;
                
                // 边界保护：不要超出屏幕顶部或左侧
                top = Math.max(window.scrollY + 10, top);
                left = Math.max(window.scrollX + 10, left);
                
                this.panel.style.top = `${top}px`;
                this.panel.style.left = `${left}px`;
                return;
            }

            const selection = window.getSelection();
            if (selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            let top = rect.bottom + window.scrollY + 8;
            let left = rect.left + window.scrollX;

            // 针对刚刚输入 @ 且光标还在行首的情况做补偿
            if (rect.width === 0 && rect.height === 0) {
                const parentRect = this.promptInput.getBoundingClientRect();
                top = parentRect.top + window.scrollY + 20;
                left = parentRect.left + window.scrollX + 20;
            }

            this.panel.style.top = `${top}px`;
            this.panel.style.left = `${left}px`;
        } catch (e) {
            console.warn('[Mention] 定位计算失败:', e);
            // 兜底显示在输入框附近
            const inputRect = this.promptInput.getBoundingClientRect();
            this.panel.style.top = `${inputRect.top + window.scrollY + 30}px`;
            this.panel.style.left = `${inputRect.left + window.scrollX + 10}px`;
        }
    }

    /**
     * 插入 Mention Tag (按照用户提供的 HTML 结构)
     */
    insertMention(ref) {
        if (!this.activeRange) return;

        // 1. 精确删除触发面板的那个 @ 符号 (仅当是键盘输入触发时)
        if (this.triggerType === 'input') {
            if (this.atTextNode && this.atTextNode.parentNode) {
                this.atTextNode.parentNode.removeChild(this.atTextNode);
                this.atTextNode = null;
            } else {
                // 兜底方案：如果节点丢失，尝试用 range 选区删除
                this.activeRange.setStart(this.activeRange.startContainer, Math.max(0, this.activeRange.startOffset - 1));
                this.activeRange.deleteContents();
            }
        }

        // 2. 创建 Mention Tag 元素
        const tag = document.createElement('span');
        tag.className = 'react-renderer node-reference-mention-tag';
        tag.contentEditable = 'false';
        tag.dataset.refId = ref.id;
        tag.dataset.imageUrl = ref.data; // 核心补全：用于 API 采集
        tag.dataset.filename = ref.name; // 核心补全：用于 API 采集
        
        // 缩略图模板 (根据类型)
        let thumbContent = '';
        if (ref.type === 'image') {
            thumbContent = `<div class="thumbnail-vJ6ynC"><img src="${ref.data}" width="16" height="16" class="image-yKvKIw"></div>`;
        } else if (ref.type === 'video') {
            thumbContent = `<div class="thumbnail-vJ6ynC"><div class="video-indicator">🎬</div></div>`;
        } else {
            thumbContent = `<div class="thumbnail-vJ6ynC audio-item-e_NZ3R"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><path d="M16.667 5.731a.8.8 0 0 1 1.016.77v5.304a3.75 3.75 0 1 0 1.999 3.216V6.503a2.8 2.8 0 0 0-3.554-2.697l-6.783 1.9A2.8 2.8 0 0 0 7.3 8.4v5.281a3.75 3.75 0 1 0 2 3.353V8.402a.8.8 0 0 1 .584-.77l6.783-1.9ZM7.3 16.992v.016a1.75 1.75 0 1 1 0-.016Zm8.633-3.62a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z" fill="currentColor"></path></svg></div>`;
        }

        tag.innerHTML = `
            <span as="span" data-node-view-wrapper style="white-space: normal;">
                <span data-drag-handle="true" class="tag-Qw6RMP">
                    <span class="icon-zIfgf7">${thumbContent}</span>
                    <span class="label-DEyGrL">${ref.name}</span>
                </span>
            </span>
        `;

        // 3. 插入到文档
        this.activeRange.insertNode(tag);

        // 4. 在标签后插入一个空格并移动光标
        const space = document.createTextNode('\u00A0');
        tag.after(space);
        
        const nextRange = document.createRange();
        nextRange.setStartAfter(space);
        nextRange.setEndAfter(space);
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(nextRange);

        this.hidePanel();
        this.promptInput.focus();
    }
}

export const mentionManager = new MentionManager();
console.log('%c[Mention] 脚本模块加载成功', 'color: #3b82f6; font-weight: bold;');
