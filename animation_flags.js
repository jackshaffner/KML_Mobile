/* animation_flags.js */

// Global references to external objects
let viewerRef = null;
let kmlDataListRef = null;
let settingsRef = null;
let fileInfoRef = null;

// Touch detection
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Global event handlers for proper cleanup
let globalEventHandlers = {
  mousemove: null,
  mouseup: null,
  click: null,
  touchmove: null,
  touchend: null
};

// Global screen space event handler for proper cleanup
let flagPlacementHandler = null;

/**
 * Animation state - Tracks the current state of the animation playback
 */
const animationState = {
  playing: false,        // Whether animation is currently playing
  currentTime: 0,        // Current time in the animation
  startTime: 0,          // Global start time for all tracks
  endTime: 0,            // Global end time for all tracks
  speed: 1.0,            // Animation playback speed multiplier
  markers: [],           // Array of marker entities showing current position
  lastUpdateTime: 0,     // Last time the animation was updated (for delta time calculation)
};

/**
 * Flags state - Tracks the current state of start/finish flags
 */
const flagsState = {
  // Flag entities
  startFlag: null,           // Cesium entity for start flag
  finishFlag: null,          // Cesium entity for finish flag
  
  // Track indices for flags
  startTrackIndex: -1,       // Index of track where start flag is placed
  startPointIndex: -1,       // Index of point on track where start flag is placed
  finishTrackIndex: -1,      // Index of track where finish flag is placed
  finishPointIndex: -1,      // Index of point on track where finish flag is placed
  
  // Drag state
  draggingStart: false,      // Whether start flag is being dragged
  draggingFinish: false,     // Whether finish flag is being dragged
  movingPlacedFlag: false,   // Whether a placed flag is being moved
  currentMovingFlag: null,   // Reference to flag being moved
  flagAdjustmentInProgress: false,  // Whether flag adjustment is in progress
  initialFlagPosition: null,  // Initial position of flag being adjusted

  // For improved drag and drop
  isDragging: false,         // Whether drag operation is in progress
  draggedFlagElement: null,  // Element being dragged
  draggedFlagType: null,     // Type of flag being dragged ('start' or 'finish')
  mouseOffsetX: 0,           // X offset of mouse from flag center
  mouseOffsetY: 0,           // Y offset of mouse from flag center
  startFlagDeployed: false,  // Whether start flag is deployed
  finishFlagDeployed: false, // Whether finish flag is deployed

  // Prevent map movement during flag interaction
  preventMapMovement: false, // Whether to prevent map movement

  // Flag entity hit boxes for detection
  flagHitBoxes: [],          // Array of hit boxes for flag detection

  // Store original camera controller state
  originalCameraController: null, // Original camera controller state

  // Track if we're hovering over a flag
  hoveringOverFlag: false,   // Whether mouse is hovering over a flag

  // Store initial mouse/touch position for drag operations
  initialMouseX: 0,          // Initial X position of mouse/touch for drag
  initialMouseY: 0,          // Initial Y position of mouse/touch for drag

  // Store initial screen position of flag for smooth movement
  initialFlagScreenPosition: null, // Initial screen position of flag
  
  // State for map-based pickup and drop
  flagPickedUp: false,       // Whether a flag is picked up
  pickedUpFlagType: null,    // Type of flag picked up ('start' or 'finish')
  
  // Ghost flag element for pickup and drop
  ghostFlagElement: null,    // Ghost flag element
  
  // Flag to track if reset was just performed
  justReset: false,          // Whether reset was just performed
  
  // Flag to track if we're in the process of resetting
  isResetting: false,        // Whether we're in the process of resetting
  
  // Touch-specific state
  touchActive: false,        // Whether touch interaction is active
  lastTouchX: 0,             // Last touch X position
  lastTouchY: 0              // Last touch Y position
};

/**
 * Initialize animation and flags
 * Called once from main.js to set references to external objects
 * 
 * @param {Object} options - Object containing references to external objects
 * @param {Object} options.viewer - Cesium viewer instance
 * @param {Array} options.kmlDataList - Array of KML data objects
 * @param {Object} options.settings - Settings object
 * @param {Object} options.fileInfo - File info element
 */
function initAnimationAndFlags({ viewer, kmlDataList, settings, fileInfo }) {
  // Store references to external objects
  viewerRef = viewer;
  kmlDataListRef = kmlDataList;
  settingsRef = settings;
  fileInfoRef = fileInfo;

  // Store original camera controller for later restoration
  if (viewerRef && viewerRef.scene && viewerRef.scene.screenSpaceCameraController) {
    flagsState.originalCameraController = {
      enableInputs: viewerRef.scene.screenSpaceCameraController.enableInputs
    };
  }

  // Set up map movement prevention
  setupMapMovementPrevention();
  
  // Set up flag hover/touch detection
  setupFlagInteractionDetection();
  
  // Create ghost flag element
  createGhostFlagElement();
  
  // Add CSS for flag pulse animation
  addFlagPulseCSS();
  
  // Update menu icons
  updateMenuIcons();
  
  // Force hide ghost flag initially
  hideGhostFlag();
  
  // Initialize flag placement and drag/drop
  // IMPORTANT: These should only be called ONCE at initialization
  initFlagPlacement();
  initFlagDragDrop();
  
  // Hide ghost flag on any click/touch outside
  // Store the handler for potential cleanup
  globalEventHandlers.click = function() {
    hideGhostFlag();
  };
  document.addEventListener('click', globalEventHandlers.click);
  
  if (isTouchDevice) {
    document.addEventListener('touchend', globalEventHandlers.click);
  }
}

/**
 * Add CSS for flag pulse animation
 * Creates and adds a style element with keyframe animation for ghost flag
 */
