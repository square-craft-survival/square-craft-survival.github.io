import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

console.log("SQUARE CRAFT SURVIVAL: TREE COLLISION VERSION");

// ======================================================
// HTML
// ======================================================

const playButton = document.getElementById("playButton");
const startScreen = document.getElementById("startScreen");
const gameContainer = document.getElementById("game");

gameContainer.style.display = "none";


// ======================================================
// THREE.JS
// ======================================================

let scene;
let camera;
let renderer;
let clock;


// ======================================================
// PLAYER
// ======================================================

const keys = {};

let yaw = 0;
let pitch = 0;

const moveSpeed = 7;

const gravity = 20;
const jumpPower = 7.5;

const eyeHeight = 1.7;

const playerHeight = 1.8;
const playerRadius = 0.32;

let verticalVelocity = 0;
let onGround = false;


// ======================================================
// WORLD
// ======================================================

const worldSize = 60;


// ======================================================
// TREE COLLISION DATA
// ======================================================

const solidTreeBlocks = new Set();


function blockKey(x, y, z) {

    return `${x},${y},${z}`;

}


function addSolidTreeBlock(x, y, z) {

    solidTreeBlocks.add(
        blockKey(x, y, z)
    );

}


// ======================================================
// PLAY BUTTON
// ======================================================

playButton.addEventListener("click", () => {

    startScreen.style.display = "none";
    gameContainer.style.display = "block";

    startGame();

});


// ======================================================
// TERRAIN HEIGHT
// ======================================================

function getTerrainHeight(x, z) {

    const wave1 =
        Math.sin(x * 0.11) * 2.2;

    const wave2 =
        Math.cos(z * 0.10) * 2.0;

    const wave3 =
        Math.sin((x + z) * 0.065) * 1.6;

    const wave4 =
        Math.cos((x - z) * 0.045) * 1.2;


    let height =
        3 +
        wave1 +
        wave2 +
        wave3 +
        wave4;


    height =
        Math.floor(height);


    height =
        Math.max(
            0,
            Math.min(
                8,
                height
            )
        );


    return height;

}


// ======================================================
// RANDOM NUMBER BASED ON COORDINATES
// ======================================================

function coordinateRandom(x, z) {

    const value =
        Math.sin(
            x * 12.9898 +
            z * 78.233
        ) * 43758.5453;


    return value -
        Math.floor(value);

}


// ======================================================
// TREE SPAWN CHECK
// ======================================================

function canTreeSpawn(x, z) {

    const spawnX = 0;
    const spawnZ = 8;


    const distance =
        Math.sqrt(
            Math.pow(
                x - spawnX,
                2
            ) +
            Math.pow(
                z - spawnZ,
                2
            )
        );


    if (distance < 8) {

        return false;

    }


    if (
        Math.abs(x) >
        worldSize - 4
        ||
        Math.abs(z) >
        worldSize - 4
    ) {

        return false;

    }


    const center =
        getTerrainHeight(x, z);

    const north =
        getTerrainHeight(x, z - 1);

    const south =
        getTerrainHeight(x, z + 1);

    const east =
        getTerrainHeight(x + 1, z);

    const west =
        getTerrainHeight(x - 1, z);


    if (
        Math.abs(center - north) > 1 ||
        Math.abs(center - south) > 1 ||
        Math.abs(center - east) > 1 ||
        Math.abs(center - west) > 1
    ) {

        return false;

    }


    return true;

}


// ======================================================
// PLAYER VS TREE COLLISION
// ======================================================

