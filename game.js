import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

console.log("SQUARE CRAFT SURVIVAL - ENTITIES + TOOLS + SURVIVAL");

// =====================================================
// HELPERS
// =====================================================

const css = (el, styles) => (Object.assign(el.style, styles), el);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const blockKey = (x, y, z) => `${x},${y},${z}`;
const chunkKey = (cx, cz) => `${cx},${cz}`;
const worldToChunk = value => Math.floor(value / CHUNK_SIZE);

// =====================================================
// HTML / HUD
// =====================================================

const playButton = document.getElementById("playButton");
const startScreen = document.getElementById("startScreen");
const gameContainer = document.getElementById("game");
const hotbar = document.getElementById("hotbar");

gameContainer.style.display = "none";
hotbar.innerHTML = "";

for (let i = 0; i < 7; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    hotbar.appendChild(slot);
}

const hotbarSlots = Array.from(document.querySelectorAll(".slot"));

const blockNameLabel = css(document.createElement("div"), {
    position: "fixed",
    bottom: "95px",
    left: "50%",
    transform: "translateX(-50%)",
    color: "white",
    fontSize: "22px",
    fontWeight: "bold",
    textShadow: "2px 2px 0 black",
    pointerEvents: "none",
    zIndex: "20"
});
gameContainer.appendChild(blockNameLabel);

const miningHud = css(document.createElement("div"), {
    position: "fixed",
    left: "50%",
    top: "56%",
    transform: "translateX(-50%)",
    width: "150px",
    height: "14px",
    border: "3px solid #111",
    background: "rgba(0,0,0,0.65)",
    display: "none",
    zIndex: "30",
    pointerEvents: "none"
});

const miningFill = css(document.createElement("div"), {
    width: "0%",
    height: "100%",
    background: "white"
});
miningHud.appendChild(miningFill);
gameContainer.appendChild(miningHud);

const survivalHud = css(document.createElement("div"), {
    position: "fixed",
    top: "18px",
    left: "18px",
    zIndex: "40",
    pointerEvents: "none",
    color: "white",
    textShadow: "2px 2px 0 #000",
    fontWeight: "bold"
});
gameContainer.appendChild(survivalHud);

function createMeter(labelText) {
    const row = css(document.createElement("div"), {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "7px"
    });

    const label = css(document.createElement("div"), {
        width: "82px",
        fontSize: "15px"
    });

    label.textContent = labelText;

    const cells = css(document.createElement("div"), {
        display: "flex",
        gap: "3px"
    });

    const parts = [];

    for (let i = 0; i < 10; i++) {
        const part = css(document.createElement("div"), {
            width: "15px",
            height: "15px",
            border: "2px solid #111",
            boxSizing: "border-box"
        });

        cells.appendChild(part);
        parts.push(part);
    }

    row.append(label, cells);
    survivalHud.appendChild(row);

    return {
        row,
        label,
        parts
    };
}

const healthMeter = createMeter("HEALTH");
const hungerMeter = createMeter("HUNGER");

const damageFlash = css(document.createElement("div"), {
    position: "fixed",
    inset: "0",
    background: "rgba(170,0,0,0.28)",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "900",
    transition: "opacity 0.12s linear"
});

document.body.appendChild(damageFlash);

// =====================================================
// GAME STATE
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
let craftingOpen = false;

const moveSpeed = 7;
const gravity = 20;
const jumpPower = 7.5;

const eyeHeight = 1.7;
const playerHeight = 1.8;
const playerRadius = 0.32;

const maxHealth = 20;
const maxHunger = 20;

let health = maxHealth;
let hunger = maxHunger;

let hungerTimer = 0;
let starvationTimer = 0;
let regenTimer = 0;

// =====================================================
// WORLD SETTINGS
// =====================================================

const CHUNK_SIZE = 16;
const LOAD_DISTANCE = 4;

const FOG_NEAR = 30;
const FOG_FAR = 46;

const bedrockY = -5;
const maxBuildY = 48;

const loadedChunks = new Map();
const chunkEdits = new Map();
const interactiveMeshes = new Set();

let lastPlayerChunkX = null;
let lastPlayerChunkZ = null;

const allBlockTypes = [
    "grass",
    "dirt",
    "wood",
    "leaves",
    "stone",
    "craftingWood",
    "bedrock"
];

const placeableTypes = new Set([
    "grass",
    "dirt",
    "wood",
    "leaves",
    "stone",
    "craftingWood"
]);

// =====================================================
// INVENTORY / RECIPES
// =====================================================

const inventory = {
    grass: 0,
    dirt: 0,
    wood: 0,
    leaves: 0,
    stone: 0,
    craftingWood: 0,
    sticks: 0,
    axe: 0,
    pickaxe: 0,
    beef: 0,
    pork: 0,
    mutton: 0
};

const hotbarItems = [
    null,
    null,
    null,
    null,
    null,
    null,
    null
];

let selectedHotbarIndex = 0;

const recipes = [
    {
        name: "Crafting Wood",

        input: {
            wood: 1
        },

        output: {
            craftingWood: 5
        },

        description:
            "1 Wood → 5 Crafting Wood"
    },

    {
        name: "Sticks",

        input: {
            craftingWood: 2
        },

        output: {
            sticks: 4
        },

        description:
            "2 Crafting Wood → 4 Sticks"
    },

    {
        name: "Axe",

        input: {
            craftingWood: 3,
            sticks: 2
        },

        output: {
            axe: 1
        },

        description:
            "3 Crafting Wood + 2 Sticks → Axe"
    },

    {
        name: "Pickaxe",

        input: {
            craftingWood: 3,
            sticks: 2
        },

        output: {
            pickaxe: 1
        },

        description:
            "3 Crafting Wood + 2 Sticks → Pickaxe"
    }
];

const foodValues = {
    beef: 6,
    pork: 5,
    mutton: 4
};

function itemName(type) {
    const names = {
        grass: "Grass",
        dirt: "Dirt",
        wood: "Wood",
        leaves: "Leaves",
        stone: "Stone",
        craftingWood: "Crafting Wood",
        sticks: "Sticks",
        axe: "Axe",
        pickaxe: "Pickaxe",
        beef: "Beef",
        pork: "Pork",
        mutton: "Mutton",
        bedrock: "Bedrock"
    };

    return names[type] || type;
}

function selectedItem() {
    return hotbarItems[selectedHotbarIndex];
}

// =====================================================
// RAYCASTING / MINING
// =====================================================

const raycaster =
    new THREE.Raycaster();

const screenCenter =
    new THREE.Vector2(
        0,
        0
    );

raycaster.far = 6;

let miningHeld = false;
let miningTargetKey = null;
let miningProgress = 0;

let playerAttackCooldown = 0;

function getMiningTime(
    blockType
) {
    const tool =
        selectedItem();

    if (
        blockType ===
        "bedrock"
    ) {
        return Infinity;
    }

    if (
        blockType ===
        "leaves"
    ) {
        return 0.5;
    }

    if (
        blockType ===
        "grass"
        ||
        blockType ===
        "dirt"
    ) {
        return 1;
    }

    if (
        blockType ===
        "wood"
        ||
        blockType ===
        "craftingWood"
    ) {
        return tool ===
        "axe"
            ? 1
            : 3;
    }

    if (
        blockType ===
        "stone"
    ) {
        return tool ===
        "pickaxe"
            ? 3
            : 5;
    }

    return 2;
}

function resetMining() {
    miningTargetKey = null;
    miningProgress = 0;

    miningFill.style.width =
        "0%";

    miningHud.style.display =
        "none";
}

// =====================================================
// TERRAIN
// =====================================================

function coordinateRandom(
    x,
    z
) {
    const value =
        Math.sin(
            x * 12.9898 +
            z * 78.233
        )
        *
        43758.5453;

    return value -
        Math.floor(value);
}

function getTerrainHeight(
    x,
    z
) {
    const huge =
        Math.sin(
            x * 0.026
        ) * 2.6

        +

        Math.cos(
            z * 0.024
        ) * 2.3;

    const medium =
        Math.sin(
            (x + z) *
            0.052
        ) * 1.7

        +

        Math.cos(
            (x - z) *
            0.041
        ) * 1.3;

    const small =
        Math.sin(
            x * 0.11
        ) * 0.7

        +

        Math.cos(
            z * 0.10
        ) * 0.7;

    return Math.max(
        0,

        Math.min(
            11,

            Math.floor(
                4 +
                huge +
                medium +
                small
            )
        )
    );
}

// =====================================================
// TREES
// =====================================================

function canTreeSpawn(
    x,
    z
) {
    if (
        Math.hypot(
            x,
            z - 8
        ) < 8
    ) {
        return false;
    }

    if (
        coordinateRandom(
            x,
            z
        ) >= 0.027
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
            center -
            north
        ) <= 1

        &&

        Math.abs(
            center -
            south
        ) <= 1

        &&

        Math.abs(
            center -
            east
        ) <= 1

        &&

        Math.abs(
            center -
            west
        ) <= 1
    );
}

