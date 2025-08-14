import React, { useState, useRef, useCallback } from 'react';
import './index.css';

function App() {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [designImage, setDesignImage] = useState(null);
  const [imageOpacity, setImageOpacity] = useState(0.5);
  const [imageSize, setImageSize] = useState({ width: 400, height: 300 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [imageTransformOrigin, setImageTransformOrigin] = useState('center center');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [resizeStart, setResizeStart] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState(null);
  const [selectionStart, setSelectionStart] = useState(null);
  const [issues, setIssues] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalScreenshot, setModalScreenshot] = useState(null);
  const [currentIssue, setCurrentIssue] = useState({ description: '', suggestion: '' });
  const [editingIssueId, setEditingIssueId] = useState(null);
  const [designSize, setDesignSize] = useState({ width: 1440, height: 900 });
  const [showScreenshotTip, setShowScreenshotTip] = useState(false);

  const previewRef = useRef();
  const fileInputRef = useRef();
  const iframeRef = useRef();

  // Common web design dimensions
  const designSizePresets = [
    { name: '1440×900 (Mainstream)', width: 1440, height: 900 },
    { name: '1920×1080 (Desktop)', width: 1920, height: 1080 },
    { name: '1366×768 (Laptop)', width: 1366, height: 768 },
    { name: '1280×720 (Small Screen)', width: 1280, height: 720 },
    { name: '1600×900 (Widescreen)', width: 1600, height: 900 }
  ];

  const loadUrl = () => {
    if (url.trim()) {
      setCurrentUrl(url.trim());
    }
  };

  const clearPage = () => {
    setUrl('');
    setCurrentUrl('');
    setDesignImage(null);
    setImagePosition({ x: 0, y: 0 });
    setImageSize({ width: 400, height: 300 });
    setImageScale(1);
    setImageTransformOrigin('center center');
    setSelection(null);
    setSelectionStart(null);
    setIsSelecting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };



  // Switch design dimensions
  const handleDesignSizeChange = (event) => {
    const selectedIndex = event.target.value;
    const selectedPreset = designSizePresets[selectedIndex];
    setDesignSize({ width: selectedPreset.width, height: selectedPreset.height });
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (10MB = 10 * 1024 * 1024 bytes)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`Image file too large (${(file.size / 1024 / 1024).toFixed(1)}MB), please select an image smaller than 10MB`);
        event.target.value = ''; // Clear file selection
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setDesignImage(e.target.result);
          
          // Set initial dimensions
          const maxWidth = 500;
          const maxHeight = 400;
          let width = img.width;
          let height = img.height;
          
          // If image is too large, scale it down proportionally
          if (width > maxWidth || height > maxHeight) {
            const scaleX = maxWidth / width;
            const scaleY = maxHeight / height;
            const scale = Math.min(scaleX, scaleY);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          
          setImageSize({ width, height });
          setImagePosition({ x: 100, y: 100 });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current.click();
  };

  const removeDesignImage = () => {
    setDesignImage(null);
    setImagePosition({ x: 0, y: 0 });
    setImageSize({ width: 400, height: 300 });
    setImageScale(1);
    setImageTransformOrigin('center center');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageMouseDown = (e) => {
    // Check if click is on resize handle
    if (e.target.classList.contains('resize-handle') || 
        e.target.closest('.resize-handle')) {
      return; // Avoid conflict with resizing
    }
    
    // Ensure clicking on the image itself or image container
    if (!e.target.classList.contains('design-image') && 
        !e.target.classList.contains('design-overlay')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Add stricter state checking
    if (isResizing || isSelecting) {
      return;
    }
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - imagePosition.x,
      y: e.clientY - imagePosition.y
    });
  };

  const handleResizeMouseDown = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only prevent selection mode, allow switching to resize during dragging
    if (isSelecting) {
      return;
    }
    
    // Clean up other states
    setIsDragging(false);
    setDragStart(null);
    setIsResizing(true);
    
    // Set transform-origin based on direction
    let origin = 'center center';
    switch (direction) {
      case 'nw': origin = 'bottom right'; break;
      case 'ne': origin = 'bottom left'; break;
      case 'sw': origin = 'top right'; break;
      case 'se': origin = 'top left'; break;
      case 'n': origin = 'bottom center'; break;
      case 's': origin = 'top center'; break;
      case 'w': origin = 'right center'; break;
      case 'e': origin = 'left center'; break;
    }
    setImageTransformOrigin(origin);
    
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      direction: direction,
      startScale: imageScale
    });
  };

  const handleMouseMove = useCallback((e) => {
    // Handle dragging directly
    if (isDragging && dragStart) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setImagePosition({ x: newX, y: newY });
      return;
    }

    // Handle selection directly
    if (isSelecting && selectionStart) {
      const rect = previewRef.current?.getBoundingClientRect();
      if (rect) {
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        setSelection({
          left: Math.min(selectionStart.x, currentX),
          top: Math.min(selectionStart.y, currentY),
          width: Math.abs(currentX - selectionStart.x),
          height: Math.abs(currentY - selectionStart.y)
        });
      }
      return;
    }


    // Handle resize using transform scaling
    if (isResizing && resizeStart) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      
      // Calculate scale change based on drag direction - improve sensitivity
      let scaleChange = 0;
      const sensitivity = 100; // Lower value increases sensitivity
      
      switch (resizeStart.direction) {
        case 'se': // Bottom right - drag down-right to enlarge
          scaleChange = Math.max(deltaX, deltaY) / sensitivity;
          break;
        case 'nw': // Top left - drag up-left to enlarge
          scaleChange = Math.max(-deltaX, -deltaY) / sensitivity;
          break;
        case 'ne': // Top right - drag up-right to enlarge
          scaleChange = Math.max(deltaX, -deltaY) / sensitivity;
          break;
        case 'sw': // Bottom left - drag down-left to enlarge
          scaleChange = Math.max(-deltaX, deltaY) / sensitivity;
          break;
        case 'e': // Right side - drag right to enlarge
          scaleChange = deltaX / sensitivity;
          break;
        case 'w': // Left side - drag left to enlarge
          scaleChange = -deltaX / sensitivity;
          break;
        case 's': // Bottom side - drag down to enlarge
          scaleChange = deltaY / sensitivity;
          break;
        case 'n': // Top side - drag up to enlarge
          scaleChange = -deltaY / sensitivity;
          break;
      }
      
      // Calculate new scale value with larger range
      const newScale = Math.max(0.1, Math.min(10, resizeStart.startScale + scaleChange));
      setImageScale(newScale);
    }
  }, [isDragging, dragStart, isResizing, resizeStart, isSelecting, selectionStart]);

  const handleMouseUp = useCallback(async () => {
    // Save current state
    const wasDragging = isDragging;
    const wasResizing = isResizing;
    const wasSelecting = isSelecting;
    
    // Immediately clean up all states to prevent state residue
    setIsDragging(false);
    setIsResizing(false);
    setDragStart(null);
    setResizeStart(null);
    
    if (wasResizing) {
      // Reset transform-origin after resizing
      setTimeout(() => setImageTransformOrigin('center center'), 50);
    }
    
    // No processing after selection completion, wait for user to click button
    if (wasSelecting && selection && selection.width > 10 && selection.height > 10) {
      setIsSelecting(false);
    }
    
  }, [isSelecting, selection]);

  React.useEffect(() => {
    if (isDragging || isResizing || isSelecting) {
      const handleGlobalMouseMove = (e) => {
        handleMouseMove(e);
      };
      
      const handleGlobalMouseUp = (e) => {
        handleMouseUp(e);
      };
      
      // Add global event listeners, including window events
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('blur', handleGlobalMouseUp); // Clean up when window loses focus
      document.addEventListener('mouseleave', handleGlobalMouseUp); // Clean up when mouse leaves document
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('blur', handleGlobalMouseUp);
        document.removeEventListener('mouseleave', handleGlobalMouseUp);
      };
    }
  }, [isDragging, isResizing, isSelecting, handleMouseMove, handleMouseUp]);

  // Listen for selection completion, show screenshot tip
  React.useEffect(() => {
    if (!isSelecting && selection && selection.width > 10 && selection.height > 10) {
      // After selection completion, show screenshot tip
      setShowScreenshotTip(true);
      // Highlight preview area (red frame stays visible)
      if (previewRef.current) {
        previewRef.current.style.boxShadow = '0 0 0 4px #ff0000';
        previewRef.current.style.transition = 'box-shadow 0.3s ease';
      }
      // Don't auto-hide tip, let user take action
    }
  }, [isSelecting, selection]);


  const startSelection = () => {
    setIsSelecting(true);
    setSelection(null);
  };

  const cancelSelection = () => {
    setIsSelecting(false);
    setSelection(null);
    setSelectionStart(null);
    // Only remove red frame highlight and tip when clearing selection
    setShowScreenshotTip(false);
    if (previewRef.current) {
      previewRef.current.style.boxShadow = '';
    }
  };

  // Close screenshot tip (but keep red frame visible)
  const closeScreenshotTip = () => {
    setShowScreenshotTip(false);
    // Don't remove red frame highlight, keep it visible until user clears selection
  };

  // Handle clipboard screenshot paste
  const handlePasteScreenshot = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        if (item.types.includes('image/png')) {
          const blob = await item.getType('image/png');
          const reader = new FileReader();
          
          reader.onload = (e) => {
            setModalScreenshot(e.target.result);
            // Close tip but keep red frame (frame will be cleared when user clears selection or saves issue)
            setShowScreenshotTip(false);
            setShowModal(true);
          };
          
          reader.readAsDataURL(blob);
          return;
        }
      }
      
      // If no image found, alert user
      alert('No image found in clipboard, please take a screenshot first using Win+Shift+S');
      
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      alert('Unable to access clipboard, please take a screenshot using Win+Shift+S first and retry');
    }
  };

  // Start screenshot mode
  const startScreenshot = () => {
    setIsSelecting(true);
    setSelection(null);
    setSelectionStart(null);
  };


  const handlePreviewMouseDown = (e) => {
    if (isSelecting) {
      const rect = previewRef.current.getBoundingClientRect();
      setSelectionStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };


  const saveIssue = () => {
    if (currentIssue.description.trim() || currentIssue.suggestion.trim()) {
      const newIssue = {
        id: editingIssueId || Date.now().toString(),
        screenshot: modalScreenshot,
        description: currentIssue.description,
        suggestion: currentIssue.suggestion,
        status: 'Pending'
      };

      if (editingIssueId) {
        setIssues(issues.map(issue => 
          issue.id === editingIssueId ? newIssue : issue
        ));
      } else {
        setIssues([...issues, newIssue]);
      }
    }

    setShowModal(false);
    setSelection(null);
    setSelectionStart(null);
    setModalScreenshot(null);
    setCurrentIssue({ description: '', suggestion: '' });
    setEditingIssueId(null);
    // Clear red frame highlight after saving issue
    if (previewRef.current) {
      previewRef.current.style.boxShadow = '';
    }
  };

  const editIssue = (issue) => {
    setCurrentIssue({
      description: issue.description,
      suggestion: issue.suggestion
    });
    setModalScreenshot(issue.screenshot);
    setEditingIssueId(issue.id);
    setShowModal(true);
  };

  const deleteIssue = (issueId) => {
    if (window.confirm('Are you sure you want to delete this issue?')) {
      setIssues(issues.filter(issue => issue.id !== issueId));
    }
  };

  // Compress image to small thumbnail
  const compressImage = (base64, maxWidth = 150, maxHeight = 100, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate compressed dimensions
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw compressed image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to lower quality base64
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      
      img.src = base64;
    });
  };

  const exportToReport = () => {
    if (issues.length === 0) {
      alert('No issues to export');
      return;
    }

    try {
      // Use original images without compression
      let html = `
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: 'Microsoft YaHei', Arial, sans-serif; 
              margin: 40px;
              line-height: 1.6;
            }
            .issue-item {
              margin-bottom: 50px;
              page-break-inside: avoid;
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 25px;
              background-color: #fafafa;
            }
            .issue-header {
              background-color: #4472C4;
              color: white;
              padding: 18px 25px;
              margin: -25px -25px 30px -25px;
              border-radius: 7px 7px 0 0;
              font-size: 42px;
              font-weight: bold;
              text-align: center;
            }
            .screenshot {
              max-width: 600px;
              height: auto;
              border: 2px solid #ccc;
              border-radius: 4px;
              display: block;
              margin: 20px auto;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .info-section {
              margin-top: 25px;
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 5px;
            }
            .info-label {
              font-weight: bold;
              color: #333;
              margin-bottom: 15px;
              font-size: 32px;
            }
            .info-content {
              background-color: white;
              padding: 25px;
              border: 2px solid #ddd;
              border-radius: 6px;
              margin-bottom: 30px;
              min-height: 80px;
              font-size: 28px;
              line-height: 2.0;
            }
          </style>
        </head>
        <body>
      `;

      issues.forEach((issue, index) => {
        const status = issue.status || 'Pending';
        
        html += `
          <div class="issue-item">
            <div class="issue-header">
              Issue ${index + 1}
            </div>
            
            <div style="text-align: center;">
              <img class="screenshot" src="${issue.screenshot}" alt="Issue ${index + 1} Screenshot" />
            </div>
            
            <div class="info-section">
              <div class="info-label">Issue Description:</div>
              <div class="info-content">${issue.description || 'No description'}</div>
              
              <div class="info-label">Modification Suggestion:</div>
              <div class="info-content">${issue.suggestion || 'No suggestion'}</div>
              
              <div class="info-label">Review Status:</div>
              <div class="info-content">Pending</div>
            </div>
          </div>
        `;
      });

      html += `
        </body>
        </html>
      `;

      // Create Blob and download as .doc file (Word-compatible HTML format)
      const blob = new Blob([html], { 
        type: 'application/msword;charset=utf-8' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UI_Inspection_Report_${new Date().toISOString().slice(0, 10)}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed, please retry: ' + error.message);
    }
  };

  return (
    <div className="app">
      <div className="top-bar">
        <input
          type="text"
          className="url-input"
          placeholder="Please enter the frontend test page URL address..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && loadUrl()}
        />
        <button className="load-button" onClick={loadUrl}>
          Load Page
        </button>
        <button className="load-button" onClick={clearPage} style={{backgroundColor: '#6c757d', marginLeft: '10px'}}>
          Clear Page
        </button>
      </div>

      <div className="main-content">
        <div className="preview-section">
          <div className="preview-controls">
            <div className="control-group">
              <label>Design Size:</label>
              <select 
                className="design-size-selector" 
                onChange={handleDesignSizeChange}
                defaultValue={0}
              >
                {designSizePresets.map((preset, index) => (
                  <option key={index} value={index}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="file-input"
              accept=".png,.jpg,.jpeg"
              onChange={handleImageUpload}
            />
            <button 
              className="upload-button" 
              onClick={designImage ? removeDesignImage : triggerImageUpload}
              style={{backgroundColor: designImage ? '#dc3545' : '#28a745'}}
              title={designImage ? 'Delete current design image' : 'Supported formats: PNG, JPG, JPEG, max 10MB'}
            >
              {designImage ? 'Delete Design' : 'Upload Design'}
            </button>
            
            <button 
              className="upload-button" 
              onClick={() => {
                if (selection && selection.width > 10) {
                  // If there's already a selection, clear it (call cancelSelection to ensure red frame highlight is cleared)
                  cancelSelection();
                } else if (isSelecting) {
                  // If selecting but no selection made, cancel selection
                  cancelSelection();
                } else {
                  // Start selection
                  startSelection();
                }
              }}
              style={{
                backgroundColor: (selection && selection.width > 10) ? '#6c757d' : isSelecting ? '#dc3545' : '#ffc107', 
                color: (selection && selection.width > 10) ? 'white' : isSelecting ? 'white' : '#212529'
              }}
              title={
                (selection && selection.width > 10) ? 'Clear current selection area' : 
                isSelecting ? 'Cancel selection mode' : 
                'Manual selection of issue area'
              }
            >
              {(selection && selection.width > 10) ? 'Clear Selection' : isSelecting ? 'Cancel Selection' : 'Manual Selection'}
            </button>
            
            <button 
              className="ai-review-button" 
              disabled={true}
              title="Coming Soon"
            >
              🤖 AI Review
            </button>
            
            
            {isSelecting && !(selection && selection.width > 10) && (
              <div style={{fontSize: '12px', color: '#666', marginLeft: '10px', alignSelf: 'center'}}>
                Please drag to select issue area
              </div>
            )}
            
            
            
            
            {designImage && (
                <div className="control-group">
                  <label>Transparency:</label>
                  <input
                    type="range"
                    className="control-slider"
                    min="0"
                    max="1"
                    step="0.1"
                    value={imageOpacity}
                    onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                  />
                  <span>{Math.round((1 - imageOpacity) * 100)}%</span>
                </div>
            )}
          </div>


          <div 
            className="preview-container" 
            id="previewArea"
            ref={previewRef}
            onMouseDown={handlePreviewMouseDown}
          >
            <div 
              className="iframe-wrapper"
              id="frameWrapper"
              style={{
                width: designSize.width,
                height: designSize.height
              }}
            >
              {currentUrl ? (
                <iframe
                  ref={iframeRef}
                  className="preview-iframe"
                  src={currentUrl}
                  title="Web Preview"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  style={{
                    width: designSize.width,
                    height: designSize.height
                  }}
                />
              ) : (
                <div className="empty-preview-placeholder">
                  <div className="placeholder-content">
                    <h3>Welcome to UI Inspection Tool</h3>
                    <p>Please paste the frontend test page URL in the input box above</p>
                    <p className="placeholder-example">Supports: http://localhost:3000, dev environment IPs, test environment domains, etc.</p>
                    <div className="placeholder-steps">
                      <div className="step">1. Enter frontend page URL</div>
                      <div className="step">2. Click "Load Page"</div>
                      <div className="step">3. Upload design image for comparison</div>
                      <div className="step">4. Use "Manual Selection" to mark issues</div>
                      <div className="step">5. Take screenshot and annotate issues</div>
                      <div className="step">6. Export report</div>
                    </div>
                    <div className="placeholder-notice">
                      <p>Note: This tool does not save user history records, but supports exporting inspection reports</p>
                    </div>
                  </div>
                </div>
              )}
              
              {designImage && (
              <div
                className={`design-overlay ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
                style={{
                  left: imagePosition.x,
                  top: imagePosition.y,
                  width: imageSize.width,
                  height: imageSize.height,
                  opacity: imageOpacity,
                  position: 'absolute',
                  transform: `scale(${imageScale})`,
                  transformOrigin: imageTransformOrigin,
                  transition: isResizing ? 'none' : 'transform 0.1s ease'
                }}
                onMouseDown={handleImageMouseDown}
              >
                <img
                  className="design-image"
                  src={designImage}
                  alt="Design Image"
                  draggable={false}
                  style={{ 
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
                
                {/* 8 resize control handles */}
                <div className="resize-handle nw" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} title="Drag to resize" />
                <div className="resize-handle n" onMouseDown={(e) => handleResizeMouseDown(e, 'n')} title="Drag to resize" />
                <div className="resize-handle ne" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} title="Drag to resize" />
                <div className="resize-handle e" onMouseDown={(e) => handleResizeMouseDown(e, 'e')} title="Drag to resize" />
                <div className="resize-handle se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} title="Drag to resize" />
                <div className="resize-handle s" onMouseDown={(e) => handleResizeMouseDown(e, 's')} title="Drag to resize" />
                <div className="resize-handle sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} title="Drag to resize" />
                <div className="resize-handle w" onMouseDown={(e) => handleResizeMouseDown(e, 'w')} title="Drag to resize" />
              </div>
            )}

            <div className={`selection-overlay ${isSelecting ? 'selecting' : ''}`}>
              {selection && (
                <div
                  className="selection-box"
                  style={{
                    left: selection.left,
                    top: selection.top,
                    width: selection.width,
                    height: selection.height
                  }}
                />
              )}
            </div>
            </div>
          </div>
        </div>

        <div className="issues-panel">
          <div className="issues-header">
            <h3 className="issues-title">Issue List ({issues.length})</h3>
            <button className="export-button" onClick={exportToReport} disabled={issues.length === 0}>
              Export Inspection Report
            </button>
          </div>
          
          <div className="issues-list">
            {/* Show paste screenshot button after user completes selection */}
            {selection && selection.width > 10 && (
              <div className="paste-screenshot-section">
                <div className="paste-instruction">
                  <span>📸 Please take screenshot within the red frame area (Win+Shift+S), then click button below to paste</span>
                </div>
                <button className="paste-screenshot-button" onClick={handlePasteScreenshot}>
                  📋 Paste Screenshot
                </button>
              </div>
            )}
            
            {issues.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
                No issues recorded yet
                <br />
                <small>After uploading design image, click "Manual Selection" to mark issue areas</small>
              </div>
            ) : (
              issues.map((issue) => (
                <div key={issue.id} className="issue-item">
                  <img
                    className="issue-screenshot"
                    src={issue.screenshot}
                    alt="Issue Screenshot"
                  />
                  <div className="issue-description">
                    <div className="issue-label">Issue Description:</div>
                    <div className="issue-text">{issue.description || 'No description'}</div>
                  </div>
                  <div className="issue-suggestion">
                    <div className="issue-label">Modification Suggestion:</div>
                    <div className="issue-text">{issue.suggestion || 'No suggestion'}</div>
                  </div>
                  <div className="issue-actions">
                    <button className="edit-button" onClick={() => editIssue(issue)}>
                      Edit
                    </button>
                    <button className="delete-button" onClick={() => deleteIssue(issue.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showScreenshotTip && (
        <div className="screenshot-tip">
          <div className="tip-content">
            <span className="tip-text">
              📸 You can take screenshot within the red frame area, please use Win+Shift+S, after screenshot is complete, click "Paste Screenshot" in the issue list
            </span>
            <button className="tip-close" onClick={closeScreenshotTip}>×</button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">
              {editingIssueId ? 'Edit Issue' : 'Add Issue'}
            </h3>
            
            <img
              className="modal-screenshot"
              src={modalScreenshot}
              alt="Screenshot"
            />

            <div className="form-group">
              <label className="form-label">Issue Description</label>
              <textarea
                className="form-textarea"
                value={currentIssue.description}
                onChange={(e) => setCurrentIssue({...currentIssue, description: e.target.value})}
                placeholder="Please describe the specific issue, e.g.: Button position 5px too left, title font size inconsistent, background color doesn't match design, etc."
              />
              <div className="form-placeholder">
                Tip: Please describe the issue in detail, including specific information about position, size, color, etc.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Modification Suggestion</label>
              <textarea
                className="form-textarea"
                value={currentIssue.suggestion}
                onChange={(e) => setCurrentIssue({...currentIssue, suggestion: e.target.value})}
                placeholder="Please provide precise modification values, e.g.: Move button 5px to the right, change font size to 16px, change color to #1890FF, change line-height to 1.5, etc."
              />
              <div className="form-placeholder">
                Tip: Please provide specific pixel values, color values, font sizes and other precise values for developers to modify directly
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="modal-button secondary" 
                onClick={() => {
                  setShowModal(false);
                  setSelection(null);
                  setSelectionStart(null);
                  setCurrentIssue({ description: '', suggestion: '' });
                  setEditingIssueId(null);
                  // Also clear red frame highlight when canceling
                  if (previewRef.current) {
                    previewRef.current.style.boxShadow = '';
                  }
                }}
              >
                Cancel
              </button>
              <button className="modal-button primary" onClick={saveIssue}>
                {editingIssueId ? 'Save Changes' : 'Add Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
