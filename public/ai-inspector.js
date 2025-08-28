/**
 * AI Inspection Core Module
 * Integrated pixel difference detection + UI element classification + image cropping + Qwen report generation
 */

class AIInspector {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Main entry: Execute AI inspection
   * @param {string} designImageData - Design image base64 data
   * @param {HTMLCanvasElement} webpageCanvas - Webpage screenshot canvas
   * @returns {Object} Inspection results
   */
  async executeAIInspection(designImageData, webpageCanvas) {
    console.log('🚀 Starting AI inspection workflow...');
    
    try {
      
      // Step 1: Pixel difference detection
      const diffResult = await this.pixelDifferenceDetection(designImageData, webpageCanvas);
      
      if (!diffResult.regions || diffResult.regions.length === 0) {
        return {
          success: true,
          similarity: diffResult.similarity,
          regions: [],
          overlayImage: diffResult.overlayCanvas.toDataURL(),
          message: 'Page is highly consistent with design mockup, no significant differences found'
        };
      }

      // Step 2: Smart UI element classification
      const classifiedRegions = this.classifyUIElements(diffResult.regions, webpageCanvas);

      // Step 3: Generate region screenshots
      const regionScreenshots = await this.generateRegionScreenshots(
        classifiedRegions, 
        diffResult.cleanOverlayCanvas || diffResult.overlayCanvas
      );

      // Step 4: Generate problem descriptions  
      const problemDescriptions = await this.generateProblemDescriptions(regionScreenshots);

      // Step 5: Format into product-required problem list format
      const problemAreas = this.formatToProblemList(
        classifiedRegions,
        regionScreenshots,
        problemDescriptions
      );

      console.log(`✅ AI inspection complete, found ${problemAreas.length} issues`);

      return {
        success: true,
        similarity: diffResult.similarity,
        regions: problemAreas,
        overlayImage: diffResult.overlayCanvas.toDataURL()
      };

    } catch (error) {
      console.error('❌ AI inspection execution failed:', error);
      return {
        success: false,
        error: error.message,
        regions: []
      };
    }
  }

  /**
   * Pixel difference detection
   */
  async pixelDifferenceDetection(designImageData, webpageCanvas) {
    console.log('🔍 Executing pixel difference detection...');

    // Load design image
    const designImg = await this.loadImage(designImageData);
    
    // Unify dimensions
    const targetWidth = Math.min(designImg.width, webpageCanvas.width);
    const targetHeight = Math.min(designImg.height, webpageCanvas.height);

    // Create unified dimension canvas
    const designCanvas = this.createCanvas(targetWidth, targetHeight);
    const designCtx = designCanvas.getContext('2d');
    designCtx.drawImage(designImg, 0, 0, targetWidth, targetHeight);

    const webCanvas = this.createCanvas(targetWidth, targetHeight);
    const webCtx = webCanvas.getContext('2d');
    webCtx.drawImage(webpageCanvas, 0, 0, targetWidth, targetHeight);

    // Get pixel data
    const designData = designCtx.getImageData(0, 0, targetWidth, targetHeight);
    const webData = webCtx.getImageData(0, 0, targetWidth, targetHeight);

    // Calculate differences
    const diffMap = this.calculatePixelDifference(designData, webData);
    const similarity = this.calculateSimilarity(diffMap);

    // Detect difference regions
    const regions = this.detectDifferenceRegions(diffMap, targetWidth, targetHeight);
    
    // Merge nearby regions
    const mergedRegions = this.mergeNearbyRegions(regions);

    // Create overlay image (for final display)
    const overlayCanvas = this.createOverlayCanvas(designCanvas, webCanvas, mergedRegions);
    
    // Create overlay without numbers (for screenshots)
    const cleanOverlayCanvas = this.createOverlayCanvasWithoutNumbers(designCanvas, webCanvas, mergedRegions);

    console.log(`Found ${mergedRegions.length} difference regions, overall similarity: ${(similarity*100).toFixed(1)}%`);

    return {
      regions: mergedRegions,
      similarity: similarity,
      overlayCanvas: overlayCanvas,
      cleanOverlayCanvas: cleanOverlayCanvas
    };
  }

