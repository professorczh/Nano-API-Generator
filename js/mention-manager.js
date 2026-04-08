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
        this.promptInput = promptInput;
        this._createPanel();
        this._bindEvents();
    }

    _createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'mentionPanel';
        this.panel.className = 'mention-panel hidden';
        document.body.appendChild(this.panel);
    }

    _bindEvents() {
        this.promptInput.addEventListener('keyup', (e) => {
            if (e.key === '@') {
                this.showPanel();
            } else if (e.key === 'Escape') {
                this.hidePanel();
            }
        });

        // 点击页面其他地方关闭面板
        document.addEventListener('mousedown', (e) => {
            if (this.panel && !this.panel.contains(e.target) && e.target !== this.promptInput) {
                this.hidePanel();
            }
        });
    }

    showPanel() {
        const refs = referenceManager.getAllReferences();
        if (refs.length === 0) {
            debugLog('[Mention] 货架为空，不显示面板', 'info');
            return;
        }

        // 记录当前光标位置，以便后续替换
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.activeRange = selection.getRangeAt(0).cloneRange();
        }

        this._renderPanel(refs);
        this._positionPanel();
        this.panel.classList.remove('hidden');
    }

    hidePanel() {
        if (this.panel) {
            this.panel.classList.add('hidden');
        }
    }

    _renderPanel(refs) {
        this.panel.innerHTML = `
            <div class="mention-panel-header">选择要引用的内容</div>
            <div class="mention-list">
                ${refs.map(ref => `
                    <div class="mention-item" data-ref-id="${ref.id}">
                        <div class="mention-thumb">
                            ${ref.type === 'image' ? `<img src="${ref.data}">` : 
                              ref.type === 'video' ? `<div class="thumb-video-icon">🎬</div>` : 
                              `<div class="thumb-audio-icon">🎵</div>`}
                        </div>
                        <div class="mention-label">${ref.name}</div>
                    </div>
                `).join('')}
            </div>
            <div class="mention-panel-footer">
                <div class="mention-add-btn" id="mentionAddReference">
                    <span>+</span> 创建主体
                </div>
            </div>
        `;

        // 绑定点击事件
        this.panel.querySelectorAll('.mention-item').forEach(item => {
            item.onclick = () => {
                const refId = item.dataset.refId;
                const ref = refs.find(r => r.id === refId);
                this.insertMention(ref);
            };
        });

        const addBtn = this.panel.querySelector('#mentionAddReference');
        if (addBtn) {
            addBtn.onclick = () => {
                const input = document.getElementById('shelfFileInput');
                if (input) input.click();
                this.hidePanel();
            };
        }
    }

    /**
     * 计算并设置面板位置 (跟随光标)
     */
    _positionPanel() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 如果无法获取坐标 (比如刚输入 @)，尝试获取前一个字符的坐标
        let top = rect.bottom + window.scrollY + 5;
        let left = rect.left + window.scrollX;

        // 边界检查
        const panelWidth = 200;
        if (left + panelWidth > window.innerWidth) {
            left = window.innerWidth - panelWidth - 20;
        }

        this.panel.style.top = `${top}px`;
        this.panel.style.left = `${left}px`;
    }

    /**
     * 插入 Mention Tag (按照用户提供的 HTML 结构)
     */
    insertMention(ref) {
        if (!this.activeRange) return;

        // 1. 删除输入的 @ 符号
        // 我们需要移动 range 到 @ 符号之前并扩充 1 个字符
        this.activeRange.setStart(this.activeRange.startContainer, this.activeRange.startOffset - 1);
        this.activeRange.deleteContents();

        // 2. 创建 Mention Tag 元素
        const tag = document.createElement('span');
        tag.className = 'react-renderer node-reference-mention-tag';
        tag.contentEditable = 'false';
        tag.dataset.refId = ref.id; // 关键数据绑定
        
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
