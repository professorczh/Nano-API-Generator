import { AppState } from './app-state.js';
import { getIcon } from './icons.js';
import { debugLog, adjustTooltipPosition } from './utils.js';

let promptInputElement = null;
let imageDataList = [];
let pasteImageCounter = 0;

export function setPromptInput(element) {
    promptInputElement = element;
}

function getPromptInput() {
    if (!promptInputElement) {
        promptInputElement = document.getElementById('promptInput');
        if (promptInputElement) console.log('[PinManager] Fallback promptInput recovered.');
    }
    return promptInputElement;
}

function insertAtCursor(node) {
    const promptInput = getPromptInput();
    if (!promptInput) return;
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (promptInput.contains(range.commonAncestorContainer) || promptInput === range.commonAncestorContainer) {
            range.deleteContents();
            const spaceBefore = document.createTextNode(' ');
            const spaceAfter = document.createTextNode(' ');
            range.insertNode(spaceBefore);
            range.insertNode(node);
            range.insertNode(spaceAfter);
            const newRange = document.createRange();
            newRange.setStartAfter(node);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            promptInput.appendChild(document.createTextNode(' '));
            promptInput.appendChild(node);
            promptInput.appendChild(document.createTextNode(' '));
        }
    } else {
        promptInput.appendChild(document.createTextNode(' '));
        promptInput.appendChild(node);
        promptInput.appendChild(document.createTextNode(' '));
    }
}

/**
 * 标记管理逻辑
 */
export function addPinToImage(node, event) {
    const img = node.querySelector('img');
    const rect = img.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * img.naturalWidth;
    const y = ((event.clientY - rect.top) / rect.height) * img.naturalHeight;
    const pins = JSON.parse(node.dataset.pins || '[]');
    let availableNumber = 1;
    const existingNumbers = new Set(pins.map(p => p.number));
    while (existingNumbers.has(availableNumber)) availableNumber++;
    const pin = { id: Date.now(), number: availableNumber, x, y };
    pins.push(pin);
    pins.sort((a, b) => a.number - b.number);
    node.dataset.pins = JSON.stringify(pins);
    createPinMarker(node, pin);
    updatePromptWithPins(node);
    addCanvasImageToPrompt(node); // 核心：标记即上架
}

export function createPinMarker(node, pin) {
    const img = node.querySelector('img');
    const scaleX = img.offsetWidth / img.naturalWidth;
    const scaleY = img.offsetHeight / img.naturalHeight;
    const marker = document.createElement('div');
    marker.className = 'pin-marker';
    marker.dataset.pinId = pin.id;
    marker.textContent = pin.number;
    marker.style.left = `${(pin.x * scaleX) - 12}px`;
    marker.style.top = `${(pin.y * scaleY) - 12}px`;
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'pin-delete';
    deleteBtn.innerHTML = getIcon('trash', 12);
    deleteBtn.onclick = (e) => { e.stopPropagation(); removePinFromImage(node, pin.id); };
    marker.appendChild(deleteBtn);
    marker.onclick = (e) => {
        if (e.target === deleteBtn) return;
        addCanvasImageToPrompt(node);
        const promptInput = getPromptInput();
        if (!promptInput) return;
        const existingTag = promptInput.querySelector(`.pinned-image-tag[data-image-url="${node.dataset.imageUrl}"][data-pin-number="${pin.number}"]`);
        if (!existingTag) {
            const tag = createPinnedImageTag(node.dataset.imageUrl, node.dataset.filename, pin.number, pin.x, pin.y);
            insertAtCursor(tag);
        }
    };
    node.appendChild(marker);
}

