/* main.js */

// No imports needed with direct script loading - these are now globally available
// from the included script files

//////////////////////////
// Global references
let viewer = null;
let kmlDataList = [];
let settings = {
  colorMode: 'speed',
  continuousColors: true,
  speedUnits: 'mph',
  legendMin: 0,
  legendMax: 100
};

// DOM elements
let fileInfoElement = null;
let progressBarElement = null;
let progressBarFillElement = null;
let trackTogglesElement = null;
let timelineSliderElement = null;
let startTimeLabel = null;
let endTimeLabel = null;
let currentTimeLabel = null;
let speedValueElement = null;
let speedSliderElement = null;
let unitToggleElement = null;
let unitLabelElement = null;
let legendGradientElement = null;
let legendLabelsElement = null;
let trackPopupElement = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI elements first
  initializeUI();
  
  // Then initialize the viewer (with a slight delay to ensure DOM is ready)
  setTimeout(() => {
    try {
      initializeViewer();
      setupEventListeners();
      createTrackPopup();
      console.log('Viewer initialized successfully');
    } catch (error) {
      console.error('Error initializing viewer:', error);
      // Show error message to user
      showErrorMessage('Failed to initialize map viewer. Please check your internet connection and try again.');
    }
  }, 100);
});

// Show error message to user
function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'absolute';
  errorDiv.style.top = '50%';
  errorDiv.style.left = '50%';
  errorDiv.style.transform = 'translate(-50%, -50%)';
  errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = '20px';
  errorDiv.style.borderRadius = '5px';
  errorDiv.style.zIndex = '9999';
  errorDiv.style.maxWidth = '80%';
  errorDiv.style.textAlign = 'center';
  errorDiv.innerHTML = message;
  document.body.appendChild(errorDiv);
  
  // Add a close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.marginTop = '10px';
  closeButton.style.padding = '5px 10px';
  closeButton.style.backgroundColor = 'white';
  closeButton.style.color = 'red';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '3px';
  closeButton.style.cursor = 'pointer';
  closeButton.onclick = function() {
    document.body.removeChild(errorDiv);
  };
  errorDiv.appendChild(closeButton);
}

// Initialize Cesium viewer
function initializeViewer() {
  try {
    // Ensure token is set
    if (!Cesium.Ion.defaultAccessToken) {
      console.log('Setting token in initializeViewer');
      Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyOGI0NzRjZC04MWMyLTRiYmEtOTdkZS05MmM2YTNlOTkwODciLCJpZCI6MjkzMDE4LCJpYXQiOjE3NDQzMzg4Mjh9.goakCTnXpFoxeFNE0DBWyChHYW9nKrXOVPaNY5UjJAo';
    }

    // Check if container exists
    const container = document.getElementById('cesiumContainer');
    if (!container) {
      console.error('Cesium container not found');
      return;
    }
    
    // Create viewer with error handling
    viewer = new Cesium.Viewer('cesiumContainer', {
      terrainProvider: Cesium.createWorldTerrain(),
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      scene3DOnly: true,
      creditContainer: document.createElement('div'), // Hide credits
      orderIndependentTranslucency: false, // Better performance
      contextOptions: {
        webgl: {
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false,
          depth: true,
          stencil: false
        }
      },
      sceneMode: Cesium.SceneMode.SCENE3D,
      shadows: false,
      showRenderLoopErrors: true,
      targetFrameRate: 60
    });

    // Configure viewer
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
    
    // Hide Cesium branding
    hideViewerBranding();
    
    // Initialize animation and flags with references
    if (typeof initAnimationAndFlags === 'function') {
      initAnimationAndFlags({
        viewer,
        kmlDataList,
        settings,
        fileInfo: fileInfoElement,
      });
    } else {
      console.error('initAnimationAndFlags function not found');
    }
    
    // Setup track segment hover/touch handler
    setupTrackInteractionHandler();
    
    // Set initial camera position
    setDefaultCameraPosition();
    
    console.log('Viewer setup complete');
  } catch (error) {
    console.error('Error in initializeViewer:', error);
    showErrorMessage('Error initializing map: ' + error.message);
  }
}

