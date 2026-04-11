import { CONFIG, getModelDisplayName } from '../config.js';
import { AppState, CanvasState } from './app-state.js';
import { PinManager, updateImageDataList } from './pin-manager.js';
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
    
    // 核心转换：使用统一的 RAW 解析器确保“所见即所发”
    // 如果当前处于 RAW 模式，输入框里已经是解析好的文本；
    // 如果处于富文本模式，parsePromptToRawText 会执行实时解析。
    let prompt = promptPanelManager.parsePromptToRawText(promptInput);
    
    // 提及项采集 (由于我们改用了统一解析器，这里主要为了搜集 mentionedRefs 列表供后续可能逻辑使用)
    const mentionedRefs = [];
    promptInput.querySelectorAll('.node-reference-mention-tag').forEach(tag => {
        const refId = tag.dataset.refId;
        const ref = window.referenceManager?.getReference(refId);
        if (ref) mentionedRefs.push(ref);
    });

    // 标记点采集
    const pinInfo = [];
    promptInput.querySelectorAll('.pinned-image-tag').forEach(tag => {
        const imageUrl = tag.dataset.imageUrl;
        const pinNumber = tag.dataset.pinNumber;
        const filename = tag.querySelector('.pin-filename')?.textContent || "unknown";
        const x = tag.dataset.x;
        const y = tag.dataset.y;
        
        if (x !== undefined && y !== undefined) {
            pinInfo.push({ imageUrl, pinNumber, filename, x, y });
        }
    });

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
        debugLog(`[全能参考] 货架中包含 ${shelfRefs.length} 个素材`, 'info');
    }

    // 12. 统一媒体去重与采集逻辑 (基于 refId)
    const allMediaData = [];
    const processedRefIds = new Set();

    // 辅助函数：将图片资源安全打入发送列表
    const addMediaToPayload = async (ref) => {
        if (!ref || processedRefIds.has(ref.id)) return;
        
        let finalData = ref.data;
        // 如果是 blob，预先转为 base64 以便后续精准处理 (Gemini 必须 base64)
        if (finalData.startsWith('blob:')) {
            try {
                const resp = await fetch(finalData);
                const arrayBuffer = await resp.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
                finalData = `data:image/png;base64,${btoa(binary)}`;
            } catch (e) {
                console.error('[采集] Blob 转换失败:', e);
            }
        }
        
        allMediaData.push({
            data: finalData,
            name: ref.originalName || ref.name || `image_${allMediaData.length}.png`,
            type: ref.type || 'image',
            refId: ref.id
        });
        processedRefIds.add(ref.id);
    };

    // 采集阶段 1: 处理货架与提及项
    const combinedRefs = [...mentionedRefs, ...shelfRefs];
    for (const ref of combinedRefs) {
        await addMediaToPayload(ref);
    }

    // 采集阶段 2: 处理 PIN 标记项 (仅采集资源，语义替换已在 RAW 解析器中统一完成)
    for (const info of pinInfo) {
        if (info.refId && !processedRefIds.has(info.refId)) {
            const ref = window.referenceManager?.getReference(info.refId);
            if (ref) await addMediaToPayload(ref);
        }
    }

    // 采集阶段 3: 兜底逻辑 (image_0.png)
    if (allMediaData.length === 0 && (prompt.includes('image_0.png') || prompt.includes('image_0'))) {
        const selectedNode = AppState.selectedNode;
        if (selectedNode && selectedNode.dataset.imageUrl) {
            allMediaData.push({
                data: selectedNode.dataset.imageUrl,
                name: selectedNode.dataset.filename || 'image_0.png',
                type: 'image'
            });
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
            
            // 重要：在发送请求前捕获当前面板的全量快照 (Prompt, 参数, 参考图等)
            const snapshot = promptPanelManager.captureState();
            
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
                onVideoGenerated: async (videoUrl, protocol) => {
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
                                    modelName: modelDisplayName.name,
                                    protocol: protocol || 'gemini'
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
            // 捕获快照
            const snapshot = promptPanelManager.captureState();

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
