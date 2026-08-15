import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

console.log("SQUARE CRAFT SURVIVAL - INVENTORY + ICONS VERSION");

// =====================================================
// HTML
// =====================================================

const playButton = document.getElementById("playButton");
const startScreen = document.getElementById("startScreen");
const gameContainer = document.getElementById("game");
const hotbarSlots = Array.from(document.querySelectorAll(".slot"));

gameContainer.style.display = "none";

// =====================================================
// GAME SETTINGS
// =====================================================

let scene;
let camera;
let renderer;
let clock;
let blockGeometry;
let materials = {};

const keys = {};

let yaw = 0;
let pitch = 0;
let verticalVelocity = 0;
let onGround = false;

const moveSpeed = 7;
const gravity = 20;
const jumpPower = 7.5;
const eyeHeight = 1.7;
const playerHeight = 1.8;
const playerRadius = 0.32;

const worldSize = 60;
const bedrockY = -4;
const maxBuildY = 40;

// =====================================================
// BLOCK DATA
// =====================================================

const worldBlocks = new Map();

const allBlockTypes = [
    "grass",
    "dirt",
    "wood",
    "leaves",
    "stone",
    "bedrock"
];

const hotbarTypes = [
    "grass",
    "dirt",
    "wood",
    "leaves",
    "stone"
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

// You begin with nothing. Break blocks to collect them.
const inventory = {
    grass: 0,
    dirt: 0,
    wood: 0,
    leaves: 0,
    stone: 0
};

let selectedHotbarIndex = 0;

// =====================================================
// RAYCASTING
// =====================================================

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
raycaster.far = 6;

// =====================================================
// HOTBAR LABEL
// =====================================================

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

// =====================================================
// BASIC BLOCK FUNCTIONS
// =====================================================

function blockKey(x, y, z) {
    return `${x},${y},${z}`;
}

function blockExists(x, y, z) {
    return worldBlocks.has(
        blockKey(x, y, z)
    );
}

function addBlock(x, y, z, type) {
    const key = blockKey(x, y, z);

    if (
        worldBlocks.has(key)
    ) {
        return false;
    }

    const block = {
        x,
        y,
        z,
        type
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

function removeBlock(x, y, z) {
    const key = blockKey(x, y, z);

    const block =
        worldBlocks.get(key);

    if (
        !block ||
        block.type === "bedrock"
    ) {
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

// =====================================================
// TERRAIN GENERATION
// =====================================================

function getTerrainHeight(x, z) {
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

    const height =
        Math.floor(
            3 +
            wave1 +
            wave2 +
            wave3 +
            wave4
        );

    return Math.max(
        0,
        Math.min(
            8,
            height
        )
    );
}

function coordinateRandom(x, z) {
    const value =
        Math.sin(
            x * 12.9898 +
            z * 78.233
        ) *
        43758.5453;

    return value -
        Math.floor(value);
}

function canTreeSpawn(x, z) {
    const spawnDistance =
        Math.hypot(
            x,
            z - 8
        );

    if (
        spawnDistance < 8
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

    return (
        Math.abs(
            center - north
        ) <= 1
        &&
        Math.abs(
            center - south
        ) <= 1
        &&
        Math.abs(
            center - east
        ) <= 1
        &&
        Math.abs(
            center - west
        ) <= 1
    );
}

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

    // =================================================
    // GROUND
    // =================================================

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

            addBlock(
                x,
                height,
                z,
                "grass"
            );

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

            addBlock(
                x,
                bedrockY,
                z,
                "bedrock"
            );
        }
    }

    // =================================================
    // TREES
    // =================================================

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

function createTree(
    x,
    groundY,
    z
) {
    const trunkHeight =
        coordinateRandom(
            x + 500,
            z + 500
        ) > 0.5
            ? 5
            : 4;

    // =================================================
    // TRUNK
    // =================================================

    for (
        let y = 1;
        y <= trunkHeight;
        y++
    ) {
        addBlock(
            x,
            groundY + y,
            z,
            "wood"
        );
    }

    const leafBase =
        groundY +
        trunkHeight;

    // =================================================
    // LOWER LEAVES
    // =================================================

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
                Math.abs(lx) === 2
                &&
                Math.abs(lz) === 2
            ) {
                continue;
            }

            if (
                lx === 0
                &&
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

    // =================================================
    // MIDDLE LEAVES
    // =================================================

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
                Math.abs(lx) === 2
                &&
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

    // =================================================
    // TOP LEAVES
    // =================================================

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

// =====================================================
// PIXEL TEXTURES
// =====================================================

function finishPixelTexture(
    canvas
) {
    const texture =
        new THREE.CanvasTexture(
            canvas
        );

    texture.magFilter =
        THREE.NearestFilter;

    texture.minFilter =
        THREE.NearestFilter;

    texture.generateMipmaps =
        false;

    return texture;
}

function createSpeckledTexture(
    base,
    light,
    dark,
    amount = 34
) {
    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        16;

    canvas.height =
        16;

    const ctx =
        canvas.getContext(
            "2d"
        );

    ctx.fillStyle =
        base;

    ctx.fillRect(
        0,
        0,
        16,
        16
    );

    for (
        let i = 0;
        i < amount;
        i++
    ) {
        const x =
            (
                i * 7 +
                3
            ) % 16;

        const y =
            (
                i * 11 +
                5
            ) % 16;

        ctx.fillStyle =
            i % 2 === 0
                ? light
                : dark;

        ctx.fillRect(
            x,
            y,
            1,
            1
        );
    }

    return finishPixelTexture(
        canvas
    );
}

function createGrassSideTexture() {
    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        16;

    canvas.height =
        16;

    const ctx =
        canvas.getContext(
            "2d"
        );

    // =================================================
    // BOTTOM 75% DIRT
    // =================================================

    ctx.fillStyle =
        "#6f492f";

    ctx.fillRect(
        0,
        0,
        16,
        16
    );

    // =================================================
    // TOP 25% GRASS
    // =================================================

    ctx.fillStyle =
        "#4fa83b";

    ctx.fillRect(
        0,
        0,
        16,
        4
    );

    // =================================================
    // DIRT VARIATION
    // =================================================

    for (
        let i = 0;
        i < 22;
        i++
    ) {
        const x =
            (
                i * 5 +
                2
            ) % 16;

        const y =
            4 +
            (
                (
                    i * 9 +
                    1
                ) % 12
            );

        ctx.fillStyle =
            i % 2 === 0
                ? "#80563a"
                : "#5d3d29";

        ctx.fillRect(
            x,
            y,
            1,
            1
        );
    }

    // =================================================
    // GRASS VARIATION
    // =================================================

    for (
        let i = 0;
        i < 12;
        i++
    ) {
        const x =
            (
                i * 7 +
                1
            ) % 16;

        const y =
            (
                i * 3
            ) % 4;

        ctx.fillStyle =
            i % 2 === 0
                ? "#5db649"
                : "#3f8731";

        ctx.fillRect(
            x,
            y,
            1,
            1
        );
    }

    return finishPixelTexture(
        canvas
    );
}

function createMaterials() {
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

    const stoneTexture =
        createSpeckledTexture(
            "#6c6c6c",
            "#808080",
            "#575757",
            45
        );

    const bedrockTexture =
        createSpeckledTexture(
            "#2a2a2a",
            "#404040",
            "#181818",
            55
        );

    const grassTop =
        new THREE.MeshLambertMaterial({
            map:
                grassTopTexture
        });

    const grassSide =
        new THREE.MeshLambertMaterial({
            map:
                grassSideTexture
        });

    const dirt =
        new THREE.MeshLambertMaterial({
            map:
                dirtTexture
        });

    const wood =
        new THREE.MeshLambertMaterial({
            map:
                woodTexture
        });

    const leaves =
        new THREE.MeshLambertMaterial({
            map:
                leavesTexture
        });

    const stone =
        new THREE.MeshLambertMaterial({
            map:
                stoneTexture
        });

    const bedrock =
        new THREE.MeshLambertMaterial({
            map:
                bedrockTexture
        });

    materials = {
        grass: [
            grassSide,
            grassSide,
            grassTop,
            dirt,
            grassSide,
            grassSide
        ],

        dirt,
        wood,
        leaves,
        stone,
        bedrock
    };
}

// =====================================================
// RENDER BLOCKS
// =====================================================

function getBlockTint(
    block
) {
    const random =
        coordinateRandom(
            block.x * 7 +
            block.y * 3,
            block.z * 11
        );

    // Never brighter than the base texture.
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

    if (
        oldMesh
    ) {
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

// =====================================================
// HOTBAR ICONS
// =====================================================

function getIconBackground(
    type
) {
    if (
        type === "grass"
    ) {
        return "linear-gradient(to bottom, #4fa83b 0 28%, #6f492f 28% 100%)";
    }

    if (
        type === "dirt"
    ) {
        return "repeating-linear-gradient(135deg, #6f492f 0 5px, #80563a 5px 8px, #5d3d29 8px 11px)";
    }

    if (
        type === "wood"
    ) {
        return "repeating-linear-gradient(90deg, #54361f 0 4px, #6b4529 4px 8px, #7c5434 8px 11px)";
    }

    if (
        type === "leaves"
    ) {
        return "repeating-linear-gradient(45deg, #235924 0 5px, #2f6f2d 5px 9px, #3b8236 9px 12px)";
    }

    return "repeating-linear-gradient(135deg, #575757 0 5px, #6c6c6c 5px 9px, #808080 9px 12px)";
}

function updateHotbar() {
    for (
        let i = 0;
        i < hotbarSlots.length;
        i++
    ) {
        const slot =
            hotbarSlots[i];

        const type =
            hotbarTypes[i];

        if (
            !type
        ) {
            continue;
        }

        slot.classList.toggle(
            "selected",
            i ===
            selectedHotbarIndex
        );

        slot.innerHTML =
            "";

        slot.style.position =
            "relative";

        slot.style.display =
            "flex";

        slot.style.alignItems =
            "center";

        slot.style.justifyContent =
            "center";

        slot.style.overflow =
            "hidden";

        slot.style.boxSizing =
            "border-box";

        // =================================================
        // NUMBER
        // =================================================

        const number =
            document.createElement(
                "div"
            );

        number.textContent =
            i + 1;

        number.style.position =
            "absolute";

        number.style.top =
            "3px";

        number.style.left =
            "5px";

        number.style.fontSize =
            "12px";

        number.style.color =
            "white";

        number.style.textShadow =
            "1px 1px 0 #000";

        number.style.zIndex =
            "2";

        // =================================================
        // BLOCK ICON
        // =================================================

        const icon =
            document.createElement(
                "div"
            );

        icon.style.width =
            "30px";

        icon.style.height =
            "30px";

        icon.style.border =
            "2px solid rgba(0,0,0,0.45)";

        icon.style.boxSizing =
            "border-box";

        icon.style.background =
            getIconBackground(
                type
            );

        icon.style.boxShadow =
            "inset 2px 2px 0 rgba(255,255,255,0.14), inset -2px -2px 0 rgba(0,0,0,0.20)";

        // =================================================
        // BLOCK COUNT
        // =================================================

        const count =
            document.createElement(
                "div"
            );

        count.textContent =
            inventory[
                type
            ];

        count.style.position =
            "absolute";

        count.style.right =
            "4px";

        count.style.bottom =
            "2px";

        count.style.fontSize =
            "14px";

        count.style.fontWeight =
            "bold";

        count.style.color =
            inventory[type] > 0
                ? "white"
                : "#999";

        count.style.textShadow =
            "1px 1px 0 #000";

        count.style.zIndex =
            "2";

        slot.appendChild(
            number
        );

        slot.appendChild(
            icon
        );

        slot.appendChild(
            count
        );

        slot.title =
            `${type}: ${inventory[type]}`;
    }

    const selectedType =
        hotbarTypes[
            selectedHotbarIndex
        ];

    blockNameLabel.textContent =
        `${selectedType.toUpperCase()} x${inventory[selectedType]}`;
}

// =====================================================
// COLLISION
// =====================================================

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

function blockWouldHitPlayer(
    x,
    y,
    z
) {
    const feetY =
        camera.position.y -
        eyeHeight;

    const minX =
        camera.position.x -
        playerRadius;

    const maxX =
        camera.position.x +
        playerRadius;

    const minY =
        feetY +
        0.06;

    const maxY =
        feetY +
        playerHeight -
        0.05;

    const minZ =
        camera.position.z -
        playerRadius;

    const maxZ =
        camera.position.z +
        playerRadius;

    return (
        maxX >
        x - 0.5
        &&
        minX <
        x + 0.5
        &&
        maxY >
        y - 0.5
        &&
        minY <
        y + 0.5
        &&
        maxZ >
        z - 0.5
        &&
        minZ <
        z + 0.5
    );
}

function moveHorizontalAxis(
    axis,
    amount
) {
    if (
        amount === 0
    ) {
        return;
    }

    const steps =
        Math.ceil(
            Math.abs(
                amount
            ) /
            0.08
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

        // =================================================
        // NORMAL MOVEMENT
        // =================================================

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

        // =================================================
        // STEP UP ONE BLOCK
        // =================================================

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
            camera.position.x =
                testX;

            camera.position.y =
                raisedY;

            camera.position.z =
                testZ;

            verticalVelocity =
                0;

            onGround =
                true;

            continue;
        }

        // =================================================
        // ACTUAL WALL
        // =================================================

        break;
    }
}

function moveVertical(
    amount
) {
    if (
        amount === 0
    ) {
        return;
    }

    const steps =
        Math.ceil(
            Math.abs(
                amount
            ) /
            0.04
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

// =====================================================
// BLOCK TARGETING
// =====================================================

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

// =====================================================
// BREAK BLOCK
// =====================================================

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
        !removed
    ) {
        return;
    }

    // Add block to inventory.

    if (
        Object.prototype
            .hasOwnProperty
            .call(
                inventory,
                removed.type
            )
    ) {
        inventory[
            removed.type
        ] += 1;
    }

    rebuildType(
        removed.type
    );

    updateHotbar();
}

// =====================================================
// PLACE BLOCK
// =====================================================

function placeTargetBlock() {
    const target =
        getTargetBlock();

    if (
        !target ||
        !target.hit.face
    ) {
        return;
    }

    const type =
        hotbarTypes[
            selectedHotbarIndex
        ];

    // =================================================
    // NO INFINITE BLOCKS
    // =================================================

    if (
        inventory[
            type
        ] <= 0
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

    // =================================================
    // WORLD LIMITS
    // =================================================

    if (
        Math.abs(
            placeX
        ) > worldSize
        ||
        Math.abs(
            placeZ
        ) > worldSize
        ||
        placeY <
        bedrockY
        ||
        placeY >
        maxBuildY
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

    // Don't bury yourself alive.

    if (
        blockWouldHitPlayer(
            placeX,
            placeY,
            placeZ
        )
    ) {
        return;
    }

    if (
        addBlock(
            placeX,
            placeY,
            placeZ,
            type
        )
    ) {
        inventory[
            type
        ] -= 1;

        rebuildType(
            type
        );

        updateHotbar();
    }
}

// =====================================================
// PLAYER MOVEMENT
// =====================================================

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

    // =================================================
    // MAP LIMIT
    // =================================================

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

    // =================================================
    // GRAVITY
    // =================================================

    onGround =
        false;

    verticalVelocity -=
        gravity *
        delta;

    moveVertical(
        verticalVelocity *
        delta
    );

    // =================================================
    // VOID RESCUE
    // =================================================

    if (
        camera.position.y <
        -12
    ) {
        respawnPlayer();
    }
}

function respawnPlayer() {
    const spawnX =
        0;

    const spawnZ =
        8;

    const spawnY =
        getTerrainHeight(
            spawnX,
            spawnZ
        );

    camera.position.set(
        spawnX,
        spawnY +
        0.5 +
        eyeHeight,
        spawnZ
    );

    verticalVelocity =
        0;

    onGround =
        false;
}

// =====================================================
// CONTROLS
// =====================================================

function setupControls() {
    // =================================================
    // POINTER LOCK
    // =================================================

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

    // Remove browser right-click menu.

    renderer.domElement.addEventListener(
        "contextmenu",
        event => {
            event.preventDefault();
        }
    );

    // =================================================
    // MOUSE LOOK
    // =================================================

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

    // =================================================
    // KEYBOARD
    // =================================================

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

            // HOTBAR 1-5

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

    // =================================================
    // BREAK / PLACE
    // =================================================

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

    // =================================================
    // MOUSE WHEEL HOTBAR
    // =================================================

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

// =====================================================
// START GAME
// =====================================================

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

function startGame() {
    // =================================================
    // SCENE
    // =================================================

    scene =
        new THREE.Scene();

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

    // =================================================
    // CAMERA
    // =================================================

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

    // =================================================
    // RENDERER
    // =================================================

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

    // =================================================
    // LIGHTING
    // =================================================

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

    scene.add(
        sunlight
    );

    scene.add(
        new THREE.AmbientLight(
            0xffffff,
            0.45
        )
    );

    // =================================================
    // WORLD
    // =================================================

    createMaterials();

    blockGeometry =
        new THREE.BoxGeometry(
            1,
            1,
            1
        );

    generateWorld();

    respawnPlayer();

    setupControls();

    updateHotbar();

    // =================================================
    // CLOCK
    // =================================================

    clock =
        new THREE.Clock();

    animate();
}

// =====================================================
// GAME LOOP
// =====================================================

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

// =====================================================
// WINDOW RESIZE
// =====================================================

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
