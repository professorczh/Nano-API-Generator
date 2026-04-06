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
    return promptInputElement;
}

function insertAtCursor(node) {
    const promptInput = getPromptInput();
    if (!promptInput) return;
    
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        const parent = promptInput;
        if (parent.contains(range.commonAncestorContainer) || parent === range.commonAncestorContainer) {
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
            const spaceBefore = document.createTextNode(' ');
            const spaceAfter = document.createTextNode(' ');
            promptInput.appendChild(spaceBefore);
            promptInput.appendChild(node);
            promptInput.appendChild(spaceAfter);
        }
    } else {
        const spaceBefore = document.createTextNode(' ');
        const spaceAfter = document.createTextNode(' ');
        promptInput.appendChild(spaceBefore);
        promptInput.appendChild(node);
        promptInput.appendChild(spaceAfter);
    }
}

export function addPinToImage(node, event) {
    const img = node.querySelector('img');
    const rect = img.getBoundingClientRect();
    
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    const x = ((event.clientX - rect.left) / rect.width) * naturalWidth;
    const y = ((event.clientY - rect.top) / rect.height) * naturalHeight;
    
    const pins = JSON.parse(node.dataset.pins || '[]');
    
    let availableNumber = 1;
    const existingNumbers = new Set(pins.map(p => p.number));
    while (existingNumbers.has(availableNumber)) {
        availableNumber++;
    }
    
    const pin = { id: Date.now(), number: availableNumber, x: x, y: y };
    pins.push(pin);
    pins.sort((a, b) => a.number - b.number);
    node.dataset.pins = JSON.stringify(pins);
    
    createPinMarker(node, pin);
    updatePromptWithPins(node);
    
    debugLog(`[添加PIN] 坐标: (${Math.round(x)}, ${Math.round(y)})`, 'info');
}

export function createPinMarker(node, pin) {
    const img = node.querySelector('img');
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    const logicalWidth = img.offsetWidth;
    const logicalHeight = img.offsetHeight;
    
    const scaleX = logicalWidth / naturalWidth;
    const scaleY = logicalHeight / naturalHeight;
    
    const displayX = pin.x * scaleX;
    const displayY = pin.y * scaleY;
    
    const marker = document.createElement('div');
    marker.className = 'pin-marker';
    marker.dataset.pinId = pin.id;
    marker.textContent = pin.number;
    
    marker.style.left = `${displayX - 12}px`;
    marker.style.top = `${displayY - 12}px`;
    
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'pin-delete';
    deleteBtn.innerHTML = getIcon('trash', 12);
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePinFromImage(node, pin.id);
    });
    
    marker.appendChild(deleteBtn);
    
    marker.addEventListener('click', (e) => {
        if (e.target === deleteBtn) return;
        const promptInput = getPromptInput();
        if (!promptInput) return;
        
        const existingTag = promptInput.querySelector(`.pinned-image-tag[data-image-url="${node.dataset.imageUrl}"][data-pin-number="${pin.number}"]`);
        if (!existingTag) {
            const tag = createPinnedImageTag(node.dataset.imageUrl, node.dataset.filename, pin.number, pin.x, pin.y);
            insertAtCursor(tag);
        }
    });
    
    node.appendChild(marker);
}

export function refreshPinsOnNode(node) {
    const pins = JSON.parse(node.dataset.pins || '[]');
    const img = node.querySelector('img');
    if (!img || pins.length === 0) return;
    
    const scaleX = img.offsetWidth / img.naturalWidth;
    const scaleY = img.offsetHeight / img.naturalHeight;

    pins.forEach(pin => {
        const marker = node.querySelector(`.pin-marker[data-pin-id="${pin.id}"]`);
        if (marker) {
            marker.style.left = `${(pin.x * scaleX) - 12}px`;
            marker.style.top = `${(pin.y * scaleY) - 12}px`;
        }
    });
}

export function removePinFromImage(node, pinId) {
    const promptInput = getPromptInput();
    const pins = JSON.parse(node.dataset.pins || '[]');
    const index = pins.findIndex(p => p.id === pinId);
    
    if (index !== -1) {
        const pin = pins[index];
        pins.splice(index, 1);
        node.dataset.pins = JSON.stringify(pins);
        
        const marker = node.querySelector(`.pin-marker[data-pin-id="${pinId}"]`);
        if (marker) {
            marker.remove();
        }
        
        if (promptInput) {
            const tag = promptInput.querySelector(`.pinned-image-tag[data-image-url="${node.dataset.imageUrl}"][data-pin-number="${pin.number}"]`);
            if (tag) {
                tag.remove();
            }
        }
        
        debugLog(`[删除PIN] 图片: ${node.dataset.filename}, PIN编号: ${pin.number}`, 'info');
    }
}

