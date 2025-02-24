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
        float delay = (1.0 - duration) * noise;
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
            //animatedPosition.x += (diagonalWave + noise1) * waveFactor;
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
    const vec3 maxColor = vec3(0.267, 0.733, 0.984); // #44bbfb #37FAFF
    
    void main() {
        // Calculate distance from center of point sprite
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        
        // Create circular shape with sharp edges
        float circle = step(dist, 0.5);
        
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
camera.position.set(0, 0, 4);

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
controls.autoRotate = false;
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

    // Calculate variable particle sizes - larger in the center, smaller at edges
    const normalizedPos = i / adjustedCount;
    const sizeVariation = Math.sin(normalizedPos * Math.PI); // Creates a curve: small->big->small
    const randomFactor = 0.8 + Math.random() * 0.4; // Random variation between 0.8 and 1.2
    adjustedSizes[i] = 1; // Using uniform size for all particles

    // Create color gradient from darker to lighter blue
    const lightBlue = new THREE.Color("#004080");//59c1ff
    const darkBlue = new THREE.Color("#007fff"); //004080
    const t = i / adjustedCount;
    const color = new THREE.Color().lerpColors(darkBlue, lightBlue, t);
    
    // Store color components
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    // Copy target positions directly from the X model
    adjustedTargetPositions[i3] = xShape.array[i3];
    adjustedTargetPositions[i3 + 1] = xShape.array[i3 + 1];
    adjustedTargetPositions[i3 + 2] = xShape.array[i3 + 2];
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
      uSize: { value: 0.015 }, // Base particle size
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
  particles.geometry.setIndex(null)
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
  document.querySelector(".scrollProgress").textContent = `${Math.round(
    progress
  )}%`;

  // Update particle animation progress (0-1)
  if (particles) {
    particles.material.uniforms.uProgress.value = progress / 100;
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
