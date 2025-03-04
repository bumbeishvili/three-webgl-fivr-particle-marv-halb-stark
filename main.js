import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Development mode flag - set to false in production
const isDevelopment = false;

// Global configuration
const waveSpeed = 0.8; // Set to 0 to disable wave animations
let waveOffsetX = 0.1; // Master X offset value
let waveOffsetY = -0.1; // Master Y offset value 
let waveOffsetZ = -0.2; // Master Z offset value
let waveRotationX = 0.73 * (Math.PI / 180); // Controls the X rotation of the wave pattern (radians)
let waveRotationY = 5.73 * (Math.PI / 180); // Controls the Y rotation of the wave pattern (radians)
let waveRotationZ = .0; // Controls the Z rotation of the wave pattern (radians)

// Darkness effect controls - adjust these to control different aspects of the darkening effect
let distanceOpacityFactor = 2.80; // Controls how much particles darken based on distance (0-1)
let heightOpacityFactor = 0.8; // Controls how much particles darken based on height (0-2)
let distantHeightOpacityBoost = 1.2; // Controls extra darkening for particles that are both high and distant (0-2)

// Animation control parameters
let animationStartOffset = 0.2; // Start animation after scrolling 20% into section 1 (0-1)
let animationEndSection = 1.5; // Which section to complete the animation at (1-based index)

// Animation sequence control
let mainAnimationEndProgress = 0.57; // The main movement animation completes at this scroll progress
// Fade-out animation parameter
let fadeOutStartProgress = 0.6; // Start fadeout animation at 90% of the scroll progress

// Wave density controls - these parameters affect how the particles are arranged
let waveWidthFactor = 2; // Width of the wave pattern (X-axis spread)
let waveDepthFactor = 3.0; // Depth of the wave pattern (Z-axis spread)
let waveZOffset = 1.8; // Z-offset for the wave centered positioning
let gridRatio = 2 // Ratio between width and height of the grid (1 = square)

// Mouse position for camera animation
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;

// Initialize scrollY at the top level
let scrollY = window.scrollY;
// Add variables for smooth scrolling
let targetProgress = 0;
let currentProgress = 0;
let scrollEasing = 0.07; // Adjust this value to control smoothness (lower = smoother)

// New variables for section-based scrolling
let sectionElements = []; // Will hold the section elements
let section1StartPosition = 0; // Position where section 1 starts (usually 0)
let section2EndPosition = 0; // Position where section 2 ends

// Background gradient element reference
let backgroundGradient = null;