export function updatePromptWithPins(node) {
    const promptInput = getPromptInput();
    if (!promptInput) return;
    
    const pins = JSON.parse(node.dataset.pins || '[]');
    const imageUrl = node.dataset.imageUrl;
    const filename = node.dataset.filename;
    
    const existingTags = promptInput.querySelectorAll('.pinned-image-tag');
    const existingPinNumbers = new Set();
    existingTags.forEach(tag => {
        if (tag.dataset.imageUrl === imageUrl) {
            existingPinNumbers.add(parseInt(tag.dataset.pinNumber));
        }
    });
    
    pins.forEach(pin => {
        if (!existingPinNumbers.has(pin.number)) {
            const tag = createPinnedImageTag(imageUrl, filename, pin.number, pin.x, pin.y);
            insertAtCursor(tag);
        }
    });
}

export function createPinnedImageTag(imageUrl, filename, pinNumber, pinX, pinY) {
    const tag = document.createElement('span');
    tag.className = 'pinned-image-tag';
    tag.dataset.imageUrl = imageUrl;
    tag.dataset.pinNumber = pinNumber;
    tag.contentEditable = 'false';
    tag.style.userSelect = 'none';
    
    const thumbnail = document.createElement('img');
    thumbnail.src = imageUrl;
    thumbnail.style.width = '24px';
    thumbnail.style.height = '24px';
    thumbnail.style.objectFit = 'cover';
    thumbnail.style.borderRadius = '4px';
    
    const numberBadge = document.createElement('span');
    numberBadge.className = 'pin-number';
    numberBadge.textContent = pinNumber;
    
    const label = document.createElement('span');
    label.className = 'pin-filename';
    const displayName = filename.length > 15 ? filename.substring(0, 15) + '...' : filename;
    label.textContent = `${displayName}[${pinNumber}]`;
    label.title = `${filename}[${pinNumber}]`;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'image-preview-tooltip';
    
    const tooltipImg = document.createElement('img');
    tooltipImg.src = imageUrl;
    
    const pinIndicator = document.createElement('div');
    pinIndicator.className = 'pin-indicator';
    pinIndicator.textContent = pinNumber;
    
    if (pinX !== undefined && pinY !== undefined) {
        tooltipImg.onload = function() {
            const naturalWidth = this.naturalWidth;
            const naturalHeight = this.naturalHeight;
            
            const maxWidth = Math.min(window.innerWidth * 0.7, 500);
            const maxHeight = Math.min(window.innerHeight * 0.7, 500);
            
            const widthRatio = maxWidth / naturalWidth;
            const heightRatio = maxHeight / naturalHeight;
            const scale = Math.min(widthRatio, heightRatio);
            
            const displayWidth = naturalWidth * scale;
            const displayHeight = naturalHeight * scale;
            
            this.style.width = `${displayWidth}px`;
            this.style.height = `${displayHeight}px`;
            
            const indicatorX = pinX * scale;
            const indicatorY = pinY * scale;
            
            pinIndicator.style.left = `${indicatorX}px`;
            pinIndicator.style.top = `${indicatorY}px`;
        };
    } else {
        tooltipImg.onload = function() {
            const naturalWidth = this.naturalWidth;
            const naturalHeight = this.naturalHeight;
            
            const maxWidth = Math.min(window.innerWidth * 0.7, 500);
            const maxHeight = Math.min(window.innerHeight * 0.7, 500);
            
            const widthRatio = maxWidth / naturalWidth;
            const heightRatio = maxHeight / naturalHeight;
            const scale = Math.min(widthRatio, heightRatio);
            
            const displayWidth = naturalWidth * scale;
            const displayHeight = naturalHeight * scale;
            
            this.style.width = `${displayWidth}px`;
            this.style.height = `${displayHeight}px`;
        };
    }
    
    tooltip.appendChild(tooltipImg);
    tooltip.appendChild(pinIndicator);
    
    tag.appendChild(thumbnail);
    tag.appendChild(numberBadge);
    tag.appendChild(label);
    
    document.body.appendChild(tooltip);
    
    tag.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
        setTimeout(() => adjustTooltipPosition(tooltip, tag), 10);
    });
    tag.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
    
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'tag-delete';
    deleteBtn.innerHTML = getIcon('trash', 12);
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const node = findNodeByImageUrl(imageUrl);
        if (node) {
            const pins = JSON.parse(node.dataset.pins || '[]');
            const pin = pins.find(p => p.number === pinNumber);
            if (pin) {
                const marker = node.querySelector(`.pin-marker[data-pin-id="${pin.id}"]`);
                if (marker) {
                    marker.remove();
                }
                pins.splice(pins.indexOf(pin), 1);
                node.dataset.pins = JSON.stringify(pins);
            }
        }
        tooltip.remove();
        tag.remove();
    });
    
    tag.appendChild(deleteBtn);
    
    return tag;
}

export function findNodeByImageUrl(imageUrl) {
    if (typeof window === 'undefined') return null;
    
    const imageResponseContainer = document.getElementById('imageResponseContainer');
    if (!imageResponseContainer) return null;
    
    const nodes = imageResponseContainer.querySelectorAll('.canvas-node');
    for (let node of nodes) {
        if (node.dataset.imageUrl === imageUrl) {
            return node;
        }
    }
    return null;
}