function getTreeBlocks(
    treeX,
    treeZ
) {
    if (
        !canTreeSpawn(
            treeX,
            treeZ
        )
    ) {
        return [];
    }

    const groundY =
        getTerrainHeight(
            treeX,
            treeZ
        );

    const trunkHeight =
        coordinateRandom(
            treeX + 500,
            treeZ + 500
        ) > 0.5
            ? 5
            : 4;

    const blocks = [];

    for (
        let y = 1;
        y <= trunkHeight;
        y++
    ) {
        blocks.push({
            x: treeX,

            y:
                groundY +
                y,

            z: treeZ,

            type:
                "wood"
        });
    }

    const leafBase =
        groundY +
        trunkHeight;

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

            blocks.push({
                x:
                    treeX +
                    lx,

                y:
                    leafBase,

                z:
                    treeZ +
                    lz,

                type:
                    "leaves"
            });
        }
    }

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

            blocks.push({
                x:
                    treeX +
                    lx,

                y:
                    leafBase +
                    1,

                z:
                    treeZ +
                    lz,

                type:
                    "leaves"
            });
        }
    }

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
            blocks.push({
                x:
                    treeX +
                    lx,

                y:
                    leafBase +
                    2,

                z:
                    treeZ +
                    lz,

                type:
                    "leaves"
            });
        }
    }

    blocks.push({
        x: treeX,

        y:
            leafBase +
            3,

        z: treeZ,

        type:
            "leaves"
    });

    return blocks;
}

// =====================================================
// CHUNKS / WORLD EDITS
// =====================================================

function getChunkForWorld(
    x,
    z
) {
    return loadedChunks.get(

        chunkKey(
            worldToChunk(x),
            worldToChunk(z)
        )

    ) || null;
}

function setWorldEdit(
    x,
    y,
    z,
    typeOrNull
) {
    const ck =
        chunkKey(
            worldToChunk(x),
            worldToChunk(z)
        );

    if (
        !chunkEdits.has(
            ck
        )
    ) {
        chunkEdits.set(
            ck,
            new Map()
        );
    }

    chunkEdits
        .get(ck)
        .set(
            blockKey(
                x,
                y,
                z
            ),

            typeOrNull
        );
}

function generateChunkBlocks(
    cx,
    cz
) {
    const blocks =
        new Map();

    const minX =
        cx *
        CHUNK_SIZE;

    const minZ =
        cz *
        CHUNK_SIZE;

    const maxX =
        minX +
        CHUNK_SIZE -
        1;

    const maxZ =
        minZ +
        CHUNK_SIZE -
        1;

    function putBlock(
        x,
        y,
        z,
        type
    ) {
        if (
            x < minX
            ||
            x > maxX
            ||
            z < minZ
            ||
            z > maxZ
        ) {
            return;
        }

        const key =
            blockKey(
                x,
                y,
                z
            );

        if (
            !blocks.has(
                key
            )
        ) {
            blocks.set(
                key,

                {
                    x,
                    y,
                    z,
                    type
                }
            );
        }
    }

    for (
        let x = minX;
        x <= maxX;
        x++
    ) {
        for (
            let z = minZ;
            z <= maxZ;
            z++
        ) {
            const height =
                getTerrainHeight(
                    x,
                    z
                );

            putBlock(
                x,
                height,
                z,
                "grass"
            );

            putBlock(
                x,
                height - 1,
                z,
                "dirt"
            );

            putBlock(
                x,
                height - 2,
                z,
                "dirt"
            );

            for (
                let y =
                    height -
                    3;

                y >
                bedrockY;

                y--
            ) {
                putBlock(
                    x,
                    y,
                    z,
                    "stone"
                );
            }

            putBlock(
                x,
                bedrockY,
                z,
                "bedrock"
            );
        }
    }

    for (
        let treeX =
            minX -
            2;

        treeX <=
        maxX +
        2;

        treeX++
    ) {
        for (
            let treeZ =
                minZ -
                2;

            treeZ <=
            maxZ +
            2;

            treeZ++
        ) {
            for (
                const block
                of getTreeBlocks(
                    treeX,
                    treeZ
                )
            ) {
                putBlock(
                    block.x,
                    block.y,
                    block.z,
                    block.type
                );
            }
        }
    }

    const edits =
        chunkEdits.get(
            chunkKey(
                cx,
                cz
            )
        );

    if (
        edits
    ) {
        for (
            const [
                key,
                typeOrNull
            ]
            of edits
        ) {
            if (
                typeOrNull ===
                null
            ) {
                blocks.delete(
                    key
                );

                continue;
            }

            const [
                x,
                y,
                z
            ] =
                key
                    .split(",")
                    .map(Number);

            blocks.set(
                key,

                {
                    x,
                    y,
                    z,

                    type:
                        typeOrNull
                }
            );
        }
    }

    return blocks;
}

// =====================================================
// PIXEL TEXTURES
// =====================================================

function makeCanvas() {
    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        16;

    canvas.height =
        16;

    return canvas;
}

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

function speckleTexture(
    base,
    colors,
    amount
) {
    const c =
        makeCanvas();

    const x =
        c.getContext(
            "2d"
        );

    x.fillStyle =
        base;

    x.fillRect(
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
        x.fillStyle =
            colors[
                i %
                colors.length
            ];

        x.fillRect(
            (
                i * 7 +
                i * i
            ) % 16,

            (
                i * 11 +
                3
            ) % 16,

            i % 9 === 0
                ? 2
                : 1,

            1
        );
    }

    return finishPixelTexture(
        c
    );
}

function createGrassTopTexture() {
    return speckleTexture(
        "#4b9d38",

        [
            "#5bb347",
            "#3f8730",
            "#67bc4e",
            "#36792b"
        ],

        60
    );
}

function createGrassSideTexture() {
    const c =
        makeCanvas();

    const x =
        c.getContext(
            "2d"
        );

    x.fillStyle =
        "#6d472e";

    x.fillRect(
        0,
        0,
        16,
        16
    );

    x.fillStyle =
        "#4b9d38";

    x.fillRect(
        0,
        0,
        16,
        4
    );

    x.fillStyle =
        "#3f8730";

    x.fillRect(
        2,
        4,
        1,
        2
    );

    x.fillRect(
        7,
        4,
        1,
        1
    );

    x.fillRect(
        12,
        4,
        1,
        2
    );

    const colors = [
        "#80563a",
        "#593923",
        "#744b30"
    ];

    for (
        let i = 0;
        i < 28;
        i++
    ) {
        x.fillStyle =
            colors[
                i %
                colors.length
            ];

        x.fillRect(
            (
                i * 5 +
                2
            ) % 16,

            5 +
            (
                (
                    i * 9 +
                    1
                ) % 11
            ),

            1,
            1
        );
    }

    return finishPixelTexture(
        c
    );
}

function createDirtTexture() {
    return speckleTexture(
        "#70492f",

        [
            "#85593a",
            "#5c3a24",
            "#986641",
            "#67412a"
        ],

        54
    );
}

function createWoodSideTexture() {
    const c =
        makeCanvas();

    const x =
        c.getContext(
            "2d"
        );

    x.fillStyle =
        "#684328";

    x.fillRect(
        0,
        0,
        16,
        16
    );

    const stripes = [
        "#4f311d",
        "#7c5434",
        "#5b3922"
    ];

    for (
        let i = 1;
        i < 16;
        i += 3
    ) {
        x.fillStyle =
            stripes[
                i %
                stripes.length
            ];

        x.fillRect(
            i,
            0,
            1,
            16
        );
    }

    x.fillStyle =
        "#8a603d";

    x.fillRect(
        5,
        3,
        1,
        5
    );

    x.fillRect(
        11,
        9,
        1,
        4
    );

    return finishPixelTexture(
        c
    );
}

function createWoodTopTexture() {
    const c =
        makeCanvas();

    const x =
        c.getContext(
            "2d"
        );

    x.fillStyle =
        "#9b7048";

    x.fillRect(
        0,
        0,
        16,
        16
    );

    x.strokeStyle =
        "#684328";

    x.strokeRect(
        2,
        2,
        12,
        12
    );

    x.strokeRect(
        5,
        5,
        6,
        6
    );

    x.fillStyle =
        "#54321d";

    x.fillRect(
        7,
        7,
        2,
        2
    );

    return finishPixelTexture(
        c
    );
}

function createLeavesTexture() {
    return speckleTexture(
        "#2e6d2c",

        [
            "#3d8538",
            "#245822",
            "#4a9141",
            "#326f2e"
        ],

        76
    );
}

function createStoneTexture() {
    return speckleTexture(
        "#686868",

        [
            "#7d7d7d",
            "#555555",
            "#8c8c8c",
            "#606060"
        ],

        48
    );
}

function createCraftingWoodTexture() {
    const c =
        makeCanvas();

    const x =
        c.getContext(
            "2d"
        );

    x.fillStyle =
        "#a66f3f";

    x.fillRect(
        0,
        0,
        16,
        16
    );

    for (
        let y = 0;
        y < 16;
        y += 4
    ) {
        x.fillStyle =
            "#704521";

        x.fillRect(
            0,
            y,
            16,
            1
        );
    }

    x.fillStyle =
        "#c58a50";

    x.fillRect(
        2,
        1,
        5,
        1
    );

    x.fillRect(
        9,
        5,
        4,
        1
    );

    x.fillRect(
        4,
        9,
        6,
        1
    );

    x.fillRect(
        11,
        13,
        3,
        1
    );

    return finishPixelTexture(
        c
    );
}

function createBedrockTexture() {
    return speckleTexture(
        "#282828",

        [
            "#111111",
            "#454545",
            "#333333",
            "#5a5a5a"
        ],

        82
    );
}