// This technique allows a JavaScript file to read its own query parameters
function getScriptParams() {
  const currentScript = Array.from(document.getElementsByTagName('script')).map(d => d.src).find(d => d.includes('bumbeishvili'))

  if (!currentScript) return {}

  // Parse the URL
  const url = new URL(currentScript);

  // Return the parameters as an object
  const params = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

// Read script parameters
const scriptParams = getScriptParams();
if (isDevelopment) {
  console.log('Script parameters:', scriptParams);
}

// Parameter override system
function applyParameterOverrides() {
  // Define parameters that can be overridden and their types
  const parameterDefinitions = {
    // Wave parameters
    waveSpeed: 'number',
    waveOffsetX: 'number',
    waveOffsetY: 'number',
    waveOffsetZ: 'number',
    waveRotationX: 'angle', // Special handling for angles in degrees
    waveRotationY: 'angle',
    waveRotationZ: 'angle',

    // Darkness effect parameters
    distanceOpacityFactor: 'number',
    heightOpacityFactor: 'number',
    distantHeightOpacityBoost: 'number',

    // Animation parameters
    animationStartOffset: 'number',
    animationEndSection: 'number',
    mainAnimationEndProgress: 'number',
    fadeOutStartProgress: 'number',
    scrollEasing: 'number',

    // Wave density parameters
    waveWidthFactor: 'number',
    waveDepthFactor: 'number',
    waveZOffset: 'number',
    gridRatio: 'number'
  };

  const overriddenParams = [];

  // Process each parameter from URL
  Object.keys(scriptParams).forEach(paramName => {
    // Check if this is a parameter we've defined
    if (parameterDefinitions[paramName]) {
      const paramType = parameterDefinitions[paramName];
      const paramValue = scriptParams[paramName];

      // Special handling for different types
      if (paramType === 'number') {
        window[paramName] = parseFloat(paramValue);
        overriddenParams.push(`${paramName}: ${window[paramName]}`);
      }
      else if (paramType === 'boolean') {
        window[paramName] = paramValue.toLowerCase() === 'true';
        overriddenParams.push(`${paramName}: ${window[paramName]}`);
      }
      else if (paramType === 'angle') {
        // Convert degrees to radians and store
        window[paramName] = parseFloat(paramValue) * (Math.PI / 180);
        overriddenParams.push(`${paramName}: ${paramValue}° (${window[paramName]} rad)`);
      }
      else if (paramType === 'string') {
        window[paramName] = paramValue;
        overriddenParams.push(`${paramName}: ${window[paramName]}`);
      }
    }
  });

  // Log which parameters were overridden
  if (overriddenParams.length > 0 && isDevelopment) {
    console.log('Parameters overridden via URL:', overriddenParams.join(', '));
  }
}

// Apply parameter overrides
applyParameterOverrides();


// Update the recalculation on window resize
window.addEventListener("resize", () => {
  // Update sceneSize values
  sceneSize.width = window.innerWidth;
  sceneSize.height = window.innerHeight;
  sceneSize.pixelRatio = Math.min(window.devicePixelRatio, 2);

  // Update camera aspect ratio
  camera.aspect = sceneSize.width / sceneSize.height;
  camera.updateProjectionMatrix();

  // Update renderer size
  renderer.setSize(sceneSize.width, sceneSize.height);
  renderer.setPixelRatio(sceneSize.pixelRatio);

  // Update particle uniforms if they exist
  if (particles && particles.material && particles.material.uniforms) {
    // Use the same format as in the initial setup
    particles.material.uniforms.uResolution.value.set(
      sceneSize.width * sceneSize.pixelRatio,
      sceneSize.height * sceneSize.pixelRatio
    );

    // Use the shared function for point size calculation
    particles.material.uniforms.uSize.value = calculatePointSize();

    // Make sure the material knows it's been updated
    particles.material.needsUpdate = true;
  }

  // Recalculate section positions on resize
  if (sectionElements.length >= animationEndSection) {
    section1StartPosition = 0; // Section 1 starts at top of page

    // Calculate section heights
    let endPosition = 0;
    for (let i = 0; i < animationEndSection; i++) {
      endPosition += sectionElements[i].offsetHeight;
    }

    // Update end position
    section2EndPosition = endPosition;
  }
});

// Update scroll event handler to use section-based progress
window.addEventListener("scroll", () => {
  scrollY = window.scrollY;

  // Calculate progress based on section positions
  if (section2EndPosition > 0) {
    // Calculate the animation start position
    const section1Height = sectionElements[0].offsetHeight;
    const animationStartPosition = section1StartPosition + (section1Height * animationStartOffset);

    // Animation length is from start position to end of target section
    const animationLength = section2EndPosition - animationStartPosition;

    // Calculate how far we've scrolled past the start position
    const scrolledPastStart = Math.max(0, scrollY - animationStartPosition);

    // Progress will be 0 at the animation start position and 1 at the end of target section
    const progress = Math.min(1, scrolledPastStart / animationLength);

    // Set the target progress (will be smoothly interpolated in animation loop)
    targetProgress = progress;

    // Enhanced debugging - log more frequently when we're in important animation phases
    if (targetProgress > 0.75 && isDevelopment) {
      // Calculate main animation completion percentage (0-100%)
      const mainAnimProgress = Math.min(100, (targetProgress / mainAnimationEndProgress) * 100);

      // Determine which animation phase we're in
      let phase = "Main animation";
      if (targetProgress >= fadeOutStartProgress) {
        phase = "Fade-out animation";
      } else if (targetProgress >= mainAnimationEndProgress) {
        phase = "Between main and fade-out";
      }
    }
  } else {
    // Fallback to original calculation if sections aren't found
    const progress = (scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    targetProgress = progress / 100;
  }
});

// Add simple mouse move listener for camera animation
document.addEventListener('mousemove', (event) => {
  // Calculate normalized mouse position (-1 to 1)
  targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
  targetMouseY = (event.clientY / window.innerHeight) * 2 - 1;
});

// Add keypress handler for testing gridRatio
document.addEventListener('keydown', (event) => {
  // Press 1 to set gridRatio to 1 (square)
  if (event.key === '1') {
    updateGridRatio(1);
    console.log('Grid ratio set to 1:1 (square)');
  }
  // Press 2 to set gridRatio to 2 (2:1 rectangle)
  else if (event.key === '2') {
    updateGridRatio(2);
    console.log('Grid ratio set to 2:1 (rectangle)');
  }
  // Press 3 to set gridRatio to 0.5 (1:2 rectangle)
  else if (event.key === '3') {
    updateGridRatio(0.5);
    console.log('Grid ratio set to 1:2 (rectangle)');
  }
});

/**
 * Shaders
 * -------
 * The vertex shader handles particle positioning and animation:
 * - Calculates staggered animation timing based on noise
 * - Animates particles from initial positions to target X shape
 * - Handles particle size based on screen resolution and distance
 */
const vertexShader = `
    uniform vec2 uResolution;
    uniform float uSize;
    uniform float uProgress;
    uniform float uFadeOutProgress; // Fade-out progress uniform
    uniform float uWaveOffsetX;
    uniform float uWaveOffsetY;
    uniform float uWaveOffsetZ;
    uniform float uWaveRotationX;
    uniform float uWaveRotationY;
    uniform float uWaveRotationZ;
    uniform float uTime;
    attribute vec3 aPositionTarget;
    attribute float aSize;
    attribute float aTargetSize; // Add attribute for X shape target size
    attribute vec3 aColor;
    attribute vec3 aGridColor;
    varying vec3 vColor;
    varying float vWaveHeight; // New varying to pass wave height to fragment shader
    varying float vDistanceFactor; // New varying to pass distance factor to fragment shader
    varying float vFadeOutProgress; // Simplified - just pass the fade progress directly
    
    // Debug varyings
    varying vec3 vStaticPosition; // Original position before transformations
    varying vec3 vFinalPosition; // Final position after all transformations
    varying vec3 vModelPosition; // Position after model matrix
    varying float vRawDistanceX; // Raw distance value before normalization

    ${document.querySelector("#noise").textContent}

    // Rotation function around the X axis
    mat3 rotateX(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat3(
            1.0, 0.0, 0.0,
            0.0, c, -s,
            0.0, s, c
        );
    }
    
    // Rotation function around the Y axis
    mat3 rotateY(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat3(
            c, 0.0, s,
            0.0, 1.0, 0.0,
            -s, 0.0, c
        );
    }
    
    // Rotation function around the Z axis
    mat3 rotateZ(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat3(
            c, -s, 0.0,
            s, c, 0.0,
            0.0, 0.0, 1.0
        );
    }

    void main() {
        // Generate noise values for staggered animation
        float noiseOrigin = simplexNoise3d(position * 0.2);
        float noiseTarget = simplexNoise3d(aPositionTarget * 0.2);
        float noise = mix(noiseOrigin, noiseTarget, uProgress);
        noise = smoothstep(-1.0, 1.0, noise);
        
        // Calculate animation timing parameters
        float duration = 0.4;
        float delay = (1.0 - duration) * noise * 1.2; // Slightly extended delay range for more staggering
        float end = delay + duration;
        
        // Simply pass the fade-out progress to the fragment shader
        vFadeOutProgress = uFadeOutProgress;
        
        // Static position with offsets and rotation applied
        vec3 staticPosition = position;
        
        // Apply wave animation to grid state (when uProgress is low)
        // The wave effect weakens as we transition to the X shape
        float waveStrength = 1.0 - smoothstep(0.0, 0.6, uProgress);
        
        // Base position for wave calculation (use original position without rotation/offset)
        vec3 waveBasePos = position;
        
        // Create more dynamic horizontal waving with multiple wave components
        // Primary horizontal wave (increased amplitude)
        float waveX1 = sin(waveBasePos.x * 2.0 + uTime * 0.5) * 0.08;
        
        // Secondary horizontal wave with different frequency
        float waveX2 = sin(waveBasePos.z * 1.5 + uTime * 0.7) * 0.06; 
        
        // Combine horizontal waves
        float waveX = waveX1 + waveX2;
        
        // Vertical wave
        float waveY = cos(waveBasePos.z * 3.0 + uTime * 0.7) * 0.04;
        
        // Z-axis wave with horizontal influence
        float waveZ1 = sin(waveBasePos.x * 2.5 + waveBasePos.z * 2.0 + uTime * 0.6) * 0.04;
        float waveZ2 = cos(waveBasePos.x * 1.7 + uTime * 0.4) * 0.05; // Additional Z movement based on X
        float waveZ = waveZ1 + waveZ2; // Remove the excessive multiplier
        
        // Calculate wave displacements
        vec3 waveDisplacement = vec3(waveX, waveY, waveZ);
        
        // Apply the wave displacement to position
        staticPosition = waveBasePos + waveDisplacement * waveStrength;
        
        // Save staticPosition before offsets for debugging
        vStaticPosition = staticPosition;
        
        // Apply offset
        staticPosition.x += uWaveOffsetX;
        staticPosition.y += uWaveOffsetY;
        staticPosition.z += uWaveOffsetZ;
            
        // Apply rotation to the pattern
        mat3 rotMatrix = rotateZ(uWaveRotationZ) * rotateY(uWaveRotationY) * rotateX(uWaveRotationX);
        staticPosition = rotMatrix * staticPosition;
        
        // Calculate normalized wave height AFTER all transformations
        // This ensures the height-based fade matches what's visually seen
        float maxVisualHeight = 0.15; // Adjusted based on final transformed heights
        float visualHeight = staticPosition.y; // Use the y-coordinate after all transformations
        float normalizedVisualHeight = (visualHeight + 0.2) / (maxVisualHeight + 0.2); // Adjusted range
        normalizedVisualHeight = clamp(normalizedVisualHeight, 0.0, 1.0); // Ensure values stay in 0-1 range
        
        // Calculate the target position for X shape
        vec3 targetPosition = aPositionTarget;
        
        // Calculate assembly progress with staggered timing
        float assemblyProgress = smoothstep(delay, end, uProgress);
        
        // Simply transition directly from static position to target
        vec3 finalPosition = mix(staticPosition, targetPosition, assemblyProgress);
        
        // Add subtle wave effect to all particles after 50% progress
        if (uProgress > 0.5) {  // Removed front-facing check to apply to all particles
            // Calculate wave strength that increases after 50%
            float lateWaveStrength = smoothstep(0.5, 0.8, uProgress) * 0.03;
            
            // Add simple sine wave motion only in z-direction (front/back)
            // Use x and y positions to create varied wave pattern
            finalPosition.z += sin(uTime * 0.6 + targetPosition.x * 4.0 + targetPosition.y * 4.0) * lateWaveStrength;
        }
        
        // Save finalPosition after all transformations but before model matrix
        vFinalPosition = finalPosition;
        
        // Standard projection matrix transformations
        vec4 modelPosition = modelMatrix * vec4(finalPosition, 1.0);
        
        // Save model position for debugging
        vModelPosition = modelPosition.xyz;
        
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectedPosition = projectionMatrix * viewPosition;
        gl_Position = projectedPosition;

        // Now calculate distance factor based on the final transformed position
        // This uses true 3D distance to the camera for more accurate depth effects
        vec3 cameraPosition = vec3(0.8, 0.2, 3.5);

        // Calculate true distance in 3D space from camera
        // This properly accounts for all rotations and transformations
        float dx = cameraPosition.x - modelPosition.x;
        float dy = cameraPosition.y - modelPosition.y;
        float dz = cameraPosition.z - modelPosition.z;
        float distanceToCamera = sqrt(dx*dx + dy*dy + dz*dz);

        // Save raw distance for debugging
        vRawDistanceX = distanceToCamera;

        // Normalize the distance factor (0-1 range, where 1 is furthest)
        // Adjust the divisor based on the scene scale
        float normalizedDistanceFactor = clamp(distanceToCamera / 5.0, 0.0, 1.0);

        // Apply a power curve to make the effect more dramatic at greater distances
        float distanceFactor = pow(normalizedDistanceFactor, 1.2);
        
        // Pass both height and distance factors to fragment shader
        vWaveHeight = normalizedVisualHeight * waveStrength;
        vDistanceFactor = distanceFactor * waveStrength;

        // Blend between grid size and target X shape size
        float finalSize = mix(aSize, aTargetSize, assemblyProgress);
        gl_PointSize = finalSize * uSize * uResolution.y;
        gl_PointSize *= (1.0 / - viewPosition.z);

        // Use a sharper transition curve for color blending
        // This ensures we see a clear difference between grid and X colors
        // Transition between 40-70% of the animation progress
        float colorBlend = smoothstep(0.4, 0.7, uProgress);
        
        // Blend between grid colors and target colors
        vColor = mix(aGridColor, aColor, colorBlend);
    }
`;

/**
 * Fragment shader creates circular particles with the vertex color
 * Using step function for a hard edge circular shape
 * With dynamic blending transition from additive (wave) to normal (X shape)
 */
const fragmentShader = `
    varying vec3 vColor;
    varying float vWaveHeight; // Receive wave height from vertex shader
    varying float vDistanceFactor; // Receive distance factor from vertex shader
    varying float vFadeOutProgress; // Receive fade-out progress from vertex shader
    // Debug varyings
    varying vec3 vStaticPosition; // Original position before transformations
    varying vec3 vFinalPosition; // Final position after all transformations
    varying vec3 vModelPosition; // Position after model matrix
    varying float vRawDistanceX; // Raw distance value before normalization
    uniform float uProgress; // Animation progress uniform
    uniform float uBlendTransition; // Dedicated uniform for blend transition
    uniform float uDistanceOpacityFactor; // Factor for distance-based darkening
    uniform float uHeightOpacityFactor; // Factor for height-based darkening
    uniform float uDistantHeightOpacityBoost; // Factor for boosting darkness of distant high particles
    
    void main() {
        // Calculate distance from center of point sprite
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        
        // Create simple circular shape with softer edge
        float circle = smoothstep(0.5, 0.45, dist);
        
        // Apply smoothstep for more natural transition
        float blendFactor = smoothstep(0.0, 1.0, uBlendTransition);
        
        // Calculate final color components
        // For additive blending effect: boost the color brightness in wave state
        // For normal blending in X shape: use normal colors with appropriate alpha
        vec3 finalColor = vColor * mix(1.5, 1.0, blendFactor);
        
        // Dynamic height threshold that gets lower as distance increases
        // Base threshold is 0.7, but can go as low as 0.4 for the most distant particles
        float heightThreshold = mix(0.7, 0.3, vDistanceFactor);
        
        // Calculate fade factor (0 = no fade, 1 = full fade to black)
        // Only apply when vWaveHeight > heightThreshold
        float fadeFactor = 0.0;
        if (vWaveHeight > heightThreshold) {
            // Remap from threshold-1.0 range to 0.0-1.0 range
            fadeFactor = (vWaveHeight - heightThreshold) / (1.0 - heightThreshold);
            
            // Make the fade more aggressive for distant particles
            // Higher distance factor = steeper power curve
            float fadePower = mix(1.0, 3.5, vDistanceFactor);
            fadeFactor = pow(fadeFactor, 1.0 / fadePower); // Inverted power for more aggressive fade
            
            // Apply a smooth curve for more natural transition
            fadeFactor = smoothstep(0.0, 1.0, fadeFactor);
        }
        
        // Add a base distance darkness effect regardless of height
        float baseDistanceDarkness = vDistanceFactor * vDistanceFactor * uDistanceOpacityFactor;
        
        // Boost the fade factor based on distance for more dramatic effect at distance
        fadeFactor = mix(fadeFactor, 1.0, vDistanceFactor * vWaveHeight * uDistantHeightOpacityBoost);
        
        // Combine the base distance darkness with the height-based fade
        fadeFactor = max(fadeFactor, baseDistanceDarkness);
        
        // Apply height darkness factor to adjust the strength of height-based fading
        fadeFactor = min(1.0, fadeFactor * uHeightOpacityFactor);
        
        // Fade color to black based on combined height and distance factors
        finalColor = mix(finalColor, vec3(0.0, 0.0, 0.0), fadeFactor);
        
        // Calculate color brightness (higher for white, lower for dark colors)
        float brightness = (finalColor.r + finalColor.g + finalColor.b) / 3.0;
        
        // Control opacity based on blending mode and color brightness
        // Brighter colors (like white) get higher opacity
        // Lower opacity for additive blending (starting state)
        // Higher opacity for normal blending (end state)
        float baseOpacity = mix(0.6, 1.0, blendFactor);
        float brightnessBoost = brightness * 0.3; // Additional opacity boost for bright colors
        float alpha = (baseOpacity + brightnessBoost) * circle;
        
        // Ensure alpha doesn't exceed 1.0
        alpha = min(alpha, 1.0);
        
        // Fade out particles that are near the height threshold with distance-aware fading
        if (vWaveHeight > heightThreshold) {
            // Apply additional opacity reduction based on combined height and distance
            // Make distant high particles fade out more dramatically
            float opacityReduction = fadeFactor * (0.8 + vDistanceFactor * 0.4);
            alpha *= (1.0 - opacityReduction);
        } else {
            // Add some opacity reduction even for particles below height threshold if they're distant
            float distanceOpacityReduction = baseDistanceDarkness * 0.6;
            alpha *= (1.0 - distanceOpacityReduction);
        }
        
        // Apply the fade-out effect - simplified to use 1.0 - fadeOutProgress for a clean fade-out
        // This ensures all particles fade out uniformly, with brighter colors visible longer
        float fadeOutFactor = 1.0 - vFadeOutProgress; // Invert so 0 = no fade, 1 = full fade
        alpha *= max(0.0, 1.0 - (fadeOutFactor * (1.0 + brightness))); // Brighter colors fade last
        
        // Output final color with dynamic components
        gl_FragColor = vec4(finalColor, alpha);
    }
`;

// Scene setup
const canvas = document.querySelector(".webgl");
const scene = new THREE.Scene();
const sceneSize = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
};

// No scene helpers - removed for cleaner visualization

// Add fog to fade distant particles
const fogExp2 = new THREE.FogExp2(0x000000, 100);
scene.fog = fogExp2;

// Camera setup
const camera = new THREE.PerspectiveCamera(
  30,
  sceneSize.width / sceneSize.height,
  0.1,
  100
);
// Adjust camera position to match the reference images more precisely
camera.position.set(0.8, 0.2, 3.5);
// Set camera to look at the origin (0,0,0) - same target point that OrbitControls was using
camera.lookAt(0, 0, 0);

// Toggle camera helper visibility with 'H' key
// Removing keyboard event listener for debug controls

// Renderer configuration
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true // Enable transparency
});
renderer.setSize(sceneSize.width, sceneSize.height);
renderer.setPixelRatio(sceneSize.pixelRatio);
renderer.setClearColor(0x000000, 0); // Set alpha to 0 for full transparency

