import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * PanoramaRenderer
 * Handles 360 degree panoramic view using Three.js
 */
export class PanoramaRenderer {
    constructor(container, imageUrl) {
        this.container = container;
        this.imageUrl = imageUrl;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.sphere = null;
        this.animationId = null;
        this.isUserInteracting = false;
        
        this.init();
    }

    init() {
        // 1. Scene setup
        this.scene = new THREE.Scene();

        // 2. Camera setup - FOV 75, Aspect based on container
        const width = this.container.clientWidth || 512;
        const height = this.container.clientHeight || 512;
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 0.1); // Look from center

        // 3. Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(width, height);
        
        // 关键修复：颜色空间与色调映射，解决画面“发白”问题
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        this.container.appendChild(this.renderer.domElement);

        // 4. Sphere geometry with texture
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        // Invert the geometry on the x-axis so that all of the faces point inward
        geometry.scale(-1, 1, 1);

        const loader = new THREE.TextureLoader();
        // CORS support as requested
        loader.setCrossOrigin('anonymous');
        
        const texture = loader.load(this.imageUrl, (tex) => {
            // 关键修复：纹理也需要指定为 sRGB 空间
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
            console.log(`[Panorama] Texture loaded successfully: ${this.imageUrl}`);
        }, undefined, (err) => {
            console.error(`[Panorama] Failed to load texture: ${this.imageUrl}`, err);
        });

        const material = new THREE.MeshBasicMaterial({ map: texture });
        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);

        // 5. OrbitControls integration
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true; // Premium smooth inertia
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = -0.25; // Invert rotation for better feel inside sphere
        this.controls.enableZoom = true;
        this.controls.enablePan = false; // Disable panning for panorama
        
        // FOV / Zoom limits to prevent distortion
        // Standard FOV for panoramas is 75. Limit between 30 and 100.
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 0.5;

        // Implementation of FOV zoom
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            const fov = this.camera.fov + e.deltaY * 0.05;
            this.camera.fov = THREE.MathUtils.clamp(fov, 30, 100);
            this.camera.updateProjectionMatrix();
        }, { passive: false });
        
        // Auto-Rotate detail from user
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.5;

        // Stop auto-rotate on user intervention
        const stopAutoRotate = () => {
            if (this.controls.autoRotate) {
                this.controls.autoRotate = false;
                console.log("[Panorama] Auto-rotate disabled by user interaction");
            }
        };

        this.renderer.domElement.addEventListener('pointerdown', stopAutoRotate);
        this.renderer.domElement.addEventListener('wheel', stopAutoRotate);

        // 6. Start animation loop
        this.animate();

        // 7. Handle Resizing
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.container);
    }

    onResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update(); // Required for damping and auto-rotate
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    dispose() {
        console.log("[Panorama] Disposing resources...");
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        if (this.controls) {
            this.controls.dispose();
        }

        if (this.sphere) {
            this.sphere.geometry.dispose();
            if (this.sphere.material.map) this.sphere.material.map.dispose();
            this.sphere.material.dispose();
        }

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sphere = null;
    }
}
