import { CONFIG, getModelDisplayName } from '../config.js';
import { AppState, CanvasState } from './app-state.js';
import { PinManager, drawPinsOnImage, updateImageDataList } from './pin-manager.js';
import { apiClient } from './api-client.js';
import { debugLog } from './utils.js';
import { NodeFactory } from './node-factory.js';
import { createImageNode, createTextNode } from './node-manager.js';
import { createLoadingPlaceholder, createTextLoadingPlaceholder, updateLoadingPlaceholder, updateTextLoadingPlaceholder } from './loading-placeholder.js';

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
    
    updateImageDataList();
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = promptInput.innerHTML;
    const imageTags = tempDiv.querySelectorAll('.pasted-image-item');
    imageTags.forEach(tag => tag.remove());
    
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
    
    if (pinInfo.length > 0) {
        pinInfo.forEach(info => {
            const pinTag = `[${info.pinNumber}]`;
            if (processedPrompt.includes(pinTag)) {
                const node = PinManager.findNodeByImageUrl(info.imageUrl);
                let positionDesc = `图片中 PIN ${info.pinNumber} 标记的位置`;
                if (node) {
                    const width = parseInt(node.dataset.width) || 0;
                    const height = parseInt(node.dataset.height) || 0;
                    if (width > 0 && height > 0) {
                        const relX = ((info.x / width) * 100).toFixed(1);
                        const relY = ((info.y / height) * 100).toFixed(1);
                        positionDesc = `图片中 PIN ${info.pinNumber} 标记的位置（图片尺寸${width}x${height}，相对坐标${relX}%, ${relY}%）`;
                    }
                }
                processedPrompt = processedPrompt.replace(pinTag, positionDesc);
            }
        });
    }
    
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
    
    let allImageData = [...imageDataList];
    
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
            
            if (pins.length > 0) {
                debugLog(`[PIN标记] 在图片上绘制 ${pins.length} 个PIN标记`, 'info');
                base64Data = await drawPinsOnImage(base64Data, pins);
            }
            
            const existing = allImageData.find(data => data.data === base64Data);
            if (!existing) {
                allImageData.push({
                    data: base64Data,
                    name: info.filename
                });
            }
        }
    }
    
    for (let i = 0; i < allImageData.length; i++) {
        const imageData = allImageData[i];
        if (imageData.data && imageData.data.startsWith('blob:')) {
            try {
                debugLog(`[图片预处理] 转换 blob URL 为 base64: ${imageData.name}`, 'info');
                const response = await fetch(imageData.data);
                const arrayBuffer = await response.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let j = 0; j < bytes.length; j++) {
                    binary += String.fromCharCode(bytes[j]);
                }
                const base64 = btoa(binary);
                imageData.data = `data:image/png;base64,${base64}`;
                debugLog(`[图片预处理] 转换成功: ${imageData.name}`, 'success');
            } catch (convertError) {
                debugLog(`[图片预处理] 转换失败: ${imageData.name}, 错误: ${convertError.message}`, 'error');
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
            statusTag.innerText = "请求中";
            statusTag.className = "text-xs px-2 py-1 rounded bg-blue-50 text-blue-600";
        }
    }
    
    debugLog(`[请求状态] 活跃请求数: ${activeRequests}`, 'info');
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
        
        loadingPlaceholder = createLoadingPlaceholder(displayWidth, displayHeight, x, y, modelDisplayName);
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
            loadingPlaceholder._timer = imgTimer;
            loadingPlaceholder._startTime = imgGenStartTime;
        }
    } else if (currentMode !== 'video') {
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
        
        loadingPlaceholder = createTextLoadingPlaceholder(prompt, x, y, modelDisplayName);
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
            loadingPlaceholder._timer = textTimer;
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
                const lastNodeWidth = lastNode.offsetWidth;
                const lastNodeHeight = lastNode.offsetHeight;
                
                nodeX = lastNodeX + lastNodeWidth + 50;
                nodeY = lastNodeY;
                
                if (nodeX > 6000) {
                    nodeX = 5000;
                    nodeY = lastNodeY + lastNodeHeight + 50;
                }
            }
            
            const videoModel = CONFIG.VIDEO_MODEL_NAME;
            const videoProvider = CONFIG.VIDEO_MODEL_PROVIDER;
            const videoModelDisplayNameObj = getModelDisplayName(videoModel, videoProvider);
            const videoModelDisplayName = videoModelDisplayNameObj.name || videoModel;
            const videoModelProviderDisplay = videoModelDisplayNameObj.provider || videoProvider;
            console.log('[视频生成] prompt:', prompt.substring(0, 80), '...');
            const videoPlaceholder = NodeFactory.createVideoPlaceholder(nodeX, nodeY, prompt, videoModelDisplayName, videoRatioWrapper.dataset.value);
            imageResponseContainer.appendChild(videoPlaceholder);
            updateMinimapWithImage(videoPlaceholder);
            selectNode(videoPlaceholder);
            
            const videoGenStartTime = Date.now();
            const videoTimeElement = videoPlaceholder.querySelector('.node-sidebar .node-generation-time');
            if (videoTimeElement) {
                videoTimeElement.textContent = '⏱️ 0.0s';
                const videoTimer = setInterval(() => {
                    const elapsed = (Date.now() - videoGenStartTime) / 1000;
                    videoTimeElement.textContent = `⏱️ ${elapsed.toFixed(1)}s`;
                }, 100);
                videoPlaceholder._timer = videoTimer;
                videoPlaceholder._startTime = videoGenStartTime;
            }
            
            await apiClient.request({
                prompt,
                isVideoGenMode: true,
                videoModel: CONFIG.VIDEO_MODEL_NAME,
                videoProvider: CONFIG.VIDEO_MODEL_PROVIDER,
                videoRatio: videoRatioWrapper.dataset.value,
                videoResolution: videoResolutionWrapper.dataset.value,
                videoDuration: videoDurationWrapper.dataset.value,
                selectedImageUrl: selectedImageUrl,
                onVideoProgress: (progress) => {
                    debugLog(`[视频进度] ${progress}%`, 'info');
                    if (videoPlaceholder && videoPlaceholder._updateProgress) {
                        videoPlaceholder._updateProgress(progress);
                    }
                },
                onVideoGenerated: async (videoUrl) => {
                    debugLog(`[视频完成] ${videoUrl}`, 'info');
                    
                    if (videoPlaceholder && videoPlaceholder._timer) {
                        clearInterval(videoPlaceholder._timer);
                        videoPlaceholder._timer = null;
                    }
                    
                    if (videoPlaceholder && videoPlaceholder._updateProgress) {
                        videoPlaceholder._updateProgress(100);
                    }
                    
                    const videoGenEndTime = Date.now();
                    const genTime = videoPlaceholder._startTime ? (videoGenEndTime - videoPlaceholder._startTime) / 1000 : 0;
                    
                    const proxyUrl = `/api/video-proxy?url=${encodeURIComponent(videoUrl)}`;
                    debugLog(`[视频代理] 使用代理URL: ${proxyUrl}`, 'info');
                    
                    try {
                        debugLog(`[保存视频] 开始保存到服务器`, 'info');
                        const saveResponse = await fetch('/api/save-video', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                videoUrl: videoUrl,
                                prompt: prompt,
                                aspectRatio: videoRatioWrapper.dataset.value,
                                duration: videoDurationWrapper.dataset.value,
                                modelName: videoModelDisplayName
                            })
                        });
                        const saveResult = await saveResponse.json();
                        if (saveResult.success) {
                            debugLog(`[保存视频] 保存成功: ${saveResult.fileName}`, 'success');
                        } else {
                            debugLog(`[保存视频] 保存失败: ${saveResult.error}`, 'error');
                        }
                    } catch (saveError) {
                        debugLog(`[保存视频] 保存异常: ${saveError.message}`, 'error');
                    }
                    
                    console.log('[视频完成] prompt:', prompt.substring(0, 80), '... videoUrl:', proxyUrl);
                    NodeFactory.replaceWithVideo(videoPlaceholder, proxyUrl, prompt, videoModelDisplayName, genTime, videoRatioWrapper.dataset.value);
                },
                onError: (error) => {
                    debugLog(`[视频错误] ${error.message}`, 'error');
                    
                    let errorX = 5000;
                    let errorY = 5000;
                    
                    if (videoPlaceholder) {
                        if (videoPlaceholder._timer) {
                            clearInterval(videoPlaceholder._timer);
                        }
                        errorX = parseInt(videoPlaceholder.style.left) || 5000;
                        errorY = parseInt(videoPlaceholder.style.top) || 5000;
                        videoPlaceholder.remove();
                    }
                    
                    const errorNode = createImageNode('', prompt, CanvasState.nodeCounter++, 'Error', '', 0, videoModelDisplayName, error.message);
                    errorNode.style.left = `${errorX}px`;
                    errorNode.style.top = `${errorY}px`;
                    imageResponseContainer.appendChild(errorNode);
                    updateMinimapWithImage(errorNode);
                    selectNode(errorNode);
                }
            });
            
            incrementNodeCounter();
            return;
        }
        
        await apiClient.request({
            prompt,
            images: allImageData,
            pinInfo,
            modelName,
            modelProvider,
            modelDisplayName: modelDisplayName,
            modelProviderDisplay,
            generationConfig,
            isImageGenMode,
            aspectRatio: aspectRatioWrapper.dataset.value,
            imageSize: imageSizeWrapper.dataset.value,
            onImageGenerated: async (result) => {
                debugLog(`[API响应] 收到响应, 候选数量: 1`, 'info');
                
                const imageData = result.imageData;
                const apiResponse = result.response;
                
                console.log('%c[API] Received full JSON response:', 'color: #f97316; font-weight: bold');
                console.log(apiResponse);
                
                const revisedPrompt = apiResponse?.candidates?.[0]?.content?.parts?.[0]?.revisedPrompt || '';
                if (revisedPrompt) {
                    debugLog(`[API] Revised Prompt: ${revisedPrompt.substring(0, 100)}...`, 'info');
                }
                
                const safetyRatings = apiResponse?.candidates?.[0]?.safetyRatings || [];
                if (safetyRatings && safetyRatings.length > 0) {
                    console.log('%c[State] Image API safety ratings detected:', 'color: #a855f7; font-weight: bold', safetyRatings);
                }
                
                // 探测：检查 response.text() 内容
                try {
                    const responseText = typeof apiResponse?.text === 'function' ? await apiResponse.text() : null;
                    if (responseText) {
                        const textLength = responseText.length;
                        const truncatedText = textLength > 100 ? responseText.substring(0, 100) + '...' : responseText;
                        console.log('%c[DOM] Gemini response.text() 探测结果:', 'color: #a855f7; font-weight: bold');
                        console.log(`%c[DOM] 文本长度: ${textLength} 字符`, 'color: #a855f7');
                        console.log(`%c[DOM] 内容预览: ${truncatedText}`, 'color: #a855f7');
                    }
                } catch (textError) {
                    console.log('%c[DOM] response.text() 不可用或解析失败:', 'color: #a855f7', textError.message);
                }
                
                // 探测：检查 candidates[0].content.parts 结构
                const parts = apiResponse?.candidates?.[0]?.content?.parts || [];
                if (parts.length > 0) {
                    console.log('%c[DOM] candidates[0].content.parts 结构探测:', 'color: #a855f7; font-weight: bold');
                    parts.forEach((part, index) => {
                        const partKeys = Object.keys(part);
                        console.log(`%c[DOM] Part[${index}] keys: ${partKeys.join(', ')}`, 'color: #a855f7');
                        if (part.text) {
                            const textLength = part.text.length;
                            const truncatedText = textLength > 100 ? part.text.substring(0, 100) + '...' : part.text;
                            console.log(`%c[DOM] Part[${index}].text 长度: ${textLength}`, 'color: #a855f7');
                            console.log(`%c[DOM] Part[${index}].text 内容: ${truncatedText}`, 'color: #a855f7');
                        }
                    });
                }
                
                const byteCharacters = atob(imageData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });
                const blobUrl = URL.createObjectURL(blob);
                
                let filename = '';
                let resolution = '';
                
                try {
                    const providerToggle = document.getElementById('providerToggle');
                    const saveToDisk = providerToggle ? providerToggle.checked : false;
                    
                    debugLog(`[保存图片] 开始保存到服务器, saveToDisk: ${saveToDisk}`, 'info');
                    
                    if (!saveToDisk) {
                        debugLog(`[保存图片] 跳过存盘（仅预览模式）`, 'info');
                    } else {
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
                        const saveResult = await saveResponse.json();
                        if (saveResult.success) {
                            filename = saveResult.filename;
                            resolution = saveResult.resolution;
                            debugLog(`[保存图片] 保存成功: ${filename}`, 'success');
                        }
                    }
                } catch (saveError) {
                    debugLog(`[保存图片] 保存失败: ${saveError.message}`, 'error');
                }
                
                if (loadingPlaceholder && loadingPlaceholder._timer) {
                    clearInterval(loadingPlaceholder._timer);
                    loadingPlaceholder._timer = null;
                }
                
                const imgGenEndTime = Date.now();
                const genTime = loadingPlaceholder._startTime ? (imgGenEndTime - loadingPlaceholder._startTime) / 1000 : 0;
                
                const resolutionStr = `${displayWidth}x${displayHeight}`;
                
                if (loadingPlaceholder) {
                    // 方案B：更新占位节点内容（像视频那样）
                    updateLoadingPlaceholder(loadingPlaceholder, blobUrl, prompt, filename, resolutionStr, genTime, modelDisplayName, revisedPrompt);
                    loadingPlaceholder.dataset.generationConfig = JSON.stringify(generationConfig);
                    debugLog(`[更新占位节点] 图片节点已更新`, 'info');
                } else {
                    const newNode = createImageNode(blobUrl, prompt, 0, filename, resolutionStr, genTime, modelDisplayName, null, null, null, revisedPrompt);
                    newNode.dataset.generationConfig = JSON.stringify(generationConfig);
                    imageResponseContainer.appendChild(newNode);
                }
                
                updateMinimapWithImage(loadingPlaceholder);
                selectNode(loadingPlaceholder);
                incrementNodeCounter();
            },
            onTextGenerated: (text) => {
                debugLog(`[API响应] 收到文本响应`, 'info');
                
                if (loadingPlaceholder && loadingPlaceholder._timer) {
                    clearInterval(loadingPlaceholder._timer);
                    loadingPlaceholder._timer = null;
                }
                
                const textGenEndTime = Date.now();
                const genTime = loadingPlaceholder._startTime ? (textGenEndTime - loadingPlaceholder._startTime) / 1000 : 0;
                
                if (loadingPlaceholder) {
                    // 方案B：更新占位节点内容（像视频那样）
                    updateTextLoadingPlaceholder(loadingPlaceholder, text, prompt, genTime, modelDisplayName);
                    debugLog(`[更新占位节点] 文本节点已更新`, 'info');
                } else {
                    const textNode = createTextNode(text, prompt, CanvasState.nodeCounter++, '', '', genTime, modelDisplayName);
                    imageResponseContainer.appendChild(textNode);
                }
                
                updateMinimapWithImage(loadingPlaceholder);
                selectNode(loadingPlaceholder);
                incrementNodeCounter();
            },
            onError: (error) => {
                debugLog(`[API错误] ${error.message}`, 'error');
                
                let errorX = 5000;
                let errorY = 5000;
                
                if (loadingPlaceholder) {
                    if (loadingPlaceholder._timer) {
                        clearInterval(loadingPlaceholder._timer);
                    }
                    errorX = parseInt(loadingPlaceholder.style.left) || 5000;
                    errorY = parseInt(loadingPlaceholder.style.top) || 5000;
                    loadingPlaceholder.remove();
                }
                
                const errorNode = createImageNode('', prompt, CanvasState.nodeCounter++, 'Error', '', 0, modelDisplayName, error.message);
                errorNode.style.left = `${errorX}px`;
                errorNode.style.top = `${errorY}px`;
                imageResponseContainer.appendChild(errorNode);
                updateMinimapWithImage(errorNode);
                selectNode(errorNode);
                
                if (statusTag) {
                    statusTag.innerText = "错误";
                    statusTag.className = "text-xs px-2 py-1 rounded bg-red-50 text-red-600";
                }
            }
        });
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