function addFlagPulseCSS() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes flagPulse {
      0%   { transform: scale(0.7); box-shadow: 0 0 10px rgba(0, 255, 0, 0.7); }
      50%  { transform: scale(0.8); box-shadow: 0 0 15px rgba(0, 255, 0, 0.9); }
      100% { transform: scale(0.7); box-shadow: 0 0 10px rgba(0, 255, 0, 0.7); }
    }
    
    .ghost-flag {
      animation: flagPulse 1.5s ease-in-out infinite;
      position: absolute;
      z-index: 1000;
      pointer-events: none;
      opacity: 0.7;
      box-shadow: 0 0 10px rgba(0, 255, 0, 0.7);
      border: 2px solid #00FF00;
    }
    
    /* Larger touch targets for tablet */
    .flag-icon {
      min-width: 80px;
      min-height: 80px;
    }
    
    /* Active state for touch feedback */
    .flag-icon:active {
      transform: scale(1.1);
      box-shadow: 0 0 15px rgba(0, 255, 255, 0.8);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Update the menu icons to match the deployed flags
 * Creates canvas images for start and finish flags and sets them as background images
 */
function updateMenuIcons() {
  const startIcon = document.getElementById('startPointIcon');
  const finishIcon = document.getElementById('finishPointIcon');
  
  if (startIcon) {
    startIcon.innerHTML = '';
    const startCanvas = createStartArchImage();
    startIcon.style.backgroundImage = `url(${startCanvas.toDataURL('image/png')})`;
    startIcon.style.backgroundSize = 'contain';
    startIcon.style.backgroundRepeat = 'no-repeat';
    startIcon.style.backgroundPosition = 'center';
  }
  
  if (finishIcon) {
    finishIcon.innerHTML = '';
    const finishCanvas = createFinishArchImage();
    finishIcon.style.backgroundImage = `url(${finishCanvas.toDataURL('image/png')})`;
    finishIcon.style.backgroundSize = 'contain';
    finishIcon.style.backgroundRepeat = 'no-repeat';
    finishIcon.style.backgroundPosition = 'center';
  }
}

/**
 * Create ghost flag element for pickup and drop
 * Creates a div element for the ghost flag and adds it to the document body
 */
function createGhostFlagElement() {
  // Remove existing ghost flag if it exists
  if (flagsState.ghostFlagElement) {
    try {
      document.body.removeChild(flagsState.ghostFlagElement);
    } catch (e) {
      console.error("Error removing existing ghost flag:", e);
    }
  }
  
  // Create new ghost flag element
  const ghostFlag = document.createElement('div');
  ghostFlag.className = 'flag-icon ghost-flag';
  ghostFlag.style.display = 'none';
  ghostFlag.id = 'ghost-flag-element'; 
  document.body.appendChild(ghostFlag);
  
  // Store reference to ghost flag element
  flagsState.ghostFlagElement = ghostFlag;
  console.log("Ghost flag created:", ghostFlag.id);
}

/**
 * Update ghost flag position
 * Updates the position of the ghost flag element based on mouse/touch coordinates
 * 
 * @param {number} x - X coordinate of mouse/touch
 * @param {number} y - Y coordinate of mouse/touch
 */
function updateGhostFlagPosition(x, y) {
  if (!flagsState.flagPickedUp || !flagsState.ghostFlagElement) return;
  
  flagsState.ghostFlagElement.style.left = (x - 40) + 'px'; // Adjusted for larger touch target
  flagsState.ghostFlagElement.style.top = (y - 40) + 'px';  // Adjusted for larger touch target
}

/**
 * Show ghost flag
 * Shows the ghost flag element at the specified position
 * 
 * @param {string} flagType - Type of flag ('start' or 'finish')
 * @param {number} x - X coordinate to show ghost flag
 * @param {number} y - Y coordinate to show ghost flag
 */
function showGhostFlag(flagType, x, y) {
  if (!flagsState.ghostFlagElement) {
    createGhostFlagElement();
  }
  
  const isStart = (flagType === 'start');
  const flagCanvas = isStart ? createStartArchImage() : createFinishArchImage();
  
  flagsState.ghostFlagElement.style.display = 'block';
  flagsState.ghostFlagElement.style.width = `${flagCanvas.width}px`;
  flagsState.ghostFlagElement.style.height = `${flagCanvas.height}px`;
  flagsState.ghostFlagElement.style.backgroundImage = `url(${flagCanvas.toDataURL('image/png')})`;
  flagsState.ghostFlagElement.style.backgroundSize = 'cover';
  flagsState.ghostFlagElement.style.left = (x - 40) + 'px'; // Adjusted for larger touch target
  flagsState.ghostFlagElement.style.top = (y - 40) + 'px';  // Adjusted for larger touch target
  
  console.log('Ghost flag shown:', flagType);
}

/**
 * Hide ghost flag
 * Hides the ghost flag element
 */
function hideGhostFlag() {
  if (flagsState.ghostFlagElement) {
    flagsState.ghostFlagElement.style.display = 'none';
  }
}

/**
 * Setup prevention of map movement during flag interaction
 * Overrides Cesium's mouse/touch event handlers to prevent map movement during flag interaction
 */
function setupMapMovementPrevention() {
  if (!viewerRef || !viewerRef.scene || !viewerRef.scene.screenSpaceCameraController) {
    console.error("Viewer reference not properly initialized");
    return;
  }

  const originalMouseMove = viewerRef.scene.screenSpaceCameraController.handleMouseMove;
  const originalMouseDown = viewerRef.scene.screenSpaceCameraController._onMouseDown;
  const originalMouseUp = viewerRef.scene.screenSpaceCameraController._onMouseUp;
  const originalTouchStart = viewerRef.scene.screenSpaceCameraController._onTouchStart;
  const originalTouchMove = viewerRef.scene.screenSpaceCameraController._onTouchMove;
  const originalTouchEnd = viewerRef.scene.screenSpaceCameraController._onTouchEnd;

  // Override mouse handlers
  viewerRef.scene.screenSpaceCameraController.handleMouseMove = function(movement) {
    if (flagsState.preventMapMovement || 
        flagsState.movingPlacedFlag || 
        flagsState.isDragging || 
        flagsState.hoveringOverFlag || 
        flagsState.flagPickedUp) {
      return;
    }
    return originalMouseMove.call(this, movement);
  };

  viewerRef.scene.screenSpaceCameraController._onMouseDown = function(e) {
    if (flagsState.preventMapMovement || 
        flagsState.movingPlacedFlag || 
        flagsState.isDragging || 
        flagsState.hoveringOverFlag || 
        flagsState.flagPickedUp) {
      return;
    }
    return originalMouseDown.call(this, e);
  };

  viewerRef.scene.screenSpaceCameraController._onMouseUp = function(e) {
    if (flagsState.preventMapMovement || 
        flagsState.movingPlacedFlag || 
        flagsState.isDragging || 
        flagsState.flagPickedUp) {
      return;
    }
    return originalMouseUp.call(this, e);
  };
  
  // Override touch handlers for tablets
  if (isTouchDevice) {
    viewerRef.scene.screenSpaceCameraController._onTouchStart = function(e) {
      if (flagsState.preventMapMovement || 
          flagsState.movingPlacedFlag || 
          flagsState.isDragging || 
          flagsState.touchActive || 
          flagsState.flagPickedUp) {
        return;
      }
      return originalTouchStart.call(this, e);
    };
    
    viewerRef.scene.screenSpaceCameraController._onTouchMove = function(e) {
      if (flagsState.preventMapMovement || 
          flagsState.movingPlacedFlag || 
          flagsState.isDragging || 
          flagsState.touchActive || 
          flagsState.flagPickedUp) {
        return;
      }
      return originalTouchMove.call(this, e);
    };
    
    viewerRef.scene.screenSpaceCameraController._onTouchEnd = function(e) {
      if (flagsState.preventMapMovement || 
          flagsState.movingPlacedFlag || 
          flagsState.isDragging || 
          flagsState.flagPickedUp) {
        return;
      }
      return originalTouchEnd.call(this, e);
    };
  }
}

/**
 * Setup detection for when mouse/touch is interacting with a flag
 * Sets up a Cesium screen space event handler to detect when mouse/touch is over a flag
 */
function setupFlagInteractionDetection() {
  if (!viewerRef || !viewerRef.scene) return;

  const handler = new Cesium.ScreenSpaceEventHandler(viewerRef.scene.canvas);

  // Mouse move handler for desktop
  handler.setInputAction(movement => {
    const flagType = isPointInFlagHitBox(movement.endPosition.x, movement.endPosition.y);

    if (flagType) {
      if (!flagsState.hoveringOverFlag) {
        flagsState.hoveringOverFlag = true;
        disableCameraControls();
      }
    } else {
      if (flagsState.hoveringOverFlag && 
          !flagsState.movingPlacedFlag && 
          !flagsState.isDragging && 
          !flagsState.flagPickedUp) {
        flagsState.hoveringOverFlag = false;
        restoreCameraControls();
      }
    }
    
    if (flagsState.flagPickedUp) {
      updateGhostFlagPosition(movement.endPosition.x, movement.endPosition.y);
    } else {
      hideGhostFlag();
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  
  // Touch move handler for tablets
  if (isTouchDevice) {
    handler.setInputAction(movement => {
      if (movement.position) {
        const x = movement.position.x;
        const y = movement.position.y;
        flagsState.lastTouchX = x;
        flagsState.lastTouchY = y;
        
        const flagType = isPointInFlagHitBox(x, y);
        
        if (flagType) {
          flagsState.touchActive = true;
          disableCameraControls();
        }
        
        if (flagsState.flagPickedUp) {
          updateGhostFlagPosition(x, y);
        }
      }
    }, Cesium.ScreenSpaceEventType.TOUCH_MOVE);
    
    handler.setInputAction(movement => {
      if (flagsState.touchActive && !flagsState.flagPickedUp) {
        flagsState.touchActive = false;
        restoreCameraControls();
      }
    }, Cesium.ScreenSpaceEventType.TOUCH_END);
  }
}

/**
 * Completely disable camera controls
 * Disables all camera controls in Cesium viewer
 */
function disableCameraControls() {
  if (!viewerRef || !viewerRef.scene || !viewerRef.scene.screenSpaceCameraController) return;
  viewerRef.scene.screenSpaceCameraController.enableInputs = false;
}

/**
 * Restore camera controls to original state
 * Restores camera controls to their original state if no flag interaction is in progress
 */
function restoreCameraControls() {
  if (!viewerRef || !viewerRef.scene || 
      !viewerRef.scene.screenSpaceCameraController ||
      !flagsState.originalCameraController) {
    return;
  }

  if (flagsState.movingPlacedFlag || 
      flagsState.isDragging || 
      flagsState.hoveringOverFlag || 
      flagsState.flagPickedUp ||
      flagsState.touchActive) {
    return;
  }
  viewerRef.scene.screenSpaceCameraController.enableInputs =
    flagsState.originalCameraController.enableInputs;
}

/**
 * Check if a point is in a flag hit box
 * 
 * @param {number} x - X coordinate to check
 * @param {number} y - Y coordinate to check
 * @returns {string|null} - Flag type ('start' or 'finish') if point is in hit box, null otherwise
 */
function isPointInFlagHitBox(x, y) {
  for (const hitBox of flagsState.flagHitBoxes) {
    if (x >= hitBox.left && x <= hitBox.right &&
        y >= hitBox.top && y <= hitBox.bottom) {
      return hitBox.flagType;
    }
  }
  return null;
}

/**
 * Update flag hit boxes
 * Updates the hit boxes for flag detection based on current flag positions
 */
function updateFlagHitBoxes() {
  flagsState.flagHitBoxes = [];

  if (flagsState.startFlag) {
    const startPos = flagsState.startFlag.position;
    const windowPos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
      viewerRef.scene, startPos);
    if (windowPos) {
      // Larger hit box for touch devices
      const hitBoxSize = isTouchDevice ? 45 : 35;
      flagsState.flagHitBoxes.push({
        left:   windowPos.x - hitBoxSize,
        right:  windowPos.x + hitBoxSize,
        top:    windowPos.y - hitBoxSize,
        bottom: windowPos.y + hitBoxSize,
        flagType: 'start'
      });
    }
  }

  if (flagsState.finishFlag) {
    const finishPos = flagsState.finishFlag.position;
    const windowPos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
      viewerRef.scene, finishPos);
    if (windowPos) {
      // Larger hit box for touch devices
      const hitBoxSize = isTouchDevice ? 45 : 35;
      flagsState.flagHitBoxes.push({
        left:   windowPos.x - hitBoxSize,
        right:  windowPos.x + hitBoxSize,
        top:    windowPos.y - hitBoxSize,
        bottom: windowPos.y + hitBoxSize,
        flagType: 'finish'
      });
    }
  }
}

/**
 * Remove animation markers
 * Removes all animation markers from the viewer
 */
function removeAnimationMarkers() {
  for (const m of animationState.markers) {
    viewerRef.entities.remove(m);
  }
  animationState.markers = [];
}

/**
 * Update animation markers
 * Updates the position of animation markers based on current animation time
 */
function updateAnimationMarkers() {
  removeAnimationMarkers();
  const now = animationState.currentTime;
  if (!now) return;

  for (const kd of kmlDataListRef) {
    if (!kd.visible || !kd.syncedTimestamps || !kd.syncedTimestamps.length) {
      continue;
    }
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let j = 0; j < kd.syncedTimestamps.length; j++) {
      const tDiff = Math.abs(kd.syncedTimestamps[j].time - now);
      if (tDiff < minDiff) {
        minDiff = tDiff;
        closestIdx = j;
      }
    }
    const coord = kd.syncedTimestamps[closestIdx].coord;
    const pos = Cesium.Cartesian3.fromDegrees(coord[0], coord[1], coord[2]);
    if (pos) {
      const marker = viewerRef.entities.add({
        position: pos,
        point: {
          pixelSize: 12,
          color: kd.color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });
      animationState.markers.push(marker);
    }
  }
}

/**
 * Create start arch image
 * Creates a canvas image of the start arch
 * 
 * @returns {HTMLCanvasElement} - Canvas element with start arch image
 */
function createStartArchImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 70;
  canvas.height = 70;
  const ctx = canvas.getContext('2d');
  
  // Draw arch
  ctx.beginPath();
  ctx.moveTo(5, 60);
  ctx.lineTo(65, 60);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#333333';
  ctx.stroke();
  
  // Draw arch top
  ctx.beginPath();
  ctx.arc(35, 35, 30, Math.PI, 0, false);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0057B7';
  ctx.stroke();
  
  // Draw "START" text
  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('START', 35, 35);
  
  // Add shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  return canvas;
}

/**
 * Create finish arch image
 * Creates a canvas image of the finish arch
 * 
 * @returns {HTMLCanvasElement} - Canvas element with finish arch image
 */
function createFinishArchImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 70;
  canvas.height = 70;
  const ctx = canvas.getContext('2d');
  
  // Draw base
  ctx.beginPath();
  ctx.moveTo(5, 60);
  ctx.lineTo(65, 60);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#333333';
  ctx.stroke();
  
  // Draw checkered line
  ctx.beginPath();
  ctx.moveTo(5, 55);
  ctx.lineTo(65, 55);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'transparent';
  ctx.stroke();
  
  // Create checkered pattern
  const checkSize = 5;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'black' : 'white';
    ctx.fillRect(5 + i * checkSize, 52.5, checkSize, 5);
  }
  
  // Draw arch top with checkered pattern
  ctx.beginPath();
  ctx.arc(35, 35, 30, Math.PI, 0, false);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'transparent';
  ctx.stroke();
  
  // Create checkered pattern for arch
  const archLength = Math.PI * 30;
  const numChecks = Math.floor(archLength / checkSize);
  for (let i = 0; i < numChecks; i++) {
    const angle = Math.PI + (i * Math.PI / numChecks);
    const nextAngle = Math.PI + ((i + 1) * Math.PI / numChecks);
    
    ctx.beginPath();
    ctx.arc(35, 35, 30, angle, nextAngle, false);
    ctx.lineWidth = 5;
    ctx.strokeStyle = i % 2 === 0 ? 'black' : 'white';
    ctx.stroke();
  }
  
  // Add shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  return canvas;
}

