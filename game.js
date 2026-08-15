import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

console.log("SQUARE CRAFT SURVIVAL - BREAKING + PLACING VERSION");

// ======================================================
// HTML
// ======================================================

const playButton = document.getElementById("playButton");
const startScreen = document.getElementById("startScreen");
const gameContainer = document.getElementById("game");

const hotbarSlots =
    Array.from(document.querySelectorAll(".slot"));

gameContainer.style.display = "none";


// ======================================================
// THREE.JS
// ======================================================

let scene;
let camera;
let renderer;
let clock;

let blockGeometry;


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

const worldBlocks =
    new Map();

const blocksByType = {

    grass: new Map(),

    dirt: new Map(),

    wood: new Map(),

    leaves: new Map(),

    stone: new Map()

};


// ======================================================
// RENDERED BLOCK MESHES
// ======================================================

const renderMeshes = {

    grass: null,

    dirt: null,

    wood: null,

    leaves: null,

    stone: null

};


let materials = {};


// ======================================================
// BLOCK INTERACTION
// ======================================================

const raycaster =
    new THREE.Raycaster();

const screenCenter =
    new THREE.Vector2(
        0,
        0
    );

const blockReach = 6;

raycaster.far =
    blockReach;


// ======================================================
// HOTBAR
// ======================================================

const hotbarTypes = [

    "grass",
    "dirt",
    "wood",
    "leaves",
    "stone"

];

let selectedHotbarIndex = 0;


// ======================================================
// BLOCK NAME LABEL
// ======================================================

const blockNameLabel =
    document.createElement("div");

blockNameLabel.style.position =
    "fixed";

blockNameLabel.style.bottom =
    "95px";

blockNameLabel.style.left =
    "50%";

blockNameLabel.style.transform =
    "translateX(-50%)";

blockNameLabel.style.color =
    "white";

blockNameLabel.style.fontSize =
    "22px";

blockNameLabel.style.fontWeight =
    "bold";

blockNameLabel.style.textShadow =
    "2px 2px 0 black";

blockNameLabel.style.pointerEvents =
    "none";

blockNameLabel.style.zIndex =
    "20";

gameContainer.appendChild(
    blockNameLabel
);


// ======================================================
// BLOCK KEY
// ======================================================

function blockKey(
    x,
    y,
    z
) {

    return `${x},${y},${z}`;

}


// ======================================================
// ADD BLOCK
// ======================================================

function addBlock(
    x,
    y,
    z,
    type
) {

    const key =
        blockKey(
            x,
            y,
            z
        );


    if (
        worldBlocks.has(key)
    ) {

        return false;

    }


    const block = {

        x: x,
        y: y,
        z: z,

        type: type

    };


    worldBlocks.set(
        key,
        block
    );


    blocksByType[type].set(
        key,
        block
    );


    return true;

}


// ======================================================
// REMOVE BLOCK
// ======================================================

function removeBlock(
    x,
    y,
    z
) {

    const key =
        blockKey(
            x,
            y,
            z
        );


    const block =
        worldBlocks.get(key);


    if (!block) {

        return null;

    }


    worldBlocks.delete(
        key
    );


    blocksByType[
        block.type
    ].delete(
        key
    );


    return block;

}


// ======================================================
// CHECK FOR BLOCK
// ======================================================

function blockExists(
    x,
    y,
    z
) {

    return worldBlocks.has(
        blockKey(
            x,
            y,
            z
        )
    );

}


// ======================================================
// PLAY BUTTON
// ======================================================

playButton.addEventListener(
    "click",
    () => {

        startScreen.style.display =
            "none";

        gameContainer.style.display =
            "block";

        startGame();

    }
);


// ======================================================
// TERRAIN HEIGHT
// ======================================================

