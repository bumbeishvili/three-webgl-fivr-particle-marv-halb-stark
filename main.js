import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";



// Global configuration
const waveSpeed = 0.5; // Controls the speed of wave animations (higher = faster)
let waveOffsetX = -0.45; // Master X offset value
let waveOffsetY = -0.15; // Master Y offset value 
let waveOffsetZ = -2.20; // Master Z offset value
let waveRotationX = -5.73 * (Math.PI / 180); // Controls the X rotation of the wave pattern (radians)
let waveRotationY = 5.73 * (Math.PI / 180); // Controls the Y rotation of the wave pattern (radians)
let waveRotationZ = 0.0; // Controls the Z rotation of the wave pattern (radians)

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
    uniform float uTime;
    uniform float uWaveSpeed;
    uniform float uWaveOffsetX;
    uniform float uWaveOffsetY;
    uniform float uWaveOffsetZ;
    uniform float uWaveRotationX;
    uniform float uWaveRotationY;
    uniform float uWaveRotationZ;
    attribute vec3 aPositionTarget;
    attribute float aSize;
    attribute vec3 aColor;
    varying vec3 vColor;

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
        
        // Create two animated positions - one for the wave and one for the transition to X shape
        vec3 wavePosition = position;
        
        // Create a wider transition zone (35%-65%) for smoother wave fadeout
        // Use different smoothstep ranges for different effects to stagger the transitions
        float waveTransitionFactor = 1.0 - smoothstep(0.35, 0.65, uProgress);
        
        // Calculate the wave position with full animation
        if (waveTransitionFactor > 0.001) {
            // Calculate wave factor with smoother fade-out
            float waveFactor = smoothstep(0.0, 1.0, waveTransitionFactor);
            
            // Create more random and varied wave patterns
            float timeOffset = (position.x + uWaveOffsetX) * 2.5 + (position.z + uWaveOffsetZ) * 2.5; // Increased from 2.0 to 2.5 for compact waves
            
            // Apply offsets directly to the noise patterns for stronger effect
            float noise1 = simplexNoise3d(vec3((position.xz + vec2(uWaveOffsetX, uWaveOffsetZ)) * 2.0, uTime * 0.2 * uWaveSpeed)) * 0.08; // Increased scale from 1.5 to 2.0, reduced amplitude from 0.1 to 0.08
            float noise2 = simplexNoise3d(vec3((position.zx + vec2(uWaveOffsetZ, uWaveOffsetX)) * 1.2, uTime * 0.3 * uWaveSpeed + 100.0)) * 0.06; // Increased scale from 0.8 to 1.2, reduced amplitude from 0.08 to 0.06
            
            // Create diagonal movement (45 degrees)
            float diagonalWave = sin(timeOffset + uTime * 1.5 * uWaveSpeed) * 0.03; // Reduced from 0.04 to 0.03 for more compact waves
            
            // Apply the waves in diagonal pattern (45 degrees) with offsets
            // Use waveFactor 1.0 for offsets to make them more apparent
            wavePosition.y += (noise2 - diagonalWave) * waveFactor + uWaveOffsetY; // Apply Y offset more directly
            wavePosition.z += (noise1 + diagonalWave * 0.5) * waveFactor + uWaveOffsetZ; // Apply Z offset more directly
            wavePosition.x += uWaveOffsetX; // Apply X offset directly without waveFactor
            
            // Apply rotation to the wave pattern
            mat3 rotMatrix = rotateZ(uWaveRotationZ) * rotateY(uWaveRotationY) * rotateX(uWaveRotationX);
            wavePosition = rotMatrix * wavePosition;
        }

        // Calculate the target position for X shape
        vec3 targetPosition = aPositionTarget;
        
        // Calculate assembly progress with staggered timing
        float assemblyProgress = smoothstep(delay, end, uProgress);
        
        // Gradually blend between wave and direct position when transitioning to the X
        // This creates a smooth handoff between the wave animation and the X shape
        float positionBlendFactor = smoothstep(0.4, 0.6, uProgress);
        
        // Create a smooth transition between the original position, wave, and final X shape
        // The key factor is making sure there's a continuous blend between EACH stage
        vec3 animatedPosition;
        
        if (uProgress < 0.4) {
            // Before 40%, blend between original position and wave animation
            animatedPosition = wavePosition;
        } else if (uProgress < 0.6) {
            // Between 40% and 60%, smoothly blend between wave and direct position
            // This creates a continuous transition between wave animation and assembly
            float localBlend = (uProgress - 0.4) / 0.2; // 0 to 1 range
            float smoothLocalBlend = smoothstep(0.0, 1.0, localBlend);
            
            // Interpolate between wave position and position (without wave effects)
            animatedPosition = mix(wavePosition, position, smoothLocalBlend);
        } else {
            // After 60%, use the direct position for assembly to X shape
            animatedPosition = position;
        }
        
        // Finally blend to target position (X shape) based on progress
        vec3 finalPosition = mix(animatedPosition, targetPosition, assemblyProgress);
        
        // Standard projection matrix transformations
        vec4 modelPosition = modelMatrix * vec4(finalPosition, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectedPosition = projectionMatrix * viewPosition;
        gl_Position = projectedPosition;

        // Calculate point size with perspective scaling
        gl_PointSize = aSize * uSize * uResolution.y;
        gl_PointSize *= (1.0 / - viewPosition.z);

        // Pass color to fragment shader
        vColor = aColor;
    }
