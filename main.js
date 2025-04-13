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

// Touch detection
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initializeViewer();
  setupEventListeners();
  initializeUI();
  createTrackPopup();
});

// Initialize Cesium viewer
function initializeViewer() {
  Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyOGI0NzRjZC04MWMyLTRiYmEtOTdkZS05MmM2YTNlOTkwODciLCJpZCI6MjkzMDE4LCJpYXQiOjE3NDQzMzg4Mjh9.goakCTnXpFoxeFNE0DBWyChHYW9nKrXOVPaNY5UjJAo';

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
    showRenderLoopErrors: false,
    targetFrameRate: 60
  });

  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
  
  // Remove Cesium logo, watermarks, etc. (omitted for brevity)...

  // Initialize animation and flags with references
  initAnimationAndFlags({
    viewer,
    kmlDataList,
    settings,
    fileInfo: fileInfoElement,
  });
  
  // Setup track segment hover/touch handler
  setupTrackInteractionHandler();
}

// Set up event listeners for UI controls
function setupEventListeners() {
  // File controls
  document.getElementById('loadKmlBtn').addEventListener('click', handleFileLoad);
  document.getElementById('interpolateDataBtn').addEventListener('click', handleInterpolateData);
  
  // View controls
  document.getElementById('resetView').addEventListener('click', resetView);
  document.getElementById('topDownView').addEventListener('click', topDownView);
  document.getElementById('showAllBtn').addEventListener('click', showAllTracks);

  // [FIX] Ensure resetFlagsBtn calls resetAllFlags so gates fully reset
  document.getElementById('resetFlagsBtn').addEventListener('click', resetAllFlags);

  // Color mode controls
  document.getElementById('noColorRadio').addEventListener('change', updateColorMode);
  document.getElementById('speedRadio').addEventListener('change', updateColorMode);
  document.getElementById('accelRadio').addEventListener('change', updateColorMode);
  document.getElementById('timeDiffRadio').addEventListener('change', updateColorMode);
  document.getElementById('lostTimeRadio').addEventListener('change', updateColorMode);
  document.getElementById('continuousColors').addEventListener('change', updateColorMode);
  document.getElementById('unitToggle').addEventListener('change', toggleUnits);
  
  // Animation controls
  document.getElementById('playAnimation').addEventListener('click', startAnimation);
  document.getElementById('pauseAnimation').addEventListener('click', stopAnimation);
  document.getElementById('resetToSyncPoint').addEventListener('click', resetAnimation);
  
  // Add both input and change events for sliders to ensure they work on touch devices
  document.getElementById('speedSlider').addEventListener('input', updateAnimationSpeed);
  document.getElementById('speedSlider').addEventListener('change', updateAnimationSpeed);
  document.getElementById('timelineSlider').addEventListener('input', updateTimelinePosition);
  document.getElementById('timelineSlider').addEventListener('change', updateTimelinePosition);
  
  // Flag controls - add both click and touch events
  const startPointIcon = document.getElementById('startPointIcon');
  const finishPointIcon = document.getElementById('finishPointIcon');
  
  startPointIcon.addEventListener('click', () => placeFlag(true));
  finishPointIcon.addEventListener('click', () => placeFlag(false));
  
  // Add touch events for flags
  if (isTouchDevice) {
    startPointIcon.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevent default touch behavior
      placeFlag(true);
    });
    
    finishPointIcon.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevent default touch behavior
      placeFlag(false);
    });
  }
  
  // Initialize flag drag/drop with touch support
  initFlagDragDrop();
}

// Initialize UI elements
function initializeUI() {
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
  
  updateLegend();
}

// Create track popup element
function createTrackPopup() {
  const existingPopup = document.getElementById('trackPopup');
  if (existingPopup) {
    document.body.removeChild(existingPopup);
  }
  
  trackPopupElement = document.createElement('div');
  trackPopupElement.id = 'trackPopup';
  trackPopupElement.className = 'track-popup';
  
  const title = document.createElement('div');
  title.className = 'track-popup-title';
  
  const content = document.createElement('div');
  content.className = 'track-popup-content';
  
  trackPopupElement.appendChild(title);
  trackPopupElement.appendChild(content);
  
  document.body.appendChild(trackPopupElement);
}

