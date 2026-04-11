import { CONFIG, getModelDisplayName } from '../config.js';
import { AppState, CanvasState } from './app-state.js';
import { PinManager, drawPinsOnImage, updateImageDataList } from './pin-manager.js';
import { apiClient } from './api-client.js';
import { debugLog } from './utils.js';
import { NodeFactory } from './node-factory.js';
import { createImageNode, createTextNode } from './node-manager.js';
import { createLoadingPlaceholder, createTextLoadingPlaceholder, updateLoadingPlaceholder, updateTextLoadingPlaceholder } from './loading-placeholder.js';
import { promptPanelManager } from './prompt-panel-manager.js';

export async function handleAPICall(params) {
    const {
        promptInput,
        temperature,
        topP,
        aspectRatioWrapper,
        imageSizeWrapper,
        videoRatioWrapper,
        videoResolutionWrapper,
        videoDurationWrapper,
        audioDurationWrapper,
        audioFormatWrapper,
        loader,
        statusTag,
        imageResponseContainer,
        createLoadingPlaceholder,
        createTextLoadingPlaceholder,
        updateMinimapWithImage,
        selectNode,
        incrementNodeCounter
    } = params;

    debugLog(`[开始调用] handleAPICall 函数`, 'info');
    
    // 捕获当前面板快照 (Snapshot)
    const snapshot = promptPanelManager.captureState();
    
    updateImageDataList();
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = promptInput.innerHTML;

    // 1. 处理旧版的粘贴图片 (pasted-image-item)
    const imageTags = tempDiv.querySelectorAll('.pasted-image-item');
    imageTags.forEach(tag => tag.remove());
    
    // 2. 处理新的提及标签 (Mention Tags)
    const mentionTags = tempDiv.querySelectorAll('.node-reference-mention-tag');
    const mentionedRefs = [];
    
    mentionTags.forEach(tag => {
        const refId = tag.dataset.refId;
        if (refId) {
            const ref = window.referenceManager?.getReference(refId);
            if (ref) {
                mentionedRefs.push(ref);
                const textLabel = document.createTextNode(`[${ref.name}]`);
                tag.parentNode.replaceChild(textLabel, tag);
            }
        }
    });

    const pinnedImageTags = tempDiv.querySelectorAll('.pinned-image-tag');
    let processedPrompt = tempDiv.textContent.trim();
    
    const pinInfo = [];
    pinnedImageTags.forEach(tag => {
        const imageUrl = tag.dataset.imageUrl;
        const pinNumber = tag.dataset.pinNumber;
        const filename = tag.querySelector('.pin-filename').textContent;
        
        const node = PinManager.findNodeByImageUrl(imageUrl);
        if (node) {
            const pins = JSON.parse(node.dataset.pins || '[]');
            const pin = pins.find(p => p.number == pinNumber);
            if (pin) {
                pinInfo.push({
                    imageUrl: imageUrl,
                    pinNumber: pinNumber,
                    filename: filename,
                    x: pin.x,
                    y: pin.y
                });
            }
        }
    });
    
    // PIN 标签的文本替换已移至下方循环处理
    const prompt = processedPrompt;
    const currentMode = CanvasState.currentMode;
    const isImageGenMode = currentMode === 'image';
    const imageDataList = PinManager.getImageDataList();
    
    debugLog(`[参数检查] 模式: ${currentMode}, 提示词: "${prompt}", 图片数量: ${imageDataList.length}, PIN数量: ${pinInfo.length}`, 'info');
    
    let modelName;
    let modelProvider;
    
    if (currentMode === 'image') {
        modelName = CONFIG.IMAGE_MODEL_NAME;
        modelProvider = CONFIG.IMAGE_MODEL_PROVIDER;
    } else if (currentMode === 'text') {
        modelName = CONFIG.MODEL_NAME;
        modelProvider = CONFIG.MODEL_PROVIDER;
    } else if (currentMode === 'audio') {
        modelName = CONFIG.AUDIO_MODEL_NAME;
        modelProvider = CONFIG.AUDIO_MODEL_PROVIDER;
    } else {
        modelName = CONFIG.VIDEO_MODEL_NAME;
        modelProvider = CONFIG.VIDEO_MODEL_PROVIDER;
    }
    
    const modelDisplayNameObj = getModelDisplayName(modelName, modelProvider);
    const modelDisplayName = modelDisplayNameObj.name || modelName;
    const modelProviderDisplay = modelDisplayNameObj.provider || modelProvider;
    
    const generationConfig = {
        temperature: parseFloat(temperature.value),
        topP: parseFloat(topP.value),
        topK: 40,
        maxOutputTokens: 8192
    };
    
    if (isImageGenMode) {
        generationConfig.imageConfig = {
            aspectRatio: aspectRatioWrapper.dataset.value,
            imageSize: imageSizeWrapper.dataset.value
        };
    }
    
    debugLog(`[模型配置] 模型: ${modelName}, 温度: ${generationConfig.temperature}, TopP: ${generationConfig.topP}`, 'info');
    
    // --- 全能参考货架采集 (Omni-Reference) ---
    const isGeminiVeo = (currentMode === 'video' && modelProvider === 'gemini');
    let shelfRefs = [];
    
    if (!isGeminiVeo && window.referenceManager) {
        shelfRefs = window.referenceManager.getAllReferences();
        debugLog(`[全能参考] 从货架采集了 ${shelfRefs.length} 个素材`, 'info');
    }

    let allMediaData = [...imageDataList];

    const combinedRefs = [...mentionedRefs, ...shelfRefs];
    combinedRefs.forEach(ref => {
        const existing = allMediaData.find(m => m.refId === ref.id);
        if (!existing) {
            allMediaData.push({
                data: ref.data,
                name: ref.name,
                type: ref.type,
                refId: ref.id,
                originalFile: ref.originalFile
            });
        }
    });

    // 十二象限/九宫格语义方位判定函数
    const getSemanticLocation = (xPercent, yPercent) => {
        const xNum = parseFloat(xPercent);
        const yNum = parseFloat(yPercent);
        let horizontal = xNum < 33.3 ? '左侧' : (xNum < 66.6 ? '中间' : '右侧');
        let vertical = yNum < 33.3 ? '上方' : (yNum < 66.6 ? '中心' : '下方');
        if (horizontal === '中间' && vertical === '中心') return '图片正中央';
        return `图片${vertical}${horizontal}`;
    };

    for (const info of pinInfo) {
        const node = PinManager.findNodeByImageUrl(info.imageUrl);
        if (node) {
            const img = node.querySelector('img');
            const pins = JSON.parse(node.dataset.pins || '[]');
            
            let base64Data;
            if (img.src.startsWith('data:')) {
                base64Data = img.src;
            } else {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                base64Data = canvas.toDataURL('image/png');
            }
            
            // --- 核心改变：不再将 PIN 绘制到发送给模型的图片上，保持原图洁净 ---
            /* 
            if (pins.length > 0) {
                debugLog(`[PIN标记] 保持原图洁净，不再绘制红色标记点`, 'info');
                // base64Data = await drawPinsOnImage(base64Data, pins);
            }
            */
            
            // 构建增强型语义描述
            const pin = pins.find(p => p.number == info.pinNumber);
            if (pin) {
                const width = parseInt(node.dataset.width) || img.naturalWidth;
                const height = parseInt(node.dataset.height) || img.naturalHeight;
                const relX = ((pin.x / width) * 100).toFixed(1);
                const relY = ((pin.y / height) * 100).toFixed(1);
                const locationLabel = getSemanticLocation(relX, relY);
                
                const pinTag = `[${info.pinNumber}]`;
                const enhancedDesc = `图片中 PIN ${info.pinNumber} 标记的内容（该点位于${locationLabel}，相对参考坐标为 ${relX}%, ${relY}%）`;
                processedPrompt = processedPrompt.replace(pinTag, enhancedDesc);
            }

            const existing = allMediaData.find(data => data.data === base64Data);
            if (!existing) {
                allMediaData.push({
                    data: base64Data,
                    name: info.filename,
                    type: 'image'
                });
            }
        }
    }

    for (let i = 0; i < allMediaData.length; i++) {
        const mediaData = allMediaData[i];
        if (mediaData.type === 'image' && mediaData.data && mediaData.data.startsWith('blob:')) {
            try {
                debugLog(`[图片预处理] 转换 blob URL 为 base64: ${mediaData.name}`, "info");
                const response = await fetch(mediaData.data);
                const arrayBuffer = await response.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let j = 0; j < bytes.length; j++) {
                    binary += String.fromCharCode(bytes[j]);
                }
                const base64 = btoa(binary);
                mediaData.data = `data:image/png;base64,${base64}`;
                debugLog(`[图片预处理] 转换成功: ${mediaData.name}`, 'success');
            } catch (convertError) {
                debugLog(`[图片预处理] 转换失败: ${mediaData.name}, 错误: ${convertError.message}`, 'error');
                if (statusTag) {
                    statusTag.innerText = "图片预处理失败";
                    statusTag.className = "text-xs px-2 py-1 rounded bg-red-50 text-red-600";
                }
                return;
            }
        }
    }
    
    CanvasState.activeRequests++;
    const activeRequests = CanvasState.activeRequests;
    
    if (activeRequests === 1) {
        loader.classList.remove('hidden');
        if (statusTag) {
            statusTag.innerText = "正在请求";
            statusTag.className = "text-xs px-2 py-1 rounded bg-blue-50 text-blue-600";
        }
    }
    
    debugLog(`[请求状态] 活跃请求数: ${activeRequests}`, "info");
    imageResponseContainer.classList.remove('hidden');
    
    let loadingPlaceholder = null;
    let displayWidth = 300;
    let displayHeight = 300;
    
    if (isImageGenMode) {
        const aspectRatioValue = aspectRatioWrapper.dataset.value;
        const imageSizeValue = imageSizeWrapper.dataset.value;
        
        let width, height;
        const baseSize = imageSizeValue === '512px' ? 512 : imageSizeValue === '1K' ? 1024 : imageSizeValue === '2K' ? 2048 : 3840;
        
        switch (aspectRatioValue) {
            case '1:1': width = baseSize; height = baseSize; break;
            case '16:9': width = baseSize; height = Math.round(baseSize * 9 / 16); break;
            case '9:16': width = Math.round(baseSize * 9 / 16); height = baseSize; break;
            case '21:9': width = baseSize; height = Math.round(baseSize * 9 / 21); break;
            case '4:3': width = baseSize; height = Math.round(baseSize * 3 / 4); break;
            case '3:4': width = Math.round(baseSize * 3 / 4); height = baseSize; break;
            case '3:2': width = baseSize; height = Math.round(baseSize * 2 / 3); break;
            case '2:3': width = Math.round(baseSize * 2 / 3); height = baseSize; break;
            case '5:4': width = baseSize; height = Math.round(baseSize * 4 / 5); break;
            case '4:5': width = Math.round(baseSize * 4 / 5); height = baseSize; break;
            default: width = baseSize; height = Math.round(baseSize * 9 / 16);
        }
        
        const ratio = width / height;
        
        if (width > height) {
            displayWidth = Math.min(width, 300);
            displayHeight = Math.round(displayWidth / ratio);
        } else {
            displayHeight = Math.min(height, 300);
            displayWidth = Math.round(displayHeight * ratio);
        }
        
        const existingNodes = imageResponseContainer.querySelectorAll('.canvas-node');
        let x = 5000;
        let y = 5000;
        
        if (existingNodes.length > 0) {
            const lastNode = existingNodes[existingNodes.length - 1];
            const lastNodeX = parseInt(lastNode.style.left) || 0;
            const lastNodeY = parseInt(lastNode.style.top) || 0;
            const lastNodeWidth = lastNode.offsetWidth;
            const lastNodeHeight = lastNode.offsetHeight;
            
            x = lastNodeX + lastNodeWidth + 50;
            y = lastNodeY;
            
            if (x > 6000) {
                x = 5000;
                y = lastNodeY + lastNodeHeight + 50;
            }
        }
        
        loadingPlaceholder = createLoadingPlaceholder(displayWidth, displayHeight, x, y, modelDisplayName.name);
        imageResponseContainer.appendChild(loadingPlaceholder);
        updateMinimapWithImage(loadingPlaceholder);
        
        const imgGenStartTime = Date.now();
        const imgTimeElement = loadingPlaceholder.querySelector('.node-sidebar .node-generation-time');
        if (imgTimeElement) {
            imgTimeElement.textContent = '⏱️ 0.0s';
            const imgTimer = setInterval(() => {
                const elapsed = (Date.now() - imgGenStartTime) / 1000;
                imgTimeElement.textContent = `⏱️ ${elapsed.toFixed(1)}s`;
            }, 100);
            loadingPlaceholder._loadingInterval = imgTimer;
            loadingPlaceholder._startTime = imgGenStartTime;
        }
    } else if (currentMode !== 'video' && currentMode !== 'audio') {
        const existingNodes = imageResponseContainer.querySelectorAll('.canvas-node');
        let x = 5000;
        let y = 5000;
        
        if (existingNodes.length > 0) {
            const lastNode = existingNodes[existingNodes.length - 1];
            const lastNodeX = parseInt(lastNode.style.left) || 0;
            const lastNodeY = parseInt(lastNode.style.top) || 0;
            const lastNodeWidth = lastNode.offsetWidth;
            const lastNodeHeight = lastNode.offsetHeight;
            
            x = lastNodeX + lastNodeWidth + 50;
            y = lastNodeY;
            
            if (x > 6000) {
                x = 5000;
                y = lastNodeY + lastNodeHeight + 50;
            }
        }
        
        loadingPlaceholder = createTextLoadingPlaceholder(prompt, x, y, modelDisplayName.name);
        imageResponseContainer.appendChild(loadingPlaceholder);
        updateMinimapWithImage(loadingPlaceholder);
        
        const textGenStartTime = Date.now();
        const textTimeElement = loadingPlaceholder.querySelector('.node-generation-time');
        if (textTimeElement) {
            textTimeElement.textContent = '⏱️ 0.0s';
            const textTimer = setInterval(() => {
                const elapsed = (Date.now() - textGenStartTime) / 1000;
                textTimeElement.textContent = `⏱️ ${elapsed.toFixed(1)}s`;
            }, 100);
            loadingPlaceholder._loadingInterval = textTimer;
            loadingPlaceholder._startTime = textGenStartTime;
        }
    }
    
    try {
        const isVideoGenMode = currentMode === 'video';

        if (isVideoGenMode) {
            const selectedNode = AppState.selectedNode;
            let selectedImageUrl = null;
            if (selectedNode && selectedNode.querySelector('img')) {
                selectedImageUrl = selectedNode.querySelector('img').src;
            }
            
            const existingNodes = imageResponseContainer.querySelectorAll('.canvas-node');
            let nodeX = 5000;
            let nodeY = 5000;
            
            if (existingNodes.length > 0) {
                const lastNode = existingNodes[existingNodes.length - 1];
                const lastNodeX = parseInt(lastNode.style.left) || 0;
                const lastNodeY = parseInt(lastNode.style.top) || 0;
                const lastNodeWidth = lastNode.offsetWidth || 300;
                const lastNodeHeight = lastNode.offsetHeight || 169;
                
                nodeX = lastNodeX + lastNodeWidth + 50;
                nodeY = lastNodeY;
                
                if (nodeX > 6000) {
                    nodeX = 5000;
                    nodeY = lastNodeY + lastNodeHeight + 50;
                }
            }
            
            const videoPlaceholder = NodeFactory.createVideoPlaceholder(nodeX, nodeY, prompt, modelDisplayName, videoRatioWrapper.dataset.value);
            imageResponseContainer.appendChild(videoPlaceholder);
            updateMinimapWithImage(videoPlaceholder);
            selectNode(videoPlaceholder);
            
            const videoGenStartTime = Date.now();
            videoPlaceholder._startTime = videoGenStartTime;
            
            const allReferences = window.referenceManager?.getAllReferences ? window.referenceManager.getAllReferences() : [];
            const referenceMode = window.referenceManager?.currentMode || 'omni';
            
            await apiClient.request({
                prompt,
                isVideoGenMode: true,
                videoModel: modelName,
                videoProvider: modelProvider,
                aspectRatio: videoRatioWrapper.dataset.value,
                resolution: videoResolutionWrapper.dataset.value,
                durationSeconds: videoDurationWrapper.dataset.value,
                selectedImageUrl: selectedImageUrl,
                media: allReferences,
                referenceMode: referenceMode,
                onVideoProgress: (progress) => {
                    if (videoPlaceholder && typeof NodeFactory !== 'undefined') {
                        NodeFactory.updateVideoLoadingStatus(videoPlaceholder, 'generating', progress);
                    }
                },
                onVideoGenerated: async (videoUrl) => {
                    if (!videoPlaceholder || !videoPlaceholder.parentNode || !videoPlaceholder.classList.contains('loading-placeholder')) {
                        return;
                    }
                    
                    const videoGenEndTime = Date.now();
                    const startTime = videoPlaceholder._startTime;
                    const genTime = startTime ? (videoGenEndTime - startTime) / 1000 : 0;
                    
                    if (videoPlaceholder && typeof NodeFactory !== 'undefined') {
                        NodeFactory.updateVideoLoadingStatus(videoPlaceholder, 'saving', 100);
                    }
                    
                    let finalVideoUrl = videoUrl;
                    
                    // 如果 URL 已经是本地路径（后端自动存盘结果），则无需再次请求保存
                    const isAlreadyLocal = videoUrl && (videoUrl.startsWith('/DL/') || videoUrl.startsWith('./DL/'));
                    
                    if (!isAlreadyLocal) {
                        try {
                            const saveResponse = await fetch('/save-video', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    videoUrl: videoUrl,
                                    prompt: prompt,
                                    aspectRatio: videoRatioWrapper.dataset.value,
                                    duration: videoDurationWrapper.dataset.value,
                                    modelName: modelDisplayName.name
                                })
                            });
                            const saveResult = await saveResponse.json();
                            if (saveResult.success && saveResult.path) {
                                finalVideoUrl = saveResult.path;
                            }
                        } catch (e) {
                            console.error('[保存视频] 失败:', e);
                        }
                    } else {
                        console.log('[视频生成] 后端已自动完成存盘:', videoUrl);
                    }
                    
                    if (videoPlaceholder && videoPlaceholder._loadingInterval) {
                        clearInterval(videoPlaceholder._loadingInterval);
                        videoPlaceholder._loadingInterval = null;
                    }

                    if (!videoUrl) {
                        console.error('[视频生成] 完成但未获取到有效 URL');
                        if (videoPlaceholder) {
                            NodeFactory.markAsError(videoPlaceholder, '获取视频地址失败', modelDisplayName.name);
                        }
                        return;
                    }
                    
                    let finalVideoPath = finalVideoUrl;
                    if (finalVideoUrl && typeof finalVideoUrl === 'string') {
                        const dlIndex = finalVideoUrl.indexOf('/DL/');
                        if (dlIndex !== -1) {
                            finalVideoPath = finalVideoUrl.substring(dlIndex);
                        }
                    }

                    NodeFactory.replaceWithVideo(videoPlaceholder, finalVideoPath, prompt, modelDisplayName, genTime, videoRatioWrapper.dataset.value);
                    
                    if (typeof promptPanelManager !== 'undefined') {
                        promptPanelManager.saveNodeSnapshot(videoPlaceholder, snapshot);
                    }
                    
                    if (typeof updateMinimapWithImage === 'function') updateMinimapWithImage(videoPlaceholder);
                    if (typeof selectNode === 'function') selectNode(videoPlaceholder);
                },
                onError: (error) => {
                    debugLog(`[视频错误] ${error.message}`, 'error');
                    if (videoPlaceholder) {
                        const errorX = parseInt(videoPlaceholder.style.left) || 5000;
                        const errorY = parseInt(videoPlaceholder.style.top) || 5000;
                        videoPlaceholder.remove();
                        const errorNode = createImageNode('', prompt, CanvasState.nodeCounter++, 'Error', '', 0, modelDisplayName, error.message);
                        errorNode.style.left = `${errorX}px`;
                        errorNode.style.top = `${errorY}px`;
                        imageResponseContainer.appendChild(errorNode);
                        updateMinimapWithImage(errorNode);
                        selectNode(errorNode);
                    }
                }
            });
            
            incrementNodeCounter();
            return;
        }

        const isAudioGenMode = currentMode === 'audio';
        if (isAudioGenMode) {
            const existingNodes = imageResponseContainer.querySelectorAll('.canvas-node');
            let nodeX = 5000;
            let nodeY = 5000;
            
            if (existingNodes.length > 0) {
                const lastNode = existingNodes[existingNodes.length - 1];
                const lastNodeX = parseInt(lastNode.style.left) || 0;
                const lastNodeY = parseInt(lastNode.style.top) || 0;
                const lastNodeWidth = lastNode.offsetWidth;
                const lastNodeHeight = lastNode.offsetHeight;
                
                nodeX = lastNodeX + lastNodeWidth + 50;
                nodeY = lastNodeY;
                
                if (nodeX > 6000) {
                    nodeX = 5000;
                    nodeY = lastNodeY + lastNodeHeight + 50;
                }
            }
            
            const audioModel = CONFIG.AUDIO_MODEL_NAME;
            const audioProvider = CONFIG.AUDIO_MODEL_PROVIDER;
            const audioModelDisplayNameObj = getModelDisplayName(audioModel, audioProvider);
            const audioModelDisplayName = audioModelDisplayNameObj.name || audioModel;
            
            const audioPlaceholder = NodeFactory.createAudioPlaceholder(nodeX, nodeY, prompt, audioModelDisplayName);
            imageResponseContainer.appendChild(audioPlaceholder);
            updateMinimapWithImage(audioPlaceholder);
            selectNode(audioPlaceholder);
            
            const audioGenStartTime = Date.now();

            try {
                await apiClient.request({
                    prompt,
                    media: allMediaData,
                    isAudioGenMode: true,
                    modelName: audioModel,
                    modelProvider: audioProvider,
                    audioDuration: audioDurationWrapper.dataset.value,
                    audioFormat: audioFormatWrapper.dataset.value,
                    onAudioGenerated: async (audioUrl) => {
                        if (typeof NodeFactory !== 'undefined') {
                            NodeFactory.updateAudioLoadingStatus(audioPlaceholder, 'saving');
                        }

                        let finalAudioUrl = audioUrl;
                        try {
                            const saveResponse = await fetch('/save-audio', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    audioUrl: audioUrl,
                                    prompt: prompt,
                                    format: audioFormatWrapper.dataset.value,
                                    duration: audioDurationWrapper.dataset.value,
                                    modelName: audioModelDisplayName
                                })
                            });
                            const saveResult = await saveResponse.json();
                            if (saveResult.success && saveResult.path) {
                                finalAudioUrl = saveResult.path;
                            }
                        } catch (saveError) {
                            console.error('[音频保存] 失败:', saveError);
                        }

                        const genTime = (Date.now() - audioGenStartTime) / 1000;
                        NodeFactory.replaceWithAudio(audioPlaceholder, finalAudioUrl, prompt, audioModelDisplayName, genTime, audioFormatWrapper.dataset.value);
                        promptPanelManager.saveNodeSnapshot(audioPlaceholder, snapshot);
                    },
                    onError: (error) => {
                        debugLog(`[音频错误] ${error.message}`, 'error');
                        NodeFactory.markAsError(audioPlaceholder, '音频生成失败', error.message || '内容触发安全策略');
                    }
                });
            } catch (error) {
                NodeFactory.markAsError(audioPlaceholder, '音频请求异常', error.message || '连接超时');
            }
            
            incrementNodeCounter();
            return;
        }
        
        const requestConfig = {
            prompt,
            modelName,
            modelProvider,
            media: allMediaData,
            temperature: parseFloat(temperature.value),
            topP: parseFloat(topP.value),
            modelProviderDisplay,
            generationConfig,
            isImageGenMode,
            isAudioGenMode, 
            aspectRatio: aspectRatioWrapper.dataset.value,
            imageSize: imageSizeWrapper.dataset.value,
            onImageGenerated: async (result) => {
                const imageData = result.imageData;
                const apiResponse = result.response;
                const revisedPrompt = apiResponse?.candidates?.[0]?.content?.parts?.[0]?.revisedPrompt || '';
                
                let filename = '';
                let resolutionStr = `${displayWidth}x${displayHeight}`;
                let saveResult = null;
                
                try {
                    const providerToggle = document.getElementById('providerToggle');
                    const saveToDisk = providerToggle ? providerToggle.checked : false;
                    
                    if (saveToDisk) {
                        const saveResponse = await fetch('/save-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                imageData: imageData,
                                prompt: prompt,
                                aspectRatio: aspectRatioWrapper.dataset.value,
                                imageSize: imageSizeWrapper.dataset.value,
                                saveToDisk: saveToDisk
                            })
                        });
                        saveResult = await saveResponse.json();
                        if (saveResult && saveResult.success) {
                            filename = saveResult.filename;
                            resolutionStr = saveResult.resolution || resolutionStr;
                        }
                    }
                } catch (saveError) {
                    console.error('[保存图片] 失败:', saveError);
                }
                
                if (loadingPlaceholder && loadingPlaceholder._loadingInterval) {
                    clearInterval(loadingPlaceholder._loadingInterval);
                    loadingPlaceholder._loadingInterval = null;
                }
                
                const genTime = loadingPlaceholder._startTime ? (Date.now() - loadingPlaceholder._startTime) / 1000 : 0;
                
                let finalImagePath = `data:image/png;base64,${imageData}`;
                if (saveResult && saveResult.path) {
                    const dlIndex = saveResult.path.indexOf('/DL/');
                    if (dlIndex !== -1) finalImagePath = saveResult.path.substring(dlIndex);
                }

                if (loadingPlaceholder) {
                    updateLoadingPlaceholder(loadingPlaceholder, finalImagePath, prompt, filename, resolutionStr, genTime, modelDisplayName, revisedPrompt);
                    loadingPlaceholder.dataset.imageUrl = finalImagePath;
                    promptPanelManager.saveNodeSnapshot(loadingPlaceholder, snapshot);
                } else {
                    const newNode = createImageNode(finalImagePath, prompt, 0, filename, resolutionStr, genTime, modelDisplayName, null, null, null, revisedPrompt);
                    newNode.dataset.imageUrl = finalImagePath;
                    promptPanelManager.saveNodeSnapshot(newNode, snapshot);
                    imageResponseContainer.appendChild(newNode);
                }
                
                updateMinimapWithImage(loadingPlaceholder);
                selectNode(loadingPlaceholder);
                incrementNodeCounter();
            },
            onTextGenerated: (text) => {
                if (loadingPlaceholder && loadingPlaceholder._loadingInterval) {
                    clearInterval(loadingPlaceholder._loadingInterval);
                    loadingPlaceholder._loadingInterval = null;
                }
                const genTime = loadingPlaceholder._startTime ? (Date.now() - loadingPlaceholder._startTime) / 1000 : 0;
                
                if (loadingPlaceholder) {
                    updateTextLoadingPlaceholder(loadingPlaceholder, text, prompt, genTime, modelDisplayName);
                    promptPanelManager.saveNodeSnapshot(loadingPlaceholder, snapshot);
                } else {
                    const textNode = createTextNode(text, prompt, CanvasState.nodeCounter++, '', '', genTime, modelDisplayName);
                    promptPanelManager.saveNodeSnapshot(textNode, snapshot);
                    imageResponseContainer.appendChild(textNode);
                }
                
                updateMinimapWithImage(loadingPlaceholder);
                selectNode(loadingPlaceholder);
                incrementNodeCounter();
            },
            onError: (error) => {
                if (loadingPlaceholder) {
                    loadingPlaceholder.remove();
                    const errorNode = createImageNode('', prompt, CanvasState.nodeCounter++, 'Error', '', 0, modelDisplayName, error.message);
                    imageResponseContainer.appendChild(errorNode);
                    selectNode(errorNode);
                }
            }
        };

        await apiClient.request(requestConfig);
    } finally {
        CanvasState.activeRequests--;
        if (CanvasState.activeRequests === 0) {
            loader.classList.add('hidden');
            if (statusTag) {
                statusTag.innerText = "就绪";
                statusTag.className = "text-xs px-2 py-1 rounded bg-gray-50 text-gray-600";
            }
        }
    }
}
