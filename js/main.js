import { initHaptic, triggerHaptic } from "../libs/haptic.js";

let scene, camera, renderer, world;
let stack = [];
let overhangs = [];
let perfectEffects = [];
let animationTime = 0;
let lookAtTarget = new THREE.Vector3(0, 0, 0);
let precisionScore = 0;
let gameState = 'loading'; // loading, playing, zoomOut, awaitingReset
let pressTimer;

const heightScoreElement = document.getElementById('height-score');
const precisionScoreElement = document.getElementById('precision-score');
const instructionsElement = document.getElementById('instructions');
const specialPaletteToastElement = document.getElementById('special-palette-toast');


// --- Palettes ---
const allPalettes = {
    default: {
        background: '#000000',
        colors: (layer) => `hsl(${30 + layer * 4}, 90%, 60%)`
    },
    halloween: {
        name: 'Halloween!',
        palette: {
            background: '#222222',
            colors: (layer) => {
                const colors = ['#FF7F00', '#9932CC', '#000000', '#FDFD96'];
                return colors[layer % colors.length];
            }
        }
    },
    christmas: {
        name: 'Christmas!',
        palette: {
            background: '#dcf0dc',
            colors: (layer) => {
                const colors = ['#D10000', '#008A00', '#FFFFFF', '#FFD700'];
                return colors[layer % colors.length];
            }
        }
    }
};

const activeSpecialPalettes = ['halloween']; // Add 'christmas' here to enable it
let currentPalette;

function choosePalette() {
    if (activeSpecialPalettes.length > 0 && Math.random() > 0.8) { // 20% chance for a special palette
        const specialPaletteName = activeSpecialPalettes[Math.floor(Math.random() * activeSpecialPalettes.length)];
        const specialPalette = allPalettes[specialPaletteName];
        currentPalette = specialPalette.palette;
        specialPaletteToastElement.innerText = specialPalette.name;
        specialPaletteToastElement.style.display = 'block';
        specialPaletteToastElement.classList.remove('fade-out');
        setTimeout(() => {
            specialPaletteToastElement.classList.add('fade-out');
        }, 100);
    } else {
        currentPalette = allPalettes.default;
        specialPaletteToastElement.style.display = 'none';
    }
}


// --- Core Functions ---
function init() {
    initHaptic()
    world = new CANNON.World();
    world.gravity.set(0, -10, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 40;

    scene = new THREE.Scene();

    const aspect = window.innerWidth / window.innerHeight;
    const width = 40;
    const height = width / aspect;

    camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, -30, 100);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: document.getElementById('game-canvas'),
        preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animation);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 0);
    scene.add(directionalLight);

    addEventListeners();
    resetGame();
}

function resetGame() {
    gameState = 'playing';
    speed = 0.15;
    animationTime = 0;
    lookAtTarget.set(0, 0, 0);
    precisionScore = 0;

    choosePalette();
    scene.background = new THREE.Color(currentPalette.background);
    document.body.style.backgroundColor = currentPalette.background;

    const aspect = window.innerWidth / window.innerHeight;
    const width = 40;
    const height = width / aspect;
    camera.left = width / -2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = height / -2;
    camera.position.set(4, 4, 4);
    camera.lookAt(lookAtTarget);
    camera.updateProjectionMatrix();

    instructionsElement.style.display = 'block';
    heightScoreElement.innerText = 0;
    precisionScoreElement.innerText = "0";
    precisionScoreElement.style.color = `hsl(30, 90%, 60%)`;

    [...stack, ...overhangs].forEach(element => {
        scene.remove(element.threejs);
        if (element.cannonjs) world.remove(element.cannonjs);
    });
    stack = [];
    overhangs = [];

    perfectEffects.forEach(effect => scene.remove(effect.mesh));
    perfectEffects = [];

    addLayer(0, 0, 10, 10, 'foundation');
    addLayer(-15, 0, 10, 10, 'x');
}