// Setup track segment interaction handler (supports both mouse and touch)
function setupTrackInteractionHandler() {
  if (!viewer) return;
  
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  
  let hoverTimeout = null;
  let isHovering = false;
  let lastTapPosition = null;
  
  // Mouse move handler for desktop
  handler.setInputAction(function(movement) {
    handleTrackInteraction(movement.endPosition);
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  
  // Mouse out handler for desktop
  handler.setInputAction(function() {
    clearTrackInteraction();
  }, Cesium.ScreenSpaceEventType.MOUSE_OUT);
  
  // Touch move handler for tablets
  if (isTouchDevice) {
    handler.setInputAction(function(movement) {
      // For touch move, use the position of the first touch point
      if (movement.position) {
        handleTrackInteraction(movement.position);
      }
    }, Cesium.ScreenSpaceEventType.TOUCH_MOVE);
    
    // Touch end handler for tablets
    handler.setInputAction(function() {
      clearTrackInteraction();
    }, Cesium.ScreenSpaceEventType.TOUCH_END);
    
    // Single tap handler for tablets - show popup on tap
    handler.setInputAction(function(tap) {
      lastTapPosition = tap.position;
      const pickedObject = viewer.scene.pick(tap.position);
      
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.polyline) {
        const cartesian = viewer.scene.pickPosition(tap.position);
        if (cartesian) {
          showTrackPopupAtPosition(tap.position, cartesian);
          
          // Auto-hide popup after 3 seconds
          setTimeout(() => {
            hideTrackPopup();
          }, 3000);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }
  
  // Common function to handle track interaction
  function handleTrackInteraction(position) {
    const pickedObject = viewer.scene.pick(position);
    
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    
    if (!Cesium.defined(pickedObject) || !(pickedObject.id && pickedObject.id.polyline)) {
      hideTrackPopup();
      isHovering = false;
      return;
    }
    
    hoverTimeout = setTimeout(() => {
      const cartesian = viewer.scene.pickPosition(position);
      
      if (cartesian) {
        showTrackPopupAtPosition(position, cartesian);
        isHovering = true;
      }
    }, 200);
  }
  
  // Common function to clear track interaction
  function clearTrackInteraction() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    
    // Don't hide popup immediately on touch devices if it was shown by a tap
    if (!isTouchDevice || !lastTapPosition) {
      hideTrackPopup();
    }
    
    isHovering = false;
  }
}

// Show track popup at the specified position
function showTrackPopupAtPosition(screenPosition, cartesian) {
  if (!trackPopupElement || !cartesian) return;
  
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const height = cartographic.height;
  
  const trackData = [];
  
  for (let i = 0; i < kmlDataList.length; i++) {
    const kd = kmlDataList[i];
    if (!kd.visible) continue;
    
    const closestPointIndex = kd.findClosestPoint(cartesian);
    if (closestPointIndex < 0) continue;
    
    let value = 0;
    let unit = '';
    
    if (settings.colorMode === 'speed') {
      value = kd.getSpeedInUnits(kd.speeds[closestPointIndex], settings.speedUnits);
      unit = settings.speedUnits === 'mph' ? 'mph' : 'kph';
    } else if (settings.colorMode === 'acceleration') {
      value = kd.accelerations[closestPointIndex];
      unit = 'm/s²';
    } else if (settings.colorMode === 'timeDifference' || settings.colorMode === 'lostTime') {
      let refTrackIdx = 0;
      if (typeof flagsState !== 'undefined' && flagsState.startTrackIndex >= 0 && 
          flagsState.startTrackIndex < kmlDataList.length) {
        refTrackIdx = flagsState.startTrackIndex;
      } else {
        let maxPoints = 0;
        for (let j = 0; j < kmlDataList.length; j++) {
          if (kmlDataList[j].visible && kmlDataList[j].timestamps.length > maxPoints) {
            maxPoints = kmlDataList[j].timestamps.length;
            refTrackIdx = j;
          }
        }
      }
      
      if (i === refTrackIdx) {
        value = 0;
      } else {
        const refTrack = kmlDataList[refTrackIdx];
        if (settings.colorMode === 'timeDifference') {
          if (kd.syncedTimestamps && kd.syncedTimestamps.length > closestPointIndex &&
              refTrack.syncedTimestamps && refTrack.syncedTimestamps.length > closestPointIndex) {
            const trackTime = kd.syncedTimestamps[closestPointIndex].time.getTime();
            const refTime = refTrack.syncedTimestamps[closestPointIndex].time.getTime();
            value = Math.abs((trackTime - refTime) / 1000);
          }
        } else if (settings.colorMode === 'lostTime') {
          if (track.lostTimeDerivatives && j < track.lostTimeDerivatives.length) {
			value = track.lostTimeDerivatives[j];
		  } else {
			// Fallback to absolute difference if derivatives not available
			const trackTime = pt.time.getTime();
			const refTime = refTrack.syncedTimestamps[closestIdx].time.getTime();
			value = (trackTime - refTime) / 1000;
		  }
        }
      }
      
      unit = 's';
    }
    
    let color;
    if (settings.colorMode === 'noColor') {
      color = kd.color;
    } else {
      const colorScale = colorScales[settings.colorMode];
      if (colorScale) {
        const normalizedValue = (value - settings.legendMin) / (settings.legendMax - settings.legendMin);
        const clampedValue = Math.max(0, Math.min(1, normalizedValue));
        color = interpolateColor(colorScale, clampedValue);
      } else {
        color = kd.color;
      }
    }
    
    trackData.push({
      name: kd.name || `Track ${i + 1}`,
      value: value,
      unit: unit,
      color: color
    });
  }
  
  updateTrackPopupContent(trackData, settings.colorMode);
  
  // Position popup - adjust for touch to ensure it's not under the finger
  if (isTouchDevice) {
    // Position popup above the touch point on touch devices
    trackPopupElement.style.left = (screenPosition.x - 125) + 'px'; // Center horizontally
    trackPopupElement.style.top = (screenPosition.y - 150) + 'px'; // Position above finger
  } else {
    // Original positioning for mouse
    trackPopupElement.style.left = (screenPosition.x + 15) + 'px';
    trackPopupElement.style.top = (screenPosition.y + 15) + 'px';
  }
  
  trackPopupElement.style.display = 'block';
}

// Update track popup content
function updateTrackPopupContent(trackData, colorMode) {
  if (!trackPopupElement) return;
  
  const title = trackPopupElement.querySelector('.track-popup-title');
  const content = trackPopupElement.querySelector('.track-popup-content');
  
  let titleText = 'Track Data';
  switch (colorMode) {
    case 'speed':
      titleText = `Speed (${settings.speedUnits === 'mph' ? 'MPH' : 'KPH'})`;
      break;
    case 'acceleration':
      titleText = 'Acceleration (m/s²)';
      break;
    case 'timeDifference':
      titleText = 'Time Difference (s)';
      break;
    case 'lostTime':
      titleText = 'Lost Time (s)';
      break;
    case 'noColor':
      titleText = 'Track Information';
      break;
  }
  title.textContent = titleText;
  
  content.innerHTML = '';
  
  if (trackData.length === 0) {
    const noData = document.createElement('div');
    noData.textContent = 'No track data available';
    content.appendChild(noData);
  } else {
    trackData.forEach(track => {
      const item = document.createElement('div');
      item.className = 'track-popup-item';
      
      const colorBox = document.createElement('div');
      colorBox.className = 'track-popup-color';
      colorBox.style.backgroundColor = track.color.toCssColorString();
      
      const name = document.createElement('div');
      name.className = 'track-popup-name';
      name.textContent = track.name;
      
      const value = document.createElement('div');
      value.className = 'track-popup-value';
      value.textContent = `${track.value.toFixed(2)} ${track.unit}`;
      
      item.appendChild(colorBox);
      item.appendChild(name);
      item.appendChild(value);
      
      content.appendChild(item);
    });
  }
  
  // Add close button for touch devices
  if (isTouchDevice) {
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'popup-close-button';
    closeButton.addEventListener('click', hideTrackPopup);
    content.appendChild(closeButton);
  }
}

// Hide track popup
function hideTrackPopup() {
  if (trackPopupElement) {
    trackPopupElement.style.display = 'none';
  }
}

// Handle file loading
function handleFileLoad() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.kml,.kmz';
  
  input.onchange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    progressBarElement.style.display = 'block';
    progressBarFillElement.style.width = '0%';
    progressBarFillElement.textContent = '0%';
    
    let loadedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      fileInfoElement.textContent = `Loading ${file.name}...`;
      
      try {
        const content = await readFileContent(file);
        const kmlData = new KMLData(content, file.name);
        kmlDataList.push(kmlData);
        
        loadedCount++;
        const progress = Math.round((loadedCount / files.length) * 100);
        progressBarFillElement.style.width = `${progress}%`;
        progressBarFillElement.textContent = `${progress}%`;
        
        addTrackToggle(kmlData, kmlDataList.length - 1);
      } catch (error) {
        console.error(`Error loading ${file.name}:`, error);
        fileInfoElement.textContent = `Error loading ${file.name}`;
      }
    }
    
    if (loadedCount > 0) {
      fileInfoElement.textContent = `Loaded ${loadedCount} file(s)`;
      updateColorMode();
      showAllTracks();
    }
    
    setTimeout(() => {
      progressBarElement.style.display = 'none';
    }, 2000);
  };
  
  input.click();
}

// Handle interpolation of KML data
function handleInterpolateData() {
  if (!kmlDataList.length) {
    fileInfoElement.textContent = "No KML data loaded to interpolate";
    return;
  }
  
  fileInfoElement.textContent = "Interpolating data...";
  progressBarElement.style.display = 'block';
  progressBarFillElement.style.width = '0%';
  progressBarFillElement.textContent = '0%';
  
  setTimeout(() => {
    try {
      if (typeof stopAnimation === 'function') {
        stopAnimation();
      }
      
      resetFlags();
      
      let interpolatedCount = 0;
      const totalTracks = kmlDataList.length;
      
      for (let i = 0; i < kmlDataList.length; i++) {
        const kd = kmlDataList[i];
        if (!kd.isInterpolated) {
          if (kd.interpolateData()) {
            interpolatedCount++;
          }
        }
        
        const progress = Math.round(((i + 1) / totalTracks) * 100);
        progressBarFillElement.style.width = `${progress}%`;
        progressBarFillElement.textContent = `${progress}%`;
      }
      
      if (interpolatedCount > 0) {
        updateColorMode();
        fileInfoElement.textContent = `Interpolated ${interpolatedCount} track(s)`;
      } else {
        fileInfoElement.textContent = "All tracks already interpolated";
      }
    } catch (error) {
      console.error("Error during interpolation:", error);
      fileInfoElement.textContent = "Error during interpolation";
    }
    
    setTimeout(() => {
      progressBarElement.style.display = 'none';
    }, 2000);
  }, 100);
}

// Read file content
async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

// Add track toggle to UI
function addTrackToggle(kmlData, index) {
  if (!trackTogglesElement) return;
  
  const trackToggle = document.createElement('div');
  trackToggle.className = 'track-toggle';
  trackToggle.dataset.index = index;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'track-visibility-toggle';
  checkbox.checked = kmlData.visible;
  checkbox.addEventListener('change', (e) => {
    kmlData.visible = e.target.checked;
    kmlData.updateVisibility();
  });
  
  const colorBox = document.createElement('div');
  colorBox.className = 'color-box';
  colorBox.style.backgroundColor = kmlData.color.toCssColorString();
  
  const trackName = document.createElement('div');
  trackName.className = 'track-name';
  trackName.textContent = kmlData.name || `Track ${index + 1}`;
  
  const removeButton = document.createElement('span');
  removeButton.className = 'remove-track';
  removeButton.textContent = '×';
  removeButton.title = 'Remove track';
  removeButton.addEventListener('click', () => {
    removeTrack(index);
  });
  
  trackToggle.appendChild(checkbox);
  trackToggle.appendChild(colorBox);
  trackToggle.appendChild(trackName);
  trackToggle.appendChild(removeButton);
  
  trackTogglesElement.appendChild(trackToggle);
}

// Remove track
function removeTrack(index) {
  if (index < 0 || index >= kmlDataList.length) return;
  
  const kd = kmlDataList[index];
  kd.removeFromViewer();
  
  kmlDataList.splice(index, 1);
  
  // Update track toggles
  updateTrackToggles();
  
  // Update color mode
  updateColorMode();
}

// Update track toggles
function updateTrackToggles() {
  if (!trackTogglesElement) return;
  
  trackTogglesElement.innerHTML = '';
  
  for (let i = 0; i < kmlDataList.length; i++) {
    addTrackToggle(kmlDataList[i], i);
  }
}

// Reset view
function resetView() {
  if (!viewer) return;
  
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-95, 40, 10000000),
    duration: 1.5
  });
}

