import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";



// Global configuration
const waveSpeed = 1; // Set to 0 to disable wave animations
let waveOffsetX = -0.35; // Master X offset value
let waveOffsetY = 0.05; // Master Y offset value 
let waveOffsetZ = -1.65; // Master Z offset value
let waveRotationX = -5.73 * (Math.PI / 180); // Controls the X rotation of the wave pattern (radians)
let waveRotationY = 5.73 * (Math.PI / 180); // Controls the Y rotation of the wave pattern (radians)
let waveRotationZ = 0.0; // Controls the Z rotation of the wave pattern (radians)

// Darkness effect controls - adjust these to control different aspects of the darkening effect
let distanceDarknessFactor = 0.80; // Controls how much particles darken based on distance (0-1)
let heightDarknessFactor = 0.8; // Controls how much particles darken based on height (0-2)
let distantHeightBoost = 1.2; // Controls extra darkening for particles that are both high and distant (0-2)

// Debug flags
let debugMode = false; // Global flag to enable/disable debug mode
let debugFrontPosition = new THREE.Vector3(0, 0, 0); // Track front-most position
let debugBackPosition = new THREE.Vector3(0, 0, 0); // Track back-most position
let debugLeftPosition = new THREE.Vector3(0, 0, 0); // Track left-most position 
let debugRightPosition = new THREE.Vector3(0, 0, 0); // Track right-most position
let debugHighestPosition = new THREE.Vector3(0, 0, 0); // Track highest position
let debugLowestPosition = new THREE.Vector3(0, 0, 0); // Track lowest position

// Wave density controls - these parameters affect how the particles are arranged
let waveWidthFactor = 1.5; // Width of the wave pattern (X-axis spread)
let waveDepthFactor = 6.0; // Depth of the wave pattern (Z-axis spread)
let waveZOffset = 1.8; // Z-offset for the wave centered positioning

// Display offset values (for UI showing relative changes from baseline)
let displayOffsetX = 0.10; // Updated to match specified position X value
let displayOffsetY = 0.20; // Updated to match specified position Y value
let displayOffsetZ = 0.00; // Updated to match specified position Z value
let displayRotationX = 0.0;
let displayRotationY = 0.0;
let displayRotationZ = 0.0;

// Original zero values stored for reset functionality
const originalOffsets = {
  x: 0.0,
  y: 0.0,
  z: 0.0,
  rotX: 0.0,
  rotY: 0.0,
  rotZ: 0.0
};

// Apply initial wave property values when page loads
window.addEventListener("DOMContentLoaded", () => {
  // This ensures the wave properties use our master values defined at the top of the file
  setTimeout(() => {
    // Simply use the master values defined at the top of this file
    updateWaveOffsets(waveOffsetX, waveOffsetY, waveOffsetZ);
    updateWaveRotations(waveRotationX, waveRotationY, waveRotationZ);
    updateWaveDensity(waveWidthFactor, waveDepthFactor, waveZOffset);
    
    // Update display offset values based on the master values
    // We're calculating these based on the difference from our baseline values
    calculateDisplayOffsets();
    
    // Update debug display to show the specified values
    updateDebugDisplay();
  }, 100); // Small delay to ensure the particle system is initialized
});

// Add a new function to calculate display offsets from master values
function calculateDisplayOffsets() {
  // Display offsets are calculated relative to our baseline values
  // These values will show how much we've moved from the original configuration
  displayOffsetX = waveOffsetX - (-0.75);
  displayOffsetY = waveOffsetY - (-0.25);
  displayOffsetZ = waveOffsetZ - (-3.20);
  displayRotationX = waveRotationX - (-5.73 * (Math.PI / 180));
  displayRotationY = waveRotationY - (5.73 * (Math.PI / 180));
  displayRotationZ = waveRotationZ - 0.0;
}

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
        
        // Static position with offsets and rotation applied
        vec3 staticPosition = position;
        
        // Apply wave animation to grid state (when uProgress is low)
        // The wave effect weakens as we transition to the X shape
        float waveStrength = 1.0 - smoothstep(0.0, 0.3, uProgress);
        
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
        float normalizedDistance = clamp(distanceToCamera / 5.0, 0.0, 1.0);

        // Apply a power curve to make the effect more dramatic at greater distances
        float distanceFactor = pow(normalizedDistance, 1.2);
        
        // Pass both height and distance factors to fragment shader
        vWaveHeight = normalizedVisualHeight * waveStrength;
        vDistanceFactor = distanceFactor * waveStrength;

        // Blend between grid size and target X shape size
        float finalSize = mix(aSize, aTargetSize, assemblyProgress);
        gl_PointSize = finalSize * uSize * uResolution.y;
        gl_PointSize *= (1.0 / - viewPosition.z);

        // Use a sharper transition curve for color blending
        // This ensures we see a clear difference between grid and X colors
        // Use a step function that completes early in the animation (at 0.3 instead of 0.6)
        float colorBlend = smoothstep(0.0, 0.3, uProgress);
        
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
    // Debug varyings
    varying vec3 vStaticPosition; // Original position before transformations
    varying vec3 vFinalPosition; // Final position after all transformations
    varying vec3 vModelPosition; // Position after model matrix
    varying float vRawDistanceX; // Raw distance value before normalization
    uniform float uProgress; // Animation progress uniform
    uniform float uBlendTransition; // Dedicated uniform for blend transition
    uniform float uDistanceDarknessFactor; // Factor for distance-based darkening
    uniform float uHeightDarknessFactor; // Factor for height-based darkening
    uniform float uDistantHeightBoost; // Factor for boosting darkness of distant high particles
    
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
        float baseDistanceDarkness = vDistanceFactor * vDistanceFactor * uDistanceDarknessFactor;
        
        // Boost the fade factor based on distance for more dramatic effect at distance
        fadeFactor = mix(fadeFactor, 1.0, vDistanceFactor * vWaveHeight * uDistantHeightBoost);
        
        // Combine the base distance darkness with the height-based fade
        fadeFactor = max(fadeFactor, baseDistanceDarkness);
        
        // Apply height darkness factor to adjust the strength of height-based fading
        fadeFactor = min(1.0, fadeFactor * uHeightDarknessFactor);
        
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

