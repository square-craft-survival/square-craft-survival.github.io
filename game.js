import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

console.log("SQUARE CRAFT SURVIVAL - DARKER TEXTURES + BEDROCK VERSION");

// ======================================================
// HTML
// ======================================================

const playButton = document.getElementById("playButton");
const startScreen = document.getElementById("startScreen");
const gameContainer = document.getElementById("game");
const hotbarSlots = Array.from(document.querySelectorAll(".slot"));

gameContainer.style.display = "none";

// ======================================================
// THREE.JS / PLAYER
// ======================================================

let scene;
let camera;
let renderer;
let clock;
let blockGeometry;
let materials = {};

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
const bedrockY = -4;

const worldBlocks = new Map();

const allBlockTypes = [
    "grass",
    "dirt",
    "wood",
    "leaves",
    "stone",
    "bedrock"
];

const blocksByType = {
    grass: new Map(),
    dirt: new Map(),
    wood: new Map(),
    leaves: new Map(),
    stone: new Map(),
    bedrock: new Map()
};

const renderMeshes = {
    grass: null,
    dirt: null,
    wood: null,
    leaves: null,
    stone: null,
    bedrock: null
};

// ======================================================
// HOTBAR / RAYCASTING
// ======================================================

const hotbarTypes = [
    "grass",
    "dirt",
    "wood",
    "leaves",
    "stone"
];

let selectedHotbarIndex = 0;

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

raycaster.far = 6;

// ======================================================
// BLOCK NAME LABEL
// ======================================================

const blockNameLabel = document.createElement("div");

blockNameLabel.style.position = "fixed";
blockNameLabel.style.bottom = "95px";
blockNameLabel.style.left = "50%";
blockNameLabel.style.transform = "translateX(-50%)";
blockNameLabel.style.color = "white";
blockNameLabel.style.fontSize = "22px";
blockNameLabel.style.fontWeight = "bold";
blockNameLabel.style.textShadow = "2px 2px 0 black";
blockNameLabel.style.pointerEvents = "none";
blockNameLabel.style.zIndex = "20";

gameContainer.appendChild(blockNameLabel);

// ======================================================
// BASIC BLOCK HELPERS
// ======================================================

function blockKey(x, y, z) {
    return `${x},${y},${z}`;
}

function addBlock(x, y, z, type) {
    const key = blockKey(x, y, z);

    if (worldBlocks.has(key)) {
        return false;
    }

    const block = {
        x,
        y,
        z,
        type
    };

    worldBlocks.set(key, block);
    blocksByType[type].set(key, block);

    return true;
}

function removeBlock(x, y, z) {
    const key = blockKey(x, y, z);
    const block = worldBlocks.get(key);

    if (!block || block.type === "bedrock") {
        return null;
    }

    worldBlocks.delete(key);
    blocksByType[block.type].delete(key);

    return block;
}

function blockExists(x, y, z) {
    return worldBlocks.has(blockKey(x, y, z));
}

// ======================================================
// TERRAIN
// ======================================================

function getTerrainHeight(x, z) {
    const wave1 = Math.sin(x * 0.11) * 2.2;
    const wave2 = Math.cos(z * 0.10) * 2.0;
    const wave3 = Math.sin((x + z) * 0.065) * 1.6;
    const wave4 = Math.cos((x - z) * 0.045) * 1.2;

    let height = Math.floor(
        3 +
        wave1 +
        wave2 +
        wave3 +
        wave4
    );

    return Math.max(
        0,
        Math.min(8, height)
    );
}

// ======================================================
// COORDINATE RANDOM
// ======================================================

function coordinateRandom(x, z) {
    const value =
        Math.sin(
            x * 12.9898 +
            z * 78.233
        ) *
        43758.5453;

    return value - Math.floor(value);
}

// ======================================================
// TREE SPAWN
// ======================================================

function canTreeSpawn(x, z) {
    const spawnX = 0;
    const spawnZ = 8;

    const distance = Math.hypot(
        x - spawnX,
        z - spawnZ
    );

    if (distance < 8) {
        return false;
    }

    if (
        Math.abs(x) > worldSize - 4 ||
        Math.abs(z) > worldSize - 4
    ) {
        return false;
    }

    const center = getTerrainHeight(x, z);
    const north = getTerrainHeight(x, z - 1);
    const south = getTerrainHeight(x, z + 1);
    const east = getTerrainHeight(x + 1, z);
    const west = getTerrainHeight(x - 1, z);

    return (
        Math.abs(center - north) <= 1 &&
        Math.abs(center - south) <= 1 &&
        Math.abs(center - east) <= 1 &&
        Math.abs(center - west) <= 1
    );
}

