/**
 * 引用预览管理器 (PreviewManager)
 * 负责在鼠标悬浮在 Mention Tag 时弹出丰富媒体预览
 */

import { referenceManager } from './reference-manager.js';

class PreviewManager {
    constructor() {
        this.tooltip = null;
        this.activeMedia = null; // 当前正在预览的媒体元素 (video/audio)
        this.hideTimeout = null;
    }

    init() {
        this._createTooltip();
        this._bindGlobalEvents();
    }

    _createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'mentionPreviewTooltip';
        this.tooltip.className = 'mention-preview-tooltip hidden';
        document.body.appendChild(this.tooltip);
    }

    _bindGlobalEvents() {
        // 使用事件委托，因为标签是动态插入的
        document.addEventListener('mouseenter', (e) => {
            if (e.target.closest) {
                const tag = e.target.closest('.node-reference-mention-tag');
                if (tag) {
                    const refId = tag.dataset.refId;
                    this.showPreview(refId, tag);
                }
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            if (e.target.closest) {
                const tag = e.target.closest('.node-reference-mention-tag');
                if (tag || e.target === this.tooltip) {
                    this.startHideTimer();
                }
            }
        }, true);

        this.tooltip.onmouseenter = () => clearTimeout(this.hideTimeout);
        this.tooltip.onmouseleave = () => this.startHideTimer();
    }

    showPreview(refId, targetElement) {
        clearTimeout(this.hideTimeout);
        const ref = referenceManager.getAllReferences().find(r => r.id === refId);
        if (!ref) return;

        this._renderPreview(ref);
        this._positionTooltip(targetElement);
        this.tooltip.classList.remove('hidden');
    }

    startHideTimer() {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
            this.tooltip.classList.add('hidden');
            this._cleanupActiveMedia();
        }, 300);
    }

    _renderPreview(ref) {
        this._cleanupActiveMedia();
        this.tooltip.innerHTML = `<div class="preview-title">${ref.name}</div>`;
        this.tooltip.className = `mention-preview-tooltip preview-type-${ref.type}`;

        const content = document.createElement('div');
        content.className = 'preview-content';

        if (ref.type === 'image') {
            const img = document.createElement('img');
            img.src = ref.data;
            content.appendChild(img);
        } 
        else if (ref.type === 'video') {
            const video = document.createElement('video');
            video.src = ref.data;
            video.muted = true;
            video.autoplay = true;
            video.loop = true;
            content.appendChild(video);

            const durationBadge = document.createElement('div');
            durationBadge.className = 'preview-duration-badge';
            durationBadge.textContent = '00:00';
            content.appendChild(durationBadge);

            // 监听时间更新，实现倒计时/正计时
            video.ontimeupdate = () => {
                const remaining = video.duration - video.currentTime;
                const displayTime = isNaN(remaining) ? 0 : remaining;
                const m = Math.floor(displayTime / 60);
                const s = Math.floor(displayTime % 60);
                durationBadge.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            };
            this.activeMedia = video;
        } 
        else if (ref.type === 'audio') {
            const audioContainer = document.createElement('div');
            audioContainer.className = 'preview-audio-player';

            const playBtn = document.createElement('button');
            playBtn.className = 'audio-play-btn';
            playBtn.innerHTML = '▶';
            
            const audio = new Audio(ref.data);
            const timeInfo = document.createElement('div');
            timeInfo.className = 'audio-time-info';
            timeInfo.textContent = '00:00 / 00:00';

            playBtn.onclick = () => {
                if (audio.paused) {
                    audio.play();
                    playBtn.innerHTML = '⏸';
                } else {
                    audio.pause();
                    playBtn.innerHTML = '▶';
                }
            };

            audio.ontimeupdate = () => {
                const curM = Math.floor(audio.currentTime / 60);
                const curS = Math.floor(audio.currentTime % 60);
                const durM = Math.floor(audio.duration / 60) || 0;
                const durS = Math.floor(audio.duration % 60) || 0;
                timeInfo.textContent = `${curM.toString().padStart(2, '0')}:${curS.toString().padStart(2, '0')} / ${durM.toString().padStart(2, '0')}:${durS.toString().padStart(2, '0')}`;
            };

            audioContainer.appendChild(playBtn);
            audioContainer.appendChild(timeInfo);
            content.appendChild(audioContainer);
            this.activeMedia = audio;
        }

        this.tooltip.appendChild(content);
    }

    _cleanupActiveMedia() {
        if (this.activeMedia) {
            this.activeMedia.pause();
            this.activeMedia = null;
        }
    }

    _positionTooltip(targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const tooltipWidth = 280;
        
        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        let top = rect.top + window.scrollY - 200; // 默认在上方

        // 边界检查 (太靠边缘则调整)
        if (left < 10) left = 10;
        if (left + tooltipWidth > window.innerWidth) left = window.innerWidth - tooltipWidth - 10;
        if (top < 10) top = rect.bottom + window.scrollY + 10; // 如果上方没空间，显示在下方

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }
}

export const previewManager = new PreviewManager();
