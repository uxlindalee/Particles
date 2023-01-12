import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import dat from "dat.gui";
import { gsap } from "gsap";

const DEBUG = location.search.indexOf("debug") > -1;

const threeProject = (() => {
	let loadingManager, scene, renderer, camera, ambientLight, directionalLight, gltfLoader, url, model, textureLoader, requestToRender, raf;

	let whale, action;
	let mixer = null;
	let particleCount = 20;
	let renderPass, bloomPass, composer;

	let areaWidth = window.innerWidth;
	let areaHeight = window.innerHeight;

	const clock = new THREE.Clock();
	let previousTime = 0;

	const params = {
		exposure: 1,
		bloomStrength: 3,
		bloomThreshold: 0.63,
		bloomRadius: 1,
	};

	const setTheManager = () => {
		loadingManager = new THREE.LoadingManager();
		loadingManager.onLoad = () => {
			renderRequest();
		};
		loadingManager.onStart = () => {};
		loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {};
	};

	const setTheScene = () => {
		scene = new THREE.Scene();
	};

	const setTheRenderer = () => {
		renderer = new THREE.WebGLRenderer({
			antialias: true,
		});
		renderer.setClearColor(0x000000);
		renderer.setSize(areaWidth, areaHeight);
		renderer.setPixelRatio(devicePixelRatio);
		renderer.outputEncoding = THREE.sRGBEncoding;
		document.body.appendChild(renderer.domElement);
	};

	const setTheCamera = () => {
		camera = new THREE.PerspectiveCamera(45, areaWidth / areaHeight, 0.1, 1000);
		camera.position.set(50, 50, 50);
	};

	const setTheLight = () => {
		ambientLight = new THREE.AmbientLight("#fff", 1);
		directionalLight = new THREE.DirectionalLight("#fff", 1);

		scene.add(ambientLight, directionalLight);
	};

	const setTheModel = () => {
		gltfLoader = new GLTFLoader(loadingManager);

		gltfLoader.load("../resources/models/humpback_whale.glb", (object) => {
			let whaleVertices = [];

			whale = object.scene;
			whale.traverse(function (node) {
				if (node.isMesh) {
					node.castShadow = true;
					node.receiveShadow = true;
					whaleVertices.push(...node.geometry.attributes.position.array);
				}
			});
			mixer = new THREE.AnimationMixer(whale);
			action = mixer.clipAction(object.animations[0]);
			action.play();
			// whale.scale.set(10, 10, 10);
			// scene.add(whale);

			const whaleGeometry = new THREE.BufferGeometry();
			const whaleParticles = new Float32Array(whaleVertices.length * particleCount);

			for (let i = 1; i < particleCount; i++) {
				for (let j = 0; j < whaleVertices.length; j++) {
					whaleParticles[j + whaleVertices.length * i] = whaleVertices[j] + Math.random() * 0.25;
				}
			}

			const whaleMaterial = new THREE.PointsMaterial({
				color: 0xffffff,
				size: 0.15,
				sizeAttenuation: true,
				depthWrite: false,
			});

			whaleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(whaleParticles, 3));

			// Points
			const whalePoint = new THREE.Points(whaleGeometry, whaleMaterial);
			whalePoint.scale.set(10, 10, 10);
			scene.add(whalePoint);
		});
		renderRequest();
	};

	const setTheTexture = () => {
		textureLoader = new THREE.TextureLoader(loadingManager);
	};

	const setTheBloom = () => {
		renderPass = new RenderPass(scene, camera);

		bloomPass = new UnrealBloomPass(new THREE.Vector2(areaWidth, areaHeight), 1.5, 0.1, 0.1);
		bloomPass.threshold = params.bloomThreshold;
		bloomPass.strength = params.bloomStrength;
		bloomPass.radius = params.bloomRadius;

		composer = new EffectComposer(renderer);
		composer.addPass(renderPass);
		composer.addPass(bloomPass);
		// renderRequest();
	};

	const setTheRender = () => {
		const elapsedTime = clock.getElapsedTime();
		const deltaTime = elapsedTime - previousTime;
		previousTime = elapsedTime;

		// for (let i = 0; i < count; i++) {
		// 	const i3 = i * 3;

		// 	particlesGeometry.attributes.position.array[i3 + 1] = Math.sin(elapsedTime);
		// }
		// particlesGeometry.attributes.position.needsUpdate = true;

		if (mixer !== null) {
			mixer.update(deltaTime);
			// renderRequest();
		}
		if (requestToRender) {
			composer.render();
			// renderer.render(scene, camera);
			requestToRender = false;
		}

		raf = requestAnimationFrame(setTheRender);
	};

	const renderRequest = () => {
		requestToRender = true;
	};

	const resize = () => {
		areaWidth = window.innerWidth;
		areaHeight = window.innerHeight;

		camera.aspect = areaWidth / areaHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(areaWidth, areaHeight);
		renderer.setPixelRatio(devicePixelRatio);

		renderRequest();
	};

	const addEvent = () => {
		window.addEventListener("resize", resize);
	};

	const debugMode = () => {
		if (DEBUG) {
			let gui = new dat.GUI();
			gui.domElement.parentNode.style.zIndex = 100;

			const control = new OrbitControls(camera, renderer.domElement);
			control.addEventListener("change", function () {
				renderRequest();
			});

			scene.add(new THREE.AxesHelper());

			gui && gui.add(camera.position, "y", 0, 20, 0.01).name("camera y").onChange(renderRequest);
			gui &&
				gui.add(params, "exposure", 0.1, 2).onChange(function (value) {
					renderer.toneMappingExposure = Math.pow(value, 4.0);
					renderRequest();
				});

			gui &&
				gui.add(params, "bloomThreshold", 0.0, 1.0, 0.01).onChange(function (value) {
					bloomPass.threshold = Number(value);
					renderRequest();
				});

			gui &&
				gui.add(params, "bloomStrength", 0.0, 3.0).onChange(function (value) {
					bloomPass.strength = Number(value);
					renderRequest();
				});

			gui &&
				gui
					.add(params, "bloomRadius", 0.0, 1.0)
					.step(0.01)
					.onChange(function (value) {
						bloomPass.radius = Number(value);
						renderRequest();
					});
		}
	};

	const initialize = () => {
		setTheManager();
		setTheScene();
		setTheRenderer();
		setTheCamera();
		setTheLight();
		setTheModel();
		setTheBloom();
		setTheTexture();
		setTheRender();
		addEvent();
		debugMode();
	};

	return {
		init: initialize,
	};
})();

onload = threeProject.init();