// Particles system variables
let particles = null;
const particlesCount = 2754;
const positions = new Float32Array(particlesCount * 3);
const particleSizes = new Float32Array(particlesCount);
const gridColors = new Float32Array(particlesCount * 3); // Add array for grid colors

/**
 * Initial particle positions arranged in a U-shaped grid pattern
 * Creates a wave-like pattern as starting position before animation
 * With elevated sides and lower middle to match the reference image
 * Rotated around Y-axis to match the visual orientation in the image
 */
// Calculate grid dimensions using gridRatio
const gridHeight = Math.ceil(Math.sqrt(particlesCount / gridRatio));
const gridWidth = Math.ceil(gridHeight * gridRatio);

console.log(`Initial grid dimensions: ${gridWidth}x${gridHeight}, ratio: ${gridRatio}`);

for (let i = 0; i < particlesCount; i++) {
  const i3 = i * 3;

  // Calculate grid positions with separate width and height
  const row = Math.floor(i / gridWidth);
  const col = i % gridWidth;

  // Convert grid coordinates to world space using density control parameters
  const x = (col / gridWidth - 0.5) * waveWidthFactor;
  const z = (row / gridHeight - 0.5) * waveDepthFactor;

  // CALCULATE GRID COLORS BASED ON ORIGINAL (PRE-ROTATION) Z POSITION
  // We need to do this before applying rotation to match initParticles
  // Use the original Z value from grid calculation
  const originalZ = z;

  // Normalize z position for color gradient - use the original Z
  const minZ = -3.0; // Adjusted for original z values before rotation
  const maxZ = 3.0;  // Adjusted for original z values before rotation
  const normalizedZ = Math.min(1, Math.max(0, (originalZ - minZ) / (maxZ - minZ)));

  // Apply a stronger power curve to create more dramatic contrast
  const enhancedZ = Math.pow(normalizedZ, 2.5);

  // Calculate color based on original z position
  // For the outer 50% (normalizedZ < 0.5), blend towards black instead of just dark blue
  let gridColor;

  if (normalizedZ < 0.5) {
    // Outer 50% - blend between black and dark blue based on how far out we are
    // Remap 0-0.5 range to 0-1 for blending
    const fadeToBlack = 1.0 - (normalizedZ / 0.5);

    // Create a smooth transition between dark blue and black
    gridColor = new THREE.Color().lerpColors(
      new THREE.Color("#0452D5"),  // Dark blue
      new THREE.Color("#000000"),  // Pure black
      Math.pow(fadeToBlack, 1.5)   // Power curve for smoother transition
    );
  } else {
    // Inner 50% - normal gradient from dark blue to light blue
    gridColor = new THREE.Color().lerpColors(
      new THREE.Color("#0452D5"),  // Dark blue
      new THREE.Color("#d5edfb"),  // Light blue to match X shape
      enhancedZ                    // Enhanced normalized distance value
    );
  }

  // Update grid color components
  gridColors[i3] = gridColor.r;
  gridColors[i3 + 1] = gridColor.g;
  gridColors[i3 + 2] = gridColor.b;

  // Create a U-shaped wave effect (static, no animation)
  const parabolicFactor = 0.3;
  const baseSineWave = Math.sin(x * Math.PI - Math.PI / 2) * 0.1;
  const uShapeComponent = parabolicFactor * (x * x * 2.0);

  // Combine the components for static shape
  const y = baseSineWave + uShapeComponent + z * 0.15;

  // Apply rotation around Y-axis
  const rotationAngle = -16 * (Math.PI / 180);
  const cosY = Math.cos(rotationAngle);
  const sinY = Math.sin(rotationAngle);

  // Apply Y-axis rotation to x and z coordinates
  const rotatedX = x * cosY - (z + waveZOffset) * sinY;
  const rotatedZ = x * sinY + (z + waveZOffset) * cosY;

  // Store position with rotation applied
  positions[i3] = rotatedX;
  positions[i3 + 1] = y - 0.2;
  positions[i3 + 2] = rotatedZ;

  // Set particle size based on color gradient (enhancedZ) - similar to X shape sizing
  // Particles with lighter colors (higher Z) will be larger, darker ones smaller
  particleSizes[i] = 0.6 //+ enhancedZ * 0.6 + (Math.random() * 0.1);
}

