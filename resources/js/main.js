import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import dat from "dat.gui";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/all";

const DEBUG = location.search.indexOf("debug") > -1;

const threeProject = (() => {
	const wrap = document.getElementById("wrap");
	const whaleContainer = document.getElementsByClassName("whale-container");
	let loadingManager, canvas, scene, renderer, camera, ambientLight, directionalLight, gltfLoader, url, model, textureLoader, requestToRender, raf;

	let whale, whaleGeometry, whaleParticles, whaleFloatingGeometry, whaleFlying, whaleFloatingParticles, whaleOrigin, whaleBody, whaleColors, action, particleTexture;
	let seahorse, seahorseGeometry, seahorseParticles, seahorseBody, seahorseColors;
	let whaleVertices = [];
	let seahorseVertices = [];
	let renderPass, bloomPass, composer;
	let mixer = null;
	let particleCount = 20;

	const posData = {
		model: [],
		position: [],
		totalLength: 0,
	};

	const areaWidth = window.innerWidth;
	const areaHeight = window.innerHeight;
	const cursor = {
		x: 0,
		y: 0,
	};

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

			setTheParticle();
		};
		loadingManager.onStart = () => {};
		loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {};
	};

	const setTheScene = () => {
		scene = new THREE.Scene();
	};

	const setTheRenderer = () => {
		canvas = document.querySelector("canvas.webgl");
		renderer = new THREE.WebGLRenderer({
			antialias: true,
			canvas,
		});
		renderer.setClearColor(0x000000);
		renderer.setSize(areaWidth, areaHeight);
		renderer.setPixelRatio(devicePixelRatio);
		renderer.outputEncoding = THREE.sRGBEncoding;
		// document.body.appendChild(renderer.domElement);
	};

	const setTheCamera = () => {
		camera = new THREE.PerspectiveCamera(45, areaWidth / areaHeight, 0.1, 100000);
		camera.position.set(50, 50, 50);
		camera.lookAt(scene.position);
	};

	const setTheLight = () => {
		ambientLight = new THREE.AmbientLight("#fff", 1);
		directionalLight = new THREE.DirectionalLight("#fff", 1);

		scene.add(ambientLight, directionalLight);
	};

	const setTheFog = () => {
		const fog = new THREE.Fog("0xffffff", 10, 100);
		scene.fog = fog;
	};

	const setTheModel = () => {
		gltfLoader = new GLTFLoader(loadingManager);

		gltfLoader.load("../resources/models/seahorse.glb", (object) => {
			seahorse = object.scene;
			seahorse.traverse(function (node) {
				if (node.isMesh) {
					node.castShadow = true;
					node.receiveShadow = true;

					node.geometry.scale(0.01, 0.01, 0.01);
					node.geometry.rotateX(THREE.MathUtils.degToRad(90));
					node.geometry.rotateY(THREE.MathUtils.degToRad(-90));
					node.geometry.translate(0, -2, 0);

					seahorseVertices.push(...node.geometry.attributes.position.array);
				}
			});

			seahorseGeometry = new THREE.BufferGeometry();
			seahorseParticles = new Float32Array(seahorseVertices.length * particleCount);

			for (let i = 0; i < 4; i++) {
				for (let j = 0; j < seahorseVertices.length; j++) {
					seahorseParticles[j + seahorseVertices.length * i] = seahorseVertices[j] + Math.random() * 0.25;
				}
			}
		});

		gltfLoader.load("../resources/models/humpback_whale.glb", (object) => {
			whale = object.scene;
			whale.traverse(function (node) {
				if (node.isMesh) {
					node.castShadow = true;
					node.receiveShadow = true;
					whaleVertices.push(...node.geometry.attributes.position.array);
				}
			});
			// mixer = new THREE.AnimationMixer(whale);
			// action = mixer.clipAction(object.animations[0]);
			// action.play();
			// whale.scale.set(10, 10, 10);
			// scene.add(whale);

			whaleGeometry = new THREE.BufferGeometry();
			whaleFloatingGeometry = new THREE.BufferGeometry();

			whaleParticles = new Float32Array(whaleVertices.length * particleCount);
			whaleFloatingParticles = new Float32Array((whaleVertices.length * particleCount) / 2);
			whaleColors = new Float32Array(whaleVertices.length * particleCount);

			for (let i = 1; i < particleCount; i++) {
				for (let j = 0; j < whaleVertices.length; j++) {
					whaleParticles[j + whaleVertices.length * i] = whaleVertices[j] + Math.random() * 0.2;
					whaleFloatingParticles[j + whaleVertices.length * i] = whaleVertices[j] + Math.random() * 0.25;
					whaleColors[j + whaleVertices.length * i] = whaleVertices[j] + Math.random();
					whaleOrigin = whaleParticles;
				}
			}

			const whaleMaterial = new THREE.PointsMaterial({
				// color: 0xffffff,
				map: particleTexture,
				size: 0.15,
				sizeAttenuation: true,
				depthWrite: false,
				alphaTest: 0.06,
				vertexColors: true,
				blending: THREE.AdditiveBlending,
			});

			whaleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(whaleParticles, 3));
			whaleFloatingGeometry.setAttribute("position", new THREE.Float32BufferAttribute(whaleFloatingParticles, 3));

			whaleGeometry.setAttribute("color", new THREE.Float32BufferAttribute(whaleColors, 3));
			whaleFloatingGeometry.setAttribute("color", new THREE.Float32BufferAttribute(whaleColors, 3));

			whaleBody = new THREE.Points(whaleGeometry, whaleMaterial);
			whaleFlying = new THREE.Points(whaleFloatingGeometry, whaleMaterial);

			whaleBody.scale.set(10, 10, 10);
			whaleFlying.scale.set(10, 10, 10);
			scene.add(whaleBody, whaleFlying);
		});

		renderRequest();
	};

	const setTheTexture = () => {
		textureLoader = new THREE.TextureLoader(loadingManager);
		particleTexture = textureLoader.load("../resources/images/1.png");
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
	};

	let posX, posY, posZ;
	const setTheRender = () => {
		const elapsedTime = clock.getElapsedTime();
		const deltaTime = elapsedTime - previousTime;
		previousTime = elapsedTime;

		if (whaleFlying) {
			// whaleBody.rotation.x = Math.sin(elapsedTime) * 0.1;

			for (let i = 0; i < whaleFlying.geometry.attributes.position.array.length; i++) {
				const i3 = i * 3;
				posX = whaleFlying.geometry.attributes.position.array[i3] + Math.sin(i + particleCount) * Math.random() * 0.007;
				posY = whaleFlying.geometry.attributes.position.array[i3 + 1] + Math.cos(i + particleCount) * Math.random() * 0.007;
				posZ = whaleFlying.geometry.attributes.position.array[i3 + 2] + Math.cos(i + particleCount) * Math.random() * 0.007;

				whaleFlying.geometry.attributes.position.array[i3] = posX;
				whaleFlying.geometry.attributes.position.array[i3 + 1] = posY;
				whaleFlying.geometry.attributes.position.array[i3 + 2] = posZ;
				// console.log(posX, posY, posZ);
				whaleFlying.geometry.attributes.position.needsUpdate = true;
				// whaleGeometry.attributes.position.needsUpdate = true;
			}
			renderRequest();
			particleCount += 0.1;
		}

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

	const setTheParticle = () => {
		gsap.registerPlugin(ScrollTrigger);

		gsap.to(whaleBody.rotation, {
			y: Math.PI / 2,
			ease: "power2",
			scrub: true,
			scrollTrigger: {
				trigger: whaleContainer,
				start: "top top",
				end: "bottom bottom",
				scrub: true,
			},
			onUpdate: () => {
				renderRequest();
			},
		});
		// console.log(seahorseBody);
		// console.log(seahorseBody.geometry.attributes.position.array);
		// console.log(whaleBody.geometry.attributes.position.array);

		gsap.to(whaleBody.geometry.attributes.position.array, {
			endArray: seahorseParticles,
			ease: "power2",
			scrollTrigger: {
				trigger: whaleContainer,
				start: "top top",
				end: "bottom bottom",
				scrub: true,
			},
			onUpdate: () => {
				whaleBody.geometry.attributes.position.needsUpdate = true;
				renderRequest();
			},
			onComplete: () => {},
		});
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
		composer.setSize(areaWidth, areaHeight);
		renderer.setPixelRatio(devicePixelRatio);

		renderRequest();
	};

	const mouseMove = (event) => {
		renderRequest();
		cursor.x = event.clientX / areaWidth - 0.5;
		cursor.y = -(event.clientY / areaHeight - 0.5);
	};

	const addEvent = () => {
		window.addEventListener("resize", resize);
		window.addEventListener("mousemove", mouseMove);
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
		// setTheFog();
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
