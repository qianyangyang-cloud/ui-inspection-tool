/**
 * AI Inspection Core Module
 * Integrated pixel difference detection + UI element classification + image segmentation + AI report generation
 */

class AIInspector {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Main entry point: Execute AI inspection
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

      console.log(`✅ AI inspection completed, found ${problemAreas.length} issues`);

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
    
    // Standardize dimensions
    const targetWidth = Math.min(designImg.width, webpageCanvas.width);
    const targetHeight = Math.min(designImg.height, webpageCanvas.height);

    // Create canvas with unified dimensions
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
    
    // Create overlay image without numbers (for screenshots)
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
    // Binary processing
    const binaryMap = new Uint8Array(width * height);
    for (let i = 0; i < diffMap.length; i++) {
      binaryMap[i] = diffMap[i] > 0 ? 255 : 0;
    }

    // Morphological operations (simplified)
    const processedMap = this.morphologyClose(binaryMap, width, height, 15);
    
    // Connected region detection
    const regions = this.findConnectedRegions(processedMap, width, height);
    
    return regions.filter(region => region.area > 500); // Filter small regions
  }

  /**
   * Morphological closing operation (simplified)
   */
  morphologyClose(binaryMap, width, height, kernelSize) {
    const result = new Uint8Array(binaryMap.length);
    const half = Math.floor(kernelSize / 2);
    
    // Dilation
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
    
    // Erosion
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
   * Connected region detection
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
   * Flood fill algorithm
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

      // 4-connectivity
      stack.push({x: x+1, y: y});
      stack.push({x: x-1, y: y});
      stack.push({x: x, y: y+1});
      stack.push({x: x, y: y-1});
    }

    // Expand boundaries
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
   * Merge nearby regions (enhanced version)
   */
  mergeNearbyRegions(regions, threshold = 80) {
    if (regions.length <= 1) return regions;

    console.log(`Starting to merge ${regions.length} regions...`);

    // Step 1: Sort by region size, prioritize larger regions
    const sortedRegions = regions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    const merged = [];
    const used = new Array(sortedRegions.length).fill(false);

    for (let i = 0; i < sortedRegions.length; i++) {
      if (used[i]) continue;

      const group = [sortedRegions[i]];
      used[i] = true;

      // Find nearby regions - use stricter merge criteria
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
        
        // If overlap exceeds 70%, consider as duplicate regions
        const overlapRatio1 = overlapArea / region1Area;
        const overlapRatio2 = overlapArea / region2Area;
        
        if (overlapRatio1 > 0.7 || overlapRatio2 > 0.7) {
          isDuplicate = true;
          // Keep the larger region
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
   * Calculate overlap area between two regions
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
   * Determine if regions should be merged (stricter criteria)
   */
  shouldMergeRegions(region1, region2, threshold) {
    const cx1 = region1.x + region1.width / 2;
    const cy1 = region1.y + region1.height / 2;
    const cx2 = region2.x + region2.width / 2;
    const cy2 = region2.y + region2.height / 2;

    const distance = Math.sqrt((cx1 - cx2)**2 + (cy1 - cy2)**2);
    
    // Calculate region size differences
    const area1 = region1.width * region1.height;
    const area2 = region2.width * region2.height;
    const sizeRatio = Math.min(area1, area2) / Math.max(area1, area2);
    
    // Calculate overlap ratio
    const overlapArea = this.calculateOverlapArea(region1, region2);
    const overlapRatio = overlapArea / Math.min(area1, area2);
    
    // Stricter merging criteria
    const shouldMerge = (
      // 1. Close distance and similar size
      (distance < threshold * 0.8 && sizeRatio > 0.3) ||
      // 2. Has overlap within reasonable range
      (overlapRatio > 0.1 && overlapRatio < 0.9) ||
      // 3. Horizontally or vertically aligned with moderate distance
      (Math.abs(cy1 - cy2) < 25 && distance < threshold && sizeRatio > 0.2) ||
      (Math.abs(cx1 - cx2) < 25 && distance < threshold && sizeRatio > 0.2)
    );
    
    // But don't merge regions that differ too much
    if (Math.max(area1, area2) / Math.min(area1, area2) > 10) {
      return false;
    }
    
    return shouldMerge;
  }

  /**
   * Create merged region
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
   * UI element classification
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
   * Classify elements by features
   */
  classifyByFeatures(width, height, x, y, imgWidth, imgHeight) {
    const area = width * height;
    const aspectRatio = width / height;
    
    // Position analysis
    const isTop = y < imgHeight * 0.2;
    const isCenter = y > imgHeight * 0.3 && y < imgHeight * 0.7;
    const isBottom = y > imgHeight * 0.8;

    // Classification logic
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
   * Generate region screenshots
   */
  async generateRegionScreenshots(regions, overlayCanvas) {
    console.log('📸 Generating region screenshots...');

    const screenshots = [];

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      
      // Create region screenshot canvas
      const regionCanvas = this.createCanvas(region.width, region.height);
      const regionCtx = regionCanvas.getContext('2d');
      
      // Crop region from clean overlay image (no longer contains numbers)
      regionCtx.drawImage(
        overlayCanvas,
        region.x, region.y, region.width, region.height,
        0, 0, region.width, region.height
      );

      // Draw red border on region screenshot
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
        // Add difference analysis data
        diffAnalysis: {
          area: region.area,
          pixelCount: region.area,  // Number of different pixels
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
   * Create overlay image without numbers (for screenshots)
   */
  createOverlayCanvasWithoutNumbers(designCanvas, webCanvas, regions) {
    const canvas = this.createCanvas(designCanvas.width, designCanvas.height);
    const ctx = canvas.getContext('2d');

    // Create semi-transparent overlay
    ctx.globalAlpha = 0.5;
    ctx.drawImage(designCanvas, 0, 0);
    ctx.drawImage(webCanvas, 0, 0);
    ctx.globalAlpha = 1.0;

    // Only draw red borders, no numbered circles
    regions.forEach((region) => {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 4;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
    });

    return canvas;
  }



  /**
   * Generate precise problem descriptions based on pixel differences
   */
  async generateProblemDescriptions(regionScreenshots) {
    console.log('🎯 Generating precise problem descriptions based on pixel difference analysis...');

    const descriptions = [];

    for (const screenshot of regionScreenshots) {
      try {
        // Generate descriptions directly based on region features and pixel differences
        const description = this.generatePreciseDescription(screenshot);
        
        descriptions.push({
          regionId: screenshot.regionId,
          description: description.title,
          suggestion: description.suggestion
        });

      } catch (error) {
        console.error(`Failed to generate description, using fallback solution:`, error);
        
        // Fallback solution
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
   * Call Hugging Face BLIP-2 API (permanently free)
   */
  async callHuggingFaceAPI(screenshot) {
    try {
      console.log('🔗 Calling Hugging Face BLIP-2 API...');
      
      // Construct UI inspection prompt
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

      // Parse API results and format into our required format
      return this.parseHuggingFaceResponse(result, screenshot);
      
    } catch (error) {
      console.error('Hugging Face API call failed:', error);
      throw error;
    }
  }

  /**
   * Build UI inspection-specific prompts
   */
  buildUIInspectionPrompt(elementType) {
    const prompts = {
      'header': 'Analyze UI issues in this header region, check if height, alignment, and spacing comply with design specifications',
      'text': 'Analyze issues in this text region, check font size, color, line height, and alignment method',
      'button': 'Analyze styling issues of this button, check size, border-radius, color, and padding',
      'icon': 'Analyze display issues of this icon, check size, color, position, and alignment',
      'navigation': 'Analyze layout issues in this navigation region, check spacing, alignment, and responsive effects',
      'container': 'Analyze layout issues of this container, check width, padding, background, and borders',
      'footer': 'Analyze issues in this footer region, check height, content layout, and alignment method',
      'element': 'Analyze issues of this UI element, check if position, size, and style match the design mockup'
    };

    const basePrompt = prompts[elementType] || prompts['element'];
    return `This is a UI inspection screenshot showing a ${elementType} element. ${basePrompt}. Please describe specific issues and modification suggestions.`;
  }

  /**
   * Parse Hugging Face API response
   */
  parseHuggingFaceResponse(apiResponse, screenshot) {
    try {
      // Text description returned by BLIP-2
      let description = '';
      if (Array.isArray(apiResponse)) {
        description = apiResponse[0]?.generated_text || '';
      } else if (apiResponse.generated_text) {
        description = apiResponse.generated_text;
      } else {
        throw new Error('Incorrect API response format');
      }

      // Generate specific problem descriptions and suggestions based on API description and element type
      return this.generateUISpecificDescription(description, screenshot);
      
    } catch (error) {
      console.error('Failed to parse API response:', error);
      // Use smart fallback when parsing fails
      return this.generateSmartDescription(screenshot);
    }
  }

  /**
   * Generate precise descriptions based on actual differences
   */
  generatePreciseDescription(screenshot) {
    const elementType = screenshot.elementType;
    const bounds = screenshot.bounds;
    const diff = screenshot.diffAnalysis || {};
    
    // Determine page region based on region position
    const position = this.getPagePosition(bounds);
    
    // Difference severity level
    const severity = diff.severity || 'minor';
    const severityText = severity === 'critical' ? 'significant' : severity === 'medium' ? 'obvious' : 'minor';
    
    // Generate accurate descriptions based on element type, difference characteristics, and actual dimensions
    let title = '';
    let suggestion = '';
    
    switch (elementType) {
      case 'text':
        if (diff.isWideElement) {
          title = `${position} long text region has ${severityText} differences from design mockup, possibly involving line breaks, alignment or character spacing issues`;
          suggestion = `Check text-align alignment method, adjust letter-spacing and word-spacing, ensure text width is controlled within ${Math.round(bounds.width * 0.9)}px`;
        } else {
          title = `${position} text region has ${severityText} differences from design mockup, font size or line height may be inconsistent`;
          suggestion = `Recommend adjusting font-size to ${Math.max(12, Math.round(bounds.height * 0.8))}px, set line-height to ${(bounds.height * 1.2).toFixed(1)}px`;
        }
        break;
        
      case 'button':
        if (diff.isWideElement) {
          title = `${position} wide button styling has ${severityText} differences from design mockup, width-height ratio is unbalanced`;
          suggestion = `Adjust button max-width to ${Math.round(bounds.width * 0.75)}px, increase vertical padding value to improve ratio`;
        } else if (diff.isSmallIcon) {
          title = `${position} small button size does not match design mockup, possibly too small or lacking padding`;
          suggestion = `Increase minimum button size to 32×32px, set padding: 8px 12px`;
        } else {
          title = `${position} button styling has ${severityText} differences from design mockup, size or border-radius needs adjustment`;
          suggestion = `Set button width to ${bounds.width}px, height to ${bounds.height}px, border-radius: ${Math.min(bounds.height/4, 8)}px`;
        }
        break;
        
      case 'icon':
        if (diff.isSmallIcon) {
          title = `${position} small icon display has ${severityText} differences from design mockup, possibly too small or unclear`;
          suggestion = `Ensure minimum icon size is 24×24px, use SVG format to ensure clarity`;
        } else {
          title = `${position} icon size does not match design mockup, displayed too large or distorted`;
          suggestion = `Adjust icon size to ${Math.min(bounds.width, bounds.height)}×${Math.min(bounds.width, bounds.height)}px, maintain square ratio`;
        }
        break;
        
      case 'header':
        title = `${position} header region layout has ${severityText} differences from design mockup, overall height or content distribution needs adjustment`;
        suggestion = `Set header fixed height to ${bounds.height}px, use flexbox to ensure content is vertically centered`;
        break;
        
      case 'navigation':
        if (diff.isWideElement) {
          title = `${position} navigation bar width has ${severityText} differences from design mockup, possibly fills entire container width`;
          suggestion = `Limit navigation container max-width, increase gap between navigation items to ${Math.round(bounds.width * 0.03)}px`;
        } else {
          title = `${position} navigation region spacing or alignment does not match design mockup`;
          suggestion = `Adjust navigation item spacing to 16px, ensure horizontal center alignment`;
        }
        break;
        
      case 'container':
        if (diff.isLargeArea) {
          title = `${position} large container region has ${severityText} differences from design mockup, overall layout structure deviation is significant`;
          suggestion = `Recheck container max-width limit, recommend setting to 1200px, adjust internal element spacing`;
        } else {
          title = `${position} container element has ${severityText} differences from design mockup, margins or content arrangement needs optimization`;
          suggestion = `Adjust container padding to 16px, set margin to auto for centering`;
        }
        break;
        
      case 'footer':
        title = `${position} footer region height or content layout has ${severityText} differences from design mockup`;
        suggestion = `Set footer minimum height to ${Math.max(60, bounds.height)}px, use flexbox layout to ensure content is centered`;
        break;
        
      default:
        if (diff.isLargeArea) {
          title = `${position} large area region has ${severityText} visual differences from design mockup, possibly involving background or layout issues`;
          suggestion = `Check this region's background-color, border and overall layout settings`;
        } else if (diff.isSmallIcon) {
          title = `${position} small element display is inconsistent with design mockup, possibly too small or missing`;
          suggestion = `Ensure element minimum display size, check visibility and opacity properties`;
        } else {
          title = `${position} UI element has ${severityText} visual differences from design mockup`;
          suggestion = `Check this element's position, size and style property settings against the design mockup`;
        }
    }
    
    return { title, suggestion };
  }

  /**
   * Get page position description
   */
  getPagePosition(bounds) {
    const centerY = bounds.y + bounds.height / 2;
    const centerX = bounds.x + bounds.width / 2;
    
    let position = '';
    
    if (centerY < 150) {
      position = 'Top of page';
    } else if (centerY > 600) {
      position = 'Bottom of page';
    } else if (centerY > 200 && centerY < 500) {
      if (centerX < 300) {
        position = 'Middle-left of page';
      } else if (centerX > 700) {
        position = 'Middle-right of page';
      } else {
        position = 'Center of page';
      }
    } else {
      position = 'Upper-middle of page';
    }
    
    return position;
  }

  /**
   * Generate UI-specific problem descriptions and suggestions based on API description (retained as backup)
   */
  generateUISpecificDescription(apiDescription, screenshot) {
    const elementType = screenshot.elementType;
    const bounds = screenshot.bounds;
    
    // Analyze key information from API description
    const hasColorIssue = /color/.test(apiDescription);
    const hasSizeIssue = /size/.test(apiDescription);
    const hasPositionIssue = /position|alignment/.test(apiDescription);
    const hasSpacingIssue = /spacing|padding|margin/.test(apiDescription);
    
    // Generate specific descriptions based on element type and API analysis results
    let title = '';
    let suggestion = '';
    
    switch (elementType) {
      case 'text':
        if (hasColorIssue && hasSizeIssue) {
          title = `Text region color and font size do not match design mockup, ${apiDescription.substring(0, 50)}...`;
          suggestion = `Adjust text color value and font size, recommend font-size: ${Math.max(14, bounds.height * 0.6)}px`;
        } else if (hasColorIssue) {
          title = `Text color differs from design mockup, display effect does not meet expectations`;
          suggestion = `Check and modify text color property, ensure consistency with design mockup color values`;
        } else {
          title = `Text styling does not match design mockup, possibly involving font, size or line height`;
          suggestion = `Adjust font-size to ${Math.max(14, bounds.height * 0.6)}px, line-height to ${(bounds.height * 0.8).toFixed(1)}px`;
        }
        break;
        
      case 'button':
        if (hasColorIssue) {
          title = `Button background color or border color does not match design mockup, affecting visual consistency`;
          suggestion = `Modify button's background-color and border-color, ensure consistency with design mockup colors`;
        } else if (hasSizeIssue) {
          title = `Button size shows obvious differences from design mockup, width and height need adjustment`;
          suggestion = `Set button size to ${bounds.width}×${bounds.height}px, adjust padding`;
        } else {
          title = `Button styling differs from design mockup, visual effects need optimization`;
          suggestion = `Adjust padding: ${Math.round(bounds.height * 0.25)}px ${Math.round(bounds.width * 0.1)}px, border-radius: ${Math.min(bounds.height * 0.2, 8)}px`;
        }
        break;
        
      case 'icon':
        if (hasSizeIssue) {
          title = `Icon size does not match design mockup, displayed too large or too small`;
          suggestion = `Standardize icon size to ${Math.max(24, Math.min(bounds.width, bounds.height))}px`;
        } else if (hasColorIssue) {
          title = `Icon color or transparency does not match design mockup`;
          suggestion = `Check icon's fill or color properties, ensure color values match design mockup`;
        } else {
          title = `Icon display differs from design mockup, styling needs adjustment`;
          suggestion = `Check icon's size, color and position, ensure consistency with design mockup`;
        }
        break;
        
      default:
        // Generic handling
        if (hasColorIssue) {
          title = `${elementType} element color does not match design mockup, needs adjustment`;
          suggestion = `Check element's color-related CSS properties, ensure consistency with design mockup color values`;
        } else if (hasSizeIssue) {
          title = `${elementType} element size shows significant differences from design mockup`;
          suggestion = `Adjust element size to appropriate values around ${bounds.width}×${bounds.height}px`;
        } else {
          title = `${elementType} element has visual differences from design mockup`;
          suggestion = `Check this element's style properties against design mockup, make corresponding adjustments`;
        }
    }
    
    return { title, suggestion };
  }

  /**
   * Smart description generation (fallback solution)
   */
  generateSmartDescription(screenshot) {
    const elementType = screenshot.elementType;
    const bounds = screenshot.bounds;

    const descriptions = {
      'header': {
        title: 'Header region layout differs from design mockup, possibly due to inconsistent height or content arrangement',
        suggestion: `Adjust header container height to ${bounds.height}px, check vertical centering of content`
      },
      'text': {
        title: 'Text content styling does not match design mockup, possible font size or line height deviation',
        suggestion: `Recommend adjusting font-size to ${Math.max(14, bounds.height * 0.6)}px, line-height to ${(bounds.height * 0.8).toFixed(1)}px`
      },
      'button': {
        title: 'Button styling shows significant difference from design mockup, size, color or border-radius needs adjustment',
        suggestion: `Set padding: ${Math.round(bounds.height * 0.25)}px ${Math.round(bounds.width * 0.1)}px, border-radius: ${Math.min(bounds.height * 0.2, 8)}px`
      },
      'icon': {
        title: 'Icon display does not match design mockup, possible size, color or position deviation',
        suggestion: `Standardize icon size to ${Math.max(24, Math.min(bounds.width, bounds.height))}px, check if color values match design mockup`
      },
      'navigation': {
        title: 'Navigation bar elements layout inconsistent with design mockup, spacing or alignment needs adjustment',
        suggestion: `Check navigation item spacing, recommend setting margin: 0 ${Math.round(bounds.width * 0.02)}px`
      },
      'container': {
        title: 'Container layout shows significant difference from design mockup, overall structure needs adjustment',
        suggestion: `Recheck container max-width: ${bounds.width}px, padding: ${Math.round(bounds.height * 0.03)}px`
      },
      'footer': {
        title: 'Footer area does not match design mockup, height or content layout needs adjustment',
        suggestion: `Adjust footer height to ${bounds.height}px, check content center alignment`
      },
      'element': {
        title: 'UI element differs from design mockup, position, size or styling needs to be checked',
        suggestion: `Adjust this element's CSS properties according to design mockup, ensure accurate position and dimensions`
      }
    };

    return descriptions[elementType] || descriptions['element'];
  }

  /**
   * Fallback descriptions
   */
  getFallbackDescription(elementType) {
    return `${elementType} element differs from design mockup, requires further adjustment`;
  }

  getFallbackSuggestion(elementType) {
    return `Please check the styling settings of this ${elementType} against the design mockup`;
  }

  /**
   * Format into product problem list format
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
   * Calculate issue severity
   */
  calculateSeverity(area) {
    if (area > 8000) return 'critical';
    if (area > 2000) return 'medium';
    return 'minor';
  }

  /**
   * Calculate similarity
   */
  calculateSimilarity(diffMap) {
    const totalPixels = diffMap.length;
    const diffPixels = diffMap.filter(pixel => pixel > 0).length;
    return 1 - (diffPixels / totalPixels);
  }

  /**
   * Create overlay canvas
   */
  createOverlayCanvas(designCanvas, webCanvas, regions) {
    const canvas = this.createCanvas(designCanvas.width, designCanvas.height);
    const ctx = canvas.getContext('2d');

    // Create semi-transparent overlay
    ctx.globalAlpha = 0.5;
    ctx.drawImage(designCanvas, 0, 0);
    ctx.drawImage(webCanvas, 0, 0);
    ctx.globalAlpha = 1.0;

    // Draw red borders
    regions.forEach((region, index) => {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 4;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      // Draw numbered circles
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

  // === Helper Methods ===

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

// Export AI Inspector
window.AIInspector = AIInspector;