/**
 * Load the X model from GLTF file
 * The vertices from this model will be used as target positions for particles
 */
const loader = new GLTFLoader();
let xShape;
loader.load("https://bumbeishvili.github.io/three-webgl-fivr-particle-marv-halb-stark/x.glb", (gltf) => {
  xShape = gltf.scene.children[0].geometry.attributes.position;
  initParticles();
});

/**
 * Calculate the point size based on screen dimensions
 * This ensures consistent point sizes across different devices and screen sizes
 */
function calculatePointSize() {
  // Base size for a reference width of 1920px
  const baseSize = 0.026;
  const referenceWidth = 1920;

  // Scale factor that increases size on smaller screens and decreases on larger screens
  // The power value of 0.4 makes the scaling more gradual
  const scaleFactor = Math.pow(referenceWidth / window.innerWidth, 0.4);

  return baseSize * scaleFactor;
}

/**
 * Initialize the particle system
 * - Creates geometry with position, size, and color attributes
 * - Sets up target positions from the X model
 * - Configures the shader material
 */
function initParticles() {
  const geometry = new THREE.BufferGeometry();

  // Get the number of vertices from the X model
  const targetVertexCount = xShape.array.length / 3;

  // Adjust particlesCount to match the target vertex count
  const adjustedCount = Math.min(particlesCount, targetVertexCount);

  // Create new arrays with the adjusted size
  const adjustedPositions = new Float32Array(adjustedCount * 3);
  const adjustedSizes = new Float32Array(adjustedCount);
  const adjustedTargetSizes = new Float32Array(adjustedCount); // New array for X shape sizes
  const colors = new Float32Array(adjustedCount * 3);
  const adjustedTargetPositions = new Float32Array(adjustedCount * 3);

  // Define color palette once for both grid and X shape
  const darkBlue = new THREE.Color("#0b5baa");
  const lightBlue = new THREE.Color("#98d8ff");

  // Copy data to the adjusted arrays
  for (let i = 0; i < adjustedCount; i++) {
    const i3 = i * 3;

    // Copy positions from initial grid setup
    adjustedPositions[i3] = positions[i3];
    adjustedPositions[i3 + 1] = positions[i3 + 1];
    adjustedPositions[i3 + 2] = positions[i3 + 2];

    // Copy grid sizes from initial setup
    adjustedSizes[i] = particleSizes[i];

    // Get target positions from the X model
    let targetX = xShape.array[i3];
    let targetY = xShape.array[i3 + 1]; // Scale Y coordinate by 1.1 for a taller X shape
    let targetZ = xShape.array[i3 + 2];

    // DETERMINE FRONT/BACK/SIDE BASED ON PRE-ROTATION POSITIONS
    // Using more precise thresholds to identify front, side and back regions
    const isFront = targetZ > 0.1; // Clear front-facing particles
    const isBack = targetZ < -0.1; // Clear back-facing particles


    // Apply a slight rotation to the X model to match the reference images
    // Rotate around Y axis by about 15 degrees
    const angleY = Math.PI * 0.15; // Increased Y rotation
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);

    // Rotate around X axis by about 10 degrees
    const angleX = Math.PI * 0.03; // Decreased X rotation
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);

    // Apply Y-axis rotation
    const rotatedX = targetX * cosY - targetZ * sinY;
    const rotatedZ = targetX * sinY + targetZ * cosY;

    // Apply X-axis rotation to the result
    const finalY = targetY * cosX + rotatedZ * sinX;
    const finalZ = -targetY * sinX + rotatedZ * cosX;

    // Store rotated target positions
    adjustedTargetPositions[i3] = rotatedX;
    adjustedTargetPositions[i3 + 1] = finalY;
    adjustedTargetPositions[i3 + 2] = finalZ;

    // POSITION ANALYSIS - Determine regions of the X shape
    // Calculate distance from center in XY plane (for corner detection)
    const distFromCenterXY = Math.sqrt(rotatedX * rotatedX + finalY * finalY);

    // Normalize the distance for gradient calculation (0 = center, 1 = far edge)
    // Using a smaller divisor to create a more compressed gradient (faster transition)
    const normalizedDist = Math.min(distFromCenterXY / 0.7, 1.0);

    // SIZE CALCULATION BASED ON POSITION
    // More dramatic size difference between center and edges
    const particleSize = isFront ?
      (0.4 + (normalizedDist * 0.5) * 1.6 + (Math.random() * 0.1)) : // Front: Gradient from 0.8 to 1.3
      (0.4 + (Math.random() * 0.1)); // Back: Smaller than before

    // Store X shape sizes separately from grid sizes
    adjustedTargetSizes[i] = particleSize;

    // COLOR CALCULATION - GRADIENT FOR FRONT FACE
    // Apply color based on position
    let color;

    if (isBack) {
      // Back side: Always dark blue
      color = darkBlue.clone();
    } else if (isFront) {
      // Front side: Gradient from dark center to light corners
      // Apply a contrast-enhancing function for more dramatic transition

      // Create an S-curve with steeper middle section
      // This creates a darker center with a more sudden transition to light colors
      let enhancedGradient;

      if (normalizedDist < 0.3) {
        // Dark center area (inner 30%)
        enhancedGradient = normalizedDist * 0.3; // Even darker center
      } else if (normalizedDist < 0.5) {
        // Transition area (30-50% from center)
        // Rapid transition from dark to light in this range
        const transitionPos = (normalizedDist - 0.3) / 0.2; // 0-1 in this range
        enhancedGradient = 0.09 + transitionPos * 0.71; // 0.09-0.8 steeper curve
      } else {
        // Outer area (beyond 50% from center)
        // Mostly light blue with subtle gradient to pure light at edges
        enhancedGradient = 0.8 + (normalizedDist - 0.5) * 0.4; // 0.8-1.0 gentle slope
      }

      color = new THREE.Color().lerpColors(
        darkBlue,  // Center color
        lightBlue, // Edge color
        enhancedGradient  // S-curve transition for more dramatic contrast
      );
    } else {
      // Side surfaces: Gradient based on Z position
      // Normalize Z position for color gradient (0 = back, 1 = front)
      const zPos = targetZ; // Original Z value from GLB model

      // Create normalized value from -0.1 to 0.1 range to 0 to 1 range
      const normalizedZPos = (zPos + 0.1) / 0.2;

      // Calculate side gradient - transitions from light to dark from front to back
      // Also include the XY distance to match with the front face gradient
      let sideGradient;

      if (normalizedDist > 0.5) {
        // For edges of the X, use gradient based on both Z and XY distance
        // This ensures side color near light front regions is also light
        const xyFactor = (normalizedDist - 0.5) * 2; // 0-1 for outer half

        // Dramatically increase the effect - make front-facing sides much lighter
        // and back-facing sides much darker
        sideGradient = Math.pow(normalizedZPos, 0.5) * (0.6 + xyFactor * 0.4); // 0.6-1.0 range for edges
      } else {
        // For parts closer to center, still increase the effect but keep darker overall
        // Use power function to create stronger contrast
        sideGradient = Math.pow(normalizedZPos, 0.7) * 0.5; // 0-0.5 range (still darker for center)
      }

      // Boost the overall side gradient to ensure front sides are clearly light
      sideGradient = Math.max(sideGradient, normalizedZPos * 0.8);

      color = new THREE.Color().lerpColors(
        darkBlue,  // Dark for back-facing sides
        lightBlue, // Light for front-facing sides
        sideGradient // Z-based gradient for smooth transition
      );
    }

    // Store color components
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  // Set geometry attributes
  geometry.setAttribute("position", new THREE.BufferAttribute(adjustedPositions, 3));
  geometry.setAttribute("aPositionTarget", new THREE.BufferAttribute(adjustedTargetPositions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(adjustedSizes, 1));
  geometry.setAttribute("aTargetSize", new THREE.BufferAttribute(adjustedTargetSizes, 1)); // Add X shape sizes
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

  // Create a properly sized copy of the global gridColors for this geometry
  const adjustedGridColors = new Float32Array(adjustedCount * 3);
  for (let i = 0; i < adjustedCount * 3; i++) {
    adjustedGridColors[i] = gridColors[i];
  }
  geometry.setAttribute("aGridColor", new THREE.BufferAttribute(adjustedGridColors, 3));

  // Create shader material with uniforms
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uSize: { value: calculatePointSize() }, // Base size multiplier with responsive sizing
      uProgress: { value: 0.0 },
      uBlendTransition: { value: 0.0 }, // Blend transition uniform
      uTime: { value: 0.0 }, // Time uniform for wave animation
      uResolution: {
        value: new THREE.Vector2(
          sceneSize.width * sceneSize.pixelRatio,
          sceneSize.height * sceneSize.pixelRatio
        ),
      },
      // Remove wave animation uniforms
      uWaveOffsetX: { value: waveOffsetX },
      uWaveOffsetY: { value: waveOffsetY },
      uWaveOffsetZ: { value: waveOffsetZ },
      uWaveRotationX: { value: waveRotationX },
      uWaveRotationY: { value: waveRotationY },
      uWaveRotationZ: { value: waveRotationZ },
      uDistanceOpacityFactor: { value: distanceOpacityFactor },
      uHeightOpacityFactor: { value: heightOpacityFactor },
      uDistantHeightOpacityBoost: { value: distantHeightOpacityBoost },
      uFadeOutProgress: { value: 0.0 } // Initialize fade-out progress
    },
    transparent: true,
    depthWrite: false, // Disable depth writing for additive blending
    depthTest: true,
    // Start with additive blending for the wave animation
    blending: THREE.AdditiveBlending
  });

  // Create and add points mesh to scene
  particles = new THREE.Points(geometry, material);
  particles.geometry.setIndex(null);

  // Add a slight scale adjustment to make the X shape more distinctive
  particles.scale.set(1.1, 1.1, 1.1);

  // Set renderOrder to ensure proper transparency handling
  particles.renderOrder = 0;

  scene.add(particles);

  // Update with current gridRatio to ensure consistent appearance
  updateGridRatio(gridRatio);
}