// ======================================================
// PIXEL TEXTURE HELPERS
// ======================================================

function finishPixelTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);

    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;

    return texture;
}

// ======================================================
// SPECKLED PIXEL TEXTURE
// ======================================================

function createSpeckledTexture(
    base,
    light,
    dark,
    amount = 34
) {
    const canvas = document.createElement("canvas");

    canvas.width = 16;
    canvas.height = 16;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 16, 16);

    for (let i = 0; i < amount; i++) {
        const x = (i * 7 + 3) % 16;
        const y = (i * 11 + 5) % 16;

        ctx.fillStyle =
            i % 2 === 0
                ? light
                : dark;

        ctx.fillRect(x, y, 1, 1);
    }

    return finishPixelTexture(canvas);
}

// ======================================================
// GRASS SIDE TEXTURE
// TOP 25% GREEN, BOTTOM 75% DIRT
// ======================================================

function createGrassSideTexture() {
    const canvas = document.createElement("canvas");

    canvas.width = 16;
    canvas.height = 16;

    const ctx = canvas.getContext("2d");

    // Dirt base
    ctx.fillStyle = "#6f492f";
    ctx.fillRect(0, 0, 16, 16);

    // Top 25% grass
    ctx.fillStyle = "#4fa83b";
    ctx.fillRect(0, 0, 16, 4);

    // Dirt variation
    for (let i = 0; i < 22; i++) {
        const x = (i * 5 + 2) % 16;
        const y = 4 + ((i * 9 + 1) % 12);

        ctx.fillStyle =
            i % 2 === 0
                ? "#80563a"
                : "#5d3d29";

        ctx.fillRect(x, y, 1, 1);
    }

    // Grass variation
    for (let i = 0; i < 12; i++) {
        const x = (i * 7 + 1) % 16;
        const y = (i * 3) % 4;

        ctx.fillStyle =
            i % 2 === 0
                ? "#5db649"
                : "#3f8731";

        ctx.fillRect(x, y, 1, 1);
    }

    return finishPixelTexture(canvas);
}

// ======================================================
// PLAY BUTTON
// ======================================================

playButton.addEventListener(
    "click",
    () => {
        startScreen.style.display = "none";
        gameContainer.style.display = "block";

        startGame();
    }
);

// ======================================================
// START GAME
// ======================================================