// Top down view
function topDownView() {
  if (!viewer) return;
  
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-95, 40, 10000000),
    orientation: {
      heading: 0,
      pitch: -Cesium.Math.PI_OVER_TWO,
      roll: 0
    },
    duration: 1.5
  });
}

// Show all tracks
function showAllTracks() {
  if (!viewer || !kmlDataList.length) return;
  
  const rectangle = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);
  
  for (const kd of kmlDataList) {
    if (kd.visible && kd.coordinates && kd.coordinates.length > 0) {
      for (const coord of kd.coordinates) {
        const lon = coord[0];
        const lat = coord[1];
        
        if (lon < rectangle.west) rectangle.west = lon;
        if (lon > rectangle.east) rectangle.east = lon;
        if (lat < rectangle.south) rectangle.south = lat;
        if (lat > rectangle.north) rectangle.north = lat;
      }
    }
  }
  
  // Add padding
  const padding = 0.1;
  rectangle.west -= padding;
  rectangle.east += padding;
  rectangle.south -= padding;
  rectangle.north += padding;
  
  viewer.camera.flyTo({
    destination: rectangle,
    duration: 1.5
  });
}

// Update color mode
function updateColorMode() {
  const noColorRadio = document.getElementById('noColorRadio');
  const speedRadio = document.getElementById('speedRadio');
  const accelRadio = document.getElementById('accelRadio');
  const timeDiffRadio = document.getElementById('timeDiffRadio');
  const lostTimeRadio = document.getElementById('lostTimeRadio');
  const continuousColors = document.getElementById('continuousColors');
  
  if (noColorRadio.checked) {
    settings.colorMode = 'noColor';
  } else if (speedRadio.checked) {
    settings.colorMode = 'speed';
  } else if (accelRadio.checked) {
    settings.colorMode = 'acceleration';
  } else if (timeDiffRadio.checked) {
    settings.colorMode = 'timeDifference';
  } else if (lostTimeRadio.checked) {
    settings.colorMode = 'lostTime';
  }
  
  settings.continuousColors = continuousColors.checked;
  
  // Update legend
  updateLegend();
  
  // Update track colors
  for (const kd of kmlDataList) {
    kd.updateColors(settings.colorMode, settings.continuousColors, settings.legendMin, settings.legendMax);
  }
}