// --- Game Logic Functions ---
function triggerPerfectEffect(x, y, z, color) {
    const geometry = new THREE.RingGeometry(0.5, 1, 32);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    perfectEffects.push({ mesh, life: 1.0 });
}

function addLayer(x, z, width, depth, direction) {
    const y = stack.length * 2;
    const layer = generateBox(x, y, z, width, depth, false);
    layer.direction = direction;
    stack.push(layer);
}

function addOverhang(x, z, width, depth) {
    const y = (stack.length - 1) * 2;
    const overhang = generateBox(x, y, z, width, depth, true);
    overhangs.push(overhang);
}

function generateBox(x, y, z, width, depth, falls) {
    const geometry = new THREE.BoxGeometry(width, 2, depth);
    const color = new THREE.Color(currentPalette.colors(stack.length));
    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, 1, depth / 2));
    let mass = falls ? 5 : 0;
    const body = new CANNON.Body({ mass, shape });
    body.position.set(x, y, z);
    world.addBody(body);
    return { threejs: mesh, cannonjs: body, width, depth };
}

function placeBlock() {
    if (stack.length < 2) return;

    const topLayer = stack[stack.length - 1];
    const prevLayer = stack[stack.length - 2];
    const direction = topLayer.direction;

    const delta = topLayer.threejs.position[direction] - prevLayer.threejs.position[direction];
    const overhangSize = Math.abs(delta);
    const size = direction === 'x' ? topLayer.width : topLayer.depth;
    const overlap = size - overhangSize;

    if (overlap > 0) {
        const precisionBonus = Math.floor(100 * (overlap / size));
        precisionScore += precisionBonus;

        const newWidth = direction === 'x' ? overlap : topLayer.width;
        const newDepth = direction === 'z' ? overlap : topLayer.depth;

        topLayer.width = newWidth;
        topLayer.depth = newDepth;
        topLayer.threejs.scale[direction] = overlap / size;
        topLayer.threejs.position[direction] -= delta / 2;

        topLayer.cannonjs.position[direction] -= delta / 2;
        const newShape = new CANNON.Box(new CANNON.Vec3(newWidth / 2, 1, newDepth / 2));
        topLayer.cannonjs.shapes = [];
        topLayer.cannonjs.addShape(newShape);

        const PERFECT_THRESHOLD = 0.1;
        if (overhangSize < PERFECT_THRESHOLD) {
            precisionScore += 200;
            const topY = topLayer.threejs.position.y + 1.01;
            triggerPerfectEffect(topLayer.threejs.position.x, topY, topLayer.threejs.position.z, topLayer.threejs.material.color);
        }

        if (overhangSize > 0) {
            const overhangWidth = direction === 'x' ? overhangSize : newWidth;
            const overhangDepth = direction === 'z' ? overhangSize : newDepth;
            const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
            const overhangX = direction === 'x' ? topLayer.threejs.position.x + overhangShift : topLayer.threejs.position.x;
            const overhangZ = direction === 'z' ? topLayer.threejs.position.z + overhangShift : topLayer.threejs.position.z;
            addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);
        }
        return true;
    } else {
        endGame();
        return false;
    }
}

function endGame() {
    const topLayer = stack[stack.length - 1];
    scene.remove(topLayer.threejs);
    world.remove(topLayer.cannonjs);
    stack.pop();
    gameState = 'zoomOut';
}

function saveAsImage() {
    const link = document.createElement('a');
    link.download = 'puja-tower.png';
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
}