function getTerrainHeight(
    x,
    z
) {

    const wave1 =
        Math.sin(
            x * 0.11
        ) * 2.2;


    const wave2 =
        Math.cos(
            z * 0.10
        ) * 2.0;


    const wave3 =
        Math.sin(
            (x + z) *
            0.065
        ) * 1.6;


    const wave4 =
        Math.cos(
            (x - z) *
            0.045
        ) * 1.2;


    let height =

        3 +

        wave1 +

        wave2 +

        wave3 +

        wave4;


    height =
        Math.floor(
            height
        );


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
// COORDINATE RANDOM
// ======================================================

function coordinateRandom(
    x,
    z
) {

    const value =

        Math.sin(

            x * 12.9898 +

            z * 78.233

        ) *

        43758.5453;


    return value -
        Math.floor(value);

}


// ======================================================
// TREE SPAWN CHECK
// ======================================================

function canTreeSpawn(
    x,
    z
) {

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


    if (
        distance < 8
    ) {

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
        getTerrainHeight(
            x,
            z
        );


    const north =
        getTerrainHeight(
            x,
            z - 1
        );


    const south =
        getTerrainHeight(
            x,
            z + 1
        );


    const east =
        getTerrainHeight(
            x + 1,
            z
        );


    const west =
        getTerrainHeight(
            x - 1,
            z
        );


    if (

        Math.abs(
            center - north
        ) > 1

        ||

        Math.abs(
            center - south
        ) > 1

        ||

        Math.abs(
            center - east
        ) > 1

        ||

        Math.abs(
            center - west
        ) > 1

    ) {

        return false;

    }


    return true;

}


// ======================================================
// HOTBAR UPDATE
// ======================================================

function updateHotbar() {

    for (
        let i = 0;
        i < hotbarSlots.length;
        i++
    ) {

        hotbarSlots[i]
            .classList
            .toggle(
                "selected",
                i === selectedHotbarIndex
            );


        hotbarSlots[i].textContent =
            i + 1;


        hotbarSlots[i].title =
            hotbarTypes[i];

    }


    const selectedType =
        hotbarTypes[
            selectedHotbarIndex
        ];


    blockNameLabel.textContent =
        selectedType.toUpperCase();

}


// ======================================================
// PLAYER AABB COLLISION
// ======================================================

function playerCollides(
    testX,
    testY,
    testZ
) {

    const playerMinX =
        testX -
        playerRadius;

    const playerMaxX =
        testX +
        playerRadius;


    const playerMinZ =
        testZ -
        playerRadius;

    const playerMaxZ =
        testZ +
        playerRadius;


    const feetY =
        testY -
        eyeHeight;


    const playerMinY =
        feetY;


    const playerMaxY =
        feetY +
        playerHeight;


    const minBlockX =
        Math.ceil(
            playerMinX -
            0.5
        );


    const maxBlockX =
        Math.floor(
            playerMaxX +
            0.5
        );


    const minBlockY =
        Math.ceil(
            playerMinY -
            0.5
        );


    const maxBlockY =
        Math.floor(
            playerMaxY +
            0.5
        );


    const minBlockZ =
        Math.ceil(
            playerMinZ -
            0.5
        );


    const maxBlockZ =
        Math.floor(
            playerMaxZ +
            0.5
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
                    !blockExists(
                        x,
                        y,
                        z
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


                const overlapX =

                    playerMaxX >
                    blockMinX

                    &&

                    playerMinX <
                    blockMaxX;


                const overlapY =

                    playerMaxY >
                    blockMinY

                    &&

                    playerMinY <
                    blockMaxY;


                const overlapZ =

                    playerMaxZ >
                    blockMinZ

                    &&

                    playerMinZ <
                    blockMaxZ;


                if (

                    overlapX &&
                    overlapY &&
                    overlapZ

                ) {

                    return true;

                }

            }

        }

    }


    return false;

}


// ======================================================
// CHECK IF NEW BLOCK WOULD HIT PLAYER
// ======================================================

function blockWouldHitPlayer(
    blockX,
    blockY,
    blockZ
) {

    const feetY =
        camera.position.y -
        eyeHeight;


    const playerMinX =
        camera.position.x -
        playerRadius;

    const playerMaxX =
        camera.position.x +
        playerRadius;


    const playerMinY =
        feetY;

    const playerMaxY =
        feetY +
        playerHeight;


    const playerMinZ =
        camera.position.z -
        playerRadius;

    const playerMaxZ =
        camera.position.z +
        playerRadius;


    const blockMinX =
        blockX - 0.5;

    const blockMaxX =
        blockX + 0.5;


    const blockMinY =
        blockY - 0.5;

    const blockMaxY =
        blockY + 0.5;


    const blockMinZ =
        blockZ - 0.5;

    const blockMaxZ =
        blockZ + 0.5;


    return (

        playerMaxX > blockMinX &&

        playerMinX < blockMaxX &&

        playerMaxY > blockMinY &&

        playerMinY < blockMaxY &&

        playerMaxZ > blockMinZ &&

        playerMinZ < blockMaxZ

    );

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

            if (
                document.pointerLockElement !==
                renderer.domElement
            ) {

                renderer.domElement
                    .requestPointerLock();

            }

        }
    );


    // ==================================================
    // DISABLE RIGHT CLICK MENU
    // ==================================================

    renderer.domElement.addEventListener(
        "contextmenu",
        (event) => {

            event.preventDefault();

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
    // BLOCK BREAK / PLACE
    // ==================================================

    renderer.domElement.addEventListener(
        "mousedown",
        (event) => {

            if (
                document.pointerLockElement !==
                renderer.domElement
            ) {

                return;

            }


            // LEFT CLICK

            if (
                event.button === 0
            ) {

                breakTargetBlock();

            }


            // RIGHT CLICK

            if (
                event.button === 2
            ) {

                placeTargetBlock();

            }

        }
    );


    // ==================================================
    // MOUSE WHEEL HOTBAR
    // ==================================================

    renderer.domElement.addEventListener(
        "wheel",
        (event) => {

            if (
                document.pointerLockElement !==
                renderer.domElement
            ) {

                return;

            }


            event.preventDefault();


            if (
                event.deltaY > 0
            ) {

                selectedHotbarIndex++;

            }
            else {

                selectedHotbarIndex--;

            }


            if (
                selectedHotbarIndex >
                hotbarTypes.length - 1
            ) {

                selectedHotbarIndex =
                    0;

            }


            if (
                selectedHotbarIndex <
                0
            ) {

                selectedHotbarIndex =
                    hotbarTypes.length - 1;

            }


            updateHotbar();

        },
        {
            passive: false
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


            // JUMP

            if (

                event.code ===
                "Space"

                &&

                onGround

            ) {

                verticalVelocity =
                    jumpPower;


                onGround =
                    false;

            }


            if (
                event.code ===
                "Space"
            ) {

                event.preventDefault();

            }


            // HOTBAR

            if (
                event.code.startsWith(
                    "Digit"
                )
            ) {

                const number =
                    Number(
                        event.code.substring(
                            5
                        )
                    );


                if (
                    number >= 1 &&
                    number <= 5
                ) {

                    selectedHotbarIndex =
                        number - 1;


                    updateHotbar();

                }

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
    // BLOCK MATERIALS
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


    const stoneMaterial =
        new THREE.MeshLambertMaterial({

            color: 0x777777

        });


    const grassMaterials = [

        grassSide,

        grassSide,

        grassTop,

        dirtMaterial,

        grassSide,

        grassSide

    ];


    materials = {

        grass:
            grassMaterials,

        dirt:
            dirtMaterial,

        wood:
            woodMaterial,

        leaves:
            leavesMaterial,

        stone:
            stoneMaterial

    };


    // ==================================================
    // GEOMETRY
    // ==================================================

    blockGeometry =
        new THREE.BoxGeometry(
            1,
            1,
            1
        );


    // ==================================================
    // GENERATE WORLD
    // ==================================================

    generateWorld();


    // ==================================================
    // SPAWN PLAYER
    // ==================================================

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
    // HOTBAR
    // ==================================================

    updateHotbar();


    // ==================================================
    // CLOCK
    // ==================================================

    clock =
        new THREE.Clock();


    animate();

}


// ======================================================
// GENERATE WORLD
// ======================================================

function generateWorld() {

    worldBlocks.clear();


    for (
        const type of
        hotbarTypes
    ) {

        blocksByType[
            type
        ].clear();

    }


    // ==================================================
    // TERRAIN
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

            addBlock(

                x,

                height,

                z,

                "grass"

            );


            // DIRT LAYER 1

            addBlock(

                x,

                height - 1,

                z,

                "dirt"

            );


            // DIRT LAYER 2

            addBlock(

                x,

                height - 2,

                z,

                "dirt"

            );


            // STONE

            addBlock(

                x,

                height - 3,

                z,

                "stone"

            );

        }

    }


    // ==================================================
    // TREES
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

            const treeChance =
                coordinateRandom(
                    x,
                    z
                );


            if (

                treeChance <
                0.027

                &&

                canTreeSpawn(
                    x,
                    z
                )

            ) {

                createTree(

                    x,

                    getTerrainHeight(
                        x,
                        z
                    ),

                    z

                );

            }

        }

    }


    // ==================================================
    // RENDER ALL TYPES
    // ==================================================

    rebuildAllBlocks();

}