export function removePinFromImage(node, pinId) {
    const pins = JSON.parse(node.dataset.pins || '[]');
    const idx = pins.findIndex(p => p.id === pinId);
    if (idx !== -1) {
        const pin = pins[idx];
        pins.splice(idx, 1);
        node.dataset.pins = JSON.stringify(pins);
        node.querySelector(`.pin-marker[data-pin-id="${pinId}"]`)?.remove();
        const tag = getPromptInput()?.querySelector(`.pinned-image-tag[data-image-url="${node.dataset.imageUrl}"][data-pin-number="${pin.number}"]`);
        if (tag) {
            tag.remove();
            getPromptInput().dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}

export function refreshPinsOnNode(node) {
    const pins = JSON.parse(node.dataset.pins || '[]');
    const img = node.querySelector('img');
    if (!img || pins.length === 0) return;
    const scaleX = img.offsetWidth / img.naturalWidth;
    const scaleY = img.offsetHeight / img.naturalHeight;
    pins.forEach(pin => {
        const m = node.querySelector(`.pin-marker[data-pin-id="${pin.id}"]`);
        if (m) {
            m.style.left = `${(pin.x * scaleX) - 12}px`;
            m.style.top = `${(pin.y * scaleY) - 12}px`;
        }
    });
}

export function updatePromptWithPins(node) {
    const promptInput = getPromptInput();
    if (!promptInput) return;
    const pins = JSON.parse(node.dataset.pins || '[]');
    const imageUrl = node.dataset.imageUrl;
    const existingPinNumbers = new Set(Array.from(promptInput.querySelectorAll(`.pinned-image-tag[data-image-url="${imageUrl}"]`)).map(t => parseInt(t.dataset.pinNumber)));
    
    // 获取图片的 refId 以便传递给标签
    let refId = null;
    if (window.referenceManager) {
        const ref = window.referenceManager.getAllReferences().find(r => r.data === imageUrl || (r.data.length > 100 && imageUrl.length > 100 && r.data.slice(-100) === imageUrl.slice(-100)));
        if (ref) refId = ref.id;
    }

    pins.forEach(pin => {
        if (!existingPinNumbers.has(pin.number)) {
            const tag = createPinnedImageTag(imageUrl, node.dataset.filename, pin.number, pin.x, pin.y, refId);
            insertAtCursor(tag);
        }
    });
}

/**
 * 标签 UI 构造工厂
 */
export function createPinnedImageTag(imageUrl, filename, pinNumber, pinX, pinY, refId = null) {
    const tag = document.createElement('span');
    tag.className = 'pinned-image-tag';
    tag.dataset.imageUrl = imageUrl;
    tag.dataset.pinNumber = pinNumber;
    tag.dataset.refId = refId || '';
    tag.dataset.x = pinX;
    tag.dataset.y = pinY;
    tag.contentEditable = 'false';
    tag.innerHTML = `
        <img src="${imageUrl}" style="width:24px;height:24px;object-fit:cover;border-radius:4px;">
        <span class="pin-number">${pinNumber}</span>
        <span class="pin-filename">${filename.length > 15 ? filename.substring(0, 15) + '...' : filename}[${pinNumber}]</span>
    `;
    const tooltip = document.createElement('div');
    tooltip.className = 'image-preview-tooltip';
    tooltip.innerHTML = `<img src="${imageUrl}"><div class="pin-indicator">${pinNumber}</div>`;
    const tooltipImg = tooltip.querySelector('img');
    tooltipImg.onload = () => {
        const scale = Math.min(Math.min(window.innerWidth * 0.7, 500) / tooltipImg.naturalWidth, Math.min(window.innerHeight * 0.7, 500) / tooltipImg.naturalHeight);
        tooltipImg.style.width = `${tooltipImg.naturalWidth * scale}px`;
        tooltipImg.style.height = `${tooltipImg.naturalHeight * scale}px`;
        const ind = tooltip.querySelector('.pin-indicator');
        ind.style.left = `${pinX * scale}px`; ind.style.top = `${pinY * scale}px`;
    };
    document.body.appendChild(tooltip);
    tag.addEventListener('mouseenter', () => { tooltip.style.display = 'block'; setTimeout(() => adjustTooltipPosition(tooltip, tag), 10); });
    tag.addEventListener('mouseleave', () => tooltip.style.display = 'none');
    const del = document.createElement('span');
    del.className = 'tag-delete';
    del.innerHTML = getIcon('trash', 12);
    del.onclick = (e) => { e.stopPropagation(); tooltip.remove(); tag.remove(); getPromptInput().dispatchEvent(new Event('input', { bubbles: true })); };
    tag.appendChild(del);
    return tag;
}

export function createImageTag(imageData, index) {
    const item = document.createElement('span');
    item.className = 'pasted-image-item';
    item.dataset.index = index;
    item.dataset.imageUrl = imageData.data;
    item.dataset.filename = imageData.name;
    item.dataset.refId = imageData.refId || '';
    item.contentEditable = 'false';
    item.innerHTML = `<img src="${imageData.data}"><span>${imageData.name.length > 20 ? imageData.name.substring(0, 20) + '...' : imageData.name}</span>`;
    const del = document.createElement('span');
    del.className = 'delete-btn';
    del.textContent = '×';
    del.onclick = (e) => { e.stopPropagation(); item.remove(); updateImageDataList(); };
    item.appendChild(del);
    return item;
}

/**
 * 核心数据同步逻辑
 */
export async function addCanvasImageToPrompt(node) {
    console.log(`[Referencing-Core] Function reached for node ID: ${node?.dataset?.index}`);
    const imageUrl = node.dataset.imageUrl;
    const filename = node.dataset.filename;
    console.log(`[Referencing-Core] Starting: ${filename}`);

    if (!imageUrl) {
        console.warn('[Referencing] Aborted: No imageUrl found on node.');
        return;
    }
    if (node.classList.contains('loading-placeholder')) {
        console.warn('[Referencing] Aborted: Node is still loading.');
        return;
    }

    const img = node.querySelector('img');
    const imageDataUrl = img ? img.src : imageUrl;
    
    if (!getPromptInput()) {
        console.error('[Referencing] Aborted: promptInput is NULL. Please check initialization.');
        return;
    }

    let refId = null;
    if (window.referenceManager) {
        const refs = window.referenceManager.getAllReferences();
        const existing = refs.find(r => r.data === imageDataUrl || (r.data.length > 200 && imageDataUrl.length > 200 && r.data.slice(-200) === imageDataUrl.slice(-200)));
        if (existing) {
            refId = existing.id;
        } else if (imageDataUrl.startsWith('data:')) {
            // 高性能处理：Base64 生成图片直接上架，不走 fetch
            try {
                const parts = imageDataUrl.split(',');
                const mime = parts[0].match(/:(.*?);/)[1];
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) u8arr[n] = bstr.charCodeAt(n);
                const blob = new Blob([u8arr], { type: mime });
                const newRef = await window.referenceManager.addReference(blob, filename || `gen_${Date.now()}.png`, 'image');
                refId = newRef.id;
                console.log('[Sync] Fast-track Base64 sync success');
            } catch (e) {
                console.error('[Sync] Base64 fast-track failed:', e);
            }
        } else {
            try {
                const response = await fetch(imageDataUrl);
                const blob = await response.blob();
                const newRef = await window.referenceManager.addReference(blob, filename, 'image');
                refId = newRef.id;
            } catch (e) {
                console.warn('[Sync] Failed shelf sync:', e);
            }
        }
        
        // 核心硬化：将货架 ID 回写到画布节点，建立永久联系
        if (refId) {
            node.dataset.refId = refId;
        }
    }

    const settings = AppState.PromptSettings || { autoInsert: true, allowDuplicate: true };
    if (settings.autoInsert) {
        if (!settings.allowDuplicate) {
            const hasTag = getPromptInput()?.querySelectorAll('.pasted-image-item, .node-reference-mention-tag');
            const exists = Array.from(hasTag || []).some(t => t.dataset.refId === refId || t.dataset.imageUrl === imageDataUrl);
            if (exists) return;
        }
        await insertImageToPrompt(imageDataUrl, filename, refId);
    }
}

export async function insertImageToPrompt(imageUrl, filename, refId = null) {
    const promptInput = getPromptInput();
    if (!promptInput) return;
    const imageData = { data: imageUrl, name: filename, refId };
    imageDataList.push(imageData);
    const tag = createImageTag(imageData, pasteImageCounter++);
    insertAtCursor(tag);
    updateImageDataList();
}

/**
 * 追踪曾经出现过的资源 ID，用于智能下架判断
 * 防止用户在输入过程中（如刚输入 @ 尚未产生标签时）导致货架被清空
 */
let seenRefIdsInPrompt = new Set();

/**
 * 最核心的扫描器：基于 ID 和 特征码双重防御
 */
export function updateImageDataList() {
    const promptInput = getPromptInput();
    if (!promptInput) return imageDataList;
    
    // 1. 采集当前输入框中所有的标签数据
    const currentTags = [];
    promptInput.querySelectorAll('.pasted-image-item, .pinned-image-tag, .node-reference-mention-tag').forEach((tag) => {
        const refId = tag.dataset.refId;
        const data = tag.dataset.imageUrl;
        const name = tag.dataset.filename;
        currentTags.push({ data, name, refId });
        
        // 记录曾经在提示词里出现的资源 ID
        if (refId) seenRefIdsInPrompt.add(refId);
    });

    imageDataList = currentTags;

    // 2. 同步下架逻辑 (仅当开启 syncRemoval 时)
    const settings = AppState.PromptSettings || { syncRemoval: true };
    if (settings.syncRemoval && window.referenceManager) {
        const shelfRefs = window.referenceManager.getAllReferences();
        
        shelfRefs.forEach(ref => {
            // 检查该货架素材是否仍在提示词中
            const isStillInPrompt = imageDataList.some(item => {
                if (item.refId && ref.id && item.refId === ref.id) return true;
                if (item.data === ref.data) return true;
                // 特征码模糊匹配 (针对 DataURL)
                if (item.data && ref.data && item.data.length > 100 && ref.data.length > 100) {
                    return item.data.slice(-100) === ref.data.slice(-100);
                }
                return false;
            });

            // 核心改进判断：
            // 只有当该素材【曾经在提示词里出现过】(意味着它是被用户放入提示词的)，
            // 且【现在不在提示词里了】，才执行同步下架。
            // 这避免了：用户 typing @ 过程中导致尚未被引用的货架素材被误杀。
            if (seenRefIdsInPrompt.has(ref.id) && !isStillInPrompt) {
                console.log(`[同步下架] 标签已从提示词物理移除，正在下架货架项: ${ref.name}`);
                window.referenceManager.removeReference(ref.id);
                seenRefIdsInPrompt.delete(ref.id); // 移除追踪
            }
        });
    }
    
    return imageDataList;
}

export function syncRemoveFromPrompt(imageUrl) {
    const promptInput = getPromptInput();
    if (!promptInput) return;
    promptInput.querySelectorAll('.pasted-image-item, .pinned-image-tag, .node-reference-mention-tag').forEach(tag => {
        if (tag.dataset.imageUrl === imageUrl || (tag.dataset.imageUrl.length > 100 && imageUrl.length > 100 && tag.dataset.imageUrl.slice(-100) === imageUrl.slice(-100))) {
            tag.remove();
        }
    });
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * 辅助与全局导出
 */
export function findNodeByImageUrl(url, refId = null) {
    const nodes = document.getElementById('imageResponseContainer')?.querySelectorAll('.canvas-node');
    for (const n of (nodes || [])) {
        // 1. 优先通过 refId 匹配 (最可靠)
        if (refId && n.dataset.refId === refId) return n;
        
        // 2. 兜底通过 URL 匹配
        if (n.dataset.imageUrl === url || (n.dataset.imageUrl.length > 100 && url.length > 100 && n.dataset.imageUrl.slice(-100) === url.slice(-100))) return n;
    }
    return null;
}

export const PinManager = {
    setPromptInput, addPinToImage, createPinMarker, refreshPinsOnNode, removePinFromImage,
    updatePromptWithPins, createPinnedImageTag, findNodeByImageUrl, createImageTag,
    insertImageToPrompt, updateImageDataList, addCanvasImageToPrompt, syncRemoveFromPrompt,
    getImageDataList: () => imageDataList
};
window.PinManager = PinManager;
