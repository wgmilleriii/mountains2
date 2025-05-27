import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { loadElevationData } from './data_loader.js';

class TerrainVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.terrain = null;
        
        this.init();
        this.setupLoadingUI();
    }

    setupLoadingUI() {
        this.loadingElement = document.createElement('div');
        this.loadingElement.style.position = 'absolute';
        this.loadingElement.style.top = '50%';
        this.loadingElement.style.left = '50%';
        this.loadingElement.style.transform = 'translate(-50%, -50%)';
        this.loadingElement.style.color = 'white';
        this.loadingElement.style.fontFamily = 'Arial, sans-serif';
        this.loadingElement.style.fontSize = '24px';
        this.loadingElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        this.loadingElement.textContent = 'Loading terrain data...';
        this.container.appendChild(this.loadingElement);
    }

    hideLoadingUI() {
        if (this.loadingElement) {
            this.loadingElement.remove();
        }
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.style.position = 'absolute';
        errorElement.style.top = '50%';
        errorElement.style.left = '50%';
        errorElement.style.transform = 'translate(-50%, -50%)';
        errorElement.style.color = 'red';
        errorElement.style.fontFamily = 'Arial, sans-serif';
        errorElement.style.fontSize = '24px';
        errorElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        errorElement.textContent = `Error: ${message}`;
        this.container.appendChild(errorElement);
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        // Add controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 3;
        this.controls.maxDistance = 20;

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start animation loop
        this.animate();
    }

    async loadTerrain() {
        try {
            const elevationData = await loadElevationData();
            this.createTerrainMesh(elevationData);
            this.hideLoadingUI();
        } catch (error) {
            console.error('Error loading terrain data:', error);
            this.showError('Failed to load terrain data. Please refresh the page.');
        }
    }

    createTerrainMesh(elevationData) {
        const geometry = new THREE.PlaneGeometry(10, 10, 31, 31);
        
        // Create vertex colors for elevation-based coloring
        const colors = new Float32Array(geometry.attributes.position.count * 3);
        const vertices = geometry.attributes.position.array;
        
        // Find min/max elevation for color mapping
        let minElevation = Infinity;
        let maxElevation = -Infinity;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = Math.floor((i / 3) % 32);
            const z = Math.floor((i / 3) / 32);
            const elevation = elevationData[x][z] || 0;
            minElevation = Math.min(minElevation, elevation);
            maxElevation = Math.max(maxElevation, elevation);
        }

        // Apply elevation data to vertices and set colors
        for (let i = 0; i < vertices.length; i += 3) {
            const x = Math.floor((i / 3) % 32);
            const z = Math.floor((i / 3) / 32);
            const elevation = elevationData[x][z] || 0;
            vertices[i + 1] = elevation * 0.001; // Scale elevation for visualization
            
            // Calculate color based on elevation
            const normalizedElevation = (elevation - minElevation) / (maxElevation - minElevation);
            const color = this.getColorForElevation(normalizedElevation);
            
            colors[i] = color.r;
            colors[i + 1] = color.g;
            colors[i + 2] = color.b;
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 0.8,
            metalness: 0.2
        });

        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.rotation.x = -Math.PI / 2;
        this.scene.add(this.terrain);

        // Adjust camera to fit terrain
        const box = new THREE.Box3().setFromObject(this.terrain);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
        
        this.camera.position.set(center.x, center.y + cameraZ * 0.5, center.z + cameraZ * 0.5);
        this.camera.lookAt(center);
        this.controls.target.copy(center);
    }

    getColorForElevation(normalizedElevation) {
        // Color gradient from valley to peak
        const colors = [
            { r: 0.2, g: 0.4, b: 0.1 },  // Dark green (valley)
            { r: 0.4, g: 0.6, b: 0.2 },  // Medium green
            { r: 0.6, g: 0.8, b: 0.3 },  // Light green
            { r: 0.8, g: 0.7, b: 0.4 },  // Brown
            { r: 0.9, g: 0.9, b: 0.9 }   // White (peak)
        ];

        const index = Math.floor(normalizedElevation * (colors.length - 1));
        const t = normalizedElevation * (colors.length - 1) - index;
        
        const color1 = colors[index];
        const color2 = colors[Math.min(index + 1, colors.length - 1)];
        
        return {
            r: color1.r + (color2.r - color1.r) * t,
            g: color1.g + (color2.g - color1.g) * t,
            b: color1.b + (color2.b - color1.b) * t
        };
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize visualizer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new TerrainVisualizer('visualization-container');
    visualizer.loadTerrain();
}); 