// ======================================================
// CREATE TREE
// ======================================================

function createTree(
    x,
    groundHeight,
    z
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

        addBlock(

            x,

            groundHeight +
            y,

            z,

            "wood"

        );

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

                Math.abs(
                    leafX
                ) === 2

                &&

                Math.abs(
                    leafZ
                ) === 2

            ) {

                continue;

            }


            if (

                leafX === 0

                &&

                leafZ === 0

            ) {

                continue;

            }


            addBlock(

                x + leafX,

                leafBase,

                z + leafZ,

                "leaves"

            );

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

                Math.abs(
                    leafX
                ) === 2

                &&

                Math.abs(
                    leafZ
                ) === 2

            ) {

                continue;

            }


            addBlock(

                x + leafX,

                leafBase +
                1,

                z + leafZ,

                "leaves"

            );

        }

    }


    // ==================================================
    // UPPER LEAVES
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

            addBlock(

                x + leafX,

                leafBase +
                2,

                z + leafZ,

                "leaves"

            );

        }

    }


    addBlock(

        x,

        leafBase +
        3,

        z,

        "leaves"

    );

}


// ======================================================
// BLOCK COLOR VARIATION
// ======================================================

function getBlockTint(
    block
) {

    const random1 =
        coordinateRandom(

            block.x * 7 +
            block.y * 3,

            block.z * 11

        );


    const random2 =
        coordinateRandom(

            block.x * 17,

            block.z * 5 +
            block.y * 9

        );


    const color =
        new THREE.Color();


    if (
        block.type ===
        "grass"
    ) {

        color.setRGB(

            0.88 +
            random1 * 0.10,

            0.91 +
            random2 * 0.09,

            0.87 +
            random1 * 0.09

        );

    }

    else if (
        block.type ===
        "leaves"
    ) {

        color.setRGB(

            0.82 +
            random1 * 0.13,

            0.88 +
            random2 * 0.12,

            0.82 +
            random1 * 0.12

        );

    }

    else if (
        block.type ===
        "wood"
    ) {

        const shade =
            0.86 +
            random1 *
            0.14;


        color.setRGB(

            shade,

            shade *
            0.96,

            shade *
            0.90

        );

    }

    else {

        const shade =
            0.87 +
            random1 *
            0.13;


        color.setRGB(

            shade,

            shade,

            shade

        );

    }


    return color;

}