/**
 * Animation loop that updates every frame
 */
function animate() {
  // Request the next frame
  requestAnimationFrame(animate);

  // Smooth scroll progress interpolation
  currentProgress += (targetProgress - currentProgress) * scrollEasing;

  // Update particle animation progress with smoothed value
  if (particles) {
    // Calculate the main animation progress (0-1 from start to mainAnimationEndProgress)
    // This ensures the main animation runs at a consistent pace regardless of fadeOutStartProgress
    const mainProgress = Math.min(1.0, currentProgress / mainAnimationEndProgress);
    particles.material.uniforms.uProgress.value = mainProgress;

    // Calculate fade-out progress
    // Only start fading out after the main animation has completed (after mainAnimationEndProgress)
    let fadeOutProgress = 1.0; // Default: fully visible

    if (currentProgress > fadeOutStartProgress) {
      // Map fadeOutStartProgress-100% to 1-0 range for fade-out (1 = visible, 0 = invisible)
      fadeOutProgress = 1.0 - ((currentProgress - fadeOutStartProgress) / (1.0 - fadeOutStartProgress));

      // Add a smooth curve to make the fade-out more natural
      fadeOutProgress = fadeOutProgress * fadeOutProgress; // Simple quadratic easing

      // Add debug logging to verify fade-out is happening
      if (Math.random() < 0.005) { // Reduced logging frequency
        console.log(`Fade-out active: ${(1.0 - fadeOutProgress).toFixed(3)}, visibility: ${fadeOutProgress.toFixed(3)}`);
      }
    }

    // Update the uniform value
    particles.material.uniforms.uFadeOutProgress.value = fadeOutProgress;

    // Calculate blend transition from additive to normal blending using main progress
    const blendProgress = Math.max(0, Math.min(1, (mainProgress - 0.4) / 0.3));

    // Apply smoothstep easing to the blend transition for better smoothing
    const smoothBlendProgress = blendProgress * blendProgress * (3 - 2 * blendProgress);
    particles.material.uniforms.uBlendTransition.value = smoothBlendProgress;

    // Create a wider transition window for blending mode switches (50%-60% instead of exactly 50%)
    // This staggers the changes to avoid all changes happening at once
    if (blendProgress > 0.6 && particles.material.blending === THREE.AdditiveBlending) {
      // Switch to normal blending at 60% of the transition (58% of scroll)
      particles.material.blending = THREE.NormalBlending;
      particles.material.needsUpdate = true; // Important: update material after changing blending
    } else if (blendProgress <= 0.4 && particles.material.blending === THREE.NormalBlending) {
      // Switch back to additive blending at 40% of the transition (52% of scroll)
      particles.material.blending = THREE.AdditiveBlending;
      particles.material.needsUpdate = true; // Important: update material after changing blending
    }

    // Handle depth writing separately with a slightly different threshold
    // This staggers the changes to avoid everything happening at once
    if (blendProgress > 0.55 && particles.material.depthWrite === false) {
      particles.material.depthWrite = true; // Enable depth writing
      particles.material.needsUpdate = true;
    } else if (blendProgress <= 0.45 && particles.material.depthWrite === true) {
      particles.material.depthWrite = false; // Disable depth writing
      particles.material.needsUpdate = true;
    }

    // Create a smoother easing with a blend between the two phases
    let easedProgress;

    // Apply a gradual rotation that builds up throughout the scroll
    if (mainProgress >= 0.6) { // Start rotation at 60% of main progress (after wave transition completes)
      // Normalize progress to 0-1 range for the Y rotation animation (60%-100%)
      const normalizedProgress = (mainProgress - 0.6) / 0.4;

      let yEasedProgress;

      // Store phase1Progress for reuse
      const phase1Progress = mainProgress < 0.8 ? (mainProgress - 0.6) / 0.2 : 1.0; // 0-1 within phase 1

      if (mainProgress < 0.8) {
        // Use a gentler cubic ease-out for slower buildup
        // This curve will reach 0.5 (10 degrees) at the end of phase 1
        yEasedProgress = 0.5 * (3 * Math.pow(phase1Progress, 2) - 2 * Math.pow(phase1Progress, 3));
      } else {
        // Phase 2: Normalize to 0-1 range for 80-100% scroll
        const phase2Progress = (mainProgress - 0.8) / 0.2; // 0-1 within phase 2

        // Start from 0.5 (10 degrees) and build to 1.0 (20 degrees)
        // Use a smooth quadratic curve for acceleration
        yEasedProgress = 0.5 + 0.5 * Math.pow(phase2Progress, 2);
      }

      // Ensure we don't exceed 1.0 due to floating-point errors
      easedProgress = Math.min(1.0, Math.max(0, yEasedProgress));

      // Calculate X rotation that starts at 80% scroll and reaches 5 degrees at 100%
      let xRotationProgress = 0;
      if (mainProgress >= 0.8) {
        // Normalize to 0-1 range for 80-100% scroll
        const xNormalizedProgress = (mainProgress - 0.8) / 0.2;

        // Use a cubic ease-in for smooth start of X rotation
        xRotationProgress = Math.pow(xNormalizedProgress, 3);

        // Ensure smooth transition by blending with main curve
        xRotationProgress = Math.min(1.0, Math.max(0, xRotationProgress));
      }

      // Calculate max rotation values
      const maxRotationX = -5 * (Math.PI / 180); // 5 degrees in radians
      const maxRotationY = 20 * (Math.PI / 180); // 20 degrees in radians
      const maxRotationZ = 0; // Keep Z rotation at 0

      // Apply gradual rotation
      particles.rotation.x = maxRotationX * xRotationProgress; // X rotation starts at 80%
      particles.rotation.y = maxRotationY * easedProgress; // Y rotation with main easing curve
      particles.rotation.z = 0; // Z rotation fixed at 0
    } else {
      // Reset rotation when below start threshold
      particles.rotation.x = 0;
      particles.rotation.y = 0;
      particles.rotation.z = 0;
    }
  }

  // Update time-based animations
  const elapsedTime = performance.now() / 1000; // Convert to seconds

  // Update shader uniforms
  if (particles && particles.material.uniforms.uTime) {
    particles.material.uniforms.uTime.value = elapsedTime * waveSpeed;

  }

  // Smooth mouse movement
  mouseX += (targetMouseX - mouseX) * 0.05;
  mouseY += (targetMouseY - mouseY) * 0.05;

  // Apply subtle camera movement based on mouse position
  if (camera) {
    // Starting position
    const baseX = 0.8;
    const baseY = 0.2;
    const baseZ = 3.5;

    // Create subtle movement (adjust these values to change sensitivity)
    const offsetX = mouseX * 0.15;
    const offsetY = -mouseY * 0.10;

    // Apply to camera position
    camera.position.x = baseX + offsetX;
    camera.position.y = baseY + offsetY;

    // Keep looking at the center
    camera.lookAt(0, 0, 0);


  }

  // Handle fadeout animation if we've reached that threshold
  if (targetProgress >= fadeOutStartProgress) {
    const fadeOutProgress = Math.max(0, Math.min(1, (1.0 - ((targetProgress - fadeOutStartProgress) / (1.0 - fadeOutStartProgress)))));

    // Get background gradient element if not already cached
    if (!backgroundGradient) backgroundGradient = document.querySelector('.background-gradient-gl');

    // Synchronize background opacity with particle fadeout
    if (backgroundGradient) backgroundGradient.style.opacity = fadeOutProgress;

    // ... existing fade animation code ...
  } else {
    // Ensure background is fully visible before fade starts
    if (!backgroundGradient) backgroundGradient = document.querySelector('.background-gradient-gl');
    if (backgroundGradient) backgroundGradient.style.opacity = 1;
  }

  // Render the scene
  renderer.render(scene, camera);
}