function createMaterials() {
    const grassTop =
        new THREE.MeshLambertMaterial({
            map:
                createGrassTopTexture()
        });

    const grassSide =
        new THREE.MeshLambertMaterial({
            map:
                createGrassSideTexture()
        });

    const dirt =
        new THREE.MeshLambertMaterial({
            map:
                createDirtTexture()
        });

    const woodSide =
        new THREE.MeshLambertMaterial({
            map:
                createWoodSideTexture()
        });

    const woodTop =
        new THREE.MeshLambertMaterial({
            map:
                createWoodTopTexture()
        });

    const leaves =
        new THREE.MeshLambertMaterial({
            map:
                createLeavesTexture()
        });

    const stone =
        new THREE.MeshLambertMaterial({
            map:
                createStoneTexture()
        });

    const craftingWood =
        new THREE.MeshLambertMaterial({
            map:
                createCraftingWoodTexture()
        });

    const bedrock =
        new THREE.MeshLambertMaterial({
            map:
                createBedrockTexture()
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

        wood: [
            woodSide,
            woodSide,
            woodTop,
            woodTop,
            woodSide,
            woodSide
        ],

        leaves,
        stone,
        craftingWood,
        bedrock
    };
}

// =====================================================
// CHUNK RENDERING / LOADING
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

    const shade =
        0.9 +
        random *
        0.1;

    return new THREE.Color(
        shade,
        shade,
        shade
    );
}

function rebuildChunk(
    chunk
) {
    for (
        const mesh
        of chunk.meshes
    ) {
        interactiveMeshes.delete(
            mesh
        );

        scene.remove(
            mesh
        );
    }

    chunk.meshes =
        [];

    const grouped = {};

    for (
        const type
        of allBlockTypes
    ) {
        grouped[type] =
            [];
    }

    for (
        const block
        of chunk.blocks.values()
    ) {
        grouped[
            block.type
        ].push(
            block
        );
    }

    const dummy =
        new THREE.Object3D();

    for (
        const type
        of allBlockTypes
    ) {
        const blocks =
            grouped[
                type
            ];

        if (
            !blocks.length
        ) {
            continue;
        }

        const mesh =
            new THREE.InstancedMesh(
                blockGeometry,
                materials[type],
                blocks.length
            );

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

        mesh.userData.chunkKey =
            chunk.key;

        mesh.userData.blockType =
            type;

        mesh.computeBoundingSphere();

        scene.add(
            mesh
        );

        interactiveMeshes.add(
            mesh
        );

        chunk.meshes.push(
            mesh
        );
    }
}

function loadChunk(
    cx,
    cz
) {
    const key =
        chunkKey(
            cx,
            cz
        );

    if (
        loadedChunks.has(
            key
        )
    ) {
        return loadedChunks.get(
            key
        );
    }

    const chunk = {
        key,
        cx,
        cz,

        blocks:
            generateChunkBlocks(
                cx,
                cz
            ),

        meshes:
            [],

        entityIds:
            new Set()
    };

    loadedChunks.set(
        key,
        chunk
    );

    rebuildChunk(
        chunk
    );

    spawnEntityForChunk(
        chunk
    );

    return chunk;
}

function unloadChunk(
    key
) {
    const chunk =
        loadedChunks.get(
            key
        );

    if (
        !chunk
    ) {
        return;
    }

    for (
        const mesh
        of chunk.meshes
    ) {
        interactiveMeshes.delete(
            mesh
        );

        scene.remove(
            mesh
        );
    }

    for (
        const entityId
        of Array.from(
            chunk.entityIds
        )
    ) {
        removeEntity(
            entityId,
            false
        );
    }

    loadedChunks.delete(
        key
    );
}

function refreshLoadedChunks(
    force = false
) {
    if (
        !camera
    ) {
        return;
    }

    const playerCX =
        worldToChunk(
            camera.position.x
        );

    const playerCZ =
        worldToChunk(
            camera.position.z
        );

    if (
        !force
        &&
        playerCX ===
        lastPlayerChunkX
        &&
        playerCZ ===
        lastPlayerChunkZ
    ) {
        return;
    }

    lastPlayerChunkX =
        playerCX;

    lastPlayerChunkZ =
        playerCZ;

    const needed =
        new Set();

    const radius =
        LOAD_DISTANCE +
        0.35;

    for (
        let dx =
            -LOAD_DISTANCE;

        dx <=
        LOAD_DISTANCE;

        dx++
    ) {
        for (
            let dz =
                -LOAD_DISTANCE;

            dz <=
            LOAD_DISTANCE;

            dz++
        ) {
            if (
                dx * dx +
                dz * dz >
                radius *
                radius
            ) {
                continue;
            }

            const cx =
                playerCX +
                dx;

            const cz =
                playerCZ +
                dz;

            const key =
                chunkKey(
                    cx,
                    cz
                );

            needed.add(
                key
            );

            loadChunk(
                cx,
                cz
            );
        }
    }

    for (
        const key
        of Array.from(
            loadedChunks.keys()
        )
    ) {
        if (
            !needed.has(
                key
            )
        ) {
            unloadChunk(
                key
            );
        }
    }
}

// =====================================================
// BLOCK LOOKUP / EDITING
// =====================================================

function getLoadedBlock(
    x,
    y,
    z
) {
    const chunk =
        getChunkForWorld(
            x,
            z
        );

    if (
        !chunk
    ) {
        return null;
    }

    return chunk.blocks.get(
        blockKey(
            x,
            y,
            z
        )
    ) || null;
}

function blockExists(
    x,
    y,
    z
) {
    return getLoadedBlock(
        x,
        y,
        z
    ) !== null;
}

function removeLoadedBlock(
    x,
    y,
    z
) {
    const chunk =
        getChunkForWorld(
            x,
            z
        );

    if (
        !chunk
    ) {
        return null;
    }

    const key =
        blockKey(
            x,
            y,
            z
        );

    const block =
        chunk.blocks.get(
            key
        );

    if (
        !block
        ||
        block.type ===
        "bedrock"
    ) {
        return null;
    }

    chunk.blocks.delete(
        key
    );

    setWorldEdit(
        x,
        y,
        z,
        null
    );

    rebuildChunk(
        chunk
    );

    return block;
}

function addLoadedBlock(
    x,
    y,
    z,
    type
) {
    const chunk =
        loadChunk(
            worldToChunk(x),
            worldToChunk(z)
        );

    const key =
        blockKey(
            x,
            y,
            z
        );

    if (
        chunk.blocks.has(
            key
        )
    ) {
        return false;
    }

    chunk.blocks.set(
        key,

        {
            x,
            y,
            z,
            type
        }
    );

    setWorldEdit(
        x,
        y,
        z,
        type
    );

    rebuildChunk(
        chunk
    );

    return true;
}

// =====================================================
// PIXEL-ART ITEM ICONS
// =====================================================

const iconCache =
    new Map();