function startGame() {
    // ==============================
    // SCENE
    // ==============================

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(
            0x72bfe7
        );

    scene.fog =
        new THREE.Fog(
            0x72bfe7,
            55,
            120
        );

    // ==============================
    // CAMERA
    // ==============================

    camera =
        new THREE.PerspectiveCamera(
            75,
            window.innerWidth /
            window.innerHeight,
            0.1,
            500
        );

    camera.rotation.order = "YXZ";

    // ==============================
    // RENDERER
    // ==============================

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

    // ==============================
    // LIGHTING
    // ==============================

    const sunlight =
        new THREE.DirectionalLight(
            0xffffff,
            1.25
        );

    sunlight.position.set(
        40,
        70,
        25
    );

    scene.add(sunlight);

    scene.add(
        new THREE.AmbientLight(
            0xffffff,
            0.45
        )
    );

    // ==============================
    // TEXTURES
    // ==============================

    const grassTopTexture =
        createSpeckledTexture(
            "#4fa83b",
            "#5db649",
            "#3c8730",
            38
        );

    const grassSideTexture =
        createGrassSideTexture();

    const dirtTexture =
        createSpeckledTexture(
            "#6f492f",
            "#80563a",
            "#5d3d29",
            42
        );

    const stoneTexture =
        createSpeckledTexture(
            "#6c6c6c",
            "#808080",
            "#575757",
            45
        );

    const woodTexture =
        createSpeckledTexture(
            "#6b4529",
            "#7c5434",
            "#54361f",
            28
        );

    const leavesTexture =
        createSpeckledTexture(
            "#2f6f2d",
            "#3b8236",
            "#235924",
            40
        );

    const bedrockTexture =
        createSpeckledTexture(
            "#2a2a2a",
            "#404040",
            "#181818",
            55
        );

    // ==============================
    // MATERIALS
    // ==============================

    const grassTopMaterial =
        new THREE.MeshLambertMaterial({
            map: grassTopTexture
        });

    const grassSideMaterial =
        new THREE.MeshLambertMaterial({
            map: grassSideTexture
        });

    const dirtMaterial =
        new THREE.MeshLambertMaterial({
            map: dirtTexture
        });

    const stoneMaterial =
        new THREE.MeshLambertMaterial({
            map: stoneTexture
        });

    const woodMaterial =
        new THREE.MeshLambertMaterial({
            map: woodTexture
        });

    const leavesMaterial =
        new THREE.MeshLambertMaterial({
            map: leavesTexture
        });

    const bedrockMaterial =
        new THREE.MeshLambertMaterial({
            map: bedrockTexture
        });

    // right, left, top, bottom, front, back
    const grassMaterials = [
        grassSideMaterial,
        grassSideMaterial,
        grassTopMaterial,
        dirtMaterial,
        grassSideMaterial,
        grassSideMaterial
    ];

    materials = {
        grass: grassMaterials,
        dirt: dirtMaterial,
        wood: woodMaterial,
        leaves: leavesMaterial,
        stone: stoneMaterial,
        bedrock: bedrockMaterial
    };

    // ==============================
    // BLOCK GEOMETRY
    // ==============================

    blockGeometry =
        new THREE.BoxGeometry(
            1,
            1,
            1
        );

    // ==============================
    // GENERATE WORLD
    // ==============================

    generateWorld();

    // ==============================
    // SPAWN
    // ==============================

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

    // ==============================
    // CONTROLS
    // ==============================

    setupControls();
    updateHotbar();

    // ==============================
    // CLOCK
    // ==============================

    clock = new THREE.Clock();

    animate();
}

// ======================================================
// GENERATE WORLD
// ======================================================

function generateWorld() {
    worldBlocks.clear();

    for (
        const type of
        allBlockTypes
    ) {
        blocksByType[
            type
        ].clear();
    }

    // ==============================
    // TERRAIN
    // ==============================

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

            // DIRT

            addBlock(
                x,
                height - 1,
                z,
                "dirt"
            );

            addBlock(
                x,
                height - 2,
                z,
                "dirt"
            );

            // STONE DOWN TO BEDROCK

            for (
                let y =
                    height - 3;
                y > bedrockY;
                y--
            ) {
                addBlock(
                    x,
                    y,
                    z,
                    "stone"
                );
            }

            // BEDROCK FLOOR

            addBlock(
                x,
                bedrockY,
                z,
                "bedrock"
            );
        }
    }

    // ==============================
    // TREES
    // ==============================

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
            if (
                coordinateRandom(
                    x,
                    z
                ) < 0.027
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

    // TRUNK

    for (
        let y = 1;
        y <= trunkHeight;
        y++
    ) {
        addBlock(
            x,
            groundHeight + y,
            z,
            "wood"
        );
    }

    const leafBase =
        groundHeight +
        trunkHeight;

    // LOWER LEAVES

    for (
        let lx = -2;
        lx <= 2;
        lx++
    ) {
        for (
            let lz = -2;
            lz <= 2;
            lz++
        ) {
            if (
                Math.abs(lx) === 2 &&
                Math.abs(lz) === 2
            ) {
                continue;
            }

            if (
                lx === 0 &&
                lz === 0
            ) {
                continue;
            }

            addBlock(
                x + lx,
                leafBase,
                z + lz,
                "leaves"
            );
        }
    }

    // MIDDLE LEAVES

    for (
        let lx = -2;
        lx <= 2;
        lx++
    ) {
        for (
            let lz = -2;
            lz <= 2;
            lz++
        ) {
            if (
                Math.abs(lx) === 2 &&
                Math.abs(lz) === 2
            ) {
                continue;
            }

            addBlock(
                x + lx,
                leafBase + 1,
                z + lz,
                "leaves"
            );
        }
    }

    // TOP LEAVES

    for (
        let lx = -1;
        lx <= 1;
        lx++
    ) {
        for (
            let lz = -1;
            lz <= 1;
            lz++
        ) {
            addBlock(
                x + lx,
                leafBase + 2,
                z + lz,
                "leaves"
            );
        }
    }

    addBlock(
        x,
        leafBase + 3,
        z,
        "leaves"
    );
}