// Initialize scrollY at the top level
let scrollY = window.scrollY;

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

// Add camera helper (initially hidden) to visualize camera frustum
const cameraHelper = new THREE.CameraHelper(camera);
cameraHelper.visible = false; // Hidden by default
scene.add(cameraHelper);

// Toggle camera helper visibility with 'H' key
window.addEventListener("keydown", (event) => {
  if (event.key === "h" || event.key === "H") {
    cameraHelper.visible = !cameraHelper.visible;
    updateDebugDisplay();
  }

  // Darkness effect controls
  const darknessStep = 0.05; // Amount to change darkness parameters with each key press
  
  // Distance darkness controls (keys 1/2)
  if (event.key === "1") {
    updateDarknessParams(Math.max(0, distanceDarknessFactor - darknessStep), heightDarknessFactor, distantHeightBoost);
    console.log("Decreased distance darkness");
  } else if (event.key === "2") {
    updateDarknessParams(Math.min(1.0, distanceDarknessFactor + darknessStep), heightDarknessFactor, distantHeightBoost);
    console.log("Increased distance darkness");
  }
  
  // Height darkness controls (keys 3/4)
  if (event.key === "3") {
    updateDarknessParams(distanceDarknessFactor, Math.max(0, heightDarknessFactor - darknessStep*2), distantHeightBoost);
    console.log("Decreased height darkness");
  } else if (event.key === "4") {
    updateDarknessParams(distanceDarknessFactor, Math.min(2.0, heightDarknessFactor + darknessStep*2), distantHeightBoost);
    console.log("Increased height darkness");
  }
  
  // Distant height boost controls (keys 5/6)
  if (event.key === "5") {
    updateDarknessParams(distanceDarknessFactor, heightDarknessFactor, Math.max(0, distantHeightBoost - darknessStep*2));
    console.log("Decreased distant height boost");
  } else if (event.key === "6") {
    updateDarknessParams(distanceDarknessFactor, heightDarknessFactor, Math.min(2.0, distantHeightBoost + darknessStep*2));
    console.log("Increased distant height boost");
  }

  // Wave offset controls
  const offsetStep = 0.05; // Amount to change offsets with each key press

  // X offset controls (A/D)
  if (event.key === "a" || event.key === "A") {
    updateWaveOffsets(waveOffsetX - offsetStep, waveOffsetY, waveOffsetZ);
    console.log("Decreased X offset");
  } else if (event.key === "d" || event.key === "D") {
    updateWaveOffsets(waveOffsetX + offsetStep, waveOffsetY, waveOffsetZ);
    console.log("Increased X offset");
  }
  
  // Y offset controls (W/S)
  if (event.key === "w" || event.key === "W") {
    updateWaveOffsets(waveOffsetX, waveOffsetY + offsetStep, waveOffsetZ);
    console.log("Increased Y offset");
  } else if (event.key === "s" || event.key === "S") {
    updateWaveOffsets(waveOffsetX, waveOffsetY - offsetStep, waveOffsetZ);
    console.log("Decreased Y offset");
  }
  
  // Z offset controls (Q/E)
  if (event.key === "q" || event.key === "Q") {
    updateWaveOffsets(waveOffsetX, waveOffsetY, waveOffsetZ - offsetStep);
    console.log("Decreased Z offset");
  } else if (event.key === "e" || event.key === "E") {
    updateWaveOffsets(waveOffsetX, waveOffsetY, waveOffsetZ + offsetStep);
    console.log("Increased Z offset");
  }
  
  // Wave density control (using shift key + keyboard combinations)
  const densityStep = 0.1; // Amount to change density parameters with each key press
  
  // Width factor controls (Shift + Left/Right Arrow)
  if (event.shiftKey && event.key === "ArrowLeft") {
    updateWaveDensity(waveWidthFactor - densityStep, waveDepthFactor, waveZOffset);
    console.log("Decreased wave width");
  } else if (event.shiftKey && event.key === "ArrowRight") {
    updateWaveDensity(waveWidthFactor + densityStep, waveDepthFactor, waveZOffset);
    console.log("Increased wave width");
  }
  
  // Depth factor controls (Shift + Up/Down Arrow)
  if (event.shiftKey && event.key === "ArrowUp") {
    updateWaveDensity(waveWidthFactor, waveDepthFactor + densityStep, waveZOffset);
    console.log("Increased wave depth");
  } else if (event.shiftKey && event.key === "ArrowDown") {
    updateWaveDensity(waveWidthFactor, waveDepthFactor - densityStep, waveZOffset);
    console.log("Decreased wave depth");
  }
  
  // Z-offset controls (Shift + PageUp/PageDown)
  if (event.shiftKey && event.key === "PageUp") {
    updateWaveDensity(waveWidthFactor, waveDepthFactor, waveZOffset + densityStep);
    console.log("Increased wave Z offset");
  } else if (event.shiftKey && event.key === "PageDown") {
    updateWaveDensity(waveWidthFactor, waveDepthFactor, waveZOffset - densityStep);
    console.log("Decreased wave Z offset");
  }
  
  // Reset offsets to base values (R key)
  if (event.key === "r" || event.key === "R") {
    // Reset to our master values defined at the top of the file
    updateWaveOffsets(waveOffsetX, waveOffsetY, waveOffsetZ);
    updateWaveRotations(waveRotationX, waveRotationY, waveRotationZ);
    updateWaveDensity(waveWidthFactor, waveDepthFactor, waveZOffset);
    updateDarknessParams(0.30, 1.0, 1.2); // Reset to default darkness values
    console.log("Reset all parameters to master values");
  }
  
  // True zero reset (Z key)
  if (event.key === "z" || event.key === "Z") {
    updateWaveOffsets(0, 0, 0);
    updateWaveRotations(0, 0, 0);
    console.log("Reset wave parameters to true zero");
  }
});