// Hide Cesium branding elements
function hideViewerBranding() {
  try {
    // Remove Cesium logo and credits
    const creditContainer = document.querySelector('.cesium-widget-credits');
    if (creditContainer) {
      creditContainer.style.display = 'none';
    }
    
    // Remove other Cesium UI elements
    const selectors = [
      '.cesium-viewer-bottom',
      '.cesium-viewer-timelineContainer',
      '.cesium-viewer-animationContainer',
      '.cesium-viewer-fullscreenContainer',
      '.cesium-viewer-toolbar',
      '.cesium-widget-credits',
      '.cesium-credit-container',
      '.cesium-credit-logoContainer',
      '.cesium-credit-expand-link',
      '.cesium-widget-errorPanel',
      '.cesium-infoBox-container'
    ];
    
    selectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.display = 'none';
      }
    });
  } catch (error) {
    console.error('Error hiding viewer branding:', error);
  }
}

// Set default camera position
function setDefaultCameraPosition() {
  if (viewer && viewer.camera) {
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-95.0, 40.0, 10000000.0)
    });
  }
}

// Set up event listeners for UI controls
function setupEventListeners() {
  try {
    // Load KML button
    const loadKmlBtn = document.getElementById('loadKmlBtn');
    if (loadKmlBtn) {
      loadKmlBtn.addEventListener('click', () => {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = '.kml,.kmz';
        
        // Trigger click on the file input
        fileInput.click();
        
        // Handle file selection
        fileInput.addEventListener('change', (event) => {
          const files = event.target.files;
          if (files.length > 0) {
            handleKmlFiles(files);
          }
        });
      });
    }
    
    // Interpolate data button
    const interpolateDataBtn = document.getElementById('interpolateDataBtn');
    if (interpolateDataBtn) {
      interpolateDataBtn.addEventListener('click', () => {
        interpolateTrackData();
      });
    }
    
    // Reset view button
    const resetViewBtn = document.getElementById('resetView');
    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', () => {
        resetView();
      });
    }
    
    // Top down view button
    const topDownViewBtn = document.getElementById('topDownView');
    if (topDownViewBtn) {
      topDownViewBtn.addEventListener('click', () => {
        setTopDownView();
      });
    }
    
    // Show all button
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', () => {
        showAllTracks();
      });
    }
    
    // Color mode radio buttons
    const colorModeRadios = document.querySelectorAll('input[name="colorMode"]');
    colorModeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          settings.colorMode = radio.value;
          updateTrackColors();
        }
      });
    });
    
    // Continuous colors checkbox
    const continuousColorsCheckbox = document.getElementById('continuousColors');
    if (continuousColorsCheckbox) {
      continuousColorsCheckbox.addEventListener('change', () => {
        settings.continuousColors = continuousColorsCheckbox.checked;
        updateTrackColors();
      });
    }
    
    // Unit toggle
    const unitToggle = document.getElementById('unitToggle');
    if (unitToggle) {
      unitToggle.addEventListener('change', () => {
        settings.speedUnits = unitToggle.checked ? 'kph' : 'mph';
        updateUnitLabel();
        updateTrackColors();
      });
    }
    
    // Animation controls
    setupAnimationControls();
    
    console.log('Event listeners set up successfully');
  } catch (error) {
    console.error('Error setting up event listeners:', error);
  }
}

// Initialize UI elements
function initializeUI() {
  try {
    // Get references to DOM elements
    fileInfoElement = document.getElementById('fileInfo');
    progressBarElement = document.getElementById('progressBar');
    progressBarFillElement = document.getElementById('progressBarFill');
    trackTogglesElement = document.getElementById('trackToggles');
    timelineSliderElement = document.getElementById('timelineSlider');
    startTimeLabel = document.getElementById('start-time-label');
    endTimeLabel = document.getElementById('end-time-label');
    currentTimeLabel = document.getElementById('current-time-label');
    speedValueElement = document.getElementById('speedValue');
    speedSliderElement = document.getElementById('speedSlider');
    unitToggleElement = document.getElementById('unitToggle');
    unitLabelElement = document.getElementById('unitLabel');
    legendGradientElement = document.getElementById('legendGradient');
    legendLabelsElement = document.getElementById('legendLabels');
    
    // Initialize legend
    updateLegend();
    
    // Initialize unit label
    updateUnitLabel();
    
    console.log('UI initialized successfully');
  } catch (error) {
    console.error('Error initializing UI:', error);
  }
}