function createItemIcon(
    type
) {
    if (
        iconCache.has(
            type
        )
    ) {
        return iconCache.get(
            type
        );
    }

    const c =
        makeCanvas();

    const x =
        c.getContext(
            "2d"
        );

    x.imageSmoothingEnabled =
        false;

    x.clearRect(
        0,
        0,
        16,
        16
    );

    if (
        type ===
        "grass"
    ) {
        x.fillStyle =
            "#6d472e";

        x.fillRect(
            2,
            3,
            12,
            11
        );

        x.fillStyle =
            "#4b9d38";

        x.fillRect(
            2,
            2,
            12,
            4
        );

        x.fillStyle =
            "#3f8730";

        x.fillRect(
            4,
            6,
            1,
            2
        );

        x.fillRect(
            10,
            6,
            1,
            1
        );
    }

    else if (
        type ===
        "dirt"
    ) {
        x.fillStyle =
            "#70492f";

        x.fillRect(
            2,
            2,
            12,
            12
        );

        x.fillStyle =
            "#986641";

        x.fillRect(
            4,
            4,
            2,
            1
        );

        x.fillRect(
            9,
            7,
            1,
            2
        );

        x.fillStyle =
            "#5c3a24";

        x.fillRect(
            6,
            10,
            2,
            1
        );

        x.fillRect(
            11,
            4,
            1,
            1
        );
    }

    else if (
        type ===
        "wood"
    ) {
        x.fillStyle =
            "#684328";

        x.fillRect(
            3,
            1,
            10,
            14
        );

        x.fillStyle =
            "#4f311d";

        x.fillRect(
            5,
            1,
            1,
            14
        );

        x.fillRect(
            10,
            1,
            1,
            14
        );

        x.fillStyle =
            "#8a603d";

        x.fillRect(
            7,
            4,
            1,
            5
        );
    }

    else if (
        type ===
        "leaves"
    ) {
        x.fillStyle =
            "#2e6d2c";

        x.fillRect(
            2,
            2,
            12,
            12
        );

        x.fillStyle =
            "#4a9141";

        x.fillRect(
            4,
            4,
            2,
            2
        );

        x.fillRect(
            10,
            3,
            1,
            2
        );

        x.fillRect(
            8,
            10,
            2,
            1
        );

        x.fillStyle =
            "#245822";

        x.fillRect(
            3,
            9,
            1,
            2
        );

        x.fillRect(
            11,
            11,
            2,
            1
        );
    }

    else if (
        type ===
        "stone"
    ) {
        x.fillStyle =
            "#686868";

        x.fillRect(
            2,
            2,
            12,
            12
        );

        x.fillStyle =
            "#8c8c8c";

        x.fillRect(
            4,
            4,
            3,
            1
        );

        x.fillRect(
            9,
            9,
            2,
            2
        );

        x.fillStyle =
            "#555";

        x.fillRect(
            10,
            4,
            2,
            1
        );

        x.fillRect(
            5,
            11,
            2,
            1
        );
    }

    else if (
        type ===
        "craftingWood"
    ) {
        x.fillStyle =
            "#a66f3f";

        x.fillRect(
            2,
            2,
            12,
            12
        );

        x.fillStyle =
            "#704521";

        x.fillRect(
            2,
            5,
            12,
            1
        );

        x.fillRect(
            2,
            9,
            12,
            1
        );

        x.fillRect(
            2,
            13,
            12,
            1
        );

        x.fillStyle =
            "#c58a50";

        x.fillRect(
            4,
            3,
            4,
            1
        );

        x.fillRect(
            8,
            7,
            4,
            1
        );

        x.fillRect(
            3,
            11,
            5,
            1
        );
    }

    else if (
        type ===
        "sticks"
    ) {
        x.fillStyle =
            "#6e4729";

        x.fillRect(
            5,
            2,
            2,
            12
        );

        x.fillRect(
            9,
            1,
            2,
            12
        );

        x.fillStyle =
            "#a07146";

        x.fillRect(
            6,
            2,
            1,
            12
        );

        x.fillRect(
            10,
            1,
            1,
            12
        );
    }

    else if (
        type ===
        "axe"
    ) {
        // Proper pixel axe.

        x.fillStyle =
            "#6c4428";

        x.fillRect(
            5,
            10,
            2,
            4
        );

        x.fillRect(
            6,
            7,
            2,
            4
        );

        x.fillRect(
            7,
            4,
            2,
            4
        );

        x.fillStyle =
            "#9a6a40";

        x.fillRect(
            6,
            10,
            1,
            4
        );

        x.fillRect(
            7,
            7,
            1,
            3
        );

        x.fillStyle =
            "#808080";

        x.fillRect(
            8,
            2,
            5,
            2
        );

        x.fillRect(
            9,
            4,
            4,
            2
        );

        x.fillRect(
            8,
            6,
            3,
            1
        );

        x.fillStyle =
            "#b0b0b0";

        x.fillRect(
            9,
            2,
            4,
            1
        );

        x.fillRect(
            12,
            4,
            1,
            2
        );
    }

    else if (
        type ===
        "pickaxe"
    ) {
        // Proper pixel pickaxe.

        x.fillStyle =
            "#7a7a7a";

        x.fillRect(
            2,
            2,
            12,
            2
        );

        x.fillRect(
            3,
            4,
            3,
            1
        );

        x.fillRect(
            10,
            4,
            3,
            1
        );

        x.fillStyle =
            "#aaaaaa";

        x.fillRect(
            3,
            2,
            10,
            1
        );

        x.fillStyle =
            "#6c4428";

        x.fillRect(
            7,
            4,
            2,
            3
        );

        x.fillRect(
            6,
            6,
            2,
            3
        );

        x.fillRect(
            5,
            8,
            2,
            3
        );

        x.fillRect(
            4,
            10,
            2,
            4
        );

        x.fillStyle =
            "#9a6a40";

        x.fillRect(
            8,
            4,
            1,
            3
        );

        x.fillRect(
            5,
            10,
            1,
            4
        );
    }

    else if (
        type ===
        "beef"
        ||
        type ===
        "pork"
        ||
        type ===
        "mutton"
    ) {
        const base =
            type === "beef"
                ? "#7f2f25"
                : type === "pork"
                    ? "#c56f73"
                    : "#8c4b3e";

        const light =
            type === "beef"
                ? "#b75a45"
                : type === "pork"
                    ? "#e99a9d"
                    : "#c77b66";

        x.fillStyle =
            base;

        x.fillRect(
            3,
            4,
            10,
            8
        );

        x.fillStyle =
            light;

        x.fillRect(
            5,
            3,
            6,
            2
        );

        x.fillRect(
            4,
            11,
            7,
            2
        );

        x.fillStyle =
            "#e0c6ad";

        x.fillRect(
            10,
            6,
            2,
            3
        );
    }

    const url =
        c.toDataURL();

    iconCache.set(
        type,
        url
    );

    return url;
}

// =====================================================
// INVENTORY / HOTBAR
// =====================================================

function addItemToInventory(
    type,
    amount = 1
) {
    if (
        !Object.prototype
            .hasOwnProperty
            .call(
                inventory,
                type
            )
    ) {
        return;
    }

    inventory[type] +=
        amount;

    if (
        !hotbarItems.includes(
            type
        )
    ) {
        const emptyIndex =
            hotbarItems.indexOf(
                null
            );

        if (
            emptyIndex !== -1
        ) {
            hotbarItems[
                emptyIndex
            ] = type;
        }
    }

    updateHotbar();
    updateCraftingMenu();
}

function removeItemFromInventory(
    type,
    amount = 1
) {
    if (
        !Object.prototype
            .hasOwnProperty
            .call(
                inventory,
                type
            )
    ) {
        return false;
    }

    if (
        inventory[type] <
        amount
    ) {
        return false;
    }

    inventory[type] -=
        amount;

    if (
        inventory[type] <= 0
    ) {
        inventory[type] =
            0;

        for (
            let i = 0;
            i < hotbarItems.length;
            i++
        ) {
            if (
                hotbarItems[i] ===
                type
            ) {
                hotbarItems[i] =
                    null;
            }
        }
    }

    updateHotbar();
    updateCraftingMenu();

    return true;
}

function assignSelectedHotbar(
    type
) {
    if (
        !type
        ||
        inventory[type] <= 0
    ) {
        return;
    }

    for (
        let i = 0;
        i < hotbarItems.length;
        i++
    ) {
        if (
            hotbarItems[i] ===
            type
        ) {
            hotbarItems[i] =
                null;
        }
    }

    hotbarItems[
        selectedHotbarIndex
    ] = type;

    updateHotbar();
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
            hotbarItems[i];

        slot.classList.toggle(
            "selected",
            i ===
            selectedHotbarIndex
        );

        slot.innerHTML =
            "";

        css(
            slot,

            {
                position:
                    "relative",

                display:
                    "flex",

                alignItems:
                    "center",

                justifyContent:
                    "center",

                overflow:
                    "hidden",

                boxSizing:
                    "border-box"
            }
        );

        const number =
            css(
                document.createElement(
                    "div"
                ),

                {
                    position:
                        "absolute",

                    top:
                        "3px",

                    left:
                        "5px",

                    fontSize:
                        "12px",

                    color:
                        "white",

                    textShadow:
                        "1px 1px 0 #000",

                    zIndex:
                        "3"
                }
            );

        number.textContent =
            i + 1;

        slot.appendChild(
            number
        );

        if (
            type ===
            null
        ) {
            slot.title =
                "Empty";

            continue;
        }

        const icon =
            css(
                document.createElement(
                    "div"
                ),

                {
                    width:
                        "34px",

                    height:
                        "34px",

                    backgroundImage:
                        `url(${createItemIcon(type)})`,

                    backgroundSize:
                        "100% 100%",

                    imageRendering:
                        "pixelated",

                    border:
                        "2px solid rgba(0,0,0,0.5)",

                    boxSizing:
                        "border-box"
                }
            );

        slot.appendChild(
            icon
        );

        const count =
            css(
                document.createElement(
                    "div"
                ),

                {
                    position:
                        "absolute",

                    right:
                        "4px",

                    bottom:
                        "2px",

                    fontSize:
                        "14px",

                    fontWeight:
                        "bold",

                    color:
                        "white",

                    textShadow:
                        "1px 1px 0 #000",

                    zIndex:
                        "3"
                }
            );

        count.textContent =
            inventory[type];

        slot.appendChild(
            count
        );

        slot.title =
            `${itemName(type)}: ${inventory[type]}`;
    }

    const type =
        selectedItem();

    blockNameLabel.textContent =
        type === null
            ? "EMPTY"
            : `${itemName(type).toUpperCase()} x${inventory[type]}`;
}

// =====================================================
// CRAFTING MENU
// =====================================================

const craftingOverlay =
    css(
        document.createElement(
            "div"
        ),

        {
            display:
                "none",

            position:
                "fixed",

            inset:
                "0",

            background:
                "rgba(0,0,0,0.62)",

            zIndex:
                "1000",

            alignItems:
                "center",

            justifyContent:
                "center",

            fontFamily:
                "inherit"
        }
    );

document.body.appendChild(
    craftingOverlay
);

const craftingPanel =
    css(
        document.createElement(
            "div"
        ),

        {
            width:
                "min(780px, 90vw)",

            maxHeight:
                "82vh",

            overflowY:
                "auto",

            background:
                "#252525",

            border:
                "5px solid #111",

            boxShadow:
                "inset 3px 3px 0 #555, inset -3px -3px 0 #080808, 0 10px 30px rgba(0,0,0,0.55)",

            color:
                "white",

            padding:
                "24px",

            boxSizing:
                "border-box"
        }
    );

