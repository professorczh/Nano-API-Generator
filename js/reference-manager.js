import { CONFIG } from '../config.js';
import { debugLog } from './utils.js';

class ReferenceManager {
    constructor() {
        this.references = [];
        this.shelfElement = null;
        this.updateListeners = [];
        this.maxImageSize = 50 * 1024 * 1024;
        this.maxVideoSize = 100 * 1024 * 1024;
        this.maxAudioSize = 20 * 1024 * 1024;
        
        this.counts = { image: 0, video: 0, audio: 0 };
        this.currentMode = 'omni'; // 'omni', 'start_end', 'multi_frame'
    }

    addUpdateListener(fn) {
        if (typeof fn === 'function') {
            this.updateListeners.push(fn);
        }
    }

    _notifyUpdate() {
        this.updateListeners.forEach(fn => {
            try {
                fn(this.references);
            } catch (e) {
                console.warn('[货架] 监听器回调失败:', e);
            }
        });
    }

    setMode(mode) {
        if (this.currentMode !== mode) {
            this.currentMode = mode;
            this.render();
            this._notifyUpdate();
        }
    }

    setShelfElement(element) {
        this.shelfElement = element;
        this.render();
    }

    /**
     * 添加引用
     */
    async addReference(fileOrBlob, name, typeOverride = null, slotIndex = null) {
        const type = typeOverride || this._getMediaType(fileOrBlob.type);
        const size = fileOrBlob.size;

        if (!this._validateSize(type, size)) {
            alert(`文件过大: ${name}. 限制为 ${this._getSizeLimitLabel(type)}`);
            return null;
        }

        let dataUrl = '';
        let localPath = null;
        let thumbnail = null;

        if (type === 'image') {
            dataUrl = await this._compressImage(fileOrBlob);
        } else {
            dataUrl = URL.createObjectURL(fileOrBlob);
        }

        // --- 新增：自动同步到后端 uploads (Local-First 核心步骤) ---
        try {
            const formData = new FormData();
            const uploadResp = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'x-filename': encodeURIComponent(name),
                    'content-type': fileOrBlob.type
                },
                body: fileOrBlob
            });
            const uploadResult = await uploadResp.json();
            if (uploadResult.success) {
                localPath = uploadResult.path;
                thumbnail = uploadResult.thumbnail;
                debugLog(`[货架] 资产已物理存盘: ${localPath}`, 'success');
            }
        } catch (e) {
            console.error('[货架] 自动同步本地失败:', e);
        }

        // 核心改进：货架去重逻辑
        const existingRef = this.references.find(r => r.data === dataUrl);
        if (existingRef) {
            debugLog(`[货架] 素材已存在，重用引用: ${existingRef.name}`, 'info');
            return existingRef;
        }

        this.counts[type]++;
        const labelType = type === 'image' ? '图片' : type === 'video' ? '视频' : '音频';
        const friendlyName = `${labelType}${this.counts[type]}`;

        const ref = {
            id: 'ref_' + Date.now() + Math.random().toString(36).substr(2, 5),
            type: type,
            name: friendlyName,
            originalName: name,
            data: dataUrl,
            localPath: localPath,    // 记录本地物理路径
            thumbnail: thumbnail,    // 记录本地生成的缩略图 (主要针对视频)
            originalFile: fileOrBlob,
            timestamp: Date.now(),
            slot: slotIndex,
            cloud_assets: {}         // 预留供应商 ID 映射 (如 { gemini: { id, expiry } })
        };

        if (slotIndex !== null && this.currentMode === 'start_end') {
            const existingIdx = this.references.findIndex(r => r.slot === slotIndex);
            if (existingIdx !== -1) {
                const existing = this.references[existingIdx];
                if (existing.data.startsWith('blob:')) URL.revokeObjectURL(existing.data);
                this.references.splice(existingIdx, 1);
            }
        }

        this.references.push(ref);
        this.render();
        
        debugLog(`[货架] 成功添加${labelType}: ${name}`, 'success');
        
        this._notifyUpdate();
        return ref;
    }

    removeReference(id) {
        const index = this.references.findIndex(r => r.id === id);
        if (index !== -1) {
            const ref = this.references[index];
            const dataUrlToRemove = ref.data;
            
            if (ref.data && ref.data.startsWith('blob:')) {
                URL.revokeObjectURL(ref.data);
            }
            this.references.splice(index, 1);
            this.render();
            
            // 核心补充：通知 PinManager 同步删除提示词中的对应标签
            if (window.PinManager && typeof window.PinManager.syncRemoveFromPrompt === 'function') {
                window.PinManager.syncRemoveFromPrompt(dataUrlToRemove);
            }

            this._notifyUpdate();
        }
    }

    getAllReferences() {
        if (this.references.length > 0) {
            console.group(`[货架采集] 当前共有 ${this.references.length} 个素材:`);
            this.references.forEach((ref, i) => {
                console.log(`${i+1}. [${ref.type}] ${ref.name} (原名: ${ref.originalName || '未知'})`);
            });
            console.groupEnd();
        }
        return this.references;
    }

    getReference(id) {
        return this.references.find(r => r.id === id);
    }

    clear() {
        this.references.forEach(ref => {
            if (ref.data && ref.data.startsWith('blob:')) URL.revokeObjectURL(ref.data);
        });
        this.references = [];
        this.render();
    }

    _renderModeSelector() {
        const modeBtn = document.createElement('div');
        modeBtn.className = 'reference-mode-selector';
        
        const modeInfo = CONFIG.REFERENCE_MODES[this.currentMode.toUpperCase()] || CONFIG.REFERENCE_MODES.OMNI;
        
        modeBtn.innerHTML = `
            <div class="mode-trigger">
                <span class="mode-icon">${modeInfo.icon}</span>
                <span class="mode-text">${modeInfo.name}</span>
                <span class="mode-chevron">▼</span>
            </div>
            <div class="mode-dropdown hidden">
                ${Object.values(CONFIG.REFERENCE_MODES).map(m => `
                    <div class="mode-option ${m.id === this.currentMode ? 'selected' : ''}" data-mode="${m.id}">
                        <span class="opt-icon">${m.icon}</span>
                        <span class="opt-name">${m.name}</span>
                    </div>
                `).join('')}
            </div>
        `;

        const trigger = modeBtn.querySelector('.mode-trigger');
        const dropdown = modeBtn.querySelector('.mode-dropdown');
        
        trigger.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        };

        modeBtn.querySelectorAll('.mode-option').forEach(opt => {
            opt.onclick = (e) => {
                e.stopPropagation();
                this.setMode(opt.dataset.mode);
                dropdown.classList.add('hidden');
            };
        });

        const closeDropdown = () => dropdown.classList.add('hidden');
        document.addEventListener('click', closeDropdown);
        
        return modeBtn;
    }

    render() {
        if (!this.shelfElement) return;

        // 获取当前模式和模型能力
        const currentMode = window.currentMode || 'image';
        
        // 强制显示货架容器
        this.shelfElement.classList.remove('hidden');
        this.shelfElement.innerHTML = '';
        
        // 情况 A: 视频高级模式 (或者未来某个支持多帧的图片/文本模型)
        const isAdvancedMode = (this.currentMode === 'start_end' || this.currentMode === 'multi_frame');
        
        if (currentMode === 'video' && isAdvancedMode) {
            // 1. 渲染模式选择器
            this.shelfElement.appendChild(this._renderModeSelector());

            // 2. 渲染特定的插槽逻辑
            if (this.currentMode === 'start_end') {
                this._renderStartEndMode();
            } else if (this.currentMode === 'multi_frame') {
                this._renderMultiFrameMode();
            }
        } else {
            // 情况 B: 经典模式 (文本/图片/音频/视频Omni)
            // 1. 如果是视频模式，仍然可以显示模式切换器（用于切回高级模式）
            if (currentMode === 'video') {
                this.shelfElement.appendChild(this._renderModeSelector());
            }

            // 2. 渲染通用“添加参考”按钮
            this.shelfElement.appendChild(this._createUploadButton('REF', null));

            // 3. 渲染占位符（如果没有内容且不是高级模式）
            if (this.references.length === 0) {
                const label = document.createElement('div');
                label.className = 'reference-placeholder-text';
                label.textContent = '参考内容';
                this.shelfElement.appendChild(label);
            }

            // 4. 渲染已有素材
            this.references.forEach(ref => {
                this.shelfElement.appendChild(this._createReferenceItem(ref));
            });
        }
    }

    _renderOmniMode() {
        this.shelfElement.appendChild(this._createUploadButton('参考内容', null));
        if (this.references.length === 0) {
            const label = document.createElement('div');
            label.className = 'reference-placeholder-text';
            label.textContent = '添加图片、视频、音频参考';
            this.shelfElement.appendChild(label);
        }
        this.references.forEach(ref => {
            this.shelfElement.appendChild(this._createReferenceItem(ref));
        });
    }

    _renderStartEndMode() {
        const startRef = this.references.find(r => r.slot === 0);
        const endRef = this.references.find(r => r.slot === 1);

        if (startRef) {
            this.shelfElement.appendChild(this._createReferenceItem(startRef));
        } else {
            this.shelfElement.appendChild(this._createUploadButton('首帧', 0));
        }

        const swapBtn = document.createElement('div');
        swapBtn.className = 'reference-btn-mini swap-btn';
        swapBtn.innerHTML = '⇄';
        swapBtn.onclick = () => {
            this.references.forEach(r => {
                if (r.slot === 0) r.slot = 1;
                else if (r.slot === 1) r.slot = 0;
            });
            this.render();
        };
        this.shelfElement.appendChild(swapBtn);

        if (endRef) {
            this.shelfElement.appendChild(this._createReferenceItem(endRef));
        } else {
            this.shelfElement.appendChild(this._createUploadButton('尾帧', 1));
        }
    }

    _renderMultiFrameMode() {
        const multiRefs = this.references.filter(r => r.slot !== null).sort((a, b) => a.slot - b.slot);
        multiRefs.forEach(ref => {
            this.shelfElement.appendChild(this._createReferenceItem(ref));
        });
        const nextSlot = multiRefs.length;
        this.shelfElement.appendChild(this._createUploadButton(`第${nextSlot + 1}帧`, nextSlot));
        this.shelfElement.appendChild(this._createUploadButton('+', null));
    }

    _createUploadButton(label, slot) {
        const btn = document.createElement('div');
        btn.className = 'reference-add-btn';
        btn.innerHTML = `
            <div class="reference-add-icon">+</div>
            <div class="reference-add-text">${label}</div>
        `;
        btn.dataset.slot = slot !== null ? slot : '';
        btn.classList.add('reference-drop-zone');
        btn.onclick = () => {
            const input = document.getElementById('shelfFileInput');
            if (input) {
                // 设置当前操作的目标槽位
                input.dataset.targetSlot = slot !== null ? slot : '';
                input.click();
            }
        };
        
        // 确保全局文件输入框只绑定一次事件处理
        const input = document.getElementById('shelfFileInput');
        if (input && !input.dataset.listenerBound) {
            input.onchange = async (e) => {
                const slot = input.dataset.targetSlot !== '' && input.dataset.targetSlot !== undefined 
                    ? parseInt(input.dataset.targetSlot) : null;
                const files = Array.from(e.target.files);
                for (const file of files) {
                    await this.addReference(file, file.name, null, slot);
                }
                input.value = '';
            };
            input.dataset.listenerBound = 'true';
        }

        return btn;
    }

    _createReferenceItem(ref) {
        const item = document.createElement('div');
        item.className = `reference-item ${ref.type}-item`;
        
        if (ref.type === 'image') {
            const img = document.createElement('img');
            img.src = ref.data;
            item.appendChild(img);
        } else if (ref.type === 'video') {
            const badge = document.createElement('span');
            badge.className = 'reference-badge';
            badge.innerHTML = `<svg fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> ${ref.name}`;
            item.appendChild(badge);
            item.style.backgroundColor = '#000';
        } else {
            const icon = document.createElement('div');
            icon.className = 'audio-icon';
            icon.textContent = '🎵';
            item.appendChild(icon);
            const badge = document.createElement('span');
            badge.className = 'reference-badge';
            badge.textContent = ref.name;
            item.appendChild(badge);
        }
        
        const removeBtn = document.createElement('div');
        removeBtn.className = 'reference-remove';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            this.removeReference(ref.id);
        };
        item.appendChild(removeBtn);
        return item;
    }

    _getMediaType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'other';
    }

    _validateSize(type, size) {
        if (type === 'image') return size <= this.maxImageSize;
        if (type === 'video') return size <= this.maxVideoSize;
        if (type === 'audio') return size <= this.maxAudioSize;
        return true;
    }

    _getSizeLimitLabel(type) {
        if (type === 'image') return '50MB';
        if (type === 'video') return '100MB';
        if (type === 'audio') return '20MB';
        return '未知';
    }

    async _compressImage(fileOrBlob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxSide = 1536;

                    if (width > maxSide || height > maxSide) {
                        if (width > height) {
                            height = (height / width) * maxSide;
                            width = maxSide;
                        } else {
                            width = (width / height) * maxSide;
                            height = maxSide;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(fileOrBlob);
        });
    }
}

export const referenceManager = new ReferenceManager();
window.referenceManager = referenceManager;
