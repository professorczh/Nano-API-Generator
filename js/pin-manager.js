import { AppState } from './app-state.js';

let promptInputElement = null;

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

function adjustTooltipPosition(tooltip, targetElement) {
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

function debugLog(message, type = 'info') {
    if (typeof window !== 'undefined' && window.debugLog) {
        window.debugLog(message, type);
    } else {
        console.log(`[${type}] ${message}`);
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
    deleteBtn.textContent = '×';
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
    deleteBtn.textContent = '×';
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
    setPromptInput
};