// Start animation loop
animate();


/**
 * Wave parameter update functions
 * These functions update both global variables and uniforms in real-time
 */

function updateWaveOffsets(x, y, z) {
  // Update global variables
  waveOffsetX = x;
  waveOffsetY = y;
  waveOffsetZ = z;

  // Update uniform values if the material exists
  if (particles && particles.material && particles.material.uniforms) {
    particles.material.uniforms.waveOffset.value.set(x, y, z);
  }
}

function updateWaveRotations(x, y, z) {
  // Update global variables
  waveRotationX = x;
  waveRotationY = y;
  waveRotationZ = z;

  // Update uniform values if the material exists
  if (particles && particles.material && particles.material.uniforms && particles.material.uniforms.waveRotation) {
    particles.material.uniforms.waveRotation.value.set(x, y, z);
  }
}

/**
 * Updates the wave density parameters
 */
function updateWaveDensity(width, depth, zOffset) {
  waveWidthFactor = Math.max(0.5, width); // Ensure minimum width
  waveDepthFactor = Math.max(1.0, depth); // Ensure minimum depth
  waveZOffset = zOffset;

  // Recalculate wave positions with new parameters
  regenerateParticles(gridRatio);
}

function updateGridRatio(ratio) {
  gridRatio = Math.max(0.1, ratio); // Ensure minimum ratio
  regenerateParticles(gridRatio);
}