// Renderer configuration
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(sceneSize.width, sceneSize.height);
renderer.setPixelRatio(sceneSize.pixelRatio);
renderer.setClearColor("#000000");

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
const gridSize = Math.ceil(Math.sqrt(particlesCount)); // Calculate grid dimensions
for (let i = 0; i < particlesCount; i++) {
    const i3 = i * 3;
    
    // Calculate grid positions
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    
    // Convert grid coordinates to world space using density control parameters
    const x = (col / gridSize - 0.5) * waveWidthFactor;
    const z = (row / gridSize - 0.5) * waveDepthFactor;
    
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
            new THREE.Color("#63BEF4"),  // Light blue to match X shape
            enhancedZ                    // Enhanced normalized distance value
        );
    }
    
    // Update grid color components
    gridColors[i3] = gridColor.r;
    gridColors[i3 + 1] = gridColor.g;
    gridColors[i3 + 2] = gridColor.b;
    
    // Create a U-shaped wave effect (static, no animation)
    const parabolicFactor = 0.25;
    const baseSineWave = Math.sin(x * Math.PI - Math.PI/2) * 0.18;
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
    particleSizes[i] = 0.7 + enhancedZ * 0.6 + (Math.random() * 0.1);
}

/**
 * Load the X model from GLTF file
 * The vertices from this model will be used as target positions for particles
 */
const loader = new GLTFLoader();
let xShape;
loader.load("./x.glb", (gltf) => {
  xShape = gltf.scene.children[0].geometry.attributes.position;
  initParticles();
});

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
  const darkBlue = new THREE.Color("#0452D5");
  const lightBlue = new THREE.Color("#63BEF4");

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
    let targetY = xShape.array[i3 + 1];
    let targetZ = xShape.array[i3 + 2];
    
    // DETERMINE FRONT/BACK/SIDE BASED ON PRE-ROTATION POSITIONS
    // Using more precise thresholds to identify front, side and back regions
    const isFront = targetZ > 0.1; // Clear front-facing particles
    const isBack = targetZ < -0.1; // Clear back-facing particles
    const isSide = !isFront && !isBack; // Side particles
    
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
    const normalizedDist = Math.min(distFromCenterXY / 0.5, 1.0);
    
    // SIZE CALCULATION BASED ON POSITION
    // More dramatic size difference between center and edges
    const particleSize = isFront ? 
                        (0.8 + (normalizedDist * 0.5) + (Math.random() * 0.1)) : // Front: Gradient from 0.8 to 1.3
                        (0.7 + (Math.random() * 0.1)); // Back: Smaller than before
    
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
      uSize: { value: 0.026 }, // Base size multiplier
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
      uDistanceDarknessFactor: { value: distanceDarknessFactor },
      uHeightDarknessFactor: { value: heightDarknessFactor },
      uDistantHeightBoost: { value: distantHeightBoost }
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
  particles.scale.set(1.1, 1.0, 1.0);
  
  // Set renderOrder to ensure proper transparency handling
  particles.renderOrder = 0;
  
  scene.add(particles);
}

/**
 * Scroll event handler
 * Updates animation progress based on scroll position
 */
