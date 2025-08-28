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
          message: 'Page is highly consistent with design mockup, no significant differences found'
        };
      }

      // Step 2: Smart UI element classification
      const classifiedRegions = this.classifyUIElements(diffResult.regions, webpageCanvas);

      // Step 3: Generate region screenshots
      const regionScreenshots = await this.generateRegionScreenshots(
        classifiedRegions, 
        diffResult.overlayCanvas
      );

      // Step 4: Generate problem descriptions using AI
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

    console.log(`Found ${mergedRegions.length} difference regions, overall similarity: ${(similarity*100).toFixed(1)}%`);

    return {
      regions: mergedRegions,
      similarity: similarity,
      overlayCanvas: overlayCanvas
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
   * Merge nearby regions
   */
  mergeNearbyRegions(regions, threshold = 60) {
    if (regions.length <= 1) return regions;

    const merged = [];
    const used = new Array(regions.length).fill(false);

    for (let i = 0; i < regions.length; i++) {
      if (used[i]) continue;

      const group = [regions[i]];
      used[i] = true;

      // Find nearby regions
      for (let j = i + 1; j < regions.length; j++) {
        if (used[j]) continue;

        if (this.shouldMergeRegions(regions[i], regions[j], threshold)) {
          group.push(regions[j]);
          used[j] = true;
        }
      }

      // Create merged region
      if (group.length === 1) {
        merged.push(group[0]);
      } else {
        merged.push(this.createMergedRegion(group, merged.length + 1));
      }
    }

    return merged;
  }

  /**
   * Determine if regions should be merged
   */
  shouldMergeRegions(region1, region2, threshold) {
    const cx1 = region1.x + region1.width / 2;
    const cy1 = region1.y + region1.height / 2;
    const cx2 = region2.x + region2.width / 2;
    const cy2 = region2.y + region2.height / 2;

    const distance = Math.sqrt((cx1 - cx2)**2 + (cy1 - cy2)**2);
    
    // Close distance or horizontal/vertical alignment
    return distance < threshold || 
           (Math.abs(cy1 - cy2) < 30 && distance < threshold * 1.5) ||
           (Math.abs(cx1 - cx2) < 30 && distance < threshold * 1.5);
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
      
      // Crop region from overlay image
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
        }
      });
    }

    console.log(`Generated ${screenshots.length} region screenshots`);
    return screenshots;
  }

  /**
   * Generate problem descriptions using AI
   */
  async generateProblemDescriptions(regionScreenshots) {
    console.log('🤖 Generating problem descriptions using AI...');

    // Replace this with actual AI API call
    // Providing a mock implementation with real API call examples

    const descriptions = [];

    for (const screenshot of regionScreenshots) {
      try {
        // Mock description generation (can be replaced with real AI API call)
        const description = this.generateMockDescription(screenshot);
        
        descriptions.push({
          regionId: screenshot.regionId,
          description: description.title,
          suggestion: description.suggestion
        });

      } catch (error) {
        console.error(`Failed to generate description for region ${screenshot.regionId}:`, error);
        
        // Use fallback description on failure
        descriptions.push({
          regionId: screenshot.regionId,
          description: this.getFallbackDescription(screenshot.elementType),
          suggestion: this.getFallbackSuggestion(screenshot.elementType)
        });
      }
    }

    return descriptions;
  }

  /**
   * Mock AI description generation (replace with real API call)
   */
  generateMockDescription(screenshot) {
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