function addEventListeners() {
    window.addEventListener('resize', () => {
        const aspect = window.innerWidth / window.innerHeight;
        let width = 40;
        if (gameState !== 'playing') {
            width = Math.max(40, stack.length * 3);
        }
        const height = width / aspect;
        camera.left = width / -2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = height / -2;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    renderer.domElement.addEventListener('pointerdown', () => {
        pressTimer = window.setTimeout(function() {
            saveAsImage();
        }, 1000);
    });

    renderer.domElement.addEventListener('pointerup', () => {
        clearTimeout(pressTimer);
    });

    renderer.domElement.addEventListener('pointerleave', () => {
        clearTimeout(pressTimer);
    });


    renderer.domElement.addEventListener('click', () => {
        triggerHaptic()
        if (gameState === 'awaitingReset') {
            resetGame();
            return;
        }

        if (gameState === 'playing') {
            instructionsElement.style.display = 'none';
            if (placeBlock()) {
                heightScoreElement.innerText = (stack.length - 1).toLocaleString();
                precisionScoreElement.innerText = precisionScore.toLocaleString();
                precisionScoreElement.style.color = `#${stack[stack.length - 1].threejs.material.color.getHexString()}`;

                const topLayer = stack[stack.length - 1];
                const nextDirection = topLayer.direction === 'x' ? 'z' : 'x';
                speed = 0.15 + (stack.length * 0.005);
                addLayer(
                    nextDirection === 'x' ? -15 : topLayer.threejs.position.x,
                    nextDirection === 'z' ? -15 : topLayer.threejs.position.z,
                    topLayer.width,
                    topLayer.depth,
                    nextDirection
                );
            }
        }
    });
}

let speed = 0.15;
function animation() {
    if (!currentPalette || stack.length === 0) return;
    const topLayer = stack[stack.length - 1];

    if (gameState === 'playing' && topLayer.direction !== 'foundation') {
        topLayer.threejs.position[topLayer.direction] += speed;
        topLayer.cannonjs.position[topLayer.direction] += speed;

        if (Math.abs(topLayer.threejs.position[topLayer.direction]) > 15) {
            speed *= -1;
        }
    }

    // --- Camera Movement ---
    if (gameState === 'playing') {
        animationTime += 0.01;
        const sway = Math.sin(animationTime) * 2;

        camera.position.x = 4 + sway;
        camera.position.z = 4 - sway;

        const targetCameraY = ((stack.length - 1) * 2) + 4;
        camera.position.y += (targetCameraY - camera.position.y) * 0.05;

        const targetLookAtY = (stack.length - 1) * 2;
        lookAtTarget.y += (targetLookAtY - lookAtTarget.y) * 0.05;
        camera.lookAt(lookAtTarget);
    } else if (gameState === 'zoomOut') {
        const towerHeight = stack.length * 2;
        const targetWidth = Math.max(40, towerHeight * 1.5);
        const aspect = window.innerWidth / window.innerHeight;
        const targetHeight = targetWidth / aspect;

        const targetCameraY = towerHeight / 2;
        const targetLookAtY = towerHeight / 2;

        camera.position.y += (targetCameraY + 4 - camera.position.y) * 0.05;
        lookAtTarget.y += (targetLookAtY - lookAtTarget.y) * 0.05;

        camera.left += (targetWidth / -2 - camera.left) * 0.05;
        camera.right += (targetWidth / 2 - camera.right) * 0.05;
        camera.top += (targetHeight / 2 - camera.top) * 0.05;
        camera.bottom += (targetHeight / -2 - camera.bottom) * 0.05;
        camera.updateProjectionMatrix();
        camera.lookAt(lookAtTarget);

        if (Math.abs(camera.right - (targetWidth / 2)) < 0.1) {
            gameState = 'awaitingReset';
        }
    }

    for (let i = perfectEffects.length - 1; i >= 0; i--) {
        const effect = perfectEffects[i];
        effect.life -= 0.03;

        if (effect.life <= 0) {
            scene.remove(effect.mesh);
            perfectEffects.splice(i, 1);
        } else {
            const scale = (1 - effect.life) * 15;
            effect.mesh.scale.set(scale, scale, scale);
            effect.mesh.material.opacity = effect.life;
        }
    }

    world.step(1 / 60);
    overhangs.forEach(element => {
        element.threejs.position.copy(element.cannonjs.position);
        element.threejs.quaternion.copy(element.cannonjs.quaternion);
    });

    renderer.render(scene, camera);
}

init();