/**
 * Regenerates particles with current wave density parameters
 * This recalculates positions while preserving particle attributes and animation state
 */
function regenerateParticles(ratioParam = null) {
  if (!particles) return; // Skip if particles don't exist yet

  // Use provided ratio or fall back to global gridRatio
  const useRatio = ratioParam !== null ? ratioParam : gridRatio;

  // Store current progress and material properties
  const currentProgress = particles.material.uniforms.uProgress.value;
  const currentBlendTransition = particles.material.uniforms.uBlendTransition.value;
  const currentBlending = particles.material.blending;
  const currentDepthWrite = particles.material.depthWrite;

  // Get existing geometry and attributes
  const geometry = particles.geometry;
  const positionAttribute = geometry.getAttribute('position');
  const positions = positionAttribute.array;
  const gridColorAttribute = geometry.getAttribute('aGridColor');
  const gridColors = gridColorAttribute.array;
  const sizeAttribute = geometry.getAttribute('aSize'); // These are the grid sizes, not X shape sizes
  const sizes = sizeAttribute.array;

  // Define color palette for recalculation
  const darkBlue = new THREE.Color("#112046");
  const lightBlue = new THREE.Color("#63BEF4");

  // Recalculate positions with new wave density parameters
  const totalPoints = positions.length / 3;

  // Calculate grid dimensions for a non-square grid based on gridRatio
  // For example, if gridRatio is 2, we want a grid that's twice as wide as it is tall
  const gridHeight = Math.ceil(Math.sqrt(totalPoints / useRatio));
  const gridWidth = Math.ceil(gridHeight * useRatio);

  // Log for debugging
  console.log(`Grid dimensions: ${gridWidth}x${gridHeight}, ratio: ${useRatio}`);

  for (let i = 0; i < positions.length / 3; i++) {
    const i3 = i * 3;

    // Calculate grid positions with separate width and height dimensions
    const row = Math.floor(i / gridWidth);
    const col = i % gridWidth;

    // Convert grid coordinates to world space using density control parameters
    const x = (col / gridWidth - 0.5) * waveWidthFactor;
    const z = (row / gridHeight - 0.5) * waveDepthFactor;

    // CALCULATE GRID COLORS BASED ON ORIGINAL (PRE-ROTATION) Z POSITION
    // We need to do this before applying rotation to match initParticles
    // Use the original Z value from grid calculation
    const originalZ = z;

    // Normalize z position for color gradient - use the original Z
    const minZ = -3.0; // Adjusted for original z values before rotation
    const maxZ = 3.0;  // Adjusted for original z values before rotation
    const normalizedZ = Math.min(1, Math.max(0, (originalZ - minZ) / (maxZ - minZ)));

    // Apply a stronger power curve to create more dramatic contrast
    const enhancedZ = Math.pow(normalizedZ, 2.5);

    // Calculate color based on original z position
    // For the outer 50% (normalizedZ < 0.5), blend towards black instead of just dark blue
    let gridColor;

    if (normalizedZ < 0.5) {
      // Outer 50% - blend between black and dark blue based on how far out we are
      // Remap 0-0.5 range to 0-1 for blending
      const fadeToBlack = 1.0 - (normalizedZ / 0.5);

      // Create a smooth transition between dark blue and black
      gridColor = new THREE.Color().lerpColors(
        new THREE.Color("#6fa4ff"),  // Dark blue
        new THREE.Color("#000000"),  // Pure black
        Math.pow(fadeToBlack, 1.5)   // Power curve for smoother transition
      );
    } else {
      // Inner 50% - normal gradient from dark blue to light blue
      gridColor = new THREE.Color().lerpColors(
        new THREE.Color("#5593fe"),  // Dark blue
        new THREE.Color("#c2e8ff"),  // Light blue to match X shape
        enhancedZ                    // Enhanced normalized distance value
      );
    }

    // Update grid color components
    gridColors[i3] = gridColor.r;
    gridColors[i3 + 1] = gridColor.g;
    gridColors[i3 + 2] = gridColor.b;

    // Only modify the grid sizes (aSize), not the X shape sizes (aTargetSize)
    // This ensures X shape sizes remain intact during transitions
    sizes[i] = 0.5 + enhancedZ * 0.6 + (Math.random() * 0.1);

    // Create a U-shaped wave effect (static, no animation)
    const parabolicFactor = 0.25;
    const baseSineWave = Math.sin(x * Math.PI - Math.PI / 2) * 0.18;
    const uShapeComponent = parabolicFactor * (x * x * 0.2);

    // Combine the components for static shape
    const y = baseSineWave + uShapeComponent + z * 0.15;

    // Apply rotation around Y-axis
    const rotationAngle = -16 * (Math.PI / 180);
    const cosY = Math.cos(rotationAngle);
    const sinY = Math.sin(rotationAngle);

    // Apply Y-axis rotation to x and z coordinates
    const rotatedX = x * cosY - (z + waveZOffset) * sinY;
    const rotatedZ = x * sinY + (z + waveZOffset) * cosY;

    // Store position with rotation applied
    positions[i3] = rotatedX;
    positions[i3 + 1] = y - 0.2;
    positions[i3 + 2] = rotatedZ;
  }

  // Update the position, color, and size attributes
  positionAttribute.needsUpdate = true;
  gridColorAttribute.needsUpdate = true;
  sizeAttribute.needsUpdate = true;

  // Restore animation state
  particles.material.uniforms.uProgress.value = currentProgress;
  particles.material.uniforms.uBlendTransition.value = currentBlendTransition;
  particles.material.blending = currentBlending;
  particles.material.depthWrite = currentDepthWrite;
}


