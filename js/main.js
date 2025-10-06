import { initHaptic, triggerHaptic } from "../libs/haptic.js";

let scene, camera, renderer, world;
let stack = [];
let overhangs = [];
let perfectEffects = [];
let animationTime = 0;
let lookAtTarget = new THREE.Vector3(0, 0, 0);
let precisionScore = 0;
let gameState = 'loading'; // loading, playing, zoomOut, awaitingReset

const heightScoreElement = document.getElementById('height-score');
const precisionScoreElement = document.getElementById('precision-score');
const instructionsElement = document.getElementById('instructions');
const specialPaletteToastElement = document.getElementById('special-palette-toast');

const nihilisticMessages = [
    "Look on my Works, ye Mighty, and… despair?",
    "You are the tower: transient and futile.",
    "Each block, perfectly placed for nothing.",
    "Your final block will fail. It is so.",
    "Each perfect placement is a step towards the void.",
    "This monument to vanity will crumble.",
    "The abyss doesn't care about your score.",
    "A perfect stack is just a prettier ruin.",
    "You build, it falls. The universe is indifferent.",
    "How many times will you keep trying this?",
    "Every click echoes in an empty universe.",
    "This tower is a monument to… What?",
    "There is no prize at the top.",
    "Another brick on the wall of pointlessness.",
    "Well done. You have achieved nothing of substance."
];


// --- Palettes ---
const allPalettes = {
    default: {
        background: '#000015',
        colors: (layer) => `hsl(${30 + layer * 4}, 90%, 60%)`
    },
    halloween: {
        name: 'Halloween!',
        palette: {
            background: '#775555',
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
    const frustumSize = 40;
    const width = aspect >= 1 ? frustumSize * aspect : frustumSize;
    const height = aspect >= 1 ? frustumSize : frustumSize / aspect;

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
    const frustumSize = 40;
    const width = aspect >= 1 ? frustumSize * aspect : frustumSize;
    const height = aspect >= 1 ? frustumSize : frustumSize / aspect;
    camera.left = width / -2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = height / -2;
    camera.position.set(4, 4, 4);
    camera.lookAt(lookAtTarget);
    camera.updateProjectionMatrix();
    
    instructionsElement.innerHTML = `<span>Click to place blocks.</span>`;
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
    const color = new THREE.Color(currentPalette.colors(stack.length));
    const layer = generateBox(x, y, z, width, depth, false, color);
    layer.direction = direction;
    stack.push(layer);

    if (direction !== 'foundation') {
        layer.cannonjs.type = CANNON.Body.KINEMATIC;
    }
}

function addOverhang(x, z, width, depth, direction, overhangShift, color) {
    const y = (stack.length - 1) * 2; // Corrected Y-position
    const overhang = generateBox(x, y, z, width, depth, true, color);

    const mainAxis = direction === 'x' ? new CANNON.Vec3(0, 0, 1) : new CANNON.Vec3(1, 0, 0);
    const impulse = Math.sign(overhangShift) * 0.5;
    overhang.cannonjs.angularVelocity.set(mainAxis.x * impulse, mainAxis.y * impulse, mainAxis.z * impulse);
    
    overhangs.push(overhang);
}

function generateBox(x, y, z, width, depth, falls, color) {
    const geometry = new THREE.BoxGeometry(width, 2, depth);
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
        topLayer.cannonjs.type = CANNON.Body.STATIC;

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
            const overhangColor = topLayer.threejs.material.color;
            addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth, direction, overhangShift, overhangColor);
        }
        return true;
    } else {
        endGame();
        return false;
    }
}

function endGame() {
    const topLayer = stack.pop();
    overhangs.push(topLayer);
    
    topLayer.cannonjs.type = CANNON.Body.DYNAMIC;
    topLayer.cannonjs.mass = 5;
    topLayer.cannonjs.updateMassProperties();
    topLayer.cannonjs.wakeUp();

    gameState = 'zoomOut';
    
    const message = nihilisticMessages[Math.floor(Math.random() * nihilisticMessages.length)];
    instructionsElement.innerHTML = `<span class="message">${message}</span><hr/><span class="restart">Click to restart.</span>`;
    instructionsElement.style.display = 'block';
}

function triggerDownload(file) {
    const link = document.createElement("a");
    link.download = file.name;
    link.href = URL.createObjectURL(file);
    link.click();
    URL.revokeObjectURL(link.href);
}

async function saveAsImage() {
    let file;
    try {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = renderer.domElement.width;
        exportCanvas.height = renderer.domElement.height;
        const ctx = exportCanvas.getContext('2d');
        
        ctx.drawImage(renderer.domElement, 0, 0);

        const height = stack.length;
        const scoreText = `${height.toLocaleString()}`;
        ctx.font = 'bold 48px monoidregular';
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = exportCanvas.width / 2;
        const textY = exportCanvas.height - 50;
        ctx.fillText(scoreText, textX, textY);

        const blob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/png'));
        file = new File([blob], `puja-tower-${Date.now()}.png`, {
            type: "image/png",
        });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Puja Tower',
            });
        } else {
            // If sharing is not supported, fall back to download
            triggerDownload(file);
        }
    } catch (err) {
        if (err.name !== "AbortError") {
            console.error("Share API failed, attempting download fallback:", err);
            // If sharing failed unexpectedly, attempt to download the file as a fallback
            if (file) {
                triggerDownload(file);
            }
        }
    }
}


function addEventListeners() {
    let pressStartTime = 0;
    let isLongPress = false;

    window.addEventListener('resize', () => {
        const aspect = window.innerWidth / window.innerHeight;
        let frustumSize = 40;
        if (gameState !== 'playing') {
            frustumSize = Math.max(40, stack.length * 3);
        }
        const width = aspect >= 1 ? frustumSize * aspect : frustumSize;
        const height = aspect >= 1 ? frustumSize : frustumSize / aspect;

        camera.left = width / -2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = height / -2;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    renderer.domElement.addEventListener('pointerdown', () => {
        pressStartTime = Date.now();
        isLongPress = false; // Reset on each new press
    });

    renderer.domElement.addEventListener('pointerleave', () => {
        // Cancel the press if the pointer leaves the canvas
        pressStartTime = 0;
    });

    renderer.domElement.addEventListener('pointerup', () => {
        // If press was canceled, do nothing
        if (pressStartTime === 0) return;

        const pressDuration = Date.now() - pressStartTime;
        if (pressDuration >= 1000) {
            isLongPress = true;
            saveAsImage();
        }
        // Reset for the next press
        pressStartTime = 0;
    });


    renderer.domElement.addEventListener('click', () => {
        if (isLongPress) {
            // This click follows a long press, so we ignore it.
            return;
        }

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
    if (stack.length === 0) return;
    const topLayer = stack[stack.length - 1];

    if (gameState === 'playing' && topLayer.direction !== 'foundation') {
        topLayer.threejs.position[topLayer.direction] += speed;
        topLayer.cannonjs.position[topLayer.direction] += speed;

        if (Math.abs(topLayer.threejs.position[topLayer.direction]) > 15) {
            speed *= -1;
        }
    }
    
    if (gameState === 'awaitingReset') {
        camera.position.x -= 0.00001;
        lookAtTarget.x -= 0.00001;
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