// Update unit label based on current setting
function updateUnitLabel() {
  if (unitLabelElement) {
    unitLabelElement.textContent = settings.speedUnits === 'mph' ? 'MPH' : 'KPH';
  }
}

// Create track popup element
function createTrackPopup() {
  try {
    // Create popup element if it doesn't exist
    if (!trackPopupElement) {
      trackPopupElement = document.createElement('div');
      trackPopupElement.className = 'track-popup';
      document.body.appendChild(trackPopupElement);
      
      // For touch devices, add a close button
      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        const closeButton = document.createElement('button');
        closeButton.className = 'popup-close-button';
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
          hideTrackPopup();
        });
        trackPopupElement.appendChild(closeButton);
      }
    }
    
    console.log('Track popup created');
  } catch (error) {
    console.error('Error creating track popup:', error);
  }
}

// Setup track interaction handler (hover/touch)
function setupTrackInteractionHandler() {
  if (!viewer) {
    console.error('Viewer not initialized for track interaction handler');
    return;
  }
  
  try {
    // Use appropriate event based on device type
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const eventType = isTouchDevice ? Cesium.ScreenSpaceEventType.LEFT_CLICK : Cesium.ScreenSpaceEventType.MOUSE_MOVE;
    
    // Create event handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // Add event listener
    handler.setInputAction(function(movement) {
      const pickedObject = viewer.scene.pick(movement.endPosition || movement.position);
      
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.trackData) {
        // Show popup with track data
        showTrackPopup(pickedObject.id.trackData, movement);
      } else {
        // Hide popup when not hovering over a track
        hideTrackPopup();
      }
    }, eventType);
    
    // For touch devices, add a handler to hide popup when touching elsewhere
    if (isTouchDevice) {
      handler.setInputAction(function(movement) {
        const pickedObject = viewer.scene.pick(movement.position);
        
        if (!Cesium.defined(pickedObject) || !pickedObject.id || !pickedObject.id.trackData) {
          hideTrackPopup();
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
    
    // For mouse devices, add a mouse out handler
    if (!isTouchDevice) {
      handler.setInputAction(function() {
        hideTrackPopup();
      }, Cesium.ScreenSpaceEventType.MOUSE_OUT);
    }
    
    console.log('Track interaction handler set up');
  } catch (error) {
    console.error('Error setting up track interaction handler:', error);
  }
}

// Show track popup with data
function showTrackPopup(trackData, movement) {
  if (!trackPopupElement) return;
  
  try {
    // Position popup near the cursor but not under it
    const x = movement.endPosition ? movement.endPosition.x : movement.position.x;
    const y = movement.endPosition ? movement.endPosition.y : movement.position.y;
    
    // For touch devices, position popup above the touch point
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const offsetX = isTouchDevice ? -140 : 20;
    const offsetY = isTouchDevice ? -200 : 20;
    
    trackPopupElement.style.left = `${x + offsetX}px`;
    trackPopupElement.style.top = `${y + offsetY}px`;
    
    // Populate popup content
    let content = `
      <div class="track-popup-title">${trackData.name || 'Track Segment'}</div>
      <div class="track-popup-content">
    `;
    
    // Add track properties
    if (trackData.speed !== undefined) {
      const speedUnit = settings.speedUnits === 'mph' ? 'mph' : 'km/h';
      const speedValue = settings.speedUnits === 'mph' ? trackData.speed : trackData.speed * 1.60934;
      content += `
        <div class="track-popup-item">
          <div class="track-popup-color" style="background-color: ${trackData.color || '#ccc'}"></div>
          <div class="track-popup-name">Speed</div>
          <div class="track-popup-value">${speedValue.toFixed(1)} ${speedUnit}</div>
        </div>
      `;
    }
    
    if (trackData.elevation !== undefined) {
      content += `
        <div class="track-popup-item">
          <div class="track-popup-name">Elevation</div>
          <div class="track-popup-value">${trackData.elevation.toFixed(1)} m</div>
        </div>
      `;
    }
    
    if (trackData.time !== undefined) {
      content += `
        <div class="track-popup-item">
          <div class="track-popup-name">Time</div>
          <div class="track-popup-value">${formatTime(trackData.time)}</div>
        </div>
      `;
    }
    
    content += '</div>';
    
    // For touch devices, add a close button
    if (isTouchDevice) {
      content += '<button class="popup-close-button">Close</button>';
    }
    
    // Update popup content
    trackPopupElement.innerHTML = content;
    
    // Add event listener to close button if it exists
    const closeButton = trackPopupElement.querySelector('.popup-close-button');
    if (closeButton) {
      closeButton.addEventListener('click', hideTrackPopup);
    }
    
    // Show popup
    trackPopupElement.style.display = 'block';
    
    // Ensure popup is within viewport bounds
    const rect = trackPopupElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (rect.right > viewportWidth) {
      trackPopupElement.style.left = `${viewportWidth - rect.width - 10}px`;
    }
    
    if (rect.bottom > viewportHeight) {
      trackPopupElement.style.top = `${viewportHeight - rect.height - 10}px`;
    }
    
    if (rect.left < 0) {
      trackPopupElement.style.left = '10px';
    }
    
    if (rect.top < 0) {
      trackPopupElement.style.top = '10px';
    }
  } catch (error) {
    console.error('Error showing track popup:', error);
  }
}

// Hide track popup
function hideTrackPopup() {
  if (trackPopupElement) {
    trackPopupElement.style.display = 'none';
  }
}

// Format time in MM:SS format
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Update legend based on current settings
function updateLegend() {
  if (!legendGradientElement || !legendLabelsElement) return;
  
  try {
    // Clear existing content
    legendGradientElement.innerHTML = '';
    legendLabelsElement.innerHTML = '';
    
    // Set up gradient based on color mode
    let gradient = '';
    let min = settings.legendMin;
    let max = settings.legendMax;
    let unit = '';
    
    switch (settings.colorMode) {
      case 'speed':
        gradient = 'linear-gradient(to top, blue, cyan, green, yellow, red)';
        unit = settings.speedUnits === 'mph' ? 'mph' : 'km/h';
        break;
      case 'acceleration':
        gradient = 'linear-gradient(to top, purple, blue, green, yellow, red)';
        unit = 'm/s²';
        break;
      case 'timeDifference':
        gradient = 'linear-gradient(to top, green, yellow, red)';
        unit = 's';
        break;
      case 'lostTime':
        gradient = 'linear-gradient(to top, green, yellow, red)';
        unit = 's';
        break;
      default:
        return; // No legend for 'noColor' mode
    }
    
    // Set gradient background
    legendGradientElement.style.background = gradient;
    
    // Add labels
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const value = min + (max - min) * (i / steps);
      const label = document.createElement('div');
      label.className = 'legend-label';
      label.textContent = `${value.toFixed(0)} ${unit}`;
      label.style.bottom = `${(i / steps) * 100}%`;
      legendLabelsElement.appendChild(label);
    }
    
    console.log('Legend updated');
  } catch (error) {
    console.error('Error updating legend:', error);
  }
}

// Setup animation controls
function setupAnimationControls() {
  try {
    // Play button
    const playBtn = document.getElementById('playAnimation');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (typeof startAnimation === 'function') {
          startAnimation();
        }
      });
    }
    
    // Pause button
    const pauseBtn = document.getElementById('pauseAnimation');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        if (typeof pauseAnimation === 'function') {
          pauseAnimation();
        }
      });
    }
    
    // Reset to sync point button
    const resetToSyncBtn = document.getElementById('resetToSyncPoint');
    if (resetToSyncBtn) {
      resetToSyncBtn.addEventListener('click', () => {
        if (typeof resetToSyncPoint === 'function') {
          resetToSyncPoint();
        }
      });
    }
    
    // Timeline slider
    if (timelineSliderElement) {
      // For better cross-browser compatibility, use both input and change events
      ['input', 'change'].forEach(eventType => {
        timelineSliderElement.addEventListener(eventType, () => {
          if (typeof setAnimationTime === 'function') {
            const time = parseFloat(timelineSliderElement.value);
            setAnimationTime(time);
          }
        });
      });
    }
    
    // Speed slider
    if (speedSliderElement) {
      // For better cross-browser compatibility, use both input and change events
      ['input', 'change'].forEach(eventType => {
        speedSliderElement.addEventListener(eventType, () => {
          if (typeof setAnimationSpeed === 'function') {
            const speed = parseFloat(speedSliderElement.value);
            setAnimationSpeed(speed);
            if (speedValueElement) {
              speedValueElement.textContent = `${speed.toFixed(2)}x`;
            }
          }
        });
      });
    }
    
    console.log('Animation controls set up');
  } catch (error) {
    console.error('Error setting up animation controls:', error);
  }
}