  /**
   * Calculate pixel differences
   */
  calculatePixelDifference(designData, webData) {
    const diffMap = new Uint8Array(designData.width * designData.height);
    
    for (let i = 0; i < designData.data.length; i += 4) {
      const pixelIndex = i / 4;
      
      // RGB difference calculation
      const r1 = designData.data[i], g1 = designData.data[i + 1], b1 = designData.data[i + 2];
      const r2 = webData.data[i], g2 = webData.data[i + 1], b2 = webData.data[i + 2];
      
      const diff = Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
      diffMap[pixelIndex] = diff > 25 ? diff : 0; // Threshold filtering
    }
    
    return diffMap;
  }

  /**
   * Detect difference regions
   */
  detectDifferenceRegions(diffMap, width, height) {
    // Binarization processing
    const binaryMap = new Uint8Array(width * height);
    for (let i = 0; i < diffMap.length; i++) {
      binaryMap[i] = diffMap[i] > 0 ? 255 : 0;
    }

    // Morphological operations (simplified version)
    const processedMap = this.morphologyClose(binaryMap, width, height, 15);
    
    // Connected region detection
    const regions = this.findConnectedRegions(processedMap, width, height);
    
    return regions.filter(region => region.area > 500); // Filter small regions
  }

  /**
   * 形态学闭运算（简化版）
   */
  morphologyClose(binaryMap, width, height, kernelSize) {
    const result = new Uint8Array(binaryMap.length);
    const half = Math.floor(kernelSize / 2);
    
    // 膨胀
    for (let y = half; y < height - half; y++) {
      for (let x = half; x < width - half; x++) {
        let hasWhite = false;
        
        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const idx = (y + ky) * width + (x + kx);
            if (binaryMap[idx] > 0) {
              hasWhite = true;
              break;
            }
          }
          if (hasWhite) break;
        }
        
        result[y * width + x] = hasWhite ? 255 : 0;
      }
    }
    
    // 腐蚀
    const final = new Uint8Array(result.length);
    for (let y = half; y < height - half; y++) {
      for (let x = half; x < width - half; x++) {
        let allWhite = true;
        
        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const idx = (y + ky) * width + (x + kx);
            if (result[idx] === 0) {
              allWhite = false;
              break;
            }
          }
          if (!allWhite) break;
        }
        
        final[y * width + x] = allWhite ? 255 : 0;
      }
    }
    
    return final;
  }

  /**
   * 连通区域检测
   */
  findConnectedRegions(binaryMap, width, height) {
    const visited = new Array(width * height).fill(false);
    const regions = [];
    let regionId = 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (binaryMap[idx] > 0 && !visited[idx]) {
          const region = this.floodFill(binaryMap, visited, x, y, width, height, regionId++);
          if (region.area > 0) {
            regions.push(region);
          }
        }
      }
    }

    return regions;
  }

  /**
   * 洪水填充算法
   */
  floodFill(binaryMap, visited, startX, startY, width, height, regionId) {
    const stack = [{x: startX, y: startY}];
    const points = [];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    while (stack.length > 0) {
      const {x, y} = stack.pop();
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height || 
          visited[idx] || binaryMap[idx] === 0) {
        continue;
      }

      visited[idx] = true;
      points.push({x, y});
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // 4连通
      stack.push({x: x+1, y: y});
      stack.push({x: x-1, y: y});
      stack.push({x: x, y: y+1});
      stack.push({x: x, y: y-1});
    }

    // 扩展边界
    const margin = 15;
    return {
      id: regionId,
      x: Math.max(0, minX - margin),
      y: Math.max(0, minY - margin),
      width: Math.min(width, maxX - minX + 1 + margin * 2),
      height: Math.min(height, maxY - minY + 1 + margin * 2),
      area: points.length,
      points: points
    };
  }

  /**
   * 合并相近区域（增强版）
   */
  mergeNearbyRegions(regions, threshold = 80) {
    if (regions.length <= 1) return regions;

    console.log(`Starting merge of ${regions.length} regions...`);

    // Step 1: Sort by region size, prioritize processing large regions
    const sortedRegions = regions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    const merged = [];
    const used = new Array(sortedRegions.length).fill(false);

    for (let i = 0; i < sortedRegions.length; i++) {
      if (used[i]) continue;

      const group = [sortedRegions[i]];
      used[i] = true;

      // Find nearby regions - use stricter merge conditions
      for (let j = i + 1; j < sortedRegions.length; j++) {
        if (used[j]) continue;

        if (this.shouldMergeRegions(sortedRegions[i], sortedRegions[j], threshold)) {
          group.push(sortedRegions[j]);
          used[j] = true;
        }
      }

      // Create merged region
      if (group.length === 1) {
        merged.push(group[0]);
      } else {
        console.log(`Merged ${group.length} small regions into one large region`);
        merged.push(this.createMergedRegion(group, merged.length + 1));
      }
    }

    // Step 2: Further remove overlapping regions
    const deduped = this.removeDuplicateRegions(merged);
    
    console.log(`Finally retained ${deduped.length} regions`);
    return deduped;
  }

  /**
   * Remove duplicate and highly overlapping regions
   */
  removeDuplicateRegions(regions) {
    if (regions.length <= 1) return regions;

    const filtered = [];
    
    for (let i = 0; i < regions.length; i++) {
      let isDuplicate = false;
      
      for (let j = 0; j < filtered.length; j++) {
        // Calculate overlap area
        const overlapArea = this.calculateOverlapArea(regions[i], filtered[j]);
        const region1Area = regions[i].width * regions[i].height;
        const region2Area = filtered[j].width * filtered[j].height;
        
        // If overlap exceeds 70%, consider as duplicate region
        const overlapRatio1 = overlapArea / region1Area;
        const overlapRatio2 = overlapArea / region2Area;
        
        if (overlapRatio1 > 0.7 || overlapRatio2 > 0.7) {
          isDuplicate = true;
          // Keep larger region
          if (region1Area > region2Area) {
            filtered[j] = regions[i];
          }
          break;
        }
      }
      
      if (!isDuplicate) {
        filtered.push(regions[i]);
      }
    }
    
    return filtered;
  }

  /**
   * 计算两个区域的重叠面积
   */
  calculateOverlapArea(region1, region2) {
    const left = Math.max(region1.x, region2.x);
    const right = Math.min(region1.x + region1.width, region2.x + region2.width);
    const top = Math.max(region1.y, region2.y);
    const bottom = Math.min(region1.y + region1.height, region2.y + region2.height);
    
    if (left < right && top < bottom) {
      return (right - left) * (bottom - top);
    }
    
    return 0;
  }

  /**
   * 判断是否应该合并区域（更严格的条件）
   */
  shouldMergeRegions(region1, region2, threshold) {
    const cx1 = region1.x + region1.width / 2;
    const cy1 = region1.y + region1.height / 2;
    const cx2 = region2.x + region2.width / 2;
    const cy2 = region2.y + region2.height / 2;

    const distance = Math.sqrt((cx1 - cx2)**2 + (cy1 - cy2)**2);
    
    // 计算区域尺寸差异
    const area1 = region1.width * region1.height;
    const area2 = region2.width * region2.height;
    const sizeRatio = Math.min(area1, area2) / Math.max(area1, area2);
    
    // 计算重叠度
    const overlapArea = this.calculateOverlapArea(region1, region2);
    const overlapRatio = overlapArea / Math.min(area1, area2);
    
    // 更严格的合并条件
    const shouldMerge = (
      // 1. 距离很近且大小相似
      (distance < threshold * 0.8 && sizeRatio > 0.3) ||
      // 2. 有重叠且在合理范围内
      (overlapRatio > 0.1 && overlapRatio < 0.9) ||
      // 3. 水平或垂直对齐且距离适中
      (Math.abs(cy1 - cy2) < 25 && distance < threshold && sizeRatio > 0.2) ||
      (Math.abs(cx1 - cx2) < 25 && distance < threshold && sizeRatio > 0.2)
    );
    
    // 但不要合并相差太大的区域
    if (Math.max(area1, area2) / Math.min(area1, area2) > 10) {
      return false;
    }
    
    return shouldMerge;
  }

  /**
   * 创建合并区域
   */
  createMergedRegion(regions, id) {
    const minX = Math.min(...regions.map(r => r.x));
    const minY = Math.min(...regions.map(r => r.y));
    const maxX = Math.max(...regions.map(r => r.x + r.width));
    const maxY = Math.max(...regions.map(r => r.y + r.height));

    return {
      id: id,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      area: regions.reduce((sum, r) => sum + r.area, 0),
      type: 'merged',
      subRegions: regions.length
    };
  }

  /**
   * UI元素分类
   */
  classifyUIElements(regions, canvas) {
    console.log('🎯 Starting UI element classification...');

    return regions.map(region => {
      const elementType = this.classifyByFeatures(
        region.width, 
        region.height, 
        region.x, 
        region.y, 
        canvas.width, 
        canvas.height
      );

      return {
        ...region,
        elementType: elementType,
        confidence: 0.85
      };
    });
  }

  /**
   * 根据特征分类元素
   */
  classifyByFeatures(width, height, x, y, imgWidth, imgHeight) {
    const area = width * height;
    const aspectRatio = width / height;
    
    // 位置分析
    const isTop = y < imgHeight * 0.2;
    const isCenter = y > imgHeight * 0.3 && y < imgHeight * 0.7;
    const isBottom = y > imgHeight * 0.8;

    // 分类逻辑
    if (isTop && height < 60 && width > 200) {
      return 'header';
    } else if (height < 40 && width > 150 && aspectRatio > 3) {
      return 'text';
    } else if (60 <= width <= 200 && 25 <= height <= 60 && aspectRatio < 4) {
      return 'button';
    } else if (width < 80 && height < 80 && aspectRatio < 2) {
      return 'icon';
    } else if (width > 300 && height < 100) {
      return 'navigation';
    } else if (area > 8000) {
      return 'container';
    } else if (isBottom && height < 100) {
      return 'footer';
    } else {
      return 'element';
    }
  }

  /**
   * 生成区域截图
   */
  async generateRegionScreenshots(regions, overlayCanvas) {
    console.log('📸 Generating region screenshots...');

    const screenshots = [];

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      
      // 创建区域截图canvas
      const regionCanvas = this.createCanvas(region.width, region.height);
      const regionCtx = regionCanvas.getContext('2d');
      
      // 从干净的叠加图中裁剪区域（已经不包含序号）
      regionCtx.drawImage(
        overlayCanvas,
        region.x, region.y, region.width, region.height,
        0, 0, region.width, region.height
      );

      // 在区域截图上画红色边框
      regionCtx.strokeStyle = 'red';
      regionCtx.lineWidth = 3;
      regionCtx.strokeRect(0, 0, region.width, region.height);

      screenshots.push({
        regionId: region.id,
        elementType: region.elementType,
        canvas: regionCanvas,
        dataURL: regionCanvas.toDataURL('image/png'),
        bounds: {
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height
        },
        // 添加差异分析数据
        diffAnalysis: {
          area: region.area,
          pixelCount: region.area,  // 差异像素数量
          severity: this.calculateSeverity(region.area),
          aspectRatio: region.width / region.height,
          isLargeArea: region.area > 8000,
          isSmallIcon: region.width < 80 && region.height < 80,
          isWideElement: (region.width / region.height) > 3,
          isTallElement: (region.height / region.width) > 2
        }
      });
    }

    console.log(`Generated ${screenshots.length} region screenshots`);
    return screenshots;
  }

  /**
   * 创建不带序号的叠加图（用于截图）
   */
  createOverlayCanvasWithoutNumbers(designCanvas, webCanvas, regions) {
    const canvas = this.createCanvas(designCanvas.width, designCanvas.height);
    const ctx = canvas.getContext('2d');

    // 创建半透明叠加
    ctx.globalAlpha = 0.5;
    ctx.drawImage(designCanvas, 0, 0);
    ctx.drawImage(webCanvas, 0, 0);
    ctx.globalAlpha = 1.0;

    // 只画红色边框，不画序号圆圈
    regions.forEach((region) => {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 4;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
    });

    return canvas;
  }



  /**
   * 生成基于像素差异的精准问题描述
   */
  async generateProblemDescriptions(regionScreenshots) {
    console.log('🎯 Generating precise problem descriptions based on pixel differences...');

    const descriptions = [];

    for (const screenshot of regionScreenshots) {
      try {
        // 直接基于区域特征和像素差异生成描述
        const description = this.generatePreciseDescription(screenshot);
        
        descriptions.push({
          regionId: screenshot.regionId,
          description: description.title,
          suggestion: description.suggestion
        });

      } catch (error) {
        console.error(`Failed to generate description, using fallback solution:`, error);
        
        // 备用方案
        const description = this.generateSmartDescription(screenshot);
        descriptions.push({
          regionId: screenshot.regionId,
          description: description.title,
          suggestion: description.suggestion
        });
      }
    }

    return descriptions;
  }

  /**
   * 调用Hugging Face BLIP-2 API（永久免费）
   */
  async callHuggingFaceAPI(screenshot) {
    try {
      console.log('🔗 Calling Hugging Face BLIP-2 API...');
      
      // 构造中文UI走查专用提示词
      const prompt = this.buildUIInspectionPrompt(screenshot.elementType);
      
      const response = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip2-opt-2.7b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: screenshot.dataURL,
          parameters: {
            text: prompt,
            max_new_tokens: 150,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Hugging Face API response:', result);

      // 解析API返回的结果并格式化为我们需要的格式
      return this.parseHuggingFaceResponse(result, screenshot);
      
    } catch (error) {
      console.error('Hugging Face API call failed:', error);
      throw error;
    }
  }

  /**
   * 构造UI走查专用提示词
   */
  buildUIInspectionPrompt(elementType) {
    const prompts = {
      'header': '分析这个页头区域的UI问题，检查高度、对齐、间距是否符合设计规范',
      'text': '分析这个文字区域的问题，检查字体大小、颜色、行高、对齐方式',
      'button': '分析这个按钮的样式问题，检查尺寸、圆角、颜色、内边距',
      'icon': '分析这个图标的显示问题，检查大小、颜色、位置、对齐',
      'navigation': '分析这个导航区域的布局问题，检查间距、对齐、响应式效果',
      'container': '分析这个容器的布局问题，检查宽度、内边距、背景、边框',
      'footer': '分析这个页脚区域的问题，检查高度、内容布局、对齐方式',
      'element': '分析这个UI元素的问题，检查位置、尺寸、样式是否符合设计稿'
    };

    const basePrompt = prompts[elementType] || prompts['element'];
    return `这是一个UI走查截图，显示了一个${elementType}元素。${basePrompt}。请用中文描述具体问题和修改建议。`;
  }

  /**
   * 解析Hugging Face API响应
   */
  parseHuggingFaceResponse(apiResponse, screenshot) {
    try {
      // BLIP-2返回的文本描述
      let description = '';
      if (Array.isArray(apiResponse)) {
        description = apiResponse[0]?.generated_text || '';
      } else if (apiResponse.generated_text) {
        description = apiResponse.generated_text;
      } else {
        throw new Error('API返回格式不正确');
      }

      // 基于API描述和元素类型生成具体的问题描述和建议
      return this.generateUISpecificDescription(description, screenshot);
      
    } catch (error) {
      console.error('解析API响应失败:', error);
      // 解析失败时使用智能备用方案
      return this.generateSmartDescription(screenshot);
    }
  }

  /**
   * 生成基于实际差异的精准描述
   */
  generatePreciseDescription(screenshot) {
    const elementType = screenshot.elementType;
    const bounds = screenshot.bounds;
    const diff = screenshot.diffAnalysis || {};
    
    // 基于区域位置判断页面区域
    const position = this.getPagePosition(bounds);
    
    // 差异严重程度
    const severity = diff.severity || 'minor';
    const severityText = severity === 'critical' ? 'significant' : severity === 'medium' ? 'obvious' : 'minor';
    
    // 基于元素类型、差异特征和实际尺寸生成准确描述
    let title = '';
    let suggestion = '';
    
    switch (elementType) {
      case 'text':
        if (diff.isWideElement) {
          title = `Long text area in ${position} has ${severityText} differences from design mockup, may involve line breaks, alignment or letter spacing issues`;
          suggestion = `Check text-align alignment, adjust letter-spacing and word-spacing, ensure text width is controlled within ${Math.round(bounds.width * 0.9)}px`;
        } else {
          title = `Text area in ${position} has ${severityText} differences from design mockup, font size or line height may be inconsistent`;
          suggestion = `Recommend adjusting font-size to ${Math.max(12, Math.round(bounds.height * 0.8))}px, line-height to ${(bounds.height * 1.2).toFixed(1)}px`;
        }
        break;
        
      case 'button':
        if (diff.isWideElement) {
          title = `Wide button style in ${position} has ${severityText} differences from design mockup, aspect ratio is uncoordinated`;
          suggestion = `Adjust button max-width to ${Math.round(bounds.width * 0.75)}px, increase vertical padding to improve proportion`;
        } else if (diff.isSmallIcon) {
          title = `Small button size in ${position} does not match design mockup, may be too small or lack padding`;
          suggestion = `Increase button minimum size to 32×32px, set padding: 8px 12px`;
        } else {
          title = `Button style in ${position} has ${severityText} differences from design mockup, need to adjust size or border radius`;
          suggestion = `Set button width to ${bounds.width}px, height to ${bounds.height}px, border-radius: ${Math.min(bounds.height/4, 8)}px`;
        }
        break;
        
      case 'icon':
        if (diff.isSmallIcon) {
          title = `Small icon display in ${position} has ${severityText} differences from design mockup, may be too small or unclear`;
          suggestion = `Ensure icon minimum size is 24×24px, use SVG format for clarity`;
        } else {
          title = `Icon size in ${position} does not match design mockup, displays too large or deformed`;
          suggestion = `Adjust icon size to ${Math.min(bounds.width, bounds.height)}×${Math.min(bounds.width, bounds.height)}px, maintain square proportion`;
        }
        break;
        
      case 'header':
        title = `Header area layout in ${position} has ${severityText} differences from design mockup, overall height or content distribution needs adjustment`;
        suggestion = `Set header fixed height to ${bounds.height}px, use flexbox to ensure content vertical center alignment`;
        break;
        
      case 'navigation':
        if (diff.isWideElement) {
          title = `Navigation bar width in ${position} has ${severityText} differences from design mockup, may have filled entire container width`;
          suggestion = `Limit navigation container max-width, increase gap between navigation items to ${Math.round(bounds.width * 0.03)}px`;
        } else {
          title = `Navigation area spacing or alignment in ${position} does not match design mockup`;
          suggestion = `Adjust navigation item spacing to 16px, ensure horizontal center alignment`;
        }
        break;
        
      case 'container':
        if (diff.isLargeArea) {
          title = `Large container area in ${position} has ${severityText} differences from design mockup, overall layout structure has major deviation`;
          suggestion = `Re-check container max-width limit, recommend setting to 1200px, adjust internal element spacing`;
        } else {
          title = `Container element in ${position} has ${severityText} differences from design mockup, margins or content arrangement needs optimization`;
          suggestion = `Adjust container padding to 16px, margin to auto for centering`;
        }
        break;
        
      case 'footer':
        title = `Footer area height or content layout in ${position} has ${severityText} differences from design mockup`;
        suggestion = `Set footer minimum height to ${Math.max(60, bounds.height)}px, use flexbox layout to ensure content centering`;
        break;
        
      default:
        if (diff.isLargeArea) {
          title = `Large area in ${position} has ${severityText} visual differences from design mockup, may involve background or layout issues`;
          suggestion = `Check background-color, border and overall layout settings in this area`;
        } else if (diff.isSmallIcon) {
          title = `Small element in ${position} displays inconsistently with design mockup, may be too small or missing`;
          suggestion = `Ensure element minimum display size, check visibility and opacity properties`;
        } else {
          title = `UI element in ${position} has ${severityText} visual differences from design mockup`;
          suggestion = `Check position, size and style property settings of this element against design mockup`;
        }
    }
    
    return { title, suggestion };
  }

  /**
   * 获取页面位置描述
   */
  getPagePosition(bounds) {
    const centerY = bounds.y + bounds.height / 2;
    const centerX = bounds.x + bounds.width / 2;
    
    let position = '';
    
    if (centerY < 150) {
      position = 'page top';
    } else if (centerY > 600) {
      position = 'page bottom';
    } else if (centerY > 200 && centerY < 500) {
      if (centerX < 300) {
        position = 'page middle-left';
      } else if (centerX > 700) {
        position = 'page middle-right';
      } else {
        position = 'page center area';
      }
    } else {
      position = 'page middle-upper';
    }
    
    return position;
  }

  /**
   * 基于API描述生成UI特定问题描述和建议（保留作备用）
   */
  generateUISpecificDescription(apiDescription, screenshot) {
    const elementType = screenshot.elementType;
    const bounds = screenshot.bounds;
    
    // 分析API描述中的关键信息
    const hasColorIssue = /color|颜色|色彩/.test(apiDescription);
    const hasSizeIssue = /size|大小|尺寸/.test(apiDescription);
    const hasPositionIssue = /position|位置|对齐/.test(apiDescription);
    const hasSpacingIssue = /spacing|间距|padding|margin/.test(apiDescription);
    
    // 根据元素类型和API分析结果生成具体描述
    let title = '';
    let suggestion = '';
    
    switch (elementType) {
      case 'text':
        if (hasColorIssue && hasSizeIssue) {
          title = `文字区域的颜色和字体大小与设计稿不一致，${apiDescription.substring(0, 50)}...`;
          suggestion = `调整文字颜色值和字体大小，建议font-size: ${Math.max(14, bounds.height * 0.6)}px`;
        } else if (hasColorIssue) {
          title = `文字颜色与设计稿存在差异，显示效果不符合预期`;
          suggestion = `检查并修改文字color属性，确保与设计稿颜色值一致`;
        } else {
          title = `文字样式与设计稿不匹配，可能涉及字体、大小或行高`;
          suggestion = `调整font-size为${Math.max(14, bounds.height * 0.6)}px，line-height为${(bounds.height * 0.8).toFixed(1)}px`;
        }
        break;
        
      case 'button':
        if (hasColorIssue) {
          title = `按钮背景色或边框颜色与设计稿不符，影响视觉统一性`;
          suggestion = `修改按钮的background-color和border-color，确保与设计稿颜色一致`;
        } else if (hasSizeIssue) {
          title = `按钮尺寸与设计稿差异明显，需要调整宽高`;
          suggestion = `设置按钮尺寸为${bounds.width}×${bounds.height}px，调整内边距`;
        } else {
          title = `按钮样式与设计稿存在差异，需要优化视觉效果`;
          suggestion = `调整padding: ${Math.round(bounds.height * 0.25)}px ${Math.round(bounds.width * 0.1)}px，border-radius: ${Math.min(bounds.height * 0.2, 8)}px`;
        }
        break;
        
      case 'icon':
        if (hasSizeIssue) {
          title = `图标尺寸与设计稿不匹配，显示过大或过小`;
          suggestion = `统一图标尺寸为${Math.max(24, Math.min(bounds.width, bounds.height))}px`;
        } else if (hasColorIssue) {
          title = `图标颜色或透明度与设计稿不一致`;
          suggestion = `检查图标的fill或color属性，确保颜色值与设计稿相符`;
        } else {
          title = `图标显示与设计稿存在差异，需要调整样式`;
          suggestion = `检查图标的尺寸、颜色和位置，确保与设计稿一致`;
        }
        break;
        
      default:
        // 通用处理
        if (hasColorIssue) {
          title = `${elementType}元素的颜色与设计稿不符，需要调整`;
          suggestion = `检查元素的颜色相关CSS属性，确保与设计稿颜色值一致`;
        } else if (hasSizeIssue) {
          title = `${elementType}元素尺寸与设计稿差异较大`;
          suggestion = `调整元素尺寸为${bounds.width}×${bounds.height}px附近的合适值`;
        } else {
          title = `${elementType}元素与设计稿存在视觉差异`;
          suggestion = `对照设计稿检查该元素的样式属性，进行相应调整`;
        }
    }
    
    return { title, suggestion };
  }

  /**
   * 智能描述生成（备用方案）
   */
  generateSmartDescription(screenshot) {
    const elementType = screenshot.elementType;
    const bounds = screenshot.bounds;

    const descriptions = {
      'header': {
        title: 'Page header layout differs from design mockup, possibly inconsistent height or content arrangement',
        suggestion: `Adjust header container height to ${bounds.height}px, check content vertical center alignment`
      },
      'text': {
        title: 'Text content style does not match design mockup, font size or line height may be off',
        suggestion: `Recommend adjusting font-size to ${Math.max(14, bounds.height * 0.6)}px, line-height to ${(bounds.height * 0.8).toFixed(1)}px`
      },
      'button': {
        title: 'Button styling has significant differences from design mockup, need to adjust size, color or border radius',
        suggestion: `Set padding: ${Math.round(bounds.height * 0.25)}px ${Math.round(bounds.width * 0.1)}px, border-radius: ${Math.min(bounds.height * 0.2, 8)}px`
      },
      'icon': {
        title: 'Icon display does not match design mockup, possible size, color or position deviation',
        suggestion: `Unify icon size to ${Math.max(24, Math.min(bounds.width, bounds.height))}px, check if color values match design mockup`
      },
      'navigation': {
        title: 'Navigation elements layout inconsistent with design mockup, spacing or alignment needs adjustment',
        suggestion: `Check navigation item spacing, recommend setting margin: 0 ${Math.round(bounds.width * 0.02)}px`
      },
      'container': {
        title: 'Page middle-right large container area has significant differences from design mockup, overall layout structure has major deviation',
        suggestion: `Re-check container max-width: ${bounds.width}px, padding: ${Math.round(bounds.height * 0.03)}px`
      },
      'footer': {
        title: 'Footer area does not match design mockup, height or content layout needs adjustment',
        suggestion: `Adjust footer height to ${bounds.height}px, check content center alignment`
      },
      'element': {
        title: 'Page bottom button style differs from design mockup, need to adjust size or border radius',
        suggestion: `Refer to design mockup to adjust this element CSS properties, ensure accurate position and size`
      }
    };

    return descriptions[elementType] || descriptions['element'];
  }

  /**
   * 备用描述
   */
  getFallbackDescription(elementType) {
    return `${elementType} element differs from design mockup, needs further adjustment`;
  }

  getFallbackSuggestion(elementType) {
    return `Please check the style settings of this ${elementType} against design mockup`;
  }

  /**
   * 格式化为产品问题列表格式
   */
  formatToProblemList(regions, screenshots, descriptions) {
    console.log('📋 Formatting problem list...');

    return regions.map((region, index) => {
      const screenshot = screenshots.find(s => s.regionId === region.id);
      const description = descriptions.find(d => d.regionId === region.id);

      return {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        description: description ? description.description : this.getFallbackDescription(region.elementType),
        suggestion: description ? description.suggestion : this.getFallbackSuggestion(region.elementType),
        elementType: region.elementType,
        confidence: region.confidence,
        screenshot: screenshot ? screenshot.dataURL : null,
        area: region.area,
        severity: this.calculateSeverity(region.area)
      };
    });
  }

  /**
   * 计算问题严重程度
   */
  calculateSeverity(area) {
    if (area > 8000) return 'critical';
    if (area > 2000) return 'medium';
    return 'minor';
  }

  /**
   * 计算相似度
   */
  calculateSimilarity(diffMap) {
    const totalPixels = diffMap.length;
    const diffPixels = diffMap.filter(pixel => pixel > 0).length;
    return 1 - (diffPixels / totalPixels);
  }

  /**
   * 创建叠加图canvas
   */
  createOverlayCanvas(designCanvas, webCanvas, regions) {
    const canvas = this.createCanvas(designCanvas.width, designCanvas.height);
    const ctx = canvas.getContext('2d');

    // 创建半透明叠加
    ctx.globalAlpha = 0.5;
    ctx.drawImage(designCanvas, 0, 0);
    ctx.drawImage(webCanvas, 0, 0);
    ctx.globalAlpha = 1.0;

    // 画红色边框
    regions.forEach((region, index) => {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 4;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      // 画编号圆圈
      const centerX = region.x + 15;
      const centerY = region.y + 15;
      
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((index + 1).toString(), centerX, centerY);
    });

    return canvas;
  }

  // === 辅助方法 ===

  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}

// 导出AI走查器
window.AIInspector = AIInspector;