craftingOverlay.appendChild(
    craftingPanel
);

function canCraft(
    recipe
) {
    return Object.entries(
        recipe.input
    ).every(
        (
            [
                type,
                amount
            ]
        ) =>
            (
                inventory[type]
                ||
                0
            ) >= amount
    );
}

function craftRecipe(
    recipe
) {
    if (
        !canCraft(
            recipe
        )
    ) {
        return;
    }

    for (
        const [
            type,
            amount
        ]
        of Object.entries(
            recipe.input
        )
    ) {
        inventory[type] -=
            amount;
    }

    for (
        const [
            type,
            amount
        ]
        of Object.entries(
            recipe.output
        )
    ) {
        inventory[type] =
            (
                inventory[type]
                ||
                0
            )
            +
            amount;
    }

    for (
        let i = 0;
        i < hotbarItems.length;
        i++
    ) {
        const type =
            hotbarItems[i];

        if (
            type
            &&
            inventory[type] <= 0
        ) {
            hotbarItems[i] =
                null;
        }
    }

    for (
        const type
        of Object.keys(
            recipe.output
        )
    ) {
        if (
            !hotbarItems.includes(
                type
            )
        ) {
            const emptyIndex =
                hotbarItems.indexOf(
                    null
                );

            if (
                emptyIndex !== -1
            ) {
                hotbarItems[
                    emptyIndex
                ] = type;
            }
        }
    }

    updateHotbar();
    updateCraftingMenu();
}

function updateCraftingMenu() {
    if (
        !craftingPanel
    ) {
        return;
    }

    craftingPanel.innerHTML =
        "";

    const title =
        css(
            document.createElement(
                "div"
            ),

            {
                fontSize:
                    "32px",

                fontWeight:
                    "bold",

                textAlign:
                    "center",

                marginBottom:
                    "8px",

                textShadow:
                    "3px 3px 0 #000"
            }
        );

    title.textContent =
        "INVENTORY / CRAFTING";

    craftingPanel.appendChild(
        title
    );

    const hint =
        css(
            document.createElement(
                "div"
            ),

            {
                textAlign:
                    "center",

                color:
                    "#bdbdbd",

                marginBottom:
                    "22px",

                fontSize:
                    "15px"
            }
        );

    hint.textContent =
        "Press E to close • Click an item to put it in your selected hotbar slot";

    craftingPanel.appendChild(
        hint
    );

    const inventoryTitle =
        css(
            document.createElement(
                "div"
            ),

            {
                fontSize:
                    "21px",

                marginBottom:
                    "10px"
            }
        );

    inventoryTitle.textContent =
        "INVENTORY";

    craftingPanel.appendChild(
        inventoryTitle
    );

    const inventoryGrid =
        css(
            document.createElement(
                "div"
            ),

            {
                display:
                    "grid",

                gridTemplateColumns:
                    "repeat(auto-fit, minmax(145px, 1fr))",

                gap:
                    "8px",

                marginBottom:
                    "26px"
            }
        );

    for (
        const [
            type,
            amount
        ]
        of Object.entries(
            inventory
        )
    ) {
        const card =
            css(
                document.createElement(
                    "div"
                ),

                {
                    display:
                        "flex",

                    alignItems:
                        "center",

                    gap:
                        "9px",

                    background:
                        "#333",

                    border:
                        "3px solid #151515",

                    padding:
                        "8px",

                    cursor:
                        amount > 0
                            ? "pointer"
                            : "default"
                }
            );

        const icon =
            css(
                document.createElement(
                    "div"
                ),

                {
                    width:
                        "36px",

                    height:
                        "36px",

                    flex:
                        "0 0 36px",

                    backgroundImage:
                        `url(${createItemIcon(type)})`,

                    backgroundSize:
                        "100% 100%",

                    imageRendering:
                        "pixelated",

                    border:
                        "2px solid #111",

                    boxSizing:
                        "border-box"
                }
            );

        const label =
            document.createElement(
                "div"
            );

        label.textContent =
            `${itemName(type)} x${amount}`;

        label.style.fontSize =
            "15px";

        card.append(
            icon,
            label
        );

        if (
            amount > 0
        ) {
            card.addEventListener(
                "click",

                () =>
                    assignSelectedHotbar(
                        type
                    )
            );
        }

        inventoryGrid.appendChild(
            card
        );
    }

    craftingPanel.appendChild(
        inventoryGrid
    );

    const recipesTitle =
        css(
            document.createElement(
                "div"
            ),

            {
                fontSize:
                    "21px",

                marginBottom:
                    "10px"
            }
        );

    recipesTitle.textContent =
        "CRAFTING";

    craftingPanel.appendChild(
        recipesTitle
    );

    for (
        const recipe
        of recipes
    ) {
        const row =
            css(
                document.createElement(
                    "div"
                ),

                {
                    display:
                        "flex",

                    alignItems:
                        "center",

                    justifyContent:
                        "space-between",

                    gap:
                        "18px",

                    background:
                        "#333",

                    border:
                        "3px solid #151515",

                    padding:
                        "14px",

                    marginBottom:
                        "10px"
                }
            );

        const info =
            document.createElement(
                "div"
            );

        const name =
            css(
                document.createElement(
                    "div"
                ),

                {
                    fontSize:
                        "20px",

                    fontWeight:
                        "bold",

                    marginBottom:
                        "4px"
                }
            );

        name.textContent =
            recipe.name.toUpperCase();

        const description =
            document.createElement(
                "div"
            );

        description.textContent =
            recipe.description;

        description.style.color =
            "#cfcfcf";

        info.append(
            name,
            description
        );

        const button =
            document.createElement(
                "button"
            );

        const available =
            canCraft(
                recipe
            );

        button.textContent =
            available
                ? "CRAFT"
                : "MISSING ITEMS";

        button.disabled =
            !available;

        css(
            button,

            {
                minWidth:
                    "135px",

                padding:
                    "12px 16px",

                font:
                    "inherit",

                fontWeight:
                    "bold",

                fontSize:
                    "16px",

                color:
                    button.disabled
                        ? "#888"
                        : "white",

                background:
                    button.disabled
                        ? "#3d3d3d"
                        : "#666",

                border:
                    "4px solid #111",

                cursor:
                    button.disabled
                        ? "not-allowed"
                        : "pointer"
            }
        );

        button.addEventListener(
            "click",

            () =>
                craftRecipe(
                    recipe
                )
        );

        row.append(
            info,
            button
        );

        craftingPanel.appendChild(
            row
        );
    }
}

function setCraftingOpen(
    open
) {
    craftingOpen =
        open;

    craftingOverlay.style.display =
        open
            ? "flex"
            : "none";

    for (
        const key
        of Object.keys(
            keys
        )
    ) {
        keys[key] =
            false;
    }

    miningHeld =
        false;

    resetMining();

    if (
        open
    ) {
        if (
            document.pointerLockElement
        ) {
            document.exitPointerLock();
        }

        updateCraftingMenu();
    }
}

// =====================================================
// HEALTH / HUNGER
// =====================================================

function updateSurvivalHud() {
    for (
        let i = 0;
        i < 10;
        i++
    ) {
        const hp =
            health -
            i * 2;

        healthMeter.parts[i].style.background =
            hp >= 2
                ? "#b92e2e"
                : hp > 0
                    ? "linear-gradient(to right,#b92e2e 50%,#3a2020 50%)"
                    : "#3a2020";

        const food =
            hunger -
            i * 2;

        hungerMeter.parts[i].style.background =
            food >= 2
                ? "#c8872d"
                : food > 0
                    ? "linear-gradient(to right,#c8872d 50%,#3d2d1c 50%)"
                    : "#3d2d1c";
    }

    healthMeter.label.textContent =
        `HEALTH ${health}`;

    hungerMeter.label.textContent =
        `HUNGER ${hunger}`;
}

function flashDamage() {
    damageFlash.style.opacity =
        "1";

    setTimeout(
        () => {
            damageFlash.style.opacity =
                "0";
        },

        90
    );
}

function takeDamage(
    amount
) {
    health =
        clamp(
            health -
            amount,

            0,
            maxHealth
        );

    flashDamage();
    updateSurvivalHud();

    if (
        health <= 0
    ) {
        respawnPlayer();

        health =
            maxHealth;

        hunger =
            maxHunger;

        updateSurvivalHud();
    }
}

function updateSurvival(
    delta
) {
    if (
        craftingOpen
    ) {
        return;
    }

    hungerTimer +=
        delta;

    if (
        hungerTimer >=
        25
    ) {
        hungerTimer -=
            25;

        hunger =
            Math.max(
                0,
                hunger - 1
            );

        updateSurvivalHud();
    }

    if (
        hunger <= 0
    ) {
        starvationTimer +=
            delta;

        if (
            starvationTimer >=
            4
        ) {
            starvationTimer =
                0;

            takeDamage(
                1
            );
        }
    }

    else {
        starvationTimer =
            0;
    }

    if (
        hunger >= 18
        &&
        health <
        maxHealth
    ) {
        regenTimer +=
            delta;

        if (
            regenTimer >=
            8
        ) {
            regenTimer =
                0;

            health =
                Math.min(
                    maxHealth,
                    health + 1
                );

            hunger =
                Math.max(
                    0,
                    hunger - 1
                );

            updateSurvivalHud();
        }
    }

    else {
        regenTimer =
            0;
    }
}