`;

/**
 * Fragment shader creates circular particles with the vertex color
 * Using step function for a hard edge circular shape
 * With dynamic blending transition from additive (wave) to normal (X shape)
 */
const fragmentShader = `
    varying vec3 vColor;
    uniform float uProgress; // Animation progress uniform
    uniform float uBlendTransition; // Dedicated uniform for blend transition
    
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
        
        // Control opacity based on blending mode
        // Lower opacity for additive blending (starting state)
        // Higher opacity for normal blending (end state)
        float alpha = mix(0.4, 0.9, blendFactor) * circle;
        
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
    console.log("Reset wave parameters to master values");
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
    const x = (col / gridSize - 0.5) * waveWidthFactor; // Horizontal spread controlled by width factor
    const z = (row / gridSize - 0.5) * waveDepthFactor; // Depth spread controlled by depth factor
    
    // Create a U-shaped wave effect:
    // 1. Base sine wave for the primary undulation
    // 2. Parabolic component for the U-shape (x^2 term)
    // This creates higher sides and a lower middle section
    const parabolicFactor = 0.25; // Increased from 0.2 to 0.25 to maintain U shape with compressed x range
    
    // IMPORTANT: Calculate wave without the offsets - offsets will be applied in the shader
    const baseSineWave = Math.sin(x * Math.PI - Math.PI/2) * 0.18; // Slightly reduced amplitude
    const uShapeComponent = parabolicFactor * (x * x * 2.0); // Parabolic U shape based on x position
    
    // Combine the wave components and add z influence for depth variation without offsets
    const y = baseSineWave + uShapeComponent + z * 0.15; // Reduced z influence (from 0.2 to 0.15)

    // Apply rotation around Y-axis by approximately -16 degrees (negative for proper orientation)
    const rotationAngle = -16 * (Math.PI / 180); // Convert to radians
    const cosY = Math.cos(rotationAngle);
    const sinY = Math.sin(rotationAngle);
    
    // Apply Y-axis rotation to x and z coordinates (without offsets)
    // Using the configurable Z offset parameter to position the wave in front of camera
    const rotatedX = x * cosY - (z + waveZOffset) * sinY; 
    const rotatedZ = x * sinY + (z + waveZOffset) * cosY;
    
    // Store position with rotation applied (but no offsets)
    positions[i3] = rotatedX;
    positions[i3 + 1] = y - 0.2; // Maintain same vertical offset
    positions[i3 + 2] = rotatedZ; // Use rotated Z coordinate
    
    particleSizes[i] = 1;
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
  const colors = new Float32Array(adjustedCount * 3);
  const adjustedTargetPositions = new Float32Array(adjustedCount * 3);

  // Copy data to the adjusted arrays
  for (let i = 0; i < adjustedCount; i++) {
    const i3 = i * 3;

    // Copy positions from initial grid setup
    adjustedPositions[i3] = positions[i3];
    adjustedPositions[i3 + 1] = positions[i3 + 1];
    adjustedPositions[i3 + 2] = positions[i3 + 2];

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
    
    adjustedSizes[i] = particleSize;
    
    // COLOR CALCULATION - GRADIENT FOR FRONT FACE
    // Dark blue for back particles and front center
    const darkBlue = new THREE.Color("#0452D5");
    
    // Light blue for front corners/ends
    const lightBlue = new THREE.Color("#63BEF4");
    
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
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

  // Create shader material with uniforms
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uSize: { value: 0.026 }, // Base size multiplier
      uProgress: { value: 0.0 }, 
      uBlendTransition: { value: 0.0 }, // Blend transition uniform
      uResolution: {
        value: new THREE.Vector2(
          sceneSize.width * sceneSize.pixelRatio,
          sceneSize.height * sceneSize.pixelRatio
        ),
      },
      uTime: { value: 0.0 },
      uWaveSpeed: { value: waveSpeed },
      // Use the master offset values for initialization
      uWaveOffsetX: { value: waveOffsetX },
      uWaveOffsetY: { value: waveOffsetY },
      uWaveOffsetZ: { value: waveOffsetZ },
      uWaveRotationX: { value: waveRotationX },
      uWaveRotationY: { value: waveRotationY },
      uWaveRotationZ: { value: waveRotationZ }
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
let scrollY = window.scrollY;

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
function animate() {
  requestAnimationFrame(animate);

  // Update time for wave animation
  if (particles) {
    particles.material.uniforms.uTime.value += 0.01;
  }
  
  // Update camera helper if it's visible
  if (cameraHelper.visible) {
    cameraHelper.update();
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
      `${controlsInfo}<br>${densityControls}`;
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
      `${controlsInfo}<br>${densityControls}`;
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
  const currentTime = particles.material.uniforms.uTime.value;
  const currentBlending = particles.material.blending;
  const currentDepthWrite = particles.material.depthWrite;
  
  // Get existing geometry and attributes
  const geometry = particles.geometry;
  const positionAttribute = geometry.getAttribute('position');
  const positions = positionAttribute.array;
  
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
    
    // Create a U-shaped wave effect
    const parabolicFactor = 0.25;
    const baseSineWave = Math.sin(x * Math.PI - Math.PI/2) * 0.18;
    const uShapeComponent = parabolicFactor * (x * x * 2.0);
    
    // Combine the wave components
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
  
  // Update the position attribute
  positionAttribute.needsUpdate = true;
  
  // Restore animation state
  particles.material.uniforms.uProgress.value = currentProgress;
  particles.material.uniforms.uBlendTransition.value = currentBlendTransition;
  particles.material.uniforms.uTime.value = currentTime;
  particles.material.blending = currentBlending;
  particles.material.depthWrite = currentDepthWrite;
}