// ======================================================
// BLOCK VARIATION
// ======================================================

function getBlockTint(
    block
) {
    const random =
        coordinateRandom(
            block.x * 7 +
            block.y * 3,
            block.z * 11
        );

    // Never brighter than the original texture.
    // This keeps the world saturated instead of pastel.
    const shade =
        0.88 +
        random *
        0.12;

    return new THREE.Color(
        shade,
        shade,
        shade
    );
}

// ======================================================
// REBUILD BLOCKS
// ======================================================

function rebuildAllBlocks() {
    for (
        const type of
        allBlockTypes
    ) {
        rebuildType(
            type
        );
    }
}

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

        mesh.setColorAt(
            i,
            getBlockTint(
                block
            )
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
// CONTROLS
// ======================================================

function setupControls() {
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

    renderer.domElement.addEventListener(
        "contextmenu",
        event => {
            event.preventDefault();
        }
    );

    // MOUSE LOOK

    document.addEventListener(
        "mousemove",
        event => {
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

            const maxPitch =
                Math.PI / 2 -
                0.01;

            pitch =
                Math.max(
                    -maxPitch,
                    Math.min(
                        maxPitch,
                        pitch
                    )
                );

            camera.rotation.y =
                yaw;

            camera.rotation.x =
                pitch;
        }
    );

    // KEYBOARD

    document.addEventListener(
        "keydown",
        event => {
            keys[
                event.code
            ] = true;

            // JUMP

            if (
                event.code ===
                "Space"
            ) {
                event.preventDefault();

                if (
                    onGround
                ) {
                    verticalVelocity =
                        jumpPower;

                    onGround =
                        false;
                }
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
                    number >= 1
                    &&
                    number <=
                    hotbarTypes.length
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
        event => {
            keys[
                event.code
            ] = false;
        }
    );

    // BREAK / PLACE

    renderer.domElement.addEventListener(
        "mousedown",
        event => {
            if (
                document.pointerLockElement !==
                renderer.domElement
            ) {
                return;
            }

            if (
                event.button === 0
            ) {
                breakTargetBlock();
            }

            if (
                event.button === 2
            ) {
                placeTargetBlock();
            }
        }
    );

    // MOUSE WHEEL HOTBAR

    renderer.domElement.addEventListener(
        "wheel",
        event => {
            if (
                document.pointerLockElement !==
                renderer.domElement
            ) {
                return;
            }

            event.preventDefault();

            selectedHotbarIndex +=
                event.deltaY > 0
                    ? 1
                    : -1;

            if (
                selectedHotbarIndex >=
                hotbarTypes.length
            ) {
                selectedHotbarIndex =
                    0;
            }

            if (
                selectedHotbarIndex <
                0
            ) {
                selectedHotbarIndex =
                    hotbarTypes.length -
                    1;
            }

            updateHotbar();
        },
        {
            passive: false
        }
    );
}

// ======================================================
// HOTBAR
// ======================================================

function updateHotbar() {
    for (
        let i = 0;
        i < hotbarSlots.length;
        i++
    ) {
        hotbarSlots[
            i
        ].classList.toggle(
            "selected",
            i ===
            selectedHotbarIndex
        );

        hotbarSlots[
            i
        ].textContent =
            i + 1;

        hotbarSlots[
            i
        ].title =
            hotbarTypes[
                i
            ] || "";
    }

    blockNameLabel.textContent =
        hotbarTypes[
            selectedHotbarIndex
        ].toUpperCase();
}

// ======================================================
// COLLISION
// ======================================================

function playerCollides(
    testX,
    testY,
    testZ
) {
    const feetY =
        testY -
        eyeHeight;

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

    // Tiny gap prevents the old
    // "I can only move while jumping" problem.

    const playerMinY =
        feetY +
        0.06;

    const playerMaxY =
        feetY +
        playerHeight -
        0.05;

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

                const overlapsX =
                    playerMaxX >
                    x - 0.5
                    &&
                    playerMinX <
                    x + 0.5;

                const overlapsY =
                    playerMaxY >
                    y - 0.5
                    &&
                    playerMinY <
                    y + 0.5;

                const overlapsZ =
                    playerMaxZ >
                    z - 0.5
                    &&
                    playerMinZ <
                    z + 0.5;

                if (
                    overlapsX
                    &&
                    overlapsY
                    &&
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
// PLACING PLAYER COLLISION
// ======================================================

function blockWouldHitPlayer(
    x,
    y,
    z
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
        feetY +
        0.06;

    const playerMaxY =
        feetY +
        playerHeight -
        0.05;

    const playerMinZ =
        camera.position.z -
        playerRadius;

    const playerMaxZ =
        camera.position.z +
        playerRadius;

    return (
        playerMaxX >
        x - 0.5
        &&
        playerMinX <
        x + 0.5
        &&
        playerMaxY >
        y - 0.5
        &&
        playerMinY <
        y + 0.5
        &&
        playerMaxZ >
        z - 0.5
        &&
        playerMinZ <
        z + 0.5
    );
}

// ======================================================
// HORIZONTAL MOVEMENT
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
            testX += step;
        }

        if (
            axis === "z"
        ) {
            testZ += step;
        }

        // NORMAL MOVEMENT

        if (
            !playerCollides(
                testX,
                camera.position.y,
                testZ
            )
        ) {
            camera.position.x =
                testX;

            camera.position.z =
                testZ;

            continue;
        }

        // TRY STEPPING UP 1 BLOCK

        const raisedY =
            camera.position.y +
            1.01;

        if (
            !playerCollides(
                testX,
                raisedY,
                testZ
            )
        ) {
            camera.position.y =
                raisedY;

            camera.position.x =
                testX;

            camera.position.z =
                testZ;

            verticalVelocity =
                0;

            onGround =
                true;

            continue;
        }

        // REAL WALL

        break;
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
// TARGET BLOCK
// ======================================================

function getTargetBlock() {
    raycaster.setFromCamera(
        screenCenter,
        camera
    );

    const meshes =
        Object.values(
            renderMeshes
        ).filter(
            mesh =>
                mesh !== null
        );

    const hits =
        raycaster.intersectObjects(
            meshes,
            false
        );

    for (
        const hit of
        hits
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

        if (
            !block
        ) {
            continue;
        }

        return {
            block,
            hit
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

    if (
        !target
    ) {
        return;
    }

    // BEDROCK IS UNBREAKABLE

    if (
        target.block.type ===
        "bedrock"
    ) {
        return;
    }

    const removed =
        removeBlock(
            target.block.x,
            target.block.y,
            target.block.z
        );

    if (
        removed
    ) {
        rebuildType(
            removed.type
        );
    }
}

// ======================================================
// PLACE BLOCK
// ======================================================

function placeTargetBlock() {
    const target =
        getTargetBlock();

    if (
        !target ||
        !target.hit.face
    ) {
        return;
    }

    const normal =
        target.hit.face.normal;

    const placeX =
        target.block.x +
        Math.round(
            normal.x
        );

    const placeY =
        target.block.y +
        Math.round(
            normal.y
        );

    const placeZ =
        target.block.z +
        Math.round(
            normal.z
        );

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
        bedrockY
        ||
        placeY >
        40
    ) {
        return;
    }

    if (
        blockExists(
            placeX,
            placeY,
            placeZ
        )
    ) {
        return;
    }

    if (
        blockWouldHitPlayer(
            placeX,
            placeY,
            placeZ
        )
    ) {
        return;
    }

    const type =
        hotbarTypes[
            selectedHotbarIndex
        ];

    if (
        addBlock(
            placeX,
            placeY,
            placeZ,
            type
        )
    ) {
        rebuildType(
            type
        );
    }
}

// ======================================================
// MOVEMENT
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
        movement.lengthSq() >
        0
    ) {
        movement
            .normalize()
            .multiplyScalar(
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

    // MAP LIMIT

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

    // GRAVITY

    onGround =
        false;

    verticalVelocity -=
        gravity *
        delta;

    moveVertical(
        verticalVelocity *
        delta
    );

    // ==================================================
    // EMERGENCY VOID RESCUE
    // ==================================================

    if (
        camera.position.y <
        -12
    ) {
        respawnPlayer();
    }
}

// ======================================================
// RESPAWN
// ======================================================

function respawnPlayer() {
    const spawnX =
        0;

    const spawnZ =
        8;

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

    verticalVelocity =
        0;

    onGround =
        false;
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