// Toggle units
function toggleUnits() {
  settings.speedUnits = unitToggleElement.checked ? 'kph' : 'mph';
  unitLabelElement.textContent = settings.speedUnits === 'mph' ? 'MPH' : 'KPH';
  
  // Update legend if in speed mode
  if (settings.colorMode === 'speed') {
    updateLegend();
    
    // Update track colors
    for (const kd of kmlDataList) {
      kd.updateColors(settings.colorMode, settings.continuousColors, settings.legendMin, settings.legendMax);
    }
  }
}

// Update legend
function updateLegend() {
  if (!legendGradientElement || !legendLabelsElement) return;
  
  legendGradientElement.innerHTML = '';
  legendLabelsElement.innerHTML = '';
  
  const colorScale = colorScales[settings.colorMode];
  if (!colorScale) return;
  
  // Create gradient
  let gradientStyle = 'linear-gradient(to bottom, ';
  for (let i = 0; i < colorScale.length; i++) {
    const color = colorScale[i].color;
    const position = colorScale[i].position * 100;
    gradientStyle += `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1) ${position}%`;
    if (i < colorScale.length - 1) {
      gradientStyle += ', ';
    }
  }
  gradientStyle += ')';
  
  legendGradientElement.style.background = gradientStyle;
  
  // Create labels
  const numLabels = 5;
  for (let i = 0; i < numLabels; i++) {
    const position = i / (numLabels - 1);
    const value = settings.legendMin + position * (settings.legendMax - settings.legendMin);
    
    const label = document.createElement('div');
    label.className = 'legend-label';
    
    let displayValue = value;
    let unit = '';
    
    if (settings.colorMode === 'speed') {
      unit = settings.speedUnits === 'mph' ? ' mph' : ' kph';
    } else if (settings.colorMode === 'acceleration') {
      unit = ' m/s²';
    } else if (settings.colorMode === 'timeDifference' || settings.colorMode === 'lostTime') {
      unit = ' s';
    }
    
    label.textContent = displayValue.toFixed(1) + unit;
    label.style.bottom = `${position * 100}%`;
    
    label.addEventListener('click', () => {
      if (i === 0) {
        const newMin = prompt('Enter new minimum value:', settings.legendMin);
        if (newMin !== null && !isNaN(newMin)) {
          settings.legendMin = parseFloat(newMin);
          updateLegend();
          updateColorMode();
        }
      } else if (i === numLabels - 1) {
        const newMax = prompt('Enter new maximum value:', settings.legendMax);
        if (newMax !== null && !isNaN(newMax)) {
          settings.legendMax = parseFloat(newMax);
          updateLegend();
          updateColorMode();
        }
      }
    });
    
    legendLabelsElement.appendChild(label);
  }
}