function eatSelectedFood() {
    const type =
        selectedItem();

    if (
        !foodValues[
            type
        ]
    ) {
        return false;
    }

    if (
        inventory[type] <= 0
        ||
        hunger >=
        maxHunger
    ) {
        return true;
    }

    removeItemFromInventory(
        type,
        1
    );

    hunger =
        Math.min(
            maxHunger,

            hunger +
            foodValues[type]
        );

    updateSurvivalHud();

    return true;
}

// =====================================================
// ENTITY SYSTEM
// =====================================================

const entities =
    new Map();

const entityHitMeshes =
    new Set();

const killedEntityIds =
    new Set();

const entityMaterialCache =
    new Map();

function entityMaterial(
    color
) {
    if (
        !entityMaterialCache.has(
            color
        )
    ) {
        entityMaterialCache.set(
            color,

            new THREE.MeshLambertMaterial({
                color
            })
        );
    }

    return entityMaterialCache.get(
        color
    );
}

function addEntityPart(
    group,
    entityId,
    size,
    color,
    position
) {
    const mesh =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                size.x,
                size.y,
                size.z
            ),

            entityMaterial(
                color
            )
        );

    mesh.position.set(
        position.x,
        position.y,
        position.z
    );

    mesh.userData.entityId =
        entityId;

    group.add(
        mesh
    );

    entityHitMeshes.add(
        mesh
    );

    return mesh;
}

// =====================================================
// MOB MODELS
// =====================================================

function buildAnimalModel(
    type,
    entityId
) {
    const group =
        new THREE.Group();

    const part =
        (
            size,
            color,
            position
        ) =>
            addEntityPart(
                group,
                entityId,
                size,
                color,
                position
            );

    // =================================================
    // PIG
    // =================================================

    if (
        type ===
        "pig"
    ) {
        part(
            {
                x: 1.25,
                y: 0.72,
                z: 0.78
            },

            0xd77f86,

            {
                x: 0,
                y: 0.72,
                z: 0
            }
        );

        part(
            {
                x: 0.62,
                y: 0.58,
                z: 0.58
            },

            0xe58d94,

            {
                x: 0,
                y: 0.82,
                z: 0.58
            }
        );

        part(
            {
                x: 0.42,
                y: 0.25,
                z: 0.18
            },

            0xf0a0a5,

            {
                x: 0,
                y: 0.72,
                z: 0.92
            }
        );

        // Nostrils

        part(
            {
                x: 0.06,
                y: 0.07,
                z: 0.03
            },

            0x5e3035,

            {
                x: -0.10,
                y: 0.74,
                z: 1.02
            }
        );

        part(
            {
                x: 0.06,
                y: 0.07,
                z: 0.03
            },

            0x5e3035,

            {
                x: 0.10,
                y: 0.74,
                z: 1.02
            }
        );

        // Ears

        part(
            {
                x: 0.16,
                y: 0.18,
                z: 0.12
            },

            0xc66e76,

            {
                x: -0.22,
                y: 1.12,
                z: 0.62
            }
        );

        part(
            {
                x: 0.16,
                y: 0.18,
                z: 0.12
            },

            0xc66e76,

            {
                x: 0.22,
                y: 1.12,
                z: 0.62
            }
        );

        for (
            const [
                px,
                pz
            ]
            of [
                [-0.42, -0.24],
                [0.42, -0.24],
                [-0.42, 0.24],
                [0.42, 0.24]
            ]
        ) {
            part(
                {
                    x: 0.18,
                    y: 0.48,
                    z: 0.18
                },

                0xb76269,

                {
                    x: px,
                    y: 0.24,
                    z: pz
                }
            );
        }
    }

    // =================================================
    // COW
    // =================================================

    else if (
        type ===
        "cow"
    ) {
        part(
            {
                x: 1.42,
                y: 0.82,
                z: 0.82
            },

            0x6a432d,

            {
                x: 0,
                y: 0.82,
                z: 0
            }
        );

        // Patches

        part(
            {
                x: 0.34,
                y: 0.28,
                z: 0.05
            },

            0xd9cbb5,

            {
                x: -0.34,
                y: 0.95,
                z: 0.41
            }
        );

        part(
            {
                x: 0.30,
                y: 0.24,
                z: 0.05
            },

            0xd9cbb5,

            {
                x: 0.32,
                y: 0.70,
                z: -0.41
            }
        );

        // Head

        part(
            {
                x: 0.62,
                y: 0.62,
                z: 0.58
            },

            0x754a31,

            {
                x: 0,
                y: 0.90,
                z: 0.63
            }
        );

        // Muzzle

        part(
            {
                x: 0.46,
                y: 0.25,
                z: 0.18
            },

            0xc79c7e,

            {
                x: 0,
                y: 0.77,
                z: 0.96
            }
        );

        // Ears

        part(
            {
                x: 0.22,
                y: 0.14,
                z: 0.15
            },

            0x5a3927,

            {
                x: -0.38,
                y: 1.12,
                z: 0.60
            }
        );

        part(
            {
                x: 0.22,
                y: 0.14,
                z: 0.15
            },

            0x5a3927,

            {
                x: 0.38,
                y: 1.12,
                z: 0.60
            }
        );

        // Tiny horns

        part(
            {
                x: 0.10,
                y: 0.18,
                z: 0.10
            },

            0xe4dac5,

            {
                x: -0.22,
                y: 1.26,
                z: 0.60
            }
        );

        part(
            {
                x: 0.10,
                y: 0.18,
                z: 0.10
            },

            0xe4dac5,

            {
                x: 0.22,
                y: 1.26,
                z: 0.60
            }
        );

        for (
            const [
                px,
                pz
            ]
            of [
                [-0.47, -0.25],
                [0.47, -0.25],
                [-0.47, 0.25],
                [0.47, 0.25]
            ]
        ) {
            part(
                {
                    x: 0.20,
                    y: 0.62,
                    z: 0.20
                },

                0x3c2b23,

                {
                    x: px,
                    y: 0.31,
                    z: pz
                }
            );
        }
    }

    // =================================================
    // SHEEP
    // =================================================

    else if (
        type ===
        "sheep"
    ) {
        part(
            {
                x: 1.42,
                y: 0.95,
                z: 0.88
            },

            0xe6e2d7,

            {
                x: 0,
                y: 0.88,
                z: 0
            }
        );

        // Wool lumps

        part(
            {
                x: 0.42,
                y: 0.20,
                z: 0.50
            },

            0xf2efe8,

            {
                x: -0.35,
                y: 1.35,
                z: 0
            }
        );

        part(
            {
                x: 0.42,
                y: 0.20,
                z: 0.50
            },

            0xf2efe8,

            {
                x: 0.35,
                y: 1.35,
                z: 0
            }
        );

        // Face

        part(
            {
                x: 0.54,
                y: 0.58,
                z: 0.48
            },

            0x444341,

            {
                x: 0,
                y: 0.88,
                z: 0.63
            }
        );

        // Wool forehead

        part(
            {
                x: 0.60,
                y: 0.18,
                z: 0.42
            },

            0xf0ede5,

            {
                x: 0,
                y: 1.20,
                z: 0.59
            }
        );

        // Ears

        part(
            {
                x: 0.20,
                y: 0.13,
                z: 0.13
            },

            0x3b3a38,

            {
                x: -0.34,
                y: 1.04,
                z: 0.62
            }
        );

        part(
            {
                x: 0.20,
                y: 0.13,
                z: 0.13
            },

            0x3b3a38,

            {
                x: 0.34,
                y: 1.04,
                z: 0.62
            }
        );

        for (
            const [
                px,
                pz
            ]
            of [
                [-0.45, -0.25],
                [0.45, -0.25],
                [-0.45, 0.25],
                [0.45, 0.25]
            ]
        ) {
            part(
                {
                    x: 0.18,
                    y: 0.56,
                    z: 0.18
                },

                0x3f3e3b,

                {
                    x: px,
                    y: 0.28,
                    z: pz
                }
            );
        }
    }

    // =================================================
    // MIMIC
    // =================================================

    else if (
        type ===
        "mimic"
    ) {
        // Dark torso.
        // From far away it should almost look like scenery.

        part(
            {
                x: 0.82,
                y: 1.18,
                z: 0.56
            },

            0x171513,

            {
                x: 0,
                y: 1.18,
                z: 0
            }
        );

        // Hunched shoulders.

        part(
            {
                x: 0.94,
                y: 0.32,
                z: 0.62
            },

            0x211c19,

            {
                x: 0,
                y: 1.82,
                z: 0.02
            }
        );

        // Almost-black face.

        part(
            {
                x: 0.66,
                y: 0.44,
                z: 0.08
            },

            0x090909,

            {
                x: 0,
                y: 1.50,
                z: 0.31
            }
        );

        // Tiny red eyes.

        part(
            {
                x: 0.09,
                y: 0.09,
                z: 0.04
            },

            0xb30000,

            {
                x: -0.17,
                y: 1.56,
                z: 0.36
            }
        );

        part(
            {
                x: 0.09,
                y: 0.09,
                z: 0.04
            },

            0xb30000,

            {
                x: 0.17,
                y: 1.56,
                z: 0.36
            }
        );

        // Long skinny legs.

        part(
            {
                x: 0.16,
                y: 1.05,
                z: 0.16
            },

            0x0d0c0b,

            {
                x: -0.24,
                y: 0.52,
                z: 0
            }
        );

        part(
            {
                x: 0.16,
                y: 1.05,
                z: 0.16
            },

            0x0d0c0b,

            {
                x: 0.24,
                y: 0.52,
                z: 0
            }
        );

        // Dangling arms.

        part(
            {
                x: 0.12,
                y: 0.88,
                z: 0.12
            },

            0x100e0d,

            {
                x: -0.50,
                y: 1.03,
                z: 0
            }
        );

        part(
            {
                x: 0.12,
                y: 0.88,
                z: 0.12
            },

            0x100e0d,

            {
                x: 0.50,
                y: 1.03,
                z: 0
            }
        );
    }

    return group;
}