function playerHitsTree(
    testX,
    testY,
    testZ
) {

    const playerMinX =
        testX - playerRadius;

    const playerMaxX =
        testX + playerRadius;


    const playerMinZ =
        testZ - playerRadius;

    const playerMaxZ =
        testZ + playerRadius;


    const feetY =
        testY - eyeHeight;


    const playerMinY =
        feetY;

    const playerMaxY =
        feetY + playerHeight;


    // Blocks are centered on whole numbers
    // and extend 0.5 in every direction.

    const minBlockX =
        Math.ceil(
            playerMinX - 0.5
        );

    const maxBlockX =
        Math.floor(
            playerMaxX + 0.5
        );


    const minBlockY =
        Math.ceil(
            playerMinY - 0.5
        );

    const maxBlockY =
        Math.floor(
            playerMaxY + 0.5
        );


    const minBlockZ =
        Math.ceil(
            playerMinZ - 0.5
        );

    const maxBlockZ =
        Math.floor(
            playerMaxZ + 0.5
        );


    for (
        let x = minBlockX;
        x <= maxBlockX;
        x++
    ) {

        for (
            let y = minBlockY;
            y <= maxBlockY;
            y++
        ) {

            for (
                let z = minBlockZ;
                z <= maxBlockZ;
                z++
            ) {

                if (
                    !solidTreeBlocks.has(
                        blockKey(
                            x,
                            y,
                            z
                        )
                    )
                ) {

                    continue;

                }


                const blockMinX =
                    x - 0.5;

                const blockMaxX =
                    x + 0.5;

                const blockMinY =
                    y - 0.5;

                const blockMaxY =
                    y + 0.5;

                const blockMinZ =
                    z - 0.5;

                const blockMaxZ =
                    z + 0.5;


                const overlapsX =
                    playerMaxX >
                    blockMinX
                    &&
                    playerMinX <
                    blockMaxX;


                const overlapsY =
                    playerMaxY >
                    blockMinY
                    &&
                    playerMinY <
                    blockMaxY;


                const overlapsZ =
                    playerMaxZ >
                    blockMinZ
                    &&
                    playerMinZ <
                    blockMaxZ;


                if (
                    overlapsX &&
                    overlapsY &&
                    overlapsZ
                ) {

                    return true;

                }

            }

        }

    }


    return false;

}


// ======================================================
// START GAME
// ======================================================

function startGame() {

    // ==================================================
    // SCENE
    // ==================================================

    scene =
        new THREE.Scene();


    scene.background =
        new THREE.Color(
            0x79c9f2
        );


    scene.fog =
        new THREE.Fog(
            0x79c9f2,
            55,
            120
        );


    // ==================================================
    // CAMERA
    // ==================================================

    camera =
        new THREE.PerspectiveCamera(
            75,
            window.innerWidth /
            window.innerHeight,
            0.1,
            500
        );


    camera.rotation.order =
        "YXZ";


    const spawnX = 0;
    const spawnZ = 8;


    const spawnHeight =
        getTerrainHeight(
            spawnX,
            spawnZ
        );


    camera.position.set(
        spawnX,
        spawnHeight +
        0.5 +
        eyeHeight,
        spawnZ
    );


    // ==================================================
    // RENDERER
    // ==================================================

    renderer =
        new THREE.WebGLRenderer({
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


    // ==================================================
    // POINTER LOCK
    // ==================================================

    renderer.domElement.addEventListener(
        "click",
        () => {

            renderer.domElement
                .requestPointerLock();

        }
    );


    // ==================================================
    // MOUSE LOOK
    // ==================================================

    document.addEventListener(
        "mousemove",
        (event) => {

            if (
                document.pointerLockElement !==
                renderer.domElement
            ) {

                return;

            }


            const sensitivity =
                0.002;


            yaw -=
                event.movementX *
                sensitivity;


            pitch -=
                event.movementY *
                sensitivity;


            const maximumPitch =
                Math.PI / 2 -
                0.01;


            pitch =
                Math.max(
                    -maximumPitch,
                    Math.min(
                        maximumPitch,
                        pitch
                    )
                );


            camera.rotation.y =
                yaw;

            camera.rotation.x =
                pitch;

        }
    );


    // ==================================================
    // KEYBOARD
    // ==================================================

    document.addEventListener(
        "keydown",
        (event) => {

            keys[event.code] =
                true;


            if (
                event.code === "Space" &&
                onGround
            ) {

                verticalVelocity =
                    jumpPower;

                onGround =
                    false;

            }


            if (
                event.code === "Space"
            ) {

                event.preventDefault();

            }

        }
    );


    document.addEventListener(
        "keyup",
        (event) => {

            keys[event.code] =
                false;

        }
    );


    // ==================================================
    // LIGHTING
    // ==================================================

    const sunlight =
        new THREE.DirectionalLight(
            0xffffff,
            2.3
        );


    sunlight.position.set(
        40,
        70,
        25
    );


    scene.add(
        sunlight
    );


    const ambientLight =
        new THREE.AmbientLight(
            0xffffff,
            1.1
        );


    scene.add(
        ambientLight
    );


    // ==================================================
    // MATERIALS
    // ==================================================

    const grassTop =
        new THREE.MeshLambertMaterial({
            color: 0x61b84a
        });


    const grassSide =
        new THREE.MeshLambertMaterial({
            color: 0x56883c
        });


    const dirtMaterial =
        new THREE.MeshLambertMaterial({
            color: 0x795235
        });


    const woodMaterial =
        new THREE.MeshLambertMaterial({
            color: 0x765030
        });


    const leavesMaterial =
        new THREE.MeshLambertMaterial({
            color: 0x357a32
        });


    const grassMaterials = [
        grassSide,
        grassSide,
        grassTop,
        dirtMaterial,
        grassSide,
        grassSide
    ];


    // ==================================================
    // BLOCK GEOMETRY
    // ==================================================

    const blockGeometry =
        new THREE.BoxGeometry(
            1,
            1,
            1
        );


    // ==================================================
    // BLOCK DATA
    // ==================================================

    const grassBlocks = [];
    const dirtBlocks = [];

    const trunkBlocks = [];
    const leafBlocks = [];


    // ==================================================
    // GENERATE WORLD
    // ==================================================

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

            const height =
                getTerrainHeight(
                    x,
                    z
                );


            // GRASS

            grassBlocks.push({
                x: x,
                y: height,
                z: z
            });


            // DIRT

            dirtBlocks.push({
                x: x,
                y: height - 1,
                z: z
            });


            dirtBlocks.push({
                x: x,
                y: height - 2,
                z: z
            });


            dirtBlocks.push({
                x: x,
                y: height - 3,
                z: z
            });


            // TREES

            const treeChance =
                coordinateRandom(
                    x,
                    z
                );


            if (
                treeChance < 0.027 &&
                canTreeSpawn(
                    x,
                    z
                )
            ) {

                createTree(
                    x,
                    height,
                    z,
                    trunkBlocks,
                    leafBlocks
                );

            }

        }

    }


    // ==================================================
    // REGISTER TREE COLLISIONS
    // ==================================================

    solidTreeBlocks.clear();


    for (
        const block of trunkBlocks
    ) {

        addSolidTreeBlock(
            block.x,
            block.y,
            block.z
        );

    }


    for (
        const block of leafBlocks
    ) {

        addSolidTreeBlock(
            block.x,
            block.y,
            block.z
        );

    }


    // ==================================================
    // CREATE BLOCKS
    // ==================================================

    createInstancedBlocks(
        blockGeometry,
        grassMaterials,
        grassBlocks
    );


    createInstancedBlocks(
        blockGeometry,
        dirtMaterial,
        dirtBlocks
    );


    createInstancedBlocks(
        blockGeometry,
        woodMaterial,
        trunkBlocks
    );


    createInstancedBlocks(
        blockGeometry,
        leavesMaterial,
        leafBlocks
    );


    // ==================================================
    // CLOCK
    // ==================================================

    clock =
        new THREE.Clock();


    animate();

}


