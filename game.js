import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

const playButton = document.getElementById("playButton");
const startScreen = document.getElementById("startScreen");
const gameContainer = document.getElementById("game");

let scene;
let camera;
let renderer;
let clock;

const keys = {};

let yaw = 0;
let pitch = 0;

// =============================
// PLAYER SETTINGS
// =============================

const moveSpeed = 7;

const gravity = 20;
const jumpPower = 7.5;

let verticalVelocity = 0;
let onGround = true;

// Top of the grass blocks is Y = 0.5
const groundHeight = 0.5;

// Player camera height above feet
const eyeHeight = 1.7;

const standingCameraHeight =
    groundHeight + eyeHeight;


// =============================
// WORLD SETTINGS
// =============================

// -60 to +60 = 121 x 121 blocks
const worldSize = 60;


// =============================
// PLAY BUTTON
// =============================

playButton.addEventListener("click", () => {

    startScreen.style.display = "none";

    startGame();

});


// =============================
// START GAME
// =============================

function startGame() {

    // -------------------------
    // SCENE
    // -------------------------

    scene = new THREE.Scene();

    scene.background = new THREE.Color(
        0x70c5e8
    );


    // -------------------------
    // CAMERA
    // -------------------------

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(
        0,
        standingCameraHeight,
        8
    );

    camera.rotation.order = "YXZ";


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
        Math.min(
            window.devicePixelRatio,
            2
        )
    );

    gameContainer.appendChild(
        renderer.domElement
    );


    // -------------------------
    // POINTER LOCK
    // -------------------------

    renderer.domElement.addEventListener(
        "click",
        () => {

            renderer.domElement.requestPointerLock();

        }
    );


    document.addEventListener(
        "mousemove",
        (event) => {

            if (
                document.pointerLockElement !==
                renderer.domElement
            ) {
                return;
            }

            const sensitivity = 0.002;

            yaw -=
                event.movementX *
                sensitivity;

            pitch -=
                event.movementY *
                sensitivity;

            const maxPitch =
                Math.PI / 2 - 0.01;

            pitch = Math.max(
                -maxPitch,
                Math.min(
                    maxPitch,
                    pitch
                )
            );

            camera.rotation.y = yaw;
            camera.rotation.x = pitch;

        }
    );


    // -------------------------
    // KEYBOARD
    // -------------------------

    document.addEventListener(
        "keydown",
        (event) => {

            keys[event.code] = true;


            // JUMP
            if (
                event.code === "Space" &&
                onGround
            ) {

                verticalVelocity =
                    jumpPower;

                onGround = false;

            }


            if (event.code === "Space") {

                event.preventDefault();

            }

        }
    );


    document.addEventListener(
        "keyup",
        (event) => {

            keys[event.code] = false;

        }
    );


    // -------------------------
    // LIGHTING
    // -------------------------

    const sunlight =
        new THREE.DirectionalLight(
            0xffffff,
            2
        );

    sunlight.position.set(
        10,
        20,
        10
    );

    scene.add(sunlight);


    const ambientLight =
        new THREE.AmbientLight(
            0xffffff,
            1.2
        );

    scene.add(ambientLight);


    // -------------------------
    // BLOCK MATERIALS
    // -------------------------

    const grassTop =
        new THREE.MeshLambertMaterial({
            color: 0x62b547
        });

    const grassSide =
        new THREE.MeshLambertMaterial({
            color: 0x557c31
        });

    const dirt =
        new THREE.MeshLambertMaterial({
            color: 0x79553a
        });


    const grassMaterials = [

        grassSide,
        grassSide,

        grassTop,

        dirt,

        grassSide,
        grassSide

    ];


    // -------------------------
    // BLOCK GEOMETRY
    // -------------------------

    const blockGeometry =
        new THREE.BoxGeometry(
            1,
            1,
            1
        );


    // -------------------------
    // GENERATE BIG WORLD
    // -------------------------

    const width =
        worldSize * 2 + 1;

    const blockCount =
        width * width;


    /*
        Instead of making 14,641
        completely separate Mesh objects,
        InstancedMesh renders copies of
        the same cube much more efficiently.
    */

    const ground =
        new THREE.InstancedMesh(
            blockGeometry,
            grassMaterials,
            blockCount
        );


    const dummy =
        new THREE.Object3D();

    let blockIndex = 0;


    for (
        let x = -worldSize;
        x <= worldSize;
        x++
    ) {

        for (
            let z = -worldSize;
            z <= worldSize;
            z++
        ) {

            dummy.position.set(
                x,
                0,
                z
            );

            dummy.updateMatrix();

            ground.setMatrixAt(
                blockIndex,
                dummy.matrix
            );

            blockIndex++;

        }

    }


    ground.instanceMatrix.needsUpdate =
        true;

    scene.add(ground);


    // -------------------------
    // CLOCK
    // -------------------------

    clock = new THREE.Clock();


    // -------------------------
    // START GAME LOOP
    // -------------------------

    animate();

}


// =============================
// PLAYER MOVEMENT
// =============================

function updateMovement(delta) {

    // -------------------------
    // HORIZONTAL MOVEMENT
    // -------------------------

    const forward =
        new THREE.Vector3(
            -Math.sin(yaw),
            0,
            -Math.cos(yaw)
        );


    const right =
        new THREE.Vector3(
            Math.cos(yaw),
            0,
            -Math.sin(yaw)
        );


    const movement =
        new THREE.Vector3();


    // W
    if (keys["KeyW"]) {

        movement.add(forward);

    }


    // S
    if (keys["KeyS"]) {

        movement.sub(forward);

    }


    // D
    if (keys["KeyD"]) {

        movement.add(right);

    }


    // A
    if (keys["KeyA"]) {

        movement.sub(right);

    }


    if (movement.lengthSq() > 0) {

        movement.normalize();

        movement.multiplyScalar(
            moveSpeed * delta
        );

        camera.position.add(
            movement
        );

    }


    // -------------------------
    // KEEP PLAYER ON MAP
    // -------------------------

    const mapEdge =
        worldSize - 0.5;

    camera.position.x =
        Math.max(
            -mapEdge,
            Math.min(
                mapEdge,
                camera.position.x
            )
        );

    camera.position.z =
        Math.max(
            -mapEdge,
            Math.min(
                mapEdge,
                camera.position.z
            )
        );


    // -------------------------
    // GRAVITY
    // -------------------------

    verticalVelocity -=
        gravity * delta;


    camera.position.y +=
        verticalVelocity * delta;


    // -------------------------
    // GROUND COLLISION
    // -------------------------

    if (
        camera.position.y <=
        standingCameraHeight
    ) {

        camera.position.y =
            standingCameraHeight;

        verticalVelocity = 0;

        onGround = true;

    }

}


// =============================
// GAME LOOP
// =============================

function animate() {

    requestAnimationFrame(
        animate
    );

    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );

    updateMovement(delta);


    renderer.render(
        scene,
        camera
    );

}


// =============================
// WINDOW RESIZE
// =============================

window.addEventListener(
    "resize",
    () => {

        if (
            !camera ||
            !renderer
        ) {
            return;
        }

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();


        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }
);