// Reset view to default position
function resetView() {
  if (viewer && viewer.camera) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-95.0, 40.0, 10000000.0),
      duration: 1.5
    });
  }
}

// Set top-down view
function setTopDownView() {
  if (viewer && viewer.camera) {
    const center = viewer.camera.positionCartographic;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, center.height),
      orientation: {
        heading: 0.0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0.0
      },
      duration: 1.5
    });
  }
}

// Show all tracks
function showAllTracks() {
  if (!viewer || kmlDataList.length === 0) return;
  
  try {
    // Create a rectangle that encompasses all tracks
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    
    // Find bounds of all tracks
    kmlDataList.forEach(kmlData => {
      if (kmlData.bounds) {
        west = Math.min(west, kmlData.bounds.west);
        south = Math.min(south, kmlData.bounds.south);
        east = Math.max(east, kmlData.bounds.east);
        north = Math.max(north, kmlData.bounds.north);
      }
    });
    
    // If we have valid bounds, fly to them
    if (west !== Infinity && south !== Infinity && east !== -Infinity && north !== -Infinity) {
      const rectangle = Cesium.Rectangle.fromDegrees(west, south, east, north);
      viewer.camera.flyTo({
        destination: rectangle,
        duration: 1.5,
        complete: function() {
          // Add some padding
          viewer.camera.zoomOut(viewer.camera.getMagnitude() * 0.2);
        }
      });
    } else {
      // If no bounds, reset to default view
      resetView();
    }
  } catch (error) {
    console.error('Error showing all tracks:', error);
  }
}

