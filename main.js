import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Vertex and fragment shader code
const vertexShader = `
    uniform vec2 uResolution;
    uniform float uSize;
    uniform float uProgress;
    attribute vec3 aPositionTarget;
    attribute float aSize;
    attribute vec3 aColor;
    varying vec3 vColor;

    ${document.querySelector("#noise").textContent}

    mat4 rotationY(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat4(
            c, 0.0, s, 0.0,
            0.0, 1.0, 0.0, 0.0,
            s, 0.0, c, 0.0,
            0.0, 0.0, 0.0, 1.0
        );
    }

    void main() {
        float noiseOrigin = simplexNoise3d(position * 0.2);
        float noiseTarget = simplexNoise3d(aPositionTarget * 0.2);
        float noise = mix(noiseOrigin, noiseTarget, uProgress);
        noise = smoothstep(-1.0, 1.0, noise);
        
        float duration = 0.4;
        float delay = (1.0 - duration) * noise;
        float end = delay + duration;
        
        // Assembly phase (0-90%)
        float assemblyProgress = smoothstep(delay, end, min(uProgress / 0.9, 1.0));
        vec3 assembledPosition = mix(position, aPositionTarget, assemblyProgress);
        
        // Rotation phase (90-100%)
        float rotationProgress = smoothstep(0.6, 1.0, uProgress);
        float rotationAngle = rotationProgress * radians(-10.0);
        
        vec3 finalPosition = assembledPosition;
        if (uProgress > 0.6) {
            finalPosition = (rotationY(rotationAngle) * vec4(assembledPosition, 1.0)).xyz;
        }

        vec4 modelPosition = modelMatrix * vec4(finalPosition, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectedPosition = projectionMatrix * viewPosition;
        gl_Position = projectedPosition;

        gl_PointSize = aSize * uSize * uResolution.y;
        gl_PointSize *= (1.0 / - viewPosition.z);

        vColor = aColor;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        float circle = step(dist, 0.5);
        gl_FragColor = vec4(vColor, circle);
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

// Camera
const camera = new THREE.PerspectiveCamera(
  30,
  sceneSize.width / sceneSize.height,
  0.1,
  100
);
camera.position.set(1, 0, 4);

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(sceneSize.width, sceneSize.height);
renderer.setPixelRatio(sceneSize.pixelRatio);
renderer.setClearColor("#000000");

// Controls
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

// Particles
let particles = null;
const particlesCount = 2754 * 2;
const positions = new Float32Array(particlesCount * 3);
const particleSizes = new Float32Array(particlesCount);

// Create wave shape
for (let i = 0; i < particlesCount; i++) {
  const i3 = i * 3;
  const x = (Math.random() - 0.5) * 2;
  const y = Math.sin(x * Math.PI) * 0.5;
  const z = (Math.random() - 0.5) * 0.5;

  positions[i3] = x;
  positions[i3 + 1] = y;
  positions[i3 + 2] = z;

  particleSizes[i] = 1;
}

// Load X model
const loader = new GLTFLoader();
let xShape;
loader.load("./x.glb", (gltf) => {
  xShape = gltf.scene.children[0].geometry.attributes.position;
  initParticles();
});

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

  // Copy data to the adjusted arrays
  for (let i = 0; i < adjustedCount; i++) {
    const i3 = i * 3;

    // Copy positions
    adjustedPositions[i3] = positions[i3];
    adjustedPositions[i3 + 1] = positions[i3 + 1];
    adjustedPositions[i3 + 2] = positions[i3 + 2];

    // Variable particle sizes - larger in the center, smaller at edges
    const normalizedPos = i / adjustedCount;
    const sizeVariation = Math.sin(normalizedPos * Math.PI); // Creates a curve: small->big->small
    const randomFactor = 0.8 + Math.random() * 0.4; // Random variation between 0.8 and 1.2
    adjustedSizes[i] = (0.8 + sizeVariation * 0.4) * randomFactor;

    // Set colors - create a gradient from light to darker blue
    const lightBlue = new THREE.Color("#59c1ff");
    const darkBlue = new THREE.Color("#004080");
    const t = i / adjustedCount;
    const color = new THREE.Color().lerpColors(darkBlue, lightBlue, t);
    
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  // Create adjusted and scaled target positions array
  const adjustedTargetPositions = new Float32Array(adjustedCount * 3);
  const scale = 0.015;

  // Rotation angles
  const xAngle = Math.PI / 2; // 90 degrees for vertical rotation
  const yAngle = -Math.PI / 18; // -10 degrees for initial horizontal rotation

  // First pass: find minimum Y after ALL transformations
  let minY = Infinity;
  for (let i = 0; i < adjustedCount * 3; i += 3) {
    const x = xShape.array[i] * scale;
    const y = xShape.array[i + 1] * scale;
    const z = xShape.array[i + 2] * scale;

    // Step 1: vertical rotation (X-axis)
    const y1 = y * Math.cos(xAngle) - z * Math.sin(xAngle);
    const z1 = y * Math.sin(xAngle) + z * Math.cos(xAngle);

    // Step 2: horizontal rotation (Y-axis)
    const x2 = x * Math.cos(yAngle) + z1 * Math.sin(yAngle);
    const y2 = y1; // Y doesn't change with Y rotation

    minY = Math.min(minY, y2);
  }

  // Second pass: apply both rotations and offset to Y=0
  for (let i = 0; i < adjustedCount * 3; i += 3) {
    const x = xShape.array[i] * scale;
    const y = xShape.array[i + 1] * scale;
    const z = xShape.array[i + 2] * scale;

    // Step 1: vertical rotation (X-axis)
    const y1 = y * Math.cos(xAngle) - z * Math.sin(xAngle);
    const z1 = y * Math.sin(xAngle) + z * Math.cos(xAngle);

    // Step 2: horizontal rotation (Y-axis) and apply Y offset
    adjustedTargetPositions[i] = x * Math.cos(yAngle) + z1 * Math.sin(yAngle);
    adjustedTargetPositions[i + 1] = y1 - minY;
    adjustedTargetPositions[i + 2] = -x * Math.sin(yAngle) + z1 * Math.cos(yAngle);
    adjustedTargetPositions[i + 1] -= 0.75;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(adjustedPositions, 3));
  geometry.setAttribute("aPositionTarget", new THREE.BufferAttribute(adjustedTargetPositions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(adjustedSizes, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uSize: { value: 0.03 },
      uProgress: { value: 0.0 },
      uResolution: {
        value: new THREE.Vector2(
          sceneSize.width * sceneSize.pixelRatio,
          sceneSize.height * sceneSize.pixelRatio
        ),
      }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);
}

// Handle scroll
let scrollY = window.scrollY;
let currentSection = 0;

window.addEventListener("scroll", () => {
  scrollY = window.scrollY;
  const newSection = Math.round(scrollY / sceneSize.height);

  if (currentSection !== newSection) {
    currentSection = newSection;
  }

  // Update progress display
  const progress =
    (scrollY / (document.documentElement.scrollHeight - window.innerHeight)) *
    100;
  document.querySelector(".scrollProgress").textContent = `${Math.round(
    progress
  )}%`;

  // Update particle animation
  if (particles) {
    particles.material.uniforms.uProgress.value = progress / 100;
  }
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update controls

  controls.update();

  // Render
  renderer.render(scene, camera);
}

// Start animation loop
animate();

// Handle resize
window.addEventListener("resize", () => {
  sceneSize.width = window.innerWidth;
  sceneSize.height = window.innerHeight;
  sceneSize.pixelRatio = Math.min(window.devicePixelRatio, 2);

  camera.aspect = sceneSize.width / sceneSize.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sceneSize.width, sceneSize.height);
  renderer.setPixelRatio(sceneSize.pixelRatio);

  if (particles) {
    particles.material.uniforms.uResolution.value.set(
      sceneSize.width * sceneSize.pixelRatio,
      sceneSize.height * sceneSize.pixelRatio
    );
  }

  // Enable controls only in the first section
});