/**
 * Initialize flag placement
 * Sets up event handlers for placing flags on the map
 */
function initFlagPlacement() {
  if (!viewerRef || !viewerRef.scene) return;
  
  // Remove existing handler if it exists
  if (flagPlacementHandler) {
    flagPlacementHandler.destroy();
    flagPlacementHandler = null;
  }
  
  flagPlacementHandler = new Cesium.ScreenSpaceEventHandler(viewerRef.scene.canvas);
  
  // Left click handler for mouse
  flagPlacementHandler.setInputAction(click => {
    if (flagsState.flagPickedUp) {
      const pickedPosition = viewerRef.scene.pickPosition(click.position);
      if (Cesium.defined(pickedPosition)) {
        placeFlagAtCartesian(flagsState.pickedUpFlagType === 'start', pickedPosition);
        flagsState.flagPickedUp = false;
        flagsState.pickedUpFlagType = null;
        hideGhostFlag();
        
        // Update UI
        updateFlagDeployedState();
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  
  // Touch tap handler for tablets
  if (isTouchDevice) {
    flagPlacementHandler.setInputAction(tap => {
      if (flagsState.flagPickedUp) {
        const pickedPosition = viewerRef.scene.pickPosition(tap.position);
        if (Cesium.defined(pickedPosition)) {
          placeFlagAtCartesian(flagsState.pickedUpFlagType === 'start', pickedPosition);
          flagsState.flagPickedUp = false;
          flagsState.pickedUpFlagType = null;
          hideGhostFlag();
          
          // Update UI
          updateFlagDeployedState();
          
          // Reset touch state
          flagsState.touchActive = false;
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }
}

/**
 * Initialize flag drag and drop
 * Sets up event handlers for dragging and dropping flags
 */
function initFlagDragDrop() {
  const startIcon = document.getElementById('startPointIcon');
  const finishIcon = document.getElementById('finishPointIcon');
  
  if (!startIcon || !finishIcon) return;
  
  // Remove existing drag attributes
  startIcon.removeAttribute('draggable');
  finishIcon.removeAttribute('draggable');
  
  // Mouse event handlers for desktop
  startIcon.addEventListener('mousedown', e => handleFlagDragStart(e, 'start'));
  finishIcon.addEventListener('mousedown', e => handleFlagDragStart(e, 'finish'));
  
  // Touch event handlers for tablets
  if (isTouchDevice) {
    startIcon.addEventListener('touchstart', e => handleFlagTouchStart(e, 'start'));
    finishIcon.addEventListener('touchstart', e => handleFlagTouchStart(e, 'finish'));
    
    document.addEventListener('touchmove', handleFlagTouchMove);
    document.addEventListener('touchend', handleFlagTouchEnd);
  }
  
  // Global mouse event handlers
  document.addEventListener('mousemove', handleFlagDragMove);
  document.addEventListener('mouseup', handleFlagDragEnd);
  
  // Store handlers for potential cleanup
  globalEventHandlers.mousemove = handleFlagDragMove;
  globalEventHandlers.mouseup = handleFlagDragEnd;
  
  if (isTouchDevice) {
    globalEventHandlers.touchmove = handleFlagTouchMove;
    globalEventHandlers.touchend = handleFlagTouchEnd;
  }
  
  // Update deployed state
  updateFlagDeployedState();
}

/**
 * Handle flag drag start
 * Handles the start of a flag drag operation
 * 
 * @param {MouseEvent} e - Mouse event
 * @param {string} flagType - Type of flag ('start' or 'finish')
 */
function handleFlagDragStart(e, flagType) {
  e.preventDefault();
  
  // Don't allow dragging if flag is already deployed
  if ((flagType === 'start' && flagsState.startFlagDeployed) ||
      (flagType === 'finish' && flagsState.finishFlagDeployed)) {
    return;
  }
  
  const rect = e.target.getBoundingClientRect();
  flagsState.isDragging = true;
  flagsState.draggedFlagElement = e.target;
  flagsState.draggedFlagType = flagType;
  flagsState.mouseOffsetX = e.clientX - rect.left;
  flagsState.mouseOffsetY = e.clientY - rect.top;
  flagsState.initialMouseX = e.clientX;
  flagsState.initialMouseY = e.clientY;
  
  // Create temporary flag for dragging
  createTempFlag(flagType, e.clientX, e.clientY);
  
  // Disable camera controls during drag
  disableCameraControls();
}

/**
 * Handle flag touch start
 * Handles the start of a flag touch operation
 * 
 * @param {TouchEvent} e - Touch event
 * @param {string} flagType - Type of flag ('start' or 'finish')
 */
function handleFlagTouchStart(e, flagType) {
  e.preventDefault();
  
  // Don't allow dragging if flag is already deployed
  if ((flagType === 'start' && flagsState.startFlagDeployed) ||
      (flagType === 'finish' && flagsState.finishFlagDeployed)) {
    return;
  }
  
  if (e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  const rect = e.target.getBoundingClientRect();
  
  flagsState.isDragging = true;
  flagsState.draggedFlagElement = e.target;
  flagsState.draggedFlagType = flagType;
  flagsState.mouseOffsetX = touch.clientX - rect.left;
  flagsState.mouseOffsetY = touch.clientY - rect.top;
  flagsState.initialMouseX = touch.clientX;
  flagsState.initialMouseY = touch.clientY;
  flagsState.touchActive = true;
  
  // Create temporary flag for dragging
  createTempFlag(flagType, touch.clientX, touch.clientY);
  
  // Disable camera controls during drag
  disableCameraControls();
}

/**
 * Handle flag drag move
 * Handles the movement during a flag drag operation
 * 
 * @param {MouseEvent} e - Mouse event
 */
function handleFlagDragMove(e) {
  if (!flagsState.isDragging) return;
  
  e.preventDefault();
  
  const tempFlag = document.querySelector('.temp-flag');
  if (tempFlag) {
    tempFlag.style.left = (e.clientX - flagsState.mouseOffsetX) + 'px';
    tempFlag.style.top = (e.clientY - flagsState.mouseOffsetY) + 'px';
  }
  
  // Check if we've moved far enough to pick up the flag
  const dx = e.clientX - flagsState.initialMouseX;
  const dy = e.clientY - flagsState.initialMouseY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 10 && !flagsState.flagPickedUp) {
    flagsState.flagPickedUp = true;
    flagsState.pickedUpFlagType = flagsState.draggedFlagType;
    
    // Show ghost flag
    showGhostFlag(flagsState.draggedFlagType, e.clientX, e.clientY);
    
    // Hide temp flag
    if (tempFlag) {
      tempFlag.style.display = 'none';
    }
  }
  
  if (flagsState.flagPickedUp) {
    updateGhostFlagPosition(e.clientX, e.clientY);
  }
}

/**
 * Handle flag touch move
 * Handles the movement during a flag touch operation
 * 
 * @param {TouchEvent} e - Touch event
 */
function handleFlagTouchMove(e) {
  if (!flagsState.isDragging) return;
  
  e.preventDefault();
  
  if (e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  
  const tempFlag = document.querySelector('.temp-flag');
  if (tempFlag) {
    tempFlag.style.left = (touch.clientX - flagsState.mouseOffsetX) + 'px';
    tempFlag.style.top = (touch.clientY - flagsState.mouseOffsetY) + 'px';
  }
  
  // Check if we've moved far enough to pick up the flag
  const dx = touch.clientX - flagsState.initialMouseX;
  const dy = touch.clientY - flagsState.initialMouseY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 20 && !flagsState.flagPickedUp) { // Larger threshold for touch
    flagsState.flagPickedUp = true;
    flagsState.pickedUpFlagType = flagsState.draggedFlagType;
    
    // Show ghost flag
    showGhostFlag(flagsState.draggedFlagType, touch.clientX, touch.clientY);
    
    // Hide temp flag
    if (tempFlag) {
      tempFlag.style.display = 'none';
    }
  }
  
  if (flagsState.flagPickedUp) {
    updateGhostFlagPosition(touch.clientX, touch.clientY);
    
    // Store last touch position
    flagsState.lastTouchX = touch.clientX;
    flagsState.lastTouchY = touch.clientY;
  }
}

/**
 * Handle flag drag end
 * Handles the end of a flag drag operation
 * 
 * @param {MouseEvent} e - Mouse event
 */
function handleFlagDragEnd(e) {
  if (!flagsState.isDragging) return;
  
  e.preventDefault();
  
  // Remove temporary flag
  const tempFlag = document.querySelector('.temp-flag');
  if (tempFlag) {
    document.body.removeChild(tempFlag);
  }
  
  // If flag was picked up but not placed on map, reset it
  if (flagsState.flagPickedUp) {
    // Flag will be placed by click handler if over the map
    // Otherwise, just reset the state
    setTimeout(() => {
      if (flagsState.flagPickedUp) {
        flagsState.flagPickedUp = false;
        flagsState.pickedUpFlagType = null;
        hideGhostFlag();
      }
    }, 100);
  }
  
  flagsState.isDragging = false;
  flagsState.draggedFlagElement = null;
  flagsState.draggedFlagType = null;
  
  // Restore camera controls
  restoreCameraControls();
}

/**
 * Handle flag touch end
 * Handles the end of a flag touch operation
 * 
 * @param {TouchEvent} e - Touch event
 */
function handleFlagTouchEnd(e) {
  if (!flagsState.isDragging) return;
  
  e.preventDefault();
  
  // Remove temporary flag
  const tempFlag = document.querySelector('.temp-flag');
  if (tempFlag) {
    document.body.removeChild(tempFlag);
  }
  
  // If flag was picked up but not placed on map, try to place it at last touch position
  if (flagsState.flagPickedUp && flagsState.lastTouchX && flagsState.lastTouchY) {
    const position = { x: flagsState.lastTouchX, y: flagsState.lastTouchY };
    const pickedPosition = viewerRef.scene.pickPosition(position);
    
    if (Cesium.defined(pickedPosition)) {
      placeFlagAtCartesian(flagsState.pickedUpFlagType === 'start', pickedPosition);
    }
    
    flagsState.flagPickedUp = false;
    flagsState.pickedUpFlagType = null;
    hideGhostFlag();
  }
  
  flagsState.isDragging = false;
  flagsState.draggedFlagElement = null;
  flagsState.draggedFlagType = null;
  flagsState.touchActive = false;
  
  // Restore camera controls
  restoreCameraControls();
}

/**
 * Create temporary flag for dragging
 * Creates a temporary flag element for visual feedback during drag
 * 
 * @param {string} flagType - Type of flag ('start' or 'finish')
 * @param {number} x - X coordinate for flag
 * @param {number} y - Y coordinate for flag
 */
function createTempFlag(flagType, x, y) {
  // Remove existing temp flag if it exists
  const existingTempFlag = document.querySelector('.temp-flag');
  if (existingTempFlag) {
    document.body.removeChild(existingTempFlag);
  }
  
  const tempFlag = document.createElement('div');
  tempFlag.className = `flag-icon temp-flag ${flagType}-flag`;
  
  const flagCanvas = flagType === 'start' ? createStartArchImage() : createFinishArchImage();
  tempFlag.style.backgroundImage = `url(${flagCanvas.toDataURL('image/png')})`;
  tempFlag.style.backgroundSize = 'contain';
  tempFlag.style.backgroundRepeat = 'no-repeat';
  tempFlag.style.backgroundPosition = 'center';
  
  tempFlag.style.left = (x - flagsState.mouseOffsetX) + 'px';
  tempFlag.style.top = (y - flagsState.mouseOffsetY) + 'px';
  
  document.body.appendChild(tempFlag);
}

/**
 * Update flag deployed state
 * Updates the visual state of flag elements based on deployment status
 */
function updateFlagDeployedState() {
  const startIcon = document.getElementById('startPointIcon');
  const finishIcon = document.getElementById('finishPointIcon');
  
  if (startIcon) {
    if (flagsState.startFlagDeployed) {
      startIcon.classList.add('flag-deployed');
    } else {
      startIcon.classList.remove('flag-deployed');
    }
  }
  
  if (finishIcon) {
    if (flagsState.finishFlagDeployed) {
      finishIcon.classList.add('flag-deployed');
    } else {
      finishIcon.classList.remove('flag-deployed');
    }
  }
}

/**
 * Place flag on map
 * Public function called from main.js to initiate flag placement
 * 
 * @param {boolean} isStart - Whether to place start flag (true) or finish flag (false)
 */
function placeFlagOnMap(isStart) {
  // If flag is already deployed, don't allow picking it up again
  if ((isStart && flagsState.startFlagDeployed) ||
      (!isStart && flagsState.finishFlagDeployed)) {
    return;
  }
  
  flagsState.flagPickedUp = true;
  flagsState.pickedUpFlagType = isStart ? 'start' : 'finish';
  
  // Show ghost flag at center of screen initially
  const canvas = viewerRef.scene.canvas;
  const centerX = canvas.clientWidth / 2;
  const centerY = canvas.clientHeight / 2;
  
  showGhostFlag(flagsState.pickedUpFlagType, centerX, centerY);
  
  // Disable camera controls
  disableCameraControls();
}

/**
 * Place flag at cartesian position
 * Places a flag at the specified cartesian position
 * 
 * @param {boolean} isStart - Whether to place start flag (true) or finish flag (false)
 * @param {Cesium.Cartesian3} position - Cartesian position to place flag
 */
function placeFlagAtCartesian(isStart, position) {
  if (!viewerRef || !position) return;
  
  // Remove existing flag
  if (isStart && flagsState.startFlag) {
    viewerRef.entities.remove(flagsState.startFlag);
    flagsState.startFlag = null;
    flagsState.startTrackIndex = -1;
    flagsState.startPointIndex = -1;
  } else if (!isStart && flagsState.finishFlag) {
    viewerRef.entities.remove(flagsState.finishFlag);
    flagsState.finishFlag = null;
    flagsState.finishTrackIndex = -1;
    flagsState.finishPointIndex = -1;
  }
  
  // Find closest track and point
  let closestTrackIndex = -1;
  let closestPointIndex = -1;
  let minDistance = Infinity;
  
  for (let i = 0; i < kmlDataListRef.length; i++) {
    const kd = kmlDataListRef[i];
    if (!kd.visible || !kd.coordinates || kd.coordinates.length === 0) continue;
    
    const pointIndex = kd.findClosestPoint(position);
    if (pointIndex >= 0) {
      const pointPosition = Cesium.Cartesian3.fromDegrees(
        kd.coordinates[pointIndex][0],
        kd.coordinates[pointIndex][1],
        kd.coordinates[pointIndex][2] || 0
      );
      
      const distance = Cesium.Cartesian3.distance(position, pointPosition);
      if (distance < minDistance) {
        minDistance = distance;
        closestTrackIndex = i;
        closestPointIndex = pointIndex;
      }
    }
  }
  
  // If no track found, return
  if (closestTrackIndex < 0 || closestPointIndex < 0) {
    console.warn("No track found near flag placement position");
    return;
  }
  
  // Get coordinates of closest point
  const kd = kmlDataListRef[closestTrackIndex];
  const coord = kd.coordinates[closestPointIndex];
  
  // Create flag entity
  const flagPosition = Cesium.Cartesian3.fromDegrees(coord[0], coord[1], coord[2] || 0);
  
  const flagEntity = viewerRef.entities.add({
    position: flagPosition,
    billboard: {
      image: isStart ? createStartArchImage().toDataURL() : createFinishArchImage().toDataURL(),
      width: 70,
      height: 70,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });
  
  // Store flag entity and track/point indices
  if (isStart) {
    flagsState.startFlag = flagEntity;
    flagsState.startTrackIndex = closestTrackIndex;
    flagsState.startPointIndex = closestPointIndex;
    flagsState.startFlagDeployed = true;
  } else {
    flagsState.finishFlag = flagEntity;
    flagsState.finishTrackIndex = closestTrackIndex;
    flagsState.finishPointIndex = closestPointIndex;
    flagsState.finishFlagDeployed = true;
  }
  
  // Update flag deployed state
  updateFlagDeployedState();
  
  // Update flag hit boxes
  updateFlagHitBoxes();
  
  // Restore camera controls
  restoreCameraControls();
  
  // Sync timestamps if both flags are placed
  if (flagsState.startFlag && flagsState.finishFlag) {
    syncTimestamps();
  }
}

/**
 * Reset all flags
 * Resets all flags to their initial state
 */
function resetAllFlags() {
  if (!viewerRef) return;
  
  // Remove flags from viewer
  if (flagsState.startFlag) {
    viewerRef.entities.remove(flagsState.startFlag);
    flagsState.startFlag = null;
  }
  
  if (flagsState.finishFlag) {
    viewerRef.entities.remove(flagsState.finishFlag);
    flagsState.finishFlag = null;
  }
  
  // Reset flag state
  flagsState.startTrackIndex = -1;
  flagsState.startPointIndex = -1;
  flagsState.finishTrackIndex = -1;
  flagsState.finishPointIndex = -1;
  flagsState.startFlagDeployed = false;
  flagsState.finishFlagDeployed = false;
  
  // Update flag deployed state
  updateFlagDeployedState();
  
  // Reset animation
  resetAnimation();
  
  // Reset timestamps
  resetTimestamps();
  
  // Set reset flag
  flagsState.justReset = true;
  setTimeout(() => {
    flagsState.justReset = false;
  }, 500);
}

/**
 * Sync timestamps
 * Synchronizes timestamps between tracks based on flag positions
 */
function syncTimestamps() {
  if (flagsState.startTrackIndex < 0 || flagsState.finishTrackIndex < 0) return;
  
  // Reset existing synced timestamps
  resetTimestamps();
  
  // Get reference track (track with start flag)
  const refTrack = kmlDataListRef[flagsState.startTrackIndex];
  if (!refTrack || !refTrack.timestamps || refTrack.timestamps.length === 0) return;
  
  // Get reference time at start flag
  const refStartTime = refTrack.timestamps[flagsState.startPointIndex];
  
  // Sync all tracks to reference track
  for (const kd of kmlDataListRef) {
    if (!kd.timestamps || kd.timestamps.length === 0) continue;
    
    // Create synced timestamps
    kd.syncedTimestamps = [];
    
    // If this is the reference track, just copy timestamps
    if (kd === refTrack) {
      for (let i = 0; i < kd.timestamps.length; i++) {
        const time = new Date(kd.timestamps[i]);
        kd.syncedTimestamps.push({
          time: time,
          coord: kd.coordinates[i]
        });
      }
    } else {
      // Find closest point to start flag
      const closestToStart = kd.findClosestPointToCoordinate(
        refTrack.coordinates[flagsState.startPointIndex]
      );
      
      if (closestToStart < 0) continue;
      
      // Calculate time offset
      const timeOffset = refStartTime - kd.timestamps[closestToStart];
      
      // Apply offset to all timestamps
      for (let i = 0; i < kd.timestamps.length; i++) {
        const time = new Date(kd.timestamps[i] + timeOffset);
        kd.syncedTimestamps.push({
          time: time,
          coord: kd.coordinates[i]
        });
      }
    }
  }
  
  // Update animation state
  updateAnimationState();
}

/**
 * Reset timestamps
 * Resets all synced timestamps
 */
function resetTimestamps() {
  for (const kd of kmlDataListRef) {
    kd.syncedTimestamps = null;
  }
  
  // Reset animation state
  animationState.startTime = 0;
  animationState.endTime = 0;
  animationState.currentTime = 0;
}

/**
 * Update animation state
 * Updates animation state based on synced timestamps
 */
function updateAnimationState() {
  if (!kmlDataListRef.length) return;
  
  let minTime = Infinity;
  let maxTime = -Infinity;
  
  for (const kd of kmlDataListRef) {
    if (!kd.syncedTimestamps || kd.syncedTimestamps.length === 0) continue;
    
    const trackMinTime = kd.syncedTimestamps[0].time.getTime();
    const trackMaxTime = kd.syncedTimestamps[kd.syncedTimestamps.length - 1].time.getTime();
    
    if (trackMinTime < minTime) minTime = trackMinTime;
    if (trackMaxTime > maxTime) maxTime = trackMaxTime;
  }
  
  if (minTime === Infinity || maxTime === -Infinity) return;
  
  animationState.startTime = minTime;
  animationState.endTime = maxTime;
  animationState.currentTime = minTime;
  
  // Update timeline labels
  updateTimelineLabels();
}

/**
 * Update timeline labels
 * Updates timeline labels based on animation state
 */
function updateTimelineLabels() {
  const startTimeLabel = document.getElementById('start-time-label');
  const endTimeLabel = document.getElementById('end-time-label');
  const currentTimeLabel = document.getElementById('current-time-label');
  const timelineSlider = document.getElementById('timelineSlider');
  
  if (!startTimeLabel || !endTimeLabel || !currentTimeLabel || !timelineSlider) return;
  
  if (animationState.startTime && animationState.endTime) {
    const totalDuration = (animationState.endTime - animationState.startTime) / 1000;
    startTimeLabel.textContent = '00:00';
    endTimeLabel.textContent = formatTime(totalDuration);
    
    const currentDuration = (animationState.currentTime - animationState.startTime) / 1000;
    currentTimeLabel.textContent = formatTime(currentDuration);
    
    const position = (animationState.currentTime - animationState.startTime) / 
                    (animationState.endTime - animationState.startTime);
    timelineSlider.value = position * 100;
  } else {
    startTimeLabel.textContent = '00:00';
    endTimeLabel.textContent = '00:00';
    currentTimeLabel.textContent = '00:00';
    timelineSlider.value = 0;
  }
}

/**
 * Format time
 * Formats time in seconds to MM:SS format
 * 
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Animation functions
 */
let animationFrameId = null;

/**
 * Start animation playback
 * Starts animation playback
 */
function startAnimationPlayback() {
  if (animationState.playing) return;
  
  animationState.playing = true;
  animationState.lastUpdateTime = performance.now();
  
  // Start animation loop
  animationLoop();
}

/**
 * Stop animation playback
 * Stops animation playback
 */
function stopAnimationPlayback() {
  animationState.playing = false;
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Reset animation to sync point
 * Resets animation to the start time
 */
function resetAnimationToSyncPoint() {
  animationState.currentTime = animationState.startTime;
  updateTimelineLabels();
  updateAnimationMarkers();
}

/**
 * Set animation speed
 * Sets the animation playback speed
 * 
 * @param {number} speed - Animation speed multiplier
 */
function setAnimationSpeed(speed) {
  animationState.speed = speed;
}

/**
 * Set animation position
 * Sets the animation position based on normalized position
 * 
 * @param {number} position - Normalized position (0-1)
 */
function setAnimationPosition(position) {
  if (!animationState.startTime || !animationState.endTime) return;
  
  const time = animationState.startTime + position * (animationState.endTime - animationState.startTime);
  animationState.currentTime = time;
  
  updateTimelineLabels();
  updateAnimationMarkers();
}

/**
 * Animation loop
 * Main animation loop
 */
function animationLoop() {
  if (!animationState.playing) return;
  
  const now = performance.now();
  const deltaTime = now - animationState.lastUpdateTime;
  animationState.lastUpdateTime = now;
  
  // Update current time
  const timeStep = deltaTime * animationState.speed;
  animationState.currentTime += timeStep;
  
  // Check if animation is complete
  if (animationState.currentTime >= animationState.endTime) {
    animationState.currentTime = animationState.endTime;
    animationState.playing = false;
  }
  
  // Update timeline labels
  updateTimelineLabels();
  
  // Update animation markers
  updateAnimationMarkers();
  
  // Continue animation loop
  if (animationState.playing) {
    animationFrameId = requestAnimationFrame(animationLoop);
  }
}

// Export animation functions
window.startAnimationPlayback = startAnimationPlayback;
window.stopAnimationPlayback = stopAnimationPlayback;
window.resetAnimationToSyncPoint = resetAnimationToSyncPoint;
window.setAnimationSpeed = setAnimationSpeed;
window.setAnimationPosition = setAnimationPosition;
window.placeFlagOnMap = placeFlagOnMap;
window.resetAllFlags = resetAllFlags;