// Color scales for different modes
const colorScales = {
  speed: [
    { position: 0.0, color: [0, 0, 255] },    // Blue
    { position: 0.5, color: [0, 255, 0] },    // Green
    { position: 1.0, color: [255, 0, 0] }     // Red
  ],
  acceleration: [
    { position: 0.0, color: [255, 0, 0] },    // Red (negative acceleration)
    { position: 0.5, color: [255, 255, 255] }, // White (zero acceleration)
    { position: 1.0, color: [0, 255, 0] }     // Green (positive acceleration)
  ],
  timeDifference: [
    { position: 0.0, color: [0, 255, 0] },    // Green (small difference)
    { position: 0.5, color: [255, 255, 0] },  // Yellow
    { position: 1.0, color: [255, 0, 0] }     // Red (large difference)
  ],
  lostTime: [
    { position: 0.0, color: [0, 255, 0] },    // Green (gaining time)
    { position: 0.5, color: [255, 255, 255] }, // White (neutral)
    { position: 1.0, color: [255, 0, 0] }     // Red (losing time)
  ]
};

// Interpolate color
function interpolateColor(colorScale, value) {
  if (value <= 0) {
    return new Cesium.Color(
      colorScale[0].color[0] / 255,
      colorScale[0].color[1] / 255,
      colorScale[0].color[2] / 255,
      1
    );
  }
  
  if (value >= 1) {
    return new Cesium.Color(
      colorScale[colorScale.length - 1].color[0] / 255,
      colorScale[colorScale.length - 1].color[1] / 255,
      colorScale[colorScale.length - 1].color[2] / 255,
      1
    );
  }
  
  for (let i = 0; i < colorScale.length - 1; i++) {
    if (value >= colorScale[i].position && value <= colorScale[i + 1].position) {
      const t = (value - colorScale[i].position) / (colorScale[i + 1].position - colorScale[i].position);
      
      const r = colorScale[i].color[0] + t * (colorScale[i + 1].color[0] - colorScale[i].color[0]);
      const g = colorScale[i].color[1] + t * (colorScale[i + 1].color[1] - colorScale[i].color[1]);
      const b = colorScale[i].color[2] + t * (colorScale[i + 1].color[2] - colorScale[i].color[2]);
      
      return new Cesium.Color(r / 255, g / 255, b / 255, 1);
    }
  }
  
  return new Cesium.Color(1, 1, 1, 1);
}

