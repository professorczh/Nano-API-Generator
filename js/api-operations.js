import { CONFIG, getModelDisplayName } from '../config.js';
import { AppState, CanvasState } from './app-state.js';
import { PinManager, updateImageDataList } from './pin-manager.js';
import { apiClient } from './api-client.js';
import { debugLog } from './utils.js';
import { NodeFactory } from './node-factory.js';
import { createImageNode, createTextNode } from './node-manager.js';
import { createLoadingPlaceholder, createTextLoadingPlaceholder, updateLoadingPlaceholder, updateTextLoadingPlaceholder } from './loading-placeholder.js';
import { promptPanelManager } from './prompt-panel-manager.js';

/**
 * 解析比例字符串 (如 "16:9") 为数值
 */
function parseRatio(ratioStr) {
    if (!ratioStr || !ratioStr.includes(':')) return 16/9;
    const [w, h] = ratioStr.split(':').map(Number);
    return (w && h) ? w / h : 16/9;
}

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
    
    // 终极坐标稳定性系统：在 handleAPICall 最前端统一计算新节点位置
    // 确保所有模态（图片、视频、音频、文本）共享同一套精确定义的坐标参考系
    const allExistingNodes = imageResponseContainer.querySelectorAll('.canvas-node');
    let targetX = 5000;
    let targetY = 5000;

    if (allExistingNodes.length > 0) {
        const lastBaseNode = allExistingNodes[allExistingNodes.length - 1];
        const lastBaseX = parseInt(lastBaseNode.style.left) || 5000;
        const lastBaseY = parseInt(lastBaseNode.style.top) || 5000;
        
        const standardWidth = 400;
        // 判定基准：只要是盒状媒体节点或加载占位符，一律按 300px 预留空间
        const isStandardBox = lastBaseNode.classList.contains('text-node') || 
                             lastBaseNode.classList.contains('audio-node') || 
                             lastBaseNode.classList.contains('image-node') ||
                             lastBaseNode.classList.contains('video-node') ||
                             lastBaseNode.classList.contains('loading-placeholder') ||
                             lastBaseNode.classList.contains('text-loading-placeholder');
        
        const lastBaseHeight = isStandardBox ? 300 : (lastBaseNode.offsetHeight || 300);
        
        targetX = lastBaseX + standardWidth + 50;
        targetY = lastBaseY;
        
        if (targetX > 6000) {
            targetX = 5000;
            targetY = lastBaseY + lastBaseHeight + 50;
        }
    }
    
    if (isImageGenMode) {
        const aspectRatioValue = aspectRatioWrapper.dataset.value || '1:1';
        const imageSizeValue = imageSizeWrapper.dataset.value;
        
        const ratio = parseRatio(aspectRatioValue);
        const baseSize = imageSizeValue === '512px' ? 512 : imageSizeValue === '1K' ? 1024 : imageSizeValue === '2K' ? 2048 : 3840;
        
        // 1. 计算 API 要求的物理尺导
        let width, height;
        if (ratio >= 1) {
            width = baseSize;
            height = Math.round(baseSize / ratio);
        } else {
            height = baseSize;
            width = Math.round(baseSize * ratio);
        }
        
        // 2. 计算 UI 显示尺寸 (改为执行 300px 基准轴策略)
        const axisSize = 300;
        if (ratio > 1) {
            // 横屏：锁定高度 300
            displayHeight = axisSize;
            displayWidth = Math.round(axisSize * ratio);
        } else {
            // 竖屏或正方形：锁定宽度 300
            displayWidth = axisSize;
            displayHeight = Math.round(axisSize / ratio);
        }

        
        // 使用统一计算出的 targetX 和 targetY
        loadingPlaceholder = createLoadingPlaceholder(displayWidth, displayHeight, targetX, targetY, modelDisplayNameObj);
        // 保存物理坐标到 dataset
        loadingPlaceholder.dataset.posX = targetX;
        loadingPlaceholder.dataset.posY = targetY;
        
        imageResponseContainer.appendChild(loadingPlaceholder);
        updateMinimapWithImage(loadingPlaceholder);
        
        const imgGenStartTime = Date.now();
        const imgTimeElement = loadingPlaceholder.querySelector('.node-sidebar .node-generation-time');
        const imgTimeSpan = imgTimeElement ? imgTimeElement.querySelector('span') : null;
        if (imgTimeElement) {
            const imgTimer = setInterval(() => {
                const elapsed = (Date.now() - imgGenStartTime) / 1000;
                import('./utils.js').then(utils => {
                    if (imgTimeSpan) imgTimeSpan.textContent = utils.formatGenerationTime(elapsed).replace('⏱️', '').trim();
                    else imgTimeElement.textContent = utils.formatGenerationTime(elapsed);
                });
            }, 100);
            loadingPlaceholder._loadingInterval = imgTimer;
            loadingPlaceholder._startTime = imgGenStartTime;
        }
    } else if (currentMode !== 'video' && currentMode !== 'audio') {
        // 直接使用统一排布坐标
        loadingPlaceholder = createTextLoadingPlaceholder(prompt, targetX, targetY, modelDisplayNameObj);
        loadingPlaceholder.dataset.posX = targetX;
        loadingPlaceholder.dataset.posY = targetY;
        imageResponseContainer.appendChild(loadingPlaceholder);
        updateMinimapWithImage(loadingPlaceholder);
        
        const textGenStartTime = Date.now();
        const textTimeElement = loadingPlaceholder.querySelector('.node-generation-time');
        if (textTimeElement) {
            const timeSpan = textTimeElement.querySelector('span');
            import('./utils.js').then(utils => {
                const updateUI = (val) => {
                    const timeStr = utils.formatGenerationTime(val).replace('⏱️', '').trim();
                    if (timeSpan) timeSpan.textContent = timeStr;
                    else textTimeElement.textContent = `⏱️ ${timeStr}`;
                };
                
                updateUI(0);
                const textTimer = setInterval(() => {
                    const elapsed = (Date.now() - textGenStartTime) / 1000;
                    updateUI(elapsed);
                }, 100);
                loadingPlaceholder._loadingInterval = textTimer;
            });
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
            
            // 使用统一排布坐标，彻底修复此处变量作用域断层导致的 ReferenceError
            const videoPlaceholder = NodeFactory.createVideoPlaceholder(targetX, targetY, prompt, modelDisplayNameObj, videoRatioWrapper.dataset.value);
            videoPlaceholder.dataset.posX = targetX;
            videoPlaceholder.dataset.posY = targetY;
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
            // 直接使用统一排布坐标
            const audioPlaceholder = NodeFactory.createAudioPlaceholder(targetX, targetY, prompt, modelDisplayNameObj);
            audioPlaceholder.dataset.posX = targetX;
            audioPlaceholder.dataset.posY = targetY;
            
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
                    modelName: modelName,
                    modelProvider: modelProvider,
                    audioDuration: audioDurationWrapper.dataset.value,
                    audioFormat: audioFormatWrapper.dataset.value,
                    onAudioGenerated: async (audioUrl, result) => {
                        const lyrics = result?.lyrics || '';
                        const caption = result?.caption || '';
                        
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
                                    modelName: modelDisplayName,
                                    lyrics: lyrics,
                                    caption: caption
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
                        NodeFactory.replaceWithAudio(
                            audioPlaceholder, 
                            finalAudioUrl, 
                            prompt, 
                            modelDisplayName, 
                            genTime, 
                            audioFormatWrapper.dataset.value,
                            lyrics,
                            caption
                        );
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
                    // 核心加固：降级创建流程。优先尝试从现有 DOM 找回坐标，否则使用 5000 默认值。
                    const fallbackX = loadingPlaceholder?.dataset.posX || 5000;
                    const fallbackY = loadingPlaceholder?.dataset.posY || 5000;
                    const newNode = createImageNode(finalImagePath, prompt, 0, filename, resolutionStr, genTime, modelDisplayName, null, fallbackX, fallbackY, revisedPrompt);
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
                    // 同样处理文本节点的降级创建坐标
                    const fallbackX = loadingPlaceholder?.dataset.posX || 5000;
                    const fallbackY = loadingPlaceholder?.dataset.posY || 5000;
                    const textNode = createTextNode(text, prompt, CanvasState.nodeCounter++, '', '', genTime, modelDisplayName, fallbackX, fallbackY);
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