// ======================================================
// REBUILD ALL BLOCK TYPES
// ======================================================

function rebuildAllBlocks() {

    rebuildType(
        "grass"
    );

    rebuildType(
        "dirt"
    );

    rebuildType(
        "wood"
    );

    rebuildType(
        "leaves"
    );

    rebuildType(
        "stone"
    );

}


// ======================================================
// REBUILD ONE BLOCK TYPE
// ======================================================

function rebuildType(
    type
) {

    const oldMesh =
        renderMeshes[
            type
        ];


    if (oldMesh) {

        scene.remove(
            oldMesh
        );


        if (
            typeof oldMesh.dispose ===
            "function"
        ) {

            oldMesh.dispose();

        }

    }


    const blocks =
        Array.from(

            blocksByType[
                type
            ].values()

        );


    if (
        blocks.length === 0
    ) {

        renderMeshes[
            type
        ] = null;


        return;

    }


    const mesh =
        new THREE.InstancedMesh(

            blockGeometry,

            materials[
                type
            ],

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


        const tint =
            getBlockTint(
                block
            );


        mesh.setColorAt(

            i,

            tint

        );

    }


    mesh.instanceMatrix.needsUpdate =
        true;


    if (
        mesh.instanceColor
    ) {

        mesh.instanceColor.needsUpdate =
            true;

    }


    mesh.userData.blocks =
        blocks;


    mesh.userData.blockType =
        type;


    mesh.computeBoundingSphere();


    scene.add(
        mesh
    );


    renderMeshes[
        type
    ] = mesh;

}


// ======================================================
// FIND BLOCK PLAYER IS LOOKING AT
// ======================================================

function getTargetBlock() {

    raycaster.setFromCamera(

        screenCenter,

        camera

    );


    const meshes =

        Object.values(
            renderMeshes
        )

        .filter(
            mesh => mesh !== null
        );


    const hits =

        raycaster.intersectObjects(

            meshes,

            false

        );


    if (
        hits.length === 0
    ) {

        return null;

    }


    for (
        const hit of hits
    ) {

        if (
            hit.instanceId ===
            undefined
        ) {

            continue;

        }


        const block =

            hit.object
                .userData
                .blocks[
                    hit.instanceId
                ];


        if (!block) {

            continue;

        }


        return {

            block: block,

            hit: hit

        };

    }


    return null;

}


// ======================================================
// BREAK BLOCK
// ======================================================

function breakTargetBlock() {

    const target =
        getTargetBlock();


    if (!target) {

        return;

    }


    const block =
        target.block;


    const removed =
        removeBlock(

            block.x,

            block.y,

            block.z

        );


    if (!removed) {

        return;

    }


    rebuildType(
        removed.type
    );

}


// ======================================================
// PLACE BLOCK
// ======================================================