window.addEventListener("scroll", () => {
  scrollY = window.scrollY;

  // Calculate progress percentage (0-100)
  const progress =
    (scrollY / (document.documentElement.scrollHeight - window.innerHeight)) *
    100;
  
  // Update progress display in the UI
  const scrollPercentage = Math.round(progress);
  document.querySelector(".scrollProgress").textContent = `${scrollPercentage}%`;
  
  // Update debug info using the centralized function
  updateDebugDisplay();

  // Update particle animation progress (0-1)
  if (particles) {
    particles.material.uniforms.uProgress.value = progress / 100;
    
    // Calculate blend transition from additive to normal blending
    // - Wave state (0-35%): Fully additive blending
    // - Transition period (35-65%): Gradual change to normal blending
    // - X shape (65-100%): Normal blending
    // This matches the position transition timing in the vertex shader
    const blendProgress = Math.max(0, Math.min(1, (progress - 35) / 30));
    
    // Apply smoothstep easing to the blend transition for better smoothing
    const smoothBlendProgress = blendProgress * blendProgress * (3 - 2 * blendProgress);
    particles.material.uniforms.uBlendTransition.value = smoothBlendProgress;
    
    // Create a wider transition window for blending mode switches (45%-55% instead of exactly 50%)
    // This staggers the changes to avoid all changes happening at once
    if (blendProgress > 0.6 && particles.material.blending === THREE.AdditiveBlending) {
      // Switch to normal blending at 60% of the transition (53% of scroll)
      particles.material.blending = THREE.NormalBlending;
      particles.material.needsUpdate = true; // Important: update material after changing blending
    } else if (blendProgress <= 0.4 && particles.material.blending === THREE.NormalBlending) {
      // Switch back to additive blending at 40% of the transition (47% of scroll)
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
    if (progress >= 60) { // Start rotation at 60% scroll (after wave transition completes)
      // Normalize progress to 0-1 range for the Y rotation animation (60%-100%)
      const normalizedProgress = (progress - 60) / 40;
      
      let yEasedProgress;
      
      // Store phase1Progress for reuse
      const phase1Progress = progress < 80 ? (progress - 60) / 20 : 1.0; // 0-1 within phase 1
      
      if (progress < 80) {
        // Use a gentler cubic ease-out for slower buildup
        // This curve will reach 0.5 (10 degrees) at the end of phase 1
        yEasedProgress = 0.5 * (3 * Math.pow(phase1Progress, 2) - 2 * Math.pow(phase1Progress, 3));
      } else {
        // Phase 2: Normalize to 0-1 range for 80-100% scroll
        const phase2Progress = (progress - 80) / 20; // 0-1 within phase 2
        
        // Start from 0.5 (10 degrees) and build to 1.0 (20 degrees)
        // Use a smooth quadratic curve for acceleration
        yEasedProgress = 0.5 + 0.5 * Math.pow(phase2Progress, 2);
      }
      
      // Ensure we don't exceed 1.0 due to floating-point errors
      easedProgress = Math.min(1.0, Math.max(0, yEasedProgress));
      
      // Calculate X rotation that starts at 80% scroll and reaches 5 degrees at 100%
      let xRotationProgress = 0;
      if (progress >= 80) {
        // Normalize to 0-1 range for 80-100% scroll
        const xNormalizedProgress = (progress - 80) / 20;
        
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
});

/**
 * Animation loop
 * Renders the scene on each frame
 */
let clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  // Update time for wave animation
  const deltaTime = clock.getDelta();
  if (particles && waveSpeed > 0) {
    // Only update time if wave animation is enabled
    particles.material.uniforms.uTime.value += deltaTime * waveSpeed;
  }
  
  // Update camera helper if it's visible
  if (cameraHelper.visible) {
    cameraHelper.update();
  }
  
  // Update debug info when in debug mode
  if (debugMode) {
    // Limit debug stats updates to once every 30 frames for performance
    if (Math.floor(performance.now() / 100) % 3 === 0) {
      requestAnimationFrame(() => {
        captureVertexStats();
        updateDarknessVisualizer(); // Add this line
      });
    }
  } else {
    // Hide visualizer when debug mode is off
    const canvas = document.getElementById('darknessVisualizer');
    if (canvas) canvas.style.display = 'none';
  }

  // Render the scene
  renderer.render(scene, camera);
}

// Start animation loop
animate();

// Initialize debug display
updateDebugDisplay();

/**
 * Updates wave offset parameters and applies them to shader uniforms
 * @param {number} x - X offset for the wave pattern
 * @param {number} y - Y offset for the wave pattern
 * @param {number} z - Z offset for the wave pattern
 */
function updateWaveOffsets(x, y, z) {
  // Update global variables
  waveOffsetX = x;
  waveOffsetY = y;
  waveOffsetZ = z;
  
  // Recalculate display offsets based on these new values
  calculateDisplayOffsets();
  
  // Update shader uniforms if particles exist
  if (particles) {
    particles.material.uniforms.uWaveOffsetX.value = x;
    particles.material.uniforms.uWaveOffsetY.value = y;
    particles.material.uniforms.uWaveOffsetZ.value = z;
  }
  
  console.log(`Wave offsets updated: X=${x}, Y=${y}, Z=${z}`);
  
  // Update debug display with new offset values
  updateDebugDisplay();
}

/**
 * Updates wave rotation parameters and applies them to shader uniforms
 * @param {number} x - X rotation for the wave pattern (in radians)
 * @param {number} y - Y rotation for the wave pattern (in radians)
 * @param {number} z - Z rotation for the wave pattern (in radians)
 */
function updateWaveRotations(x, y, z) {
  // Calculate display rotations relative to base values (in radians)
  displayRotationX = x - (-5.73 * (Math.PI / 180));
  displayRotationY = y - (5.73 * (Math.PI / 180));
  displayRotationZ = z - 0.0;
  
  // Update global variables
  waveRotationX = x;
  waveRotationY = y;
  waveRotationZ = z;
  
  // Update shader uniforms if particles exist
  if (particles) {
    particles.material.uniforms.uWaveRotationX.value = x;
    particles.material.uniforms.uWaveRotationY.value = y;
    particles.material.uniforms.uWaveRotationZ.value = z;
  }
  
  console.log(`Wave rotations updated: X=${x}, Y=${y}, Z=${z}`);
  
  // Update debug display with new rotation values
  updateDebugDisplay();
}

/**
 * Updates darkness effect parameters and applies them to shader uniforms
 * @param {number} distance - Factor for distance-based darkening
 * @param {number} height - Factor for height-based darkening
 * @param {number} distantHeight - Factor for boosting darkness of distant high particles
 */
function updateDarknessParams(distance, height, distantHeight) {
  // Update global variables
  distanceDarknessFactor = distance;
  heightDarknessFactor = height;
  distantHeightBoost = distantHeight;
  
  // Update shader uniforms if particles exist
  if (particles) {
    particles.material.uniforms.uDistanceDarknessFactor.value = distance;
    particles.material.uniforms.uHeightDarknessFactor.value = height;
    particles.material.uniforms.uDistantHeightBoost.value = distantHeight;
  }
  
  console.log(`Darkness params updated: Distance=${distance.toFixed(2)}, Height=${height.toFixed(2)}, Boost=${distantHeight.toFixed(2)}`);
  
  // Update debug display with new values
  updateDebugDisplay();
}

/**
 * Updates the debug display with current values
 * Shows scroll progress, rotation status, wave offset values, and camera information
 */
function updateDebugDisplay() {
  // Get current scroll progress
  const progress = (scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
  const scrollProgressPrecise = progress.toFixed(1);
  
  // Format display offset values to 2 decimal places (these will start at 0)
  const offsetX = displayOffsetX.toFixed(2);
  const offsetY = displayOffsetY.toFixed(2);
  const offsetZ = displayOffsetZ.toFixed(2);
  
  // Format actual offset values (not just display deltas)
  const actualX = waveOffsetX.toFixed(2);
  const actualY = waveOffsetY.toFixed(2);
  const actualZ = waveOffsetZ.toFixed(2);
  
  // Format display rotation values to 2 decimal places (convert to degrees for display)
  const rotOffsetX = (displayRotationX * 180 / Math.PI).toFixed(2);
  const rotOffsetY = (displayRotationY * 180 / Math.PI).toFixed(2);
  const rotOffsetZ = (displayRotationZ * 180 / Math.PI).toFixed(2);
  
  // Format wave density parameters
  const widthFactor = waveWidthFactor.toFixed(2);
  const depthFactor = waveDepthFactor.toFixed(2);
  const zOffsetValue = waveZOffset.toFixed(2);
  
  // Format darkness parameters
  const distanceDark = distanceDarknessFactor.toFixed(2);
  const heightDark = heightDarknessFactor.toFixed(2);
  const distantBoost = distantHeightBoost.toFixed(2);
  
  // Format camera parameters to 2 decimal places
  const camPosX = camera.position.x.toFixed(2);
  const camPosY = camera.position.y.toFixed(2);
  const camPosZ = camera.position.z.toFixed(2);
  
  // Get camera rotation in degrees
  const camRotX = (camera.rotation.x * 180 / Math.PI).toFixed(2);
  const camRotY = (camera.rotation.y * 180 / Math.PI).toFixed(2);
  const camRotZ = (camera.rotation.z * 180 / Math.PI).toFixed(2);
  
  // Calculate camera lookAt target based on camera's matrix
  const lookAtVector = new THREE.Vector3(0, 0, -1);
  lookAtVector.applyQuaternion(camera.quaternion);
  const lookX = lookAtVector.x.toFixed(2);
  const lookY = lookAtVector.y.toFixed(2);
  const lookZ = lookAtVector.z.toFixed(2);
  
  // Camera helper status
  const helperStatus = cameraHelper.visible ? "visible" : "hidden";
  
  // Controls reminder
  const controlsInfo = `Controls: WASD/QE = move, R = reset, Z = zero`;
  const densityControls = `Density: Shift+Arrows = width/depth, Shift+Page = Z-offset`;
  const darknessControls = `Darkness: 1/2 = distance, 3/4 = height, 5/6 = boost`;
  
  if (progress >= 60 && particles) {
    // When rotation is active (at 60% or higher), show rotation values and offsets
    const rotX = (particles.rotation.x * 180 / Math.PI).toFixed(1);
    const rotY = (particles.rotation.y * 180 / Math.PI).toFixed(1);
    const rotZ = 0.0;
    
    document.querySelector(".scrollProgressPrecise").innerHTML = 
      `Scroll: ${scrollProgressPrecise}% | Rotation: active<br>` +
      `X: <span class="rot-x">${rotX}°</span> ` +
      `Y: <span class="rot-y">${rotY}°</span> ` +
      `Z: <span class="rot-z">${rotZ}°</span><br>` +
      `Position: <span class="off-x">X=${offsetX}</span> ` +
      `<span class="off-y">Y=${offsetY}</span> ` +
      `<span class="off-z">Z=${offsetZ}</span><br>` +
      `Actual: <span class="off-x">X=${actualX}</span> ` +
      `<span class="off-y">Y=${actualY}</span> ` +
      `<span class="off-z">Z=${actualZ}</span><br>` +
      `Rotation: <span class="rot-x">X=${rotOffsetX}°</span> ` +
      `<span class="rot-y">Y=${rotOffsetY}°</span> ` +
      `<span class="rot-z">Z=${rotOffsetZ}°</span><br>` +
      `Density: Width=${widthFactor}, Depth=${depthFactor}, Z-Offset=${zOffsetValue}<br>` +
      `Darkness: Dist=${distanceDark}, Height=${heightDark}, Boost=${distantBoost}<br>` +
      `${controlsInfo}<br>${densityControls}<br>${darknessControls}`;
  } else {
    // When rotation is not active (below 60%), only show offset values
    document.querySelector(".scrollProgressPrecise").innerHTML = 
      `Scroll: ${scrollProgressPrecise}% | Rotation: inactive<br>` +
      `X: <span class="rot-x">0.0°</span> ` +
      `Y: <span class="rot-y">0.0°</span> ` +
      `Z: <span class="rot-z">0.0°</span><br>` +
      `Position: <span class="off-x">X=${offsetX}</span> ` +
      `<span class="off-y">Y=${offsetY}</span> ` +
      `<span class="off-z">Z=${offsetZ}</span><br>` +
      `Actual: <span class="off-x">X=${actualX}</span> ` +
      `<span class="off-y">Y=${actualY}</span> ` +
      `<span class="off-z">Z=${actualZ}</span><br>` +
      `Rotation: <span class="rot-x">X=${rotOffsetX}°</span> ` +
      `<span class="rot-y">Y=${rotOffsetY}°</span> ` +
      `<span class="rot-z">Z=${rotOffsetZ}°</span><br>` +
      `Density: Width=${widthFactor}, Depth=${depthFactor}, Z-Offset=${zOffsetValue}<br>` +
      `Darkness: Dist=${distanceDark}, Height=${heightDark}, Boost=${distantBoost}<br>` +
      `${controlsInfo}<br>${densityControls}<br>${darknessControls}`;
  }
  
  // Add camera debug info if helper is visible
  if (cameraHelper.visible) {
    document.querySelector(".scrollProgressPrecise").innerHTML += `<br>` +
      `Camera: <span class="cam-pos">X=${camPosX} Y=${camPosY} Z=${camPosZ}</span><br>` +
      `Rotation: <span class="cam-rot">X=${camRotX}° Y=${camRotY}° Z=${camRotZ}°</span><br>` +
      `LookAt: <span class="cam-look">X=${lookX} Y=${lookY} Z=${lookZ}</span><br>` +
      `Helper: ${helperStatus}`;
  }
}

/**
 * Updates wave density parameters and regenerates particles if needed
 * @param {number} width - Width factor for the wave pattern
 * @param {number} depth - Depth factor for the wave pattern
 * @param {number} zOffset - Z-offset for wave positioning
 */
function updateWaveDensity(width, depth, zOffset) {
  // Update global wave density variables
  waveWidthFactor = Math.max(0.5, width); // Ensure minimum width
  waveDepthFactor = Math.max(1.0, depth); // Ensure minimum depth
  waveZOffset = Math.max(0.0, zOffset); // Ensure non-negative z-offset
  
  // Regenerate particles with new density parameters
  regenerateParticles();
  
  console.log(`Wave density updated: Width=${waveWidthFactor}, Depth=${waveDepthFactor}, Z-Offset=${waveZOffset}`);
  
  // Update debug display with new values
  updateDebugDisplay();
}

/**
 * Regenerates particles with current wave density parameters
 * This recalculates positions while preserving particle attributes and animation state
 */
function regenerateParticles() {
  if (!particles) return; // Skip if particles don't exist yet
  
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
  const darkBlue = new THREE.Color("#0452D5");
  const lightBlue = new THREE.Color("#63BEF4");
  
  // Recalculate positions with new wave density parameters
  const gridSize = Math.ceil(Math.sqrt(positions.length / 3));
  
  for (let i = 0; i < positions.length / 3; i++) {
    const i3 = i * 3;
    
    // Calculate grid positions
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    
    // Convert grid coordinates to world space using density control parameters
    const x = (col / gridSize - 0.5) * waveWidthFactor;
    const z = (row / gridSize - 0.5) * waveDepthFactor;
    
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
            new THREE.Color("#63BEF4"),  // Light blue to match X shape
            enhancedZ                    // Enhanced normalized distance value
        );
    }
    
    // Update grid color components
    gridColors[i3] = gridColor.r;
    gridColors[i3 + 1] = gridColor.g;
    gridColors[i3 + 2] = gridColor.b;
    
    // Only modify the grid sizes (aSize), not the X shape sizes (aTargetSize)
    // This ensures X shape sizes remain intact during transitions
    sizes[i] = 0.7 + enhancedZ * 0.6 + (Math.random() * 0.1);
    
    // Create a U-shaped wave effect (static, no animation)
    const parabolicFactor = 0.25;
    const baseSineWave = Math.sin(x * Math.PI - Math.PI/2) * 0.18;
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

// Add debug overlay to the HTML
document.body.insertAdjacentHTML('beforeend', `
<div id="debugOverlay" style="position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; font-family: monospace; font-size: 12px; z-index: 1000; width: 300px; display: none;">
  <h3>Debug Information</h3>
  <div id="debugStats"></div>
  <div id="particleDebug"></div>
  <div id="extremePositions"></div>
  <div style="margin-top: 10px;">
    <button id="toggleDebug">Hide Debug</button>
    <button id="captureStats">Capture Stats</button>
  </div>
</div>
`);

// Initialize a structure to store debug stats
let debugStats = {
  distanceFactor: {
    min: 100, max: -100, avg: 0
  },
  heightFactor: {
    min: 100, max: -100, avg: 0
  },
  rawDistanceX: {
    min: 100, max: -100, avg: 0
  },
  positions: {
    x: { min: 100, max: -100 },
    y: { min: 100, max: -100 },
    z: { min: 100, max: -100 }
  },
  modelPositions: {
    x: { min: 100, max: -100 },
    y: { min: 100, max: -100 },
    z: { min: 100, max: -100 }
  }
};

// Toggle debug mode with 'D' key
window.addEventListener("keydown", (event) => {
  if (event.key === "d" || event.key === "D") {
    debugMode = !debugMode;
    document.getElementById('debugOverlay').style.display = debugMode ? 'block' : 'none';
    
    if (debugMode) {
      console.log("Debug mode activated");
      document.getElementById('toggleDebug').innerText = "Hide Debug";
    } else {
      console.log("Debug mode deactivated");
      document.getElementById('toggleDebug').innerText = "Show Debug";
    }
  }
  
  // Existing key handlers
  // ... existing code ...
});

// Function to check the position of every particle to find extremes
function captureVertexStats() {
  if (!particles) return;
  
  // Get all the attributes
  const geometry = particles.geometry;
  if (!geometry) return;
  
  // Reset stats
  debugStats = {
    distanceFactor: { min: 100, max: -100, avg: 0, sum: 0, count: 0 },
    heightFactor: { min: 100, max: -100, avg: 0, sum: 0, count: 0 },
    rawDistanceX: { min: 100, max: -100, avg: 0, sum: 0, count: 0 },
    positions: {
      x: { min: 100, max: -100 },
      y: { min: 100, max: -100 },
      z: { min: 100, max: -100 }
    },
    modelPositions: {
      x: { min: 100, max: -100 },
      y: { min: 100, max: -100 },
      z: { min: 100, max: -100 }
    }
  };
  
  // Create a copy of particle geometry for position analysis
  const positionAttribute = geometry.getAttribute('position');
  const particleCount = positionAttribute.count;
  
  // Update debug overlay
  document.getElementById('debugStats').innerHTML = `
    <p>Particle count: ${particleCount}</p>
    <p>Current distanceDarknessFactor: ${distanceDarknessFactor.toFixed(2)}</p>
    <p>Current heightDarknessFactor: ${heightDarknessFactor.toFixed(2)}</p>
    <p>Current distantHeightBoost: ${distantHeightBoost.toFixed(2)}</p>
  `;
  
  // Track extreme positions
  let extremePositions = {
    left: { x: 100, y: 0, z: 0, distance: 0, darkness: 0 },
    right: { x: -100, y: 0, z: 0, distance: 0, darkness: 0 },
    front: { x: 0, y: 0, z: -100, distance: 0, darkness: 0 },
    back: { x: 0, y: 0, z: 100, distance: 0, darkness: 0 },
    top: { x: 0, y: -100, z: 0, distance: 0, darkness: 0 },
    bottom: { x: 0, y: 100, z: 0, distance: 0, darkness: 0 }
  };
  
  // Create a raycaster to find specific particles
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(0, 0);
  const camera = scene.children.find(child => child instanceof THREE.Camera);
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(particles);
  
  // Get debug shader values using special material's uniforms
  const debugValues = {};
  if (intersects.length > 0) {
    const index = intersects[0].index;
    const modelPos = new THREE.Vector3();
    particles.getWorldPosition(modelPos);
    
    debugValues.worldPosition = modelPos;
    debugValues.index = index;
    debugValues.point = intersects[0].point;
  }
  
  // Calculate world matrix for position transformations
  particles.updateMatrixWorld();
  const worldMatrix = particles.matrixWorld.clone();
  
  // Sample positions at key points to check distance values
  for (let i = 0; i < particleCount; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);
    
    // Track position extremes
    if (x < debugStats.positions.x.min) debugStats.positions.x.min = x;
    if (x > debugStats.positions.x.max) debugStats.positions.x.max = x;
    if (y < debugStats.positions.y.min) debugStats.positions.y.min = y;
    if (y > debugStats.positions.y.max) debugStats.positions.y.max = y;
    if (z < debugStats.positions.z.min) debugStats.positions.z.min = z;
    if (z > debugStats.positions.z.max) debugStats.positions.z.max = z;
    
    // Calculate model position (world space)
    const position = new THREE.Vector3(x, y, z);
    const modelPosition = position.clone().applyMatrix4(worldMatrix);
    
    // Track model position extremes
    if (modelPosition.x < debugStats.modelPositions.x.min) debugStats.modelPositions.x.min = modelPosition.x;
    if (modelPosition.x > debugStats.modelPositions.x.max) debugStats.modelPositions.x.max = modelPosition.x;
    if (modelPosition.y < debugStats.modelPositions.y.min) debugStats.modelPositions.y.min = modelPosition.y;
    if (modelPosition.y > debugStats.modelPositions.y.max) debugStats.modelPositions.y.max = modelPosition.y;
    if (modelPosition.z < debugStats.modelPositions.z.min) debugStats.modelPositions.z.min = modelPosition.z;
    if (modelPosition.z > debugStats.modelPositions.z.max) debugStats.modelPositions.z.max = modelPosition.z;
    
    // Calculate distance factors manually to compare with shader
    const cameraPosition = new THREE.Vector3(0.8, 0.2, 3.5);
    const dx = cameraPosition.x - modelPosition.x;
    const dy = cameraPosition.y - modelPosition.y;
    const dz = cameraPosition.z - modelPosition.z;
    const distanceToCamera = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const normalizedDistance = Math.min(Math.max(distanceToCamera / 5.0, 0.0), 1.0);
    const distanceFactor = Math.pow(normalizedDistance, 1.2);
    
    // Update the extremes
    if (modelPosition.x < extremePositions.left.x) {
      extremePositions.left = {
        x: modelPosition.x,
        y: modelPosition.y,
        z: modelPosition.z,
        distance: distanceToCamera, // Use distanceToCamera instead of distanceX
        darkness: distanceFactor * distanceFactor * distanceDarknessFactor
      };
    }
    
    if (modelPosition.x > extremePositions.right.x) {
      extremePositions.right = {
        x: modelPosition.x,
        y: modelPosition.y,
        z: modelPosition.z,
        distance: distanceToCamera, // Use distanceToCamera instead of distanceX
        darkness: distanceFactor * distanceFactor * distanceDarknessFactor
      };
    }
    
    if (modelPosition.z < extremePositions.front.z) {
      extremePositions.front = {
        x: modelPosition.x,
        y: modelPosition.y,
        z: modelPosition.z,
        distance: distanceToCamera, // Use distanceToCamera instead of distanceX
        darkness: distanceFactor * distanceFactor * distanceDarknessFactor
      };
    }
    
    if (modelPosition.z > extremePositions.back.z) {
      extremePositions.back = {
        x: modelPosition.x,
        y: modelPosition.y,
        z: modelPosition.z,
        distance: distanceToCamera, // Use distanceToCamera instead of distanceX
        darkness: distanceFactor * distanceFactor * distanceDarknessFactor
      };
    }
    
    if (modelPosition.y > extremePositions.top.y) {
      extremePositions.top = {
        x: modelPosition.x,
        y: modelPosition.y,
        z: modelPosition.z,
        distance: distanceToCamera, // Use distanceToCamera instead of distanceX
        darkness: distanceFactor * distanceFactor * distanceDarknessFactor
      };
    }
    
    if (modelPosition.y < extremePositions.bottom.y) {
      extremePositions.bottom = {
        x: modelPosition.x,
        y: modelPosition.y,
        z: modelPosition.z,
        distance: distanceToCamera, // Use distanceToCamera instead of distanceX
        darkness: distanceFactor * distanceFactor * distanceDarknessFactor
      };
    }
    
    // Track stats for distance factor
    if (distanceFactor < debugStats.distanceFactor.min) debugStats.distanceFactor.min = distanceFactor;
    if (distanceFactor > debugStats.distanceFactor.max) debugStats.distanceFactor.max = distanceFactor;
    debugStats.distanceFactor.sum += distanceFactor;
    debugStats.distanceFactor.count++;
    
    // Track stats for raw distance
    if (distanceToCamera < debugStats.rawDistanceX.min) debugStats.rawDistanceX.min = distanceToCamera;
    if (distanceToCamera > debugStats.rawDistanceX.max) debugStats.rawDistanceX.max = distanceToCamera;
    debugStats.rawDistanceX.sum += distanceToCamera;
    debugStats.rawDistanceX.count++;
  }
  
  // Calculate averages
  if (debugStats.distanceFactor.count > 0) {
    debugStats.distanceFactor.avg = debugStats.distanceFactor.sum / debugStats.distanceFactor.count;
  }
  
  if (debugStats.rawDistanceX.count > 0) {
    debugStats.rawDistanceX.avg = debugStats.rawDistanceX.sum / debugStats.rawDistanceX.count;
  }
  
  // Display extreme positions
  document.getElementById('extremePositions').innerHTML = `
    <h4>Extreme Positions:</h4>
    <p>Left: x=${extremePositions.left.x.toFixed(2)}, distance=${extremePositions.left.distance.toFixed(2)}, darkness=${extremePositions.left.darkness.toFixed(2)}</p>
    <p>Right: x=${extremePositions.right.x.toFixed(2)}, distance=${extremePositions.right.distance.toFixed(2)}, darkness=${extremePositions.right.darkness.toFixed(2)}</p>
    <p>Front: z=${extremePositions.front.z.toFixed(2)}, distance=${extremePositions.front.distance.toFixed(2)}, darkness=${extremePositions.front.darkness.toFixed(2)}</p>
    <p>Back: z=${extremePositions.back.z.toFixed(2)}, distance=${extremePositions.back.distance.toFixed(2)}, darkness=${extremePositions.back.darkness.toFixed(2)}</p>
    <hr>
    <p>Position X range: ${debugStats.positions.x.min.toFixed(2)} to ${debugStats.positions.x.max.toFixed(2)}</p>
    <p>Model X range: ${debugStats.modelPositions.x.min.toFixed(2)} to ${debugStats.modelPositions.x.max.toFixed(2)}</p>
    <p>Raw distance range: ${debugStats.rawDistanceX.min.toFixed(2)} to ${debugStats.rawDistanceX.max.toFixed(2)} (avg: ${debugStats.rawDistanceX.avg.toFixed(2)})</p>
    <p>Distance factor range: ${debugStats.distanceFactor.min.toFixed(2)} to ${debugStats.distanceFactor.max.toFixed(2)} (avg: ${debugStats.distanceFactor.avg.toFixed(2)})</p>
  `;
  
  console.log("Debug stats captured:", debugStats);
  console.log("Extreme positions:", extremePositions);
}

// Add event listeners for debug interface
document.getElementById('toggleDebug').addEventListener('click', function() {
  debugMode = !debugMode;
  document.getElementById('debugOverlay').style.display = debugMode ? 'block' : 'none';
  this.innerText = debugMode ? "Hide Debug" : "Show Debug";
});

document.getElementById('captureStats').addEventListener('click', function() {
  captureVertexStats();
});

// Add after the debug overlay HTML insertion
document.body.insertAdjacentHTML('beforeend', `
<canvas id="darknessVisualizer" style="position: fixed; bottom: 10px; right: 10px; width: 200px; height: 200px; background: rgba(0,0,0,0.8); display: none;"></canvas>
`);

// Add new function for darkness visualization
function updateDarknessVisualizer() {
  if (!debugMode || !particles) return;
  
  const canvas = document.getElementById('darknessVisualizer');
  if (!canvas) return;
  
  // Show the canvas when in debug mode
  canvas.style.display = 'block';
  
  const ctx = canvas.getContext('2d');
  const width = 200;
  const height = 200;
  
  // Set actual canvas dimensions (not just CSS dimensions)
  canvas.width = width;
  canvas.height = height;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw background
  ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
  ctx.fillRect(0, 0, width, height);
  
  // Draw grid lines
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
  ctx.lineWidth = 0.5;
  
  // Vertical grid lines
  for (let x = 0; x <= width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Horizontal grid lines
  for (let y = 0; y <= height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Draw distance rings around camera
  const cameraX = (0.8 + 2) / 4 * width; // Camera X position in canvas
  const cameraZ = (0 + 2) / 4 * height;  // Camera Z position in canvas
  
  // Draw distance rings (3D distances from camera)
  const ringRadii = [1, 2, 3, 4, 5]; // Distances in world units
  ctx.strokeStyle = 'rgba(80, 80, 255, 0.3)';
  
  for (const radius of ringRadii) {
    // Convert world distance to canvas pixels
    const canvasRadius = radius / 5 * width / 2;
    
    ctx.beginPath();
    ctx.arc(cameraX, cameraZ, canvasRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Add distance label
    ctx.fillStyle = 'rgba(150, 150, 255, 0.7)';
    ctx.font = '8px Arial';
    ctx.fillText(`${radius}u`, cameraX + canvasRadius - 10, cameraZ);
  }
  
  // Calculate world matrix for position transformations
  particles.updateMatrixWorld();
  const worldMatrix = particles.matrixWorld.clone();
  
  // Get position attribute
  const positionAttribute = particles.geometry.getAttribute('position');
  const particleCount = Math.min(positionAttribute.count, 500); // Limit to 500 for performance
  
  // Sample particles to visualize darkness
  for (let i = 0; i < particleCount; i += 5) { // Sample every 5th particle
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);
    
    // Calculate model position (world space)
    const position = new THREE.Vector3(x, y, z);
    const modelPosition = position.clone().applyMatrix4(worldMatrix);
    
    // Calculate distance using our 3D method
    const cameraPosition = new THREE.Vector3(0.8, 0.2, 3.5);
    const dx = cameraPosition.x - modelPosition.x;
    const dy = cameraPosition.y - modelPosition.y;
    const dz = cameraPosition.z - modelPosition.z;
    const distanceToCamera = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const normalizedDistance = Math.min(Math.max(distanceToCamera / 5.0, 0.0), 1.0);
    const distanceFactor = Math.pow(normalizedDistance, 1.2);
    
    // Calculate darkness level
    const baseDistanceDarkness = distanceFactor * distanceFactor * distanceDarknessFactor;
    
    // Map particle position to canvas position (top-down view)
    const canvasX = (modelPosition.x + 2) / 4 * width; // Map from -2,2 to 0,width
    const canvasZ = (modelPosition.z + 2) / 4 * height; // Map from -2,2 to 0,height
    
    // Calculate color based on darkness level
    const darkness = baseDistanceDarkness;
    const color = Math.floor((1 - darkness) * 255);
    
    // Draw particle with color representing darkness
    ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
    ctx.beginPath();
    ctx.arc(canvasX, canvasZ, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw line from camera to particle for a few particles
    if (i % 50 === 0) {
      ctx.strokeStyle = `rgba(255, 255, 0, 0.2)`;
      ctx.beginPath();
      ctx.moveTo(cameraX, cameraZ);
      ctx.lineTo(canvasX, canvasZ);
      ctx.stroke();
      
      // Show actual distance for these highlighted particles
      ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
      ctx.font = '7px Arial';
      const midX = (cameraX + canvasX) / 2;
      const midZ = (cameraZ + canvasZ) / 2;
      ctx.fillText(`${distanceToCamera.toFixed(1)}`, midX, midZ);
    }
  }
  
  // Draw camera position
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(cameraX, cameraZ, 5, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw camera frustum
  const fov = 30 * (Math.PI / 180); // 30 degrees FOV
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.5; // Near plane distance
  const far = 5.0;  // Far plane distance
  
  // Draw frustum lines
  ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
  ctx.lineWidth = 1;
  
  // Calculate frustum width at near and far planes
  const nearHeight = 2 * Math.tan(fov / 2) * near;
  const nearWidth = nearHeight * aspect;
  const farHeight = 2 * Math.tan(fov / 2) * far;
  const farWidth = farHeight * aspect;
  
  // Convert to canvas coordinates (adjusted for top-down view)
  const nearLeft = cameraX - (nearWidth / 2) / 4 * width;
  const nearRight = cameraX + (nearWidth / 2) / 4 * width;
  const farLeft = cameraX - (farWidth / 2) / 4 * width;
  const farRight = cameraX + (farWidth / 2) / 4 * width;
  
  const nearZ = cameraZ - near / 4 * height;
  const farZ = cameraZ - far / 4 * height;
  
  // Draw the frustum lines
  ctx.beginPath();
  ctx.moveTo(cameraX, cameraZ); // Start at camera
  ctx.lineTo(nearLeft, nearZ);  // Left edge of near plane
  ctx.lineTo(farLeft, farZ);    // Left edge of far plane
  ctx.lineTo(farRight, farZ);   // Bottom edge of far plane
  ctx.lineTo(nearRight, nearZ); // Right edge of near plane
  ctx.closePath();              // Back to camera
  ctx.stroke();
  
  // Add labels
  ctx.fillStyle = 'white';
  ctx.font = '10px Arial';
  ctx.fillText('Top-Down View (XZ Plane)', 10, 12);
  ctx.fillText('Red: Camera', 10, 24);
  ctx.fillText('Blue rings: 3D distance', 10, 36);
  ctx.fillText('Yellow lines: Sample rays', 10, 48);
  ctx.fillText('White→Black: No→Full darkness', 10, 60);
}