export const PinManager = {
    insertAtCursor,
    addPinToImage,
    createPinMarker,
    refreshPinsOnNode,
    removePinFromImage,
    updatePromptWithPins,
    createPinnedImageTag,
    findNodeByImageUrl,
    setPromptInput,
    createImageTag,
    insertImageToPrompt,
    updateImageDataList,
    addCanvasImageToPrompt,
    drawPinsOnImage,
    getImageDataList: () => imageDataList,
    getPasteImageCounter: () => pasteImageCounter,
    incrementPasteImageCounter: () => ++pasteImageCounter
};

export function createImageTag(imageData, index) {
    const item = document.createElement('span');
    item.className = 'pasted-image-item';
    item.style.position = 'relative';
    item.dataset.index = index;
    item.dataset.imageUrl = imageData.data;
    item.dataset.filename = imageData.name;
    item.contentEditable = 'false';
    
    const img = document.createElement('img');
    img.src = imageData.data;
    img.alt = imageData.name;
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = imageData.name.length > 20 ? imageData.name.substring(0, 20) + '...' : imageData.name;
    nameSpan.title = imageData.name;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'image-preview-tooltip';
    
    const tooltipImg = document.createElement('img');
    tooltipImg.src = imageData.data;
    tooltipImg.alt = imageData.name;
    
    tooltipImg.onload = function() {
        const naturalWidth = this.naturalWidth;
        const naturalHeight = this.naturalHeight;
        
        const maxWidth = Math.min(window.innerWidth * 0.7, 500);
        const maxHeight = Math.min(window.innerHeight * 0.7, 500);
        
        const widthRatio = maxWidth / naturalWidth;
        const heightRatio = maxHeight / naturalHeight;
        const scale = Math.min(widthRatio, heightRatio);
        
        const displayWidth = naturalWidth * scale;
        const displayHeight = naturalHeight * scale;
        
        this.style.width = `${displayWidth}px`;
        this.style.height = `${displayHeight}px`;
    };
    
    tooltip.appendChild(tooltipImg);
    
    item.appendChild(img);
    item.appendChild(nameSpan);
    
    document.body.appendChild(tooltip);
    
    item.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
        setTimeout(() => adjustTooltipPosition(tooltip, item), 10);
    });
    item.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
    
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        const filename = item.dataset.filename;
        tooltip.remove();
        item.remove();
        updateImageDataList();
        debugLog(`[删除图片] 文件名: ${filename}`, 'info');
    };
    
    item.appendChild(deleteBtn);
    
    return item;
}

export function insertImageToPrompt(imageUrl, filename) {
    const promptInput = getPromptInput();
    if (!promptInput) return;
    
    const imageData = {
        data: imageUrl,
        name: filename
    };
    imageDataList.push(imageData);
    const imageTag = createImageTag(imageData, pasteImageCounter++);
    promptInput.appendChild(imageTag);
    updateImageDataList();
    debugLog(`[插入图片] 文件名: ${filename}`, 'info');
}

export function updateImageDataList() {
    const promptInput = getPromptInput();
    if (!promptInput) return imageDataList;
    
    imageDataList = [];
    const imageTags = promptInput.querySelectorAll('.pasted-image-item');
    imageTags.forEach((tag, index) => {
        imageDataList.push({
            data: tag.dataset.imageUrl,
            name: tag.dataset.filename
        });
        tag.dataset.index = index;
    });
    return imageDataList;
}

export function addCanvasImageToPrompt(node) {
    const promptInput = getPromptInput();
    if (!promptInput) return;
    
    const imageUrl = node.dataset.imageUrl;
    const filename = node.dataset.filename;
    
    if (!imageUrl || node.classList.contains('loading-placeholder') || filename === 'Loading...') {
        alert('无法插入正在生成的图片，请等待图片生成完成后再试');
        return;
    }
    
    const existingTags = promptInput.querySelectorAll('.pasted-image-item');
    for (let tag of existingTags) {
        if (tag.dataset.imageUrl === imageUrl) {
            return;
        }
    }
    
    const img = node.querySelector('img');
    if (!img) {
        alert('无法获取图片数据');
        return;
    }
    
    let imageDataUrl;
    if (img.src.startsWith('data:')) {
        imageDataUrl = img.src;
    } else {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        imageDataUrl = canvas.toDataURL('image/png');
    }
    
    const imageData = {
        data: imageDataUrl,
        name: filename
    };
    
    const imageTag = createImageTag(imageData, imageDataList.length);
    insertAtCursor(imageTag);
    updateImageDataList();
    
    debugLog(`[插入图片] 文件名: ${filename}, 数据格式: ${imageDataUrl.startsWith('data:') ? 'Base64' : 'URL'}`, 'info');
}

export async function drawPinsOnImage(imageUrl, pins) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            pins.forEach(pin => {
                const x = pin.x;
                const y = pin.y;
                const radius = Math.max(20, Math.min(canvas.width, canvas.height) / 30);
                
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.stroke();
                
                ctx.font = `bold ${radius}px Arial`;
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(pin.number.toString(), x, y);
            });
            
            const annotatedImageUrl = canvas.toDataURL('image/png');
            resolve(annotatedImageUrl);
        };
        img.onerror = () => {
            resolve(imageUrl);
        };
        img.src = imageUrl;
    });
}