function placeTargetBlock() {

    const target =
        getTargetBlock();


    if (!target) {

        return;

    }


    if (
        !target.hit.face
    ) {

        return;

    }


    const block =
        target.block;


    const normal =
        target.hit.face.normal;


    const normalX =
        Math.round(
            normal.x
        );


    const normalY =
        Math.round(
            normal.y
        );


    const normalZ =
        Math.round(
            normal.z
        );


    const placeX =

        block.x +
        normalX;


    const placeY =

        block.y +
        normalY;


    const placeZ =

        block.z +
        normalZ;


    // ==================================================
    // WORLD LIMIT
    // ==================================================

    if (

        Math.abs(
            placeX
        ) > worldSize

        ||

        Math.abs(
            placeZ
        ) > worldSize

    ) {

        return;

    }


    if (

        placeY <
        -10

        ||

        placeY >
        40

    ) {

        return;

    }


    // ==================================================
    // BLOCK ALREADY THERE
    // ==================================================

    if (
        blockExists(

            placeX,

            placeY,

            placeZ

        )
    ) {

        return;

    }


    // ==================================================
    // DON'T PLACE INSIDE PLAYER
    // ==================================================

    if (
        blockWouldHitPlayer(

            placeX,

            placeY,

            placeZ

        )
    ) {

        return;

    }


    const selectedType =

        hotbarTypes[
            selectedHotbarIndex
        ];


    const added =
        addBlock(

            placeX,

            placeY,

            placeZ,

            selectedType

        );


    if (
        added
    ) {

        rebuildType(
            selectedType
        );

    }

}


// ======================================================
// MOVE PLAYER ON ONE AXIS
// ======================================================

function moveHorizontalAxis(
    axis,
    amount
) {

    if (
        amount === 0
    ) {

        return;

    }


    const maxStep =
        0.08;


    const steps =
        Math.ceil(

            Math.abs(
                amount
            ) /

            maxStep

        );


    const step =
        amount /
        steps;


    for (
        let i = 0;
        i < steps;
        i++
    ) {

        let testX =
            camera.position.x;

        let testZ =
            camera.position.z;


        if (
            axis === "x"
        ) {

            testX +=
                step;

        }


        if (
            axis === "z"
        ) {

            testZ +=
                step;

        }


        if (
            playerCollides(

                testX,

                camera.position.y,

                testZ

            )
        ) {

            break;

        }


        camera.position.x =
            testX;


        camera.position.z =
            testZ;

    }

}


// ======================================================
// VERTICAL MOVEMENT
// ======================================================

function moveVertical(
    amount
) {

    if (
        amount === 0
    ) {

        return;

    }


    const maxStep =
        0.04;


    const steps =
        Math.ceil(

            Math.abs(
                amount
            ) /

            maxStep

        );


    const step =
        amount /
        steps;


    for (
        let i = 0;
        i < steps;
        i++
    ) {

        const testY =

            camera.position.y +

            step;


        if (
            playerCollides(

                camera.position.x,

                testY,

                camera.position.z

            )
        ) {

            if (
                step < 0
            ) {

                onGround =
                    true;

            }


            verticalVelocity =
                0;


            return;

        }


        camera.position.y =
            testY;

    }

}


// ======================================================
// PLAYER MOVEMENT
// ======================================================

function updateMovement(
    delta
) {

    const forward =
        new THREE.Vector3(

            -Math.sin(
                yaw
            ),

            0,

            -Math.cos(
                yaw
            )

        );


    const right =
        new THREE.Vector3(

            Math.cos(
                yaw
            ),

            0,

            -Math.sin(
                yaw
            )

        );


    const movement =
        new THREE.Vector3();


    // W

    if (
        keys["KeyW"]
    ) {

        movement.add(
            forward
        );

    }


    // S

    if (
        keys["KeyS"]
    ) {

        movement.sub(
            forward
        );

    }


    // D

    if (
        keys["KeyD"]
    ) {

        movement.add(
            right
        );

    }


    // A

    if (
        keys["KeyA"]
    ) {

        movement.sub(
            right
        );

    }


    if (
        movement.lengthSq() >
        0
    ) {

        movement.normalize();


        movement.multiplyScalar(

            moveSpeed *

            delta

        );


        moveHorizontalAxis(

            "x",

            movement.x

        );


        moveHorizontalAxis(

            "z",

            movement.z

        );

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
    // GRAVITY
    // ==================================================

    onGround =
        false;


    verticalVelocity -=

        gravity *

        delta;


    const verticalMovement =

        verticalVelocity *

        delta;


    moveVertical(
        verticalMovement
    );

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