// =====================================================
// ENTITY STATS / SPAWNING
// =====================================================

function entityStats(
    type
) {
    if (
        type ===
        "cow"
    ) {
        return {
            health: 4,
            speed: 0.75
        };
    }

    if (
        type ===
        "pig"
    ) {
        return {
            health: 3,
            speed: 0.9
        };
    }

    if (
        type ===
        "sheep"
    ) {
        return {
            health: 3,
            speed: 0.7
        };
    }

    return {
        health: 8,
        speed: 0.8
    };
}

function canEntityStandAt(
    x,
    z
) {
    const rx =
        Math.round(
            x
        );

    const rz =
        Math.round(
            z
        );

    const ground =
        getTerrainHeight(
            rx,
            rz
        );

    return !blockExists(
        rx,
        ground + 1,
        rz
    );
}

function spawnEntityForChunk(
    chunk
) {
    const r =
        coordinateRandom(
            chunk.cx * 31 + 7,
            chunk.cz * 47 + 11
        );

    let type =
        null;

    if (
        r < 0.11
    ) {
        type =
            "cow";
    }

    else if (
        r < 0.22
    ) {
        type =
            "pig";
    }

    else if (
        r < 0.33
    ) {
        type =
            "sheep";
    }

    else if (
        r < 0.365
    ) {
        type =
            "mimic";
    }

    else {
        return;
    }

    const id =
        `entity:${chunk.cx},${chunk.cz}:${type}`;

    if (
        killedEntityIds.has(
            id
        )
        ||
        entities.has(
            id
        )
    ) {
        return;
    }

    let spawnX =
        chunk.cx *
        CHUNK_SIZE +
        4;

    let spawnZ =
        chunk.cz *
        CHUNK_SIZE +
        4;

    for (
        let attempt = 0;
        attempt < 6;
        attempt++
    ) {
        const rx =
            coordinateRandom(
                chunk.cx * 67 +
                attempt * 13,

                chunk.cz * 71 +
                attempt * 17
            );

        const rz =
            coordinateRandom(
                chunk.cx * 73 +
                attempt * 19,

                chunk.cz * 79 +
                attempt * 23
            );

        spawnX =
            chunk.cx *
            CHUNK_SIZE +
            2 +
            Math.floor(
                rx * 12
            );

        spawnZ =
            chunk.cz *
            CHUNK_SIZE +
            2 +
            Math.floor(
                rz * 12
            );

        if (
            Math.hypot(
                spawnX,
                spawnZ - 8
            ) > 8
            &&
            canEntityStandAt(
                spawnX,
                spawnZ
            )
        ) {
            break;
        }
    }

    if (
        !canEntityStandAt(
            spawnX,
            spawnZ
        )
    ) {
        return;
    }

    const stats =
        entityStats(
            type
        );

    const group =
        buildAnimalModel(
            type,
            id
        );

    group.position.set(
        spawnX,

        getTerrainHeight(
            Math.round(
                spawnX
            ),

            Math.round(
                spawnZ
            )
        ) + 0.5,

        spawnZ
    );

    scene.add(
        group
    );

    const entity = {
        id,
        type,
        group,

        health:
            stats.health,

        maxHealth:
            stats.health,

        speed:
            stats.speed,

        direction:
            coordinateRandom(
                spawnX + 99,
                spawnZ - 71
            )
            *
            Math.PI
            *
            2,

        wanderTimer:
            1
            +
            coordinateRandom(
                spawnX + 4,
                spawnZ + 9
            ) * 3,

        attackCooldown:
            0,

        fleeTimer:
            0,

        chunkKey:
            chunk.key
    };

    entities.set(
        id,
        entity
    );

    chunk.entityIds.add(
        id
    );
}

function removeEntity(
    entityId,
    killed = false
) {
    const entity =
        entities.get(
            entityId
        );

    if (
        !entity
    ) {
        return;
    }

    entity.group.traverse(
        obj => {
            if (
                obj.isMesh
            ) {
                entityHitMeshes.delete(
                    obj
                );
            }
        }
    );

    scene.remove(
        entity.group
    );

    const chunk =
        loadedChunks.get(
            entity.chunkKey
        );

    if (
        chunk
    ) {
        chunk.entityIds.delete(
            entityId
        );
    }

    entities.delete(
        entityId
    );

    if (
        killed
    ) {
        killedEntityIds.add(
            entityId
        );
    }
}

function transferEntityChunk(
    entity
) {
    const newKey =
        chunkKey(
            worldToChunk(
                entity.group.position.x
            ),

            worldToChunk(
                entity.group.position.z
            )
        );

    if (
        newKey ===
        entity.chunkKey
        ||
        !loadedChunks.has(
            newKey
        )
    ) {
        return;
    }

    const oldChunk =
        loadedChunks.get(
            entity.chunkKey
        );

    const newChunk =
        loadedChunks.get(
            newKey
        );

    if (
        oldChunk
    ) {
        oldChunk.entityIds.delete(
            entity.id
        );
    }

    newChunk.entityIds.add(
        entity.id
    );

    entity.chunkKey =
        newKey;
}

function getTargetEntity() {
    raycaster.setFromCamera(
        screenCenter,
        camera
    );

    const hits =
        raycaster.intersectObjects(
            Array.from(
                entityHitMeshes
            ),

            false
        );

    for (
        const hit
        of hits
    ) {
        const id =
            hit.object.userData.entityId;

        const entity =
            entities.get(
                id
            );

        if (
            entity
        ) {
            return {
                entity,
                hit
            };
        }
    }

    return null;
}

function killEntity(
    entity
) {
    if (
        entity.type ===
        "cow"
    ) {
        addItemToInventory(
            "beef",
            2
        );
    }

    else if (
        entity.type ===
        "pig"
    ) {
        addItemToInventory(
            "pork",
            2
        );
    }

    else if (
        entity.type ===
        "sheep"
    ) {
        addItemToInventory(
            "mutton",
            1
        );
    }

    else if (
        entity.type ===
        "mimic"
    ) {
        addItemToInventory(
            "craftingWood",
            2
        );

        addItemToInventory(
            "stone",
            1
        );
    }

    removeEntity(
        entity.id,
        true
    );
}

function attackEntity(
    entity
) {
    if (
        playerAttackCooldown >
        0
    ) {
        return;
    }

    playerAttackCooldown =
        0.3;

    const tool =
        selectedItem();

    let damage =
        1;

    if (
        tool ===
        "axe"
    ) {
        damage =
            2.5;
    }

    else if (
        tool ===
        "pickaxe"
    ) {
        damage =
            2;
    }

    entity.health -=
        damage;

    if (
        entity.type !==
        "mimic"
    ) {
        const dx =
            entity.group.position.x -
            camera.position.x;

        const dz =
            entity.group.position.z -
            camera.position.z;

        entity.direction =
            Math.atan2(
                dx,
                dz
            );

        entity.fleeTimer =
            2;
    }

    if (
        entity.health <=
        0
    ) {
        killEntity(
            entity
        );
    }
}

function entityCanMoveTo(
    entity,
    nextX,
    nextZ
) {
    const currentGround =
        getTerrainHeight(
            Math.round(
                entity.group.position.x
            ),

            Math.round(
                entity.group.position.z
            )
        );

    const nextGround =
        getTerrainHeight(
            Math.round(
                nextX
            ),

            Math.round(
                nextZ
            )
        );

    if (
        Math.abs(
            nextGround -
            currentGround
        ) > 1
    ) {
        return false;
    }

    return !blockExists(
        Math.round(
            nextX
        ),

        nextGround + 1,

        Math.round(
            nextZ
        )
    );
}

