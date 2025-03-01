import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Global configuration
const waveSpeed = 0.5; // Controls the speed of wave animations (higher = faster)

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
    attribute vec3 aPositionTarget;
    attribute float aSize;
    attribute vec3 aColor;
    varying vec3 vColor;

    ${document.querySelector("#noise").textContent}

    void main() {
        // Generate noise values for staggered animation
        float noiseOrigin = simplexNoise3d(position * 0.2);
        float noiseTarget = simplexNoise3d(aPositionTarget * 0.2);
        float noise = mix(noiseOrigin, noiseTarget, uProgress);
        noise = smoothstep(-1.0, 1.0, noise);
        
        // Calculate animation timing parameters
        float duration = 0.4;
        // Adjust delay to create a more staggered appearance
        float delay = (1.0 - duration) * noise * 1.2; // Slightly extended delay range for more staggering
        float end = delay + duration;
        
        // Animate initial position with random 45-degree waves based on time
        vec3 animatedPosition = position;
        if (uProgress < 0.5) {
            // Calculate wave factor with smoother fade-out
            float waveFactor = 1.0 - (uProgress / 0.5);
            waveFactor = smoothstep(0.0, 1.0, waveFactor);
            
            // Create more random and varied wave patterns
            float timeOffset = position.x * 2.0 + position.z * 2.0; // 45-degree direction
            float noise1 = simplexNoise3d(vec3(position.xz * 1.5, uTime * 0.2 * uWaveSpeed)) * 0.1;
            float noise2 = simplexNoise3d(vec3(position.zx * 0.8, uTime * 0.3 * uWaveSpeed + 100.0)) * 0.08;
            
            // Create diagonal movement (45 degrees)
            float diagonalWave = sin(timeOffset + uTime * 1.5 * uWaveSpeed) * 0.04;
            
            // Apply the waves in diagonal pattern (45 degrees)
            // animatedPosition.x += (diagonalWave + noise1) * waveFactor;
            animatedPosition.y += (noise2 - diagonalWave) * waveFactor;
            animatedPosition.z += (noise1 + diagonalWave * 0.5) * waveFactor;
        }
        
        // Calculate assembly progress with staggered timing
        float assemblyProgress = smoothstep(delay, end, uProgress);
        vec3 finalPosition = mix(animatedPosition, aPositionTarget, assemblyProgress);

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
 * With color intensity capped to avoid white highlights
 */
const fragmentShader = `
    varying vec3 vColor;
    
    // Maximum color value to prevent white highlights from additive blending
    const vec3 maxColor = vec3(0.7, 0.95, 1.0); // Higher blue limit for more vibrant particles
    
    void main() {
        // Calculate distance from center of point sprite
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        
        // Create circular shape with enhanced glow at edges
        float circle = smoothstep(0.5, 0.32, dist); 
        
        // Add a subtle inner glow
        float innerGlow = smoothstep(0.1, 0.3, dist) * 0.5;
        circle += innerGlow * (1.0 - circle);
        
        // Clamp the color to the maximum allowed value
        vec3 clampedColor = min(vColor, maxColor);
        
        // Output final color with alpha mask
        gl_FragColor = vec4(clampedColor, circle);
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

// Add axis helpers to visualize the coordinate system
// Red = X axis, Green = Y axis, Blue = Z axis
const axesHelper = new THREE.AxesHelper(3); // Increased size of the helper lines
axesHelper.position.set(0, 0, 0); // Ensure it's at the origin
scene.add(axesHelper);

// Add a grid helper to better understand the ground plane
const gridHelper = new THREE.GridHelper(5, 20, 0xffffff, 0x888888); // Increased size and brightness
gridHelper.position.y = -0.5; // Move down slightly to not overlap with axes
scene.add(gridHelper);

// Add text labels for the axes with improved visibility
function createTextLabel(text, position, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 128;
  
  // Draw text with better contrast
  context.fillStyle = 'rgba(255, 255, 255, 0.2)'; // Lighter background
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#000000';
  context.lineWidth = 4;
  context.strokeRect(0, 0, canvas.width, canvas.height);
  
  context.font = 'bold 70px Arial';
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Create texture
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(1.0, 0.5, 1); // Doubled size for better visibility
  return sprite;
}

// Create and add axis labels with increased distance
const xLabel = createTextLabel('X', new THREE.Vector3(3.5, 0, 0), '#ff0000');
const yLabel = createTextLabel('Y', new THREE.Vector3(0, 3.5, 0), '#00ff00');
const zLabel = createTextLabel('Z', new THREE.Vector3(0, 0, 3.5), '#0000ff');

// Add visible, solid arrows to reinforce the axes
function createArrow(direction, color) {
  const arrowLength = 3;
  const headLength = 0.4;
  const headWidth = 0.3;
  
  const dir = new THREE.Vector3().copy(direction).normalize();
  const origin = new THREE.Vector3(0, 0, 0);
  
  const arrow = new THREE.ArrowHelper(dir, origin, arrowLength, color, headLength, headWidth);
  return arrow;
}

const xArrow = createArrow(new THREE.Vector3(1, 0, 0), 0xff0000);
const yArrow = createArrow(new THREE.Vector3(0, 1, 0), 0x00ff00);
const zArrow = createArrow(new THREE.Vector3(0, 0, 1), 0x0000ff);

scene.add(xArrow);
scene.add(yArrow);
scene.add(zArrow);
scene.add(xLabel);
scene.add(yLabel);
scene.add(zLabel);

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

// Renderer configuration
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(sceneSize.width, sceneSize.height);
renderer.setPixelRatio(sceneSize.pixelRatio);
renderer.setClearColor("#000000");

// Orbit controls for camera interaction
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enabled = true;
controls.autoRotate = false; // Disable auto-rotation
controls.autoRotateSpeed = 0.5;
controls.enableZoom = true;
controls.minDistance = 2;
controls.maxDistance = 10;
controls.enablePan = true;
controls.dampingFactor = 0.1;
controls.rotateSpeed = 1.0;
controls.zoomSpeed = 1.2;
controls.target.set(0, 0, 0);
controls.update();

// Particles system variables
let particles = null;
const particlesCount = 2754;
const positions = new Float32Array(particlesCount * 3);
const particleSizes = new Float32Array(particlesCount);

/**
 * Initial particle positions arranged in a grid pattern
 * Creates a wave-like pattern as starting position before animation
 */
const gridSize = Math.ceil(Math.sqrt(particlesCount)); // Calculate grid dimensions
for (let i = 0; i < particlesCount; i++) {
    const i3 = i * 3;
    
    // Calculate grid positions
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    
    // Convert grid coordinates to world space (-1 to 1 range)
    const x = (col / gridSize - 0.5) * 2;
    const z = (row / gridSize - 0.5) * 10;
    
    // Add wave effect to y coordinate
    const y = Math.sin(x * Math.PI - Math.PI/2) * 0.2 + z * 0.2;

    // Store position
    positions[i3] = x;
    positions[i3 + 1] = y - 0.2;
    positions[i3 + 2] = z + 2.7;

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
  console.log({targetVertexCount});

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

    // Calculate variable particle sizes - larger in the center, smaller at edges
    const normalizedPos = i / adjustedCount;
    const sizeVariation = Math.sin(normalizedPos * Math.PI); // Creates a curve: small->big->small
    const randomFactor = 0.8 + Math.random() * 0.4; // Random variation between 0.8 and 1.2
    adjustedSizes[i] = 1; // Using uniform size for all particles

    // Calculate color gradient from darker to lighter blue
    // Target X model's center is approximately at (0,0,0)
    // Calculate distance from center to determine color (edges brighter, center darker)
    const posX = adjustedTargetPositions[i3];
    const posY = adjustedTargetPositions[i3 + 1];
    const posZ = adjustedTargetPositions[i3 + 2];
    
    // Calculate distance from center (0,0,0)
    const distFromCenter = Math.sqrt(posX * posX + posY * posY + posZ * posZ);
    
    // Find the farthest distance to normalize against
    const maxDistance = 1.0;  
    
    // Create a different distance metric that emphasizes edges more consistently
    // This calculation creates a more uniform edge highlighting effect
    // We want particles on the outer edges of the X to be bright, regardless of absolute distance
    
    // Calculate distance from the "skeleton" line of the X - approximate by finding distance to origin plane
    // This makes points farther from the center line of the X brighter
    const distFromCenterLine = Math.abs(posY);
    
    // Combine with absolute distance for a more uniform edge highlighting
    const edgeFactor = Math.max(
      distFromCenter / maxDistance,
      distFromCenterLine / 0.3  // Emphasize edges based on distance from central axis
    );
    
    // Apply curve and clamp
    let normalizedDist = Math.min(edgeFactor, 1.0);
    normalizedDist = Math.pow(normalizedDist, 0.7); // Adjust power curve
    
    // Create color gradient based on distance from center
    // Outer edges (normalizedDist = 1.0) will be bright blue
    // Center (normalizedDist = 0.0) will be darker blue
    const brightBlue = new THREE.Color("#a8ecff"); // Brighter cyan-blue for edges
    const darkBlue = new THREE.Color("#0045cc");   // Richer dark blue for center
    
    const color = new THREE.Color().lerpColors(darkBlue, brightBlue, normalizedDist);
    
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
      uSize: { value: 0.025 }, // Increased particle size for better visibility
      uProgress: { value: 0.0 }, // Animation progress (0-1)
      uResolution: {
        value: new THREE.Vector2(
          sceneSize.width * sceneSize.pixelRatio,
          sceneSize.height * sceneSize.pixelRatio
        ),
      },
      uTime: { value: 0.0 },
      uWaveSpeed: { value: waveSpeed } // Use the global wave speed variable
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, // Additive blending for glow effect
  });

  // Create and add points mesh to scene
  particles = new THREE.Points(geometry, material);
  particles.geometry.setIndex(null);
  
  // Add a slight scale adjustment to make the X shape more distinctive
  particles.scale.set(1.1, 1.0, 1.0);
  
  scene.add(particles);
}

/**
 * Scroll event handler
 * Updates animation progress based on scroll position
 */
let scrollY = window.scrollY;
let currentSection = 0;

window.addEventListener("scroll", () => {
  scrollY = window.scrollY;
  const newSection = Math.round(scrollY / sceneSize.height);

  if (currentSection !== newSection) {
    currentSection = newSection;
  }

  // Calculate progress percentage (0-100)
  const progress =
    (scrollY / (document.documentElement.scrollHeight - window.innerHeight)) *
    100;
  
  // Update progress display in the UI
  const scrollPercentage = Math.round(progress);
  document.querySelector(".scrollProgress").textContent = `${scrollPercentage}%`;
  
  // Update debug info with more precise percentage including decimal point
  const scrollProgressPrecise = progress.toFixed(1);
  document.querySelector(".scrollProgressPrecise").textContent = 
    `Scroll: ${scrollProgressPrecise}% | Rotation: ${progress >= 20 ? 'active' : 'inactive'}`;

  // Update particle animation progress (0-1)
  if (particles) {
    particles.material.uniforms.uProgress.value = progress / 100;
    
    // Create a smoother easing with a blend between the two phases
    let easedProgress;
    
    // Apply a gradual rotation that builds up throughout the scroll
    if (progress >= 20) { // Start at 20% scroll
      // Normalize progress to 0-1 range for the whole animation (20%-100%)
      const normalizedProgress = (progress - 20) / 80;
      
      // Split Y rotation into two phases:
      // Phase 1 (20-80%): Slow build to ~10 degrees
      // Phase 2 (80-100%): Accelerated motion to 20 degrees
      
      let yEasedProgress;
      
      if (progress < 80) {
        // Phase 1: Normalize to 0-1 range for 20-80% scroll
        const phase1Progress = (progress - 20) / 60; // 0-1 within phase 1
        
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
        // This creates a continuity with the Y rotation animation
        xRotationProgress = Math.min(1.0, Math.max(0, xRotationProgress));
      }
      
      // Calculate max rotation values
      const maxRotationX = -5 * (Math.PI / 180); // 5 degrees in radians
      const maxRotationY = 20 * (Math.PI / 180); // 20 degrees in radians (increased from 19)
      const maxRotationZ = 0; // Keep Z rotation at 0
      
      // Apply gradual rotation
      particles.rotation.x = maxRotationX * xRotationProgress; // X rotation starts at 80%
      particles.rotation.y = maxRotationY * easedProgress; // Y rotation with main easing curve
      particles.rotation.z = 0; // Z rotation fixed at 0
      
      // Display rotation values in degrees for better readability
      const rotX = (particles.rotation.x * 180 / Math.PI).toFixed(1);
      const rotY = (particles.rotation.y * 180 / Math.PI).toFixed(1);
      const rotZ = 0.0; // Z rotation is fixed at 0
      
      // Update rotation indicators with colored highlighting
      document.querySelector(".scrollProgressPrecise").innerHTML = 
        `Scroll: ${scrollProgressPrecise}% | Rotation: active<br>` +
        `X: <span class="rot-x">${rotX}°</span> ` +
        `Y: <span class="rot-y">${rotY}°</span> ` +
        `Z: <span class="rot-z">${rotZ}°</span>`;
    } else {
      // Reset rotation when below start threshold
      particles.rotation.x = 0;
      particles.rotation.y = 0;
      particles.rotation.z = 0;
      
      // Update rotation indicators when inactive
      document.querySelector(".scrollProgressPrecise").innerHTML = 
        `Scroll: ${scrollProgressPrecise}% | Rotation: inactive<br>` +
        `X: <span class="rot-x">0.0°</span> ` +
        `Y: <span class="rot-y">0.0°</span> ` +
        `Z: <span class="rot-z">0.0°</span>`;
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
    
    // No additional rotation logic here - all handled in scroll event
  }

  // Update orbit controls (handles damping)
  controls.update();

  // Render the scene
  renderer.render(scene, camera);
}

// Start animation loop
animate();

/**
 * Window resize handler
 * Updates all size-dependent variables and objects
 */
window.addEventListener("resize", () => {
  // Update size variables
  sceneSize.width = window.innerWidth;
  sceneSize.height = window.innerHeight;
  sceneSize.pixelRatio = Math.min(window.devicePixelRatio, 2);

  // Update camera aspect ratio
  camera.aspect = sceneSize.width / sceneSize.height;
  camera.updateProjectionMatrix();

  // Update renderer size
  renderer.setSize(sceneSize.width, sceneSize.height);
  renderer.setPixelRatio(sceneSize.pixelRatio);

  // Update particle shader uniforms
  if (particles) {
    particles.material.uniforms.uResolution.value.set(
      sceneSize.width * sceneSize.pixelRatio,
      sceneSize.height * sceneSize.pixelRatio
    );
  }
});