// ======================================================
// CREATE INSTANCED BLOCKS
// ======================================================

function createInstancedBlocks(
    geometry,
    material,
    blocks
) {

    if (
        blocks.length === 0
    ) {

        return;

    }


    const mesh =
        new THREE.InstancedMesh(
            geometry,
            material,
            blocks.length
        );


    const dummy =
        new THREE.Object3D();


    for (
        let i = 0;
        i < blocks.length;
        i++
    ) {

        const block =
            blocks[i];


        dummy.position.set(
            block.x,
            block.y,
            block.z
        );


        dummy.updateMatrix();


        mesh.setMatrixAt(
            i,
            dummy.matrix
        );

    }


    mesh.instanceMatrix.needsUpdate =
        true;


    scene.add(
        mesh
    );

}


// ======================================================
// CREATE TREE
// ======================================================

function createTree(
    x,
    groundHeight,
    z,
    trunkBlocks,
    leafBlocks
) {

    const random =
        coordinateRandom(
            x + 500,
            z + 500
        );


    const trunkHeight =
        random > 0.5
            ? 5
            : 4;


    // ==================================================
    // TRUNK
    // ==================================================

    for (
        let y = 1;
        y <= trunkHeight;
        y++
    ) {

        trunkBlocks.push({
            x: x,
            y: groundHeight + y,
            z: z
        });

    }


    const leafBase =
        groundHeight +
        trunkHeight;


    // ==================================================
    // LOWER LEAVES
    // ==================================================

    for (
        let leafX = -2;
        leafX <= 2;
        leafX++
    ) {

        for (
            let leafZ = -2;
            leafZ <= 2;
            leafZ++
        ) {

            if (
                Math.abs(leafX) === 2 &&
                Math.abs(leafZ) === 2
            ) {

                continue;

            }


            if (
                leafX === 0 &&
                leafZ === 0
            ) {

                continue;

            }


            leafBlocks.push({
                x: x + leafX,
                y: leafBase,
                z: z + leafZ
            });

        }

    }


    // ==================================================
    // MIDDLE LEAVES
    // ==================================================

    for (
        let leafX = -2;
        leafX <= 2;
        leafX++
    ) {

        for (
            let leafZ = -2;
            leafZ <= 2;
            leafZ++
        ) {

            if (
                Math.abs(leafX) === 2 &&
                Math.abs(leafZ) === 2
            ) {

                continue;

            }


            leafBlocks.push({
                x: x + leafX,
                y: leafBase + 1,
                z: z + leafZ
            });

        }

    }


    // ==================================================
    // TOP LEAVES
    // ==================================================

    for (
        let leafX = -1;
        leafX <= 1;
        leafX++
    ) {

        for (
            let leafZ = -1;
            leafZ <= 1;
            leafZ++
        ) {

            leafBlocks.push({
                x: x + leafX,
                y: leafBase + 2,
                z: z + leafZ
            });

        }

    }


    leafBlocks.push({
        x: x,
        y: leafBase + 3,
        z: z
    });

}