function updateEntities(
    delta
) {
    for (
        const entity
        of Array.from(
            entities.values()
        )
    ) {
        entity.attackCooldown =
            Math.max(
                0,
                entity.attackCooldown - delta
            );

        entity.fleeTimer =
            Math.max(
                0,
                entity.fleeTimer - delta
            );

        const dx =
            camera.position.x -
            entity.group.position.x;

        const dz =
            camera.position.z -
            entity.group.position.z;

        const distance =
            Math.hypot(
                dx,
                dz
            );

        let speed =
            entity.speed;

        let direction =
            entity.direction;

        if (
            entity.type ===
            "mimic"
            &&
            distance <
            16
        ) {
            direction =
                Math.atan2(
                    dx,
                    dz
                );

            speed =
                distance < 8
                    ? 2.8
                    : 1.8;

            if (
                distance <
                1.45
                &&
                entity.attackCooldown <=
                0
            ) {
                entity.attackCooldown =
                    1.1;

                takeDamage(
                    2
                );
            }
        }

        else if (
            entity.fleeTimer >
            0
        ) {
            speed =
                1.8;
        }

        else {
            entity.wanderTimer -=
                delta;

            if (
                entity.wanderTimer <=
                0
            ) {
                entity.direction +=
                    (
                        Math.random()
                        -
                        0.5
                    ) * 2.4;

                entity.wanderTimer =
                    1.5 +
                    Math.random() * 3;
            }

            direction =
                entity.direction;
        }

        const nextX =
            entity.group.position.x
            +
            Math.sin(
                direction
            )
            *
            speed
            *
            delta;

        const nextZ =
            entity.group.position.z
            +
            Math.cos(
                direction
            )
            *
            speed
            *
            delta;

        if (
            entityCanMoveTo(
                entity,
                nextX,
                nextZ
            )
        ) {
            entity.group.position.x =
                nextX;

            entity.group.position.z =
                nextZ;

            entity.direction =
                direction;
        }

        else {
            entity.direction +=
                Math.PI
                *
                (
                    0.5 +
                    Math.random() *
                    0.5
                );
        }

        entity.group.position.y =
            getTerrainHeight(
                Math.round(
                    entity.group.position.x
                ),

                Math.round(
                    entity.group.position.z
                )
            )
            +
            0.5;

        entity.group.rotation.y =
            direction;

        if (
            entity.type ===
            "mimic"
            &&
            distance <
            16
        ) {
            entity.group.rotation.z =
                Math.sin(
                    performance.now() *
                    0.012
                )
                *
                0.025;
        }

        transferEntityChunk(
            entity
        );
    }
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
        amount ===
        0
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
            axis ===
            "x"
        ) {
            testX +=
                step;
        }

        if (
            axis ===
            "z"
        ) {
            testZ +=
                step;
        }

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

        break;
    }
}

function moveVertical(
    amount
) {
    if (
        amount ===
        0
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
                step <
                0
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
// TARGETING / MINING / PLACING
// =====================================================

function getTargetBlock() {
    raycaster.setFromCamera(
        screenCenter,
        camera
    );

    const hits =
        raycaster.intersectObjects(
            Array.from(
                interactiveMeshes
            ),

            false
        );

    for (
        const hit
        of hits
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
            block
        ) {
            return {
                block,
                hit
            };
        }
    }

    return null;
}

function updateMining(
    delta
) {
    if (
        !miningHeld
        ||
        craftingOpen
    ) {
        resetMining();
        return;
    }

    const blockTarget =
        getTargetBlock();

    const entityTarget =
        getTargetEntity();

    if (
        entityTarget
        &&
        (
            !blockTarget
            ||
            entityTarget.hit.distance <
            blockTarget.hit.distance
        )
    ) {
        resetMining();
        return;
    }

    if (
        !blockTarget
        ||
        blockTarget.block.type ===
        "bedrock"
    ) {
        resetMining();
        return;
    }

    const key =
        blockKey(
            blockTarget.block.x,
            blockTarget.block.y,
            blockTarget.block.z
        );

    if (
        key !==
        miningTargetKey
    ) {
        miningTargetKey =
            key;

        miningProgress =
            0;
    }

    const requiredTime =
        getMiningTime(
            blockTarget.block.type
        );

    if (
        !Number.isFinite(
            requiredTime
        )
    ) {
        resetMining();
        return;
    }

    miningProgress +=
        delta;

    const percent =
        Math.min(
            1,
            miningProgress /
            requiredTime
        );

    miningHud.style.display =
        "block";

    miningFill.style.width =
        `${percent * 100}%`;

    if (
        miningProgress >=
        requiredTime
    ) {
        const removed =
            removeLoadedBlock(
                blockTarget.block.x,
                blockTarget.block.y,
                blockTarget.block.z
            );

        if (
            removed
        ) {
            addItemToInventory(
                removed.type,
                1
            );
        }

        miningTargetKey =
            null;

        miningProgress =
            0;

        miningFill.style.width =
            "0%";
    }
}

function placeTargetBlock() {
    if (
        craftingOpen
    ) {
        return;
    }

    const target =
        getTargetBlock();

    if (
        !target
        ||
        !target.hit.face
    ) {
        return;
    }

    const type =
        selectedItem();

    if (
        !type
        ||
        !placeableTypes.has(
            type
        )
        ||
        inventory[type] <= 0
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
        addLoadedBlock(
            placeX,
            placeY,
            placeZ,
            type
        )
    ) {
        removeItemFromInventory(
            type,
            1
        );
    }
}

// =====================================================
// MOVEMENT / RESPAWN
// =====================================================

function updateMovement(
    delta
) {
    if (
        craftingOpen
    ) {
        return;
    }

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
        keys.KeyW
    ) {
        movement.add(
            forward
        );
    }

    if (
        keys.KeyS
    ) {
        movement.sub(
            forward
        );
    }

    if (
        keys.KeyD
    ) {
        movement.add(
            right
        );
    }

    if (
        keys.KeyA
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

    refreshLoadedChunks();

    onGround =
        false;

    verticalVelocity -=
        gravity *
        delta;

    moveVertical(
        verticalVelocity *
        delta
    );

    if (
        camera.position.y <
        bedrockY -
        12
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

    resetMining();

    refreshLoadedChunks(
        true
    );
}

// =====================================================
// CONTROLS
// =====================================================

function setupControls() {
    renderer.domElement.addEventListener(
        "click",

        () => {
            if (
                !craftingOpen
                &&
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

        event =>
            event.preventDefault()
    );

    document.addEventListener(
        "pointerlockchange",

        () => {
            if (
                document.pointerLockElement !==
                renderer.domElement
            ) {
                miningHeld =
                    false;

                resetMining();
            }
        }
    );

    document.addEventListener(
        "mousemove",

        event => {
            if (
                craftingOpen
                ||
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
                Math.PI /
                2 -
                0.01;

            pitch =
                clamp(
                    pitch,
                    -maxPitch,
                    maxPitch
                );

            camera.rotation.y =
                yaw;

            camera.rotation.x =
                pitch;
        }
    );

    document.addEventListener(
        "keydown",

        event => {
            if (
                event.code ===
                "KeyE"
                &&
                !event.repeat
            ) {
                event.preventDefault();

                setCraftingOpen(
                    !craftingOpen
                );

                return;
            }

            if (
                craftingOpen
            ) {
                return;
            }

            keys[
                event.code
            ] =
                true;

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
                    number <= 7
                ) {
                    selectedHotbarIndex =
                        number -
                        1;

                    updateHotbar();
                    resetMining();
                }
            }
        }
    );

    document.addEventListener(
        "keyup",

        event => {
            keys[
                event.code
            ] =
                false;
        }
    );

    renderer.domElement.addEventListener(
        "mousedown",

        event => {
            if (
                craftingOpen
                ||
                document.pointerLockElement !==
                renderer.domElement
            ) {
                return;
            }

            if (
                event.button ===
                0
            ) {
                const blockTarget =
                    getTargetBlock();

                const entityTarget =
                    getTargetEntity();

                if (
                    entityTarget
                    &&
                    (
                        !blockTarget
                        ||
                        entityTarget.hit.distance <
                        blockTarget.hit.distance
                    )
                ) {
                    attackEntity(
                        entityTarget.entity
                    );

                    miningHeld =
                        false;

                    resetMining();
                }

                else {
                    miningHeld =
                        true;

                    resetMining();
                }
            }

            if (
                event.button ===
                2
            ) {
                if (
                    !eatSelectedFood()
                ) {
                    placeTargetBlock();
                }
            }
        }
    );

    document.addEventListener(
        "mouseup",

        event => {
            if (
                event.button ===
                0
            ) {
                miningHeld =
                    false;

                resetMining();
            }
        }
    );

    renderer.domElement.addEventListener(
        "wheel",

        event => {
            if (
                craftingOpen
                ||
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
                7
            ) {
                selectedHotbarIndex =
                    0;
            }

            if (
                selectedHotbarIndex <
                0
            ) {
                selectedHotbarIndex =
                    6;
            }

            updateHotbar();
            resetMining();
        },

        {
            passive:
                false
        }
    );
}

// =====================================================
// START / LOOP
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
    scene =
        new THREE.Scene();

    const skyColor =
        0x72bfe7;

    scene.background =
        new THREE.Color(
            skyColor
        );

    scene.fog =
        new THREE.Fog(
            skyColor,
            FOG_NEAR,
            FOG_FAR
        );

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

    renderer =
        new THREE.WebGLRenderer({
            antialias:
                false
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

    createMaterials();

    blockGeometry =
        new THREE.BoxGeometry(
            1,
            1,
            1
        );

    setupControls();

    updateHotbar();
    updateCraftingMenu();
    updateSurvivalHud();

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

    refreshLoadedChunks(
        true
    );

    clock =
        new THREE.Clock();

    animate();
}

function animate() {
    requestAnimationFrame(
        animate
    );

    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );

    playerAttackCooldown =
        Math.max(
            0,
            playerAttackCooldown - delta
        );

    updateMovement(
        delta
    );

    updateMining(
        delta
    );

    updateEntities(
        delta
    );

    updateSurvival(
        delta
    );

    renderer.render(
        scene,
        camera
    );
}

window.addEventListener(
    "resize",

    () => {
        if (
            !camera
            ||
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