// Format time
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Animation functions
function startAnimation() {
  if (typeof startAnimationPlayback === 'function') {
    startAnimationPlayback();
  }
}

function stopAnimation() {
  if (typeof stopAnimationPlayback === 'function') {
    stopAnimationPlayback();
  }
}

function resetAnimation() {
  if (typeof resetAnimationToSyncPoint === 'function') {
    resetAnimationToSyncPoint();
  }
}

function updateAnimationSpeed(e) {
  if (typeof setAnimationSpeed === 'function') {
    const speed = parseFloat(e.target.value);
    setAnimationSpeed(speed);
    
    if (speedValueElement) {
      speedValueElement.textContent = speed.toFixed(2) + 'x';
    }
  }
}

function updateTimelinePosition(e) {
  if (typeof setAnimationPosition === 'function') {
    const position = parseFloat(e.target.value) / 100;
    setAnimationPosition(position);
  }
}

// Flag functions
function placeFlag(isStart) {
  if (typeof placeFlagOnMap === 'function') {
    placeFlagOnMap(isStart);
  }
}

function resetFlags() {
  if (typeof resetAllFlags === 'function') {
    resetAllFlags();
  }
}

// Initialize flag drag/drop
function initFlagDragDrop() {
  // This function is implemented in animation_flags.js
  // The actual implementation will be modified there
}