// Handle KML file loading
function handleKmlFiles(files) {
  // Implementation would go here
  console.log('KML files selected:', files.length);
}

// Interpolate track data
function interpolateTrackData() {
  // Implementation would go here
  console.log('Interpolating track data');
}

// Update track colors based on current settings
function updateTrackColors() {
  // Implementation would go here
  console.log('Updating track colors');
}

// Detect browser and apply specific fixes if needed
function applyBrowserSpecificFixes() {
  // Detect Safari
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // Detect Edge
  const isEdge = /Edge\/\d./i.test(navigator.userAgent);
  
  // Apply Safari-specific fixes
  if (isSafari) {
    // Fix for Safari's handling of position: fixed elements
    document.documentElement.classList.add('safari');
    
    // Fix for Safari's handling of range inputs
    const rangeInputs = document.querySelectorAll('input[type="range"]');
    rangeInputs.forEach(input => {
      input.classList.add('safari-range');
    });
  }
  
  // Apply iOS-specific fixes
  if (isIOS) {
    // Fix for iOS momentum scrolling
    document.documentElement.classList.add('ios');
    
    // Fix for iOS input focusing
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('touchstart', function(e) {
        e.stopPropagation();
      });
    });
  }
  
  // Apply Edge-specific fixes
  if (isEdge) {
    // Fix for Edge's handling of flexbox
    document.documentElement.classList.add('edge');
  }
}

// Call browser-specific fixes
applyBrowserSpecificFixes();

// Export functions for use in other modules
window.resetView = resetView;
window.setTopDownView = setTopDownView;
window.showAllTracks = showAllTracks;