// ======================================================
// PLAYER MOVEMENT
// ======================================================

function updateMovement(delta) {

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


    if (
        keys["KeyW"]
    ) {

        movement.add(
            forward
        );

    }


    if (
        keys["KeyS"]
    ) {

        movement.sub(
            forward
        );

    }


    if (
        keys["KeyD"]
    ) {

        movement.add(
            right
        );

    }


    if (
        keys["KeyA"]
    ) {

        movement.sub(
            right
        );

    }


    if (
        movement.lengthSq() > 0
    ) {

        movement.normalize();


        movement.multiplyScalar(
            moveSpeed *
            delta
        );


        // ==============================================
        // X COLLISION
        // ==============================================

        const nextX =
            camera.position.x +
            movement.x;


        if (
            !playerHitsTree(
                nextX,
                camera.position.y,
                camera.position.z
            )
        ) {

            camera.position.x =
                nextX;

        }


        // ==============================================
        // Z COLLISION
        // ==============================================

        const nextZ =
            camera.position.z +
            movement.z;


        if (
            !playerHitsTree(
                camera.position.x,
                camera.position.y,
                nextZ
            )
        ) {

            camera.position.z =
                nextZ;

        }

    }


    // ==================================================
    // MAP BOUNDARY
    // ==================================================

    const mapEdge =
        worldSize -
        0.5;


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


    // ==================================================
    // TERRAIN BELOW PLAYER
    // ==================================================

    const blockX =
        Math.round(
            camera.position.x
        );


    const blockZ =
        Math.round(
            camera.position.z
        );


    const terrainHeight =
        getTerrainHeight(
            blockX,
            blockZ
        );


    const standingHeight =
        terrainHeight +
        0.5 +
        eyeHeight;


    // ==================================================
    // GRAVITY
    // ==================================================

    verticalVelocity -=
        gravity *
        delta;


    const nextY =
        camera.position.y +
        verticalVelocity *
        delta;


    // ==================================================
    // VERTICAL TREE COLLISION
    // ==================================================

    if (
        playerHitsTree(
            camera.position.x,
            nextY,
            camera.position.z
        )
    ) {

        if (
            verticalVelocity < 0
        ) {

            onGround =
                true;

        }


        verticalVelocity =
            0;

    }

    else {

        camera.position.y =
            nextY;

    }


    // ==================================================
    // TERRAIN COLLISION
    // ==================================================

    if (
        camera.position.y <=
        standingHeight
    ) {

        camera.position.y =
            standingHeight;


        verticalVelocity =
            0;


        onGround =
            true;

    }

    else if (
        verticalVelocity !== 0
    ) {

        onGround =
            false;

    }

}


// ======================================================
// GAME LOOP
// ======================================================

function animate() {

    requestAnimationFrame(
        animate
    );


    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );


    updateMovement(
        delta
    );


    renderer.render(
        scene,
        camera
    );

}


// ======================================================
// WINDOW RESIZE
// ======================================================

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
