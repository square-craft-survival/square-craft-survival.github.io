import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

const playButton = document.getElementById("playButton");
const startScreen = document.getElementById("startScreen");
const gameContainer = document.getElementById("game");

let scene;
let camera;
let renderer;

playButton.addEventListener("click", () => {
    startScreen.style.display = "none";

    startGame();
});

function startGame() {
    // -------------------------
    // SCENE
    // -------------------------

    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x70c5e8);


    // -------------------------
    // CAMERA
    // -------------------------

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, 4, 8);

    camera.lookAt(0, 1, 0);


    // -------------------------
    // RENDERER
    // -------------------------

    renderer = new THREE.WebGLRenderer({
        antialias: false
    });

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    gameContainer.appendChild(renderer.domElement);


    // -------------------------
    // LIGHTING
    // -------------------------

    const sunlight = new THREE.DirectionalLight(
        0xffffff,
        2
    );

    sunlight.position.set(
        10,
        20,
        10
    );

    scene.add(sunlight);


    const ambientLight = new THREE.AmbientLight(
        0xffffff,
        1.2
    );

    scene.add(ambientLight);


    // -------------------------
    // BLOCK MATERIALS
    // -------------------------

    const grassTop = new THREE.MeshLambertMaterial({
        color: 0x62b547
    });

    const grassSide = new THREE.MeshLambertMaterial({
        color: 0x7a9e45
    });

    const dirt = new THREE.MeshLambertMaterial({
        color: 0x79553a
    });


    // Materials correspond to:
    // right, left, top, bottom, front, back

    const grassMaterials = [
        grassSide,
        grassSide,
        grassTop,
        dirt,
        grassSide,
        grassSide
    ];


    // -------------------------
    // CREATE GROUND
    // -------------------------

    const blockGeometry = new THREE.BoxGeometry(
        1,
        1,
        1
    );

    const worldSize = 20;

    for (let x = -worldSize; x <= worldSize; x++) {

        for (let z = -worldSize; z <= worldSize; z++) {

            const block = new THREE.Mesh(
                blockGeometry,
                grassMaterials
            );

            block.position.set(
                x,
                0,
                z
            );

            scene.add(block);
        }
    }


    // -------------------------
    // GAME LOOP
    // -------------------------

    animate();
}


function animate() {

    requestAnimationFrame(animate);

    renderer.render(
        scene,
        camera
    );
}


// -------------------------
// WINDOW RESIZE
// -------------------------

window.addEventListener("resize", () => {

    if (!camera || !renderer)
        return;

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});
