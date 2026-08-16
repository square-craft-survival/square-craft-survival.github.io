import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

console.log("SQUARE CRAFT SURVIVAL - INFINITE WORLD + CRAFTING");

// =====================================================
// HTML / UI
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

const blockNameLabel = document.createElement("div");

Object.assign(blockNameLabel.style, {
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

// =====================================================
// BLOCK TYPES
// =====================================================

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
// INVENTORY
// =====================================================

const inventory = {
    grass: 0,
    dirt: 0,
    wood: 0,
    leaves: 0,
    stone: 0,
    craftingWood: 0
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

// =====================================================
// RECIPES
// =====================================================

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
    }
];

// =====================================================
// RAYCASTING
// =====================================================

const raycaster = new THREE.Raycaster();

const screenCenter =
    new THREE.Vector2(
        0,
        0
    );

raycaster.far = 6;

// =====================================================
// ITEM NAMES
// =====================================================

function itemName(type) {

    const names = {
        grass:
            "Grass",

        dirt:
            "Dirt",

        wood:
            "Wood",

        leaves:
            "Leaves",

        stone:
            "Stone",

        craftingWood:
            "Crafting Wood",

        bedrock:
            "Bedrock"
    };

    return names[type] || type;
}

// =====================================================
// KEYS
// =====================================================

function blockKey(
    x,
    y,
    z
) {

    return `${x},${y},${z}`;

}

function chunkKey(
    cx,
    cz
) {

    return `${cx},${cz}`;

}

function worldToChunk(value) {

    return Math.floor(
        value /
        CHUNK_SIZE
    );

}

function getChunkForWorld(
    x,
    z
) {

    return loadedChunks.get(

        chunkKey(

            worldToChunk(
                x
            ),

            worldToChunk(
                z
            )

        )

    ) || null;

}

// =====================================================
// RANDOM
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


    return (

        value -

        Math.floor(
            value
        )

    );

}

// =====================================================
// TERRAIN HEIGHT
// =====================================================

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
// TREE SPAWNING
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

// =====================================================
// TREE BLOCKS
// =====================================================

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


    const blocks =
        [];


    // =================================================
    // TRUNK
    // =================================================

    for (
        let y = 1;
        y <= trunkHeight;
        y++
    ) {

        blocks.push({

            x:
                treeX,

            y:
                groundY +
                y,

            z:
                treeZ,

            type:
                "wood"

        });

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

                Math.abs(
                    lx
                ) === 2

                &&

                Math.abs(
                    lz
                ) === 2

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

                Math.abs(
                    lx
                ) === 2

                &&

                Math.abs(
                    lz
                ) === 2

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

        x:
            treeX,

        y:
            leafBase +
            3,

        z:
            treeZ,

        type:
            "leaves"

    });


    return blocks;

}

// =====================================================
// WORLD EDITS
// =====================================================

function setWorldEdit(
    x,
    y,
    z,
    typeOrNull
) {

    const ck =

        chunkKey(

            worldToChunk(
                x
            ),

            worldToChunk(
                z
            )

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
        .get(
            ck
        )
        .set(

            blockKey(
                x,
                y,
                z
            ),

            typeOrNull

        );

}

// =====================================================
// GENERATE CHUNK
// =====================================================

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


    // =================================================
    // TERRAIN
    // =================================================

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


    // =================================================
    // TREES
    // =================================================

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
                const block of
                getTreeBlocks(
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


    // =================================================
    // PLAYER CHANGES
    // =================================================

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
                    .split(
                        ","
                    )
                    .map(
                        Number
                    );


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
// TEXTURE HELPERS
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

// =====================================================
// GRASS TOP
// =====================================================

function createGrassTopTexture() {

    const canvas =
        makeCanvas();


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#4b9d38";


    ctx.fillRect(
        0,
        0,
        16,
        16
    );


    const colors = [

        "#5bb347",

        "#3f8730",

        "#67bc4e",

        "#36792b"

    ];


    for (
        let i = 0;
        i < 60;
        i++
    ) {

        const x =
            (
                i * 7 +
                i * i
            ) % 16;


        const y =
            (
                i * 11 +
                3
            ) % 16;


        ctx.fillStyle =
            colors[
                i %
                colors.length
            ];


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

// =====================================================
// GRASS SIDE
// =====================================================

function createGrassSideTexture() {

    const canvas =
        makeCanvas();


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#6d472e";


    ctx.fillRect(
        0,
        0,
        16,
        16
    );


    ctx.fillStyle =
        "#4b9d38";


    ctx.fillRect(
        0,
        0,
        16,
        4
    );


    ctx.fillStyle =
        "#3f8730";


    ctx.fillRect(
        2,
        4,
        1,
        2
    );


    ctx.fillRect(
        7,
        4,
        1,
        1
    );


    ctx.fillRect(
        12,
        4,
        1,
        2
    );


    const dirtColors = [

        "#80563a",

        "#593923",

        "#744b30"

    ];


    for (
        let i = 0;
        i < 28;
        i++
    ) {

        const x =
            (
                i * 5 +
                2
            ) % 16;


        const y =

            5 +

            (
                (
                    i * 9 +
                    1
                ) % 11
            );


        ctx.fillStyle =
            dirtColors[
                i %
                dirtColors.length
            ];


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

// =====================================================
// DIRT
// =====================================================

function createDirtTexture() {

    const canvas =
        makeCanvas();


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#70492f";


    ctx.fillRect(
        0,
        0,
        16,
        16
    );


    const colors = [

        "#85593a",

        "#5c3a24",

        "#986641",

        "#67412a"

    ];


    for (
        let i = 0;
        i < 54;
        i++
    ) {

        const x =
            (
                i * 3 +
                i * i * 2
            ) % 16;


        const y =
            (
                i * 7 +
                5
            ) % 16;


        ctx.fillStyle =
            colors[
                i %
                colors.length
            ];


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

// =====================================================
// WOOD SIDE
// =====================================================

function createWoodSideTexture() {

    const canvas =
        makeCanvas();


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#684328";


    ctx.fillRect(
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
        let x = 1;
        x < 16;
        x += 3
    ) {

        ctx.fillStyle =
            stripes[
                x %
                stripes.length
            ];


        ctx.fillRect(
            x,
            0,
            1,
            16
        );

    }


    ctx.fillStyle =
        "#8a603d";


    ctx.fillRect(
        5,
        3,
        1,
        5
    );


    ctx.fillRect(
        11,
        9,
        1,
        4
    );


    return finishPixelTexture(
        canvas
    );

}

// =====================================================
// WOOD TOP
// =====================================================

function createWoodTopTexture() {

    const canvas =
        makeCanvas();


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#9b7048";


    ctx.fillRect(
        0,
        0,
        16,
        16
    );


    ctx.strokeStyle =
        "#684328";


    ctx.lineWidth =
        1;


    ctx.strokeRect(
        2,
        2,
        12,
        12
    );


    ctx.strokeRect(
        5,
        5,
        6,
        6
    );


    ctx.fillStyle =
        "#54321d";


    ctx.fillRect(
        7,
        7,
        2,
        2
    );


    return finishPixelTexture(
        canvas
    );

}

// =====================================================
// LEAVES
// =====================================================

function createLeavesTexture() {

    const canvas =
        makeCanvas();


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#2e6d2c";


    ctx.fillRect(
        0,
        0,
        16,
        16
    );


    const colors = [

        "#3d8538",

        "#245822",

        "#4a9141",

        "#326f2e"

    ];


    for (
        let i = 0;
        i < 76;
        i++
    ) {

        const x =
            (
                i * 5 +
                i * i
            ) % 16;


        const y =
            (
                i * 9 +
                2
            ) % 16;


        ctx.fillStyle =
            colors[
                i %
                colors.length
            ];


        ctx.fillRect(
            x,
            y,
            1,
            1
        );

    }


    ctx.fillStyle =
        "#193f1a";


    ctx.fillRect(
        3,
        4,
        1,
        1
    );


    ctx.fillRect(
        12,
        2,
        1,
        1
    );


    ctx.fillRect(
        8,
        11,
        1,
        1
    );


    ctx.fillRect(
        14,
        13,
        1,
        1
    );


    return finishPixelTexture(
        canvas
    );

}

// =====================================================
// STONE
// =====================================================

function createStoneTexture() {

    const canvas =
        makeCanvas();


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#686868";


    ctx.fillRect(
        0,
        0,
        16,
        16
    );


    const colors = [

        "#7d7d7d",

        "#555555",

        "#8c8c8c",

        "#606060"

    ];


    for (
        let i = 0;
        i < 48;
        i++
    ) {

        const x =
            (
                i * 7 +
                1
            ) % 16;


        const y =
            (
                i * 5 +
                i * i
            ) % 16;


        const size =
            i % 5 === 0
                ? 2
                : 1;


        ctx.fillStyle =
            colors[
                i %
                colors.length
            ];


        ctx.fillRect(
            x,
            y,
            size,
            1
        );

    }


    return finishPixelTexture(
        canvas
    );

}

// =====================================================
// CRAFTING WOOD
// =====================================================

function createCraftingWoodTexture() {

    const canvas =
        makeCanvas();


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#a66f3f";


    ctx.fillRect(
        0,
        0,
        16,
        16
    );


    // Horizontal boards

    for (
        let y = 0;
        y < 16;
        y += 4
    ) {

        ctx.fillStyle =
            "#704521";


        ctx.fillRect(
            0,
            y,
            16,
            1
        );

    }


    ctx.fillStyle =
        "#c58a50";


    ctx.fillRect(
        2,
        1,
        5,
        1
    );


    ctx.fillRect(
        9,
        5,
        4,
        1
    );


    ctx.fillRect(
        4,
        9,
        6,
        1
    );


    ctx.fillRect(
        11,
        13,
        3,
        1
    );


    ctx.fillStyle =
        "#81512c";


    ctx.fillRect(
        7,
        2,
        1,
        2
    );


    ctx.fillRect(
        3,
        6,
        1,
        2
    );


    ctx.fillRect(
        12,
        10,
        1,
        2
    );


    return finishPixelTexture(
        canvas
    );

}

// =====================================================
// BEDROCK
// =====================================================

function createBedrockTexture() {

    const canvas =
        makeCanvas();


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#282828";


    ctx.fillRect(
        0,
        0,
        16,
        16
    );


    const colors = [

        "#111111",

        "#454545",

        "#333333",

        "#5a5a5a"

    ];


    for (
        let i = 0;
        i < 82;
        i++
    ) {

        const x =
            (
                i * 11 +
                i * i * 3
            ) % 16;


        const y =
            (
                i * 7 +
                4
            ) % 16;


        ctx.fillStyle =
            colors[
                i %
                colors.length
            ];


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

// =====================================================
// MATERIALS
// =====================================================

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
// BLOCK TINT
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

        0.90 +

        random *

        0.10;


    return new THREE.Color(

        shade,

        shade,

        shade

    );

}

// =====================================================
// CHUNK RENDERING
// =====================================================

function rebuildChunk(
    chunk
) {

    for (
        const mesh of
        chunk.meshes
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


    const grouped =
        {};


    for (
        const type of
        allBlockTypes
    ) {

        grouped[
            type
        ] = [];

    }


    for (
        const block of
        chunk.blocks.values()
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
        const type of
        allBlockTypes
    ) {

        const blocks =
            grouped[
                type
            ];


        if (
            blocks.length ===
            0
        ) {

            continue;

        }


        const mesh =

            new THREE.InstancedMesh(

                blockGeometry,

                materials[
                    type
                ],

                blocks.length

            );


        for (
            let i = 0;
            i < blocks.length;
            i++
        ) {

            const block =
                blocks[
                    i
                ];


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

// =====================================================
// LOAD CHUNK
// =====================================================

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
            []

    };


    loadedChunks.set(
        key,
        chunk
    );


    rebuildChunk(
        chunk
    );


    return chunk;

}

// =====================================================
// UNLOAD CHUNK
// =====================================================

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
        const mesh of
        chunk.meshes
    ) {

        interactiveMeshes.delete(
            mesh
        );


        scene.remove(
            mesh
        );

    }


    loadedChunks.delete(
        key
    );

}

// =====================================================
// REFRESH CHUNKS
// =====================================================

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
        let dx = -LOAD_DISTANCE;
        dx <= LOAD_DISTANCE;
        dx++
    ) {

        for (
            let dz = -LOAD_DISTANCE;
            dz <= LOAD_DISTANCE;
            dz++
        ) {

            if (

                dx * dx +

                dz * dz

                >

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
        const key of
        Array.from(
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
// BLOCK LOOKUP
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


    return (

        chunk.blocks.get(

            blockKey(
                x,
                y,
                z
            )

        )

        ||

        null

    );

}

function blockExists(
    x,
    y,
    z
) {

    return (

        getLoadedBlock(
            x,
            y,
            z
        )

        !==

        null

    );

}

// =====================================================
// REMOVE BLOCK
// =====================================================

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

// =====================================================
// ADD BLOCK
// =====================================================

function addLoadedBlock(
    x,
    y,
    z,
    type
) {

    const chunk =
        loadChunk(

            worldToChunk(
                x
            ),

            worldToChunk(
                z
            )

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
// HOTBAR ICONS
// =====================================================

function getIconBackground(
    type
) {

    switch (
        type
    ) {

        case "grass":

            return "linear-gradient(to bottom, #4b9d38 0 28%, #6d472e 28% 100%)";


        case "dirt":

            return "repeating-linear-gradient(135deg, #70492f 0 4px, #85593a 4px 7px, #5c3a24 7px 10px)";


        case "wood":

            return "repeating-linear-gradient(90deg, #4f311d 0 3px, #684328 3px 6px, #7c5434 6px 8px)";


        case "leaves":

            return "repeating-linear-gradient(45deg, #245822 0 3px, #2e6d2c 3px 6px, #4a9141 6px 8px)";


        case "stone":

            return "repeating-linear-gradient(135deg, #555555 0 4px, #686868 4px 7px, #8c8c8c 7px 9px)";


        case "craftingWood":

            return "repeating-linear-gradient(0deg, #704521 0 2px, #a66f3f 2px 6px, #c58a50 6px 7px)";


        default:

            return "transparent";

    }

}

// =====================================================
// ADD INVENTORY ITEM
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


    inventory[
        type
    ] +=
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
            emptyIndex !==
            -1
        ) {

            hotbarItems[
                emptyIndex
            ] =
                type;

        }

    }


    updateHotbar();

    updateCraftingMenu();

}

// =====================================================
// REMOVE INVENTORY ITEM
// =====================================================

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
        inventory[
            type
        ] < amount
    ) {

        return false;

    }


    inventory[
        type
    ] -=
        amount;


    if (
        inventory[
            type
        ] <= 0
    ) {

        inventory[
            type
        ] = 0;


        for (
            let i = 0;
            i < hotbarItems.length;
            i++
        ) {

            if (
                hotbarItems[
                    i
                ] === type
            ) {

                hotbarItems[
                    i
                ] = null;

            }

        }

    }


    updateHotbar();

    updateCraftingMenu();


    return true;

}

// =====================================================
// UPDATE HOTBAR
// =====================================================

function updateHotbar() {

    for (
        let i = 0;
        i < hotbarSlots.length;
        i++
    ) {

        const slot =
            hotbarSlots[
                i
            ];


        const type =
            hotbarItems[
                i
            ];


        slot.classList.toggle(

            "selected",

            i ===
            selectedHotbarIndex

        );


        slot.innerHTML =
            "";


        Object.assign(
            slot.style,
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


        // =================================================
        // SLOT NUMBER
        // =================================================

        const number =
            document.createElement(
                "div"
            );


        number.textContent =
            i + 1;


        Object.assign(
            number.style,
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


        // =================================================
        // ICON
        // =================================================

        const icon =
            document.createElement(
                "div"
            );


        Object.assign(
            icon.style,
            {

                width:
                    "30px",

                height:
                    "30px",

                border:
                    "2px solid rgba(0,0,0,0.5)",

                boxSizing:
                    "border-box",

                background:
                    getIconBackground(
                        type
                    ),

                boxShadow:
                    "inset 2px 2px 0 rgba(255,255,255,0.12), inset -2px -2px 0 rgba(0,0,0,0.28)"

            }
        );


        slot.appendChild(
            icon
        );


        // =================================================
        // COUNT
        // =================================================

        const count =
            document.createElement(
                "div"
            );


        count.textContent =
            inventory[
                type
            ];


        Object.assign(
            count.style,
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


        slot.appendChild(
            count
        );


        slot.title =

            `${itemName(type)}: ${inventory[type]}`;

    }


    const selectedType =

        hotbarItems[
            selectedHotbarIndex
        ];


    blockNameLabel.textContent =

        selectedType ===
        null

            ? "EMPTY"

            : `${itemName(selectedType).toUpperCase()} x${inventory[selectedType]}`;

}

// =====================================================
// CRAFTING OVERLAY
// =====================================================

const craftingOverlay =
    document.createElement(
        "div"
    );


Object.assign(
    craftingOverlay.style,
    {

        display:
            "none",

        position:
            "fixed",

        inset:
            "0",

        background:
            "rgba(0, 0, 0, 0.62)",

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


// =====================================================
// CRAFTING PANEL
// =====================================================

const craftingPanel =
    document.createElement(
        "div"
    );


Object.assign(
    craftingPanel.style,
    {

        width:
            "min(720px, 88vw)",

        maxHeight:
            "80vh",

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

// =====================================================
// CAN CRAFT?
// =====================================================

function canCraft(
    recipe
) {

    for (
        const [
            type,
            amount
        ]
        of Object.entries(
            recipe.input
        )
    ) {

        if (
            (
                inventory[
                    type
                ]
                || 0
            )
            <
            amount
        ) {

            return false;

        }

    }


    return true;

}

// =====================================================
// CRAFT RECIPE
// =====================================================

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


    // =================================================
    // REMOVE MATERIALS
    // =================================================

    for (
        const [
            type,
            amount
        ]
        of Object.entries(
            recipe.input
        )
    ) {

        inventory[
            type
        ] -=
            amount;


        if (
            inventory[
                type
            ] < 0
        ) {

            inventory[
                type
            ] = 0;

        }

    }


    // =================================================
    // ADD OUTPUT
    // =================================================

    for (
        const [
            type,
            amount
        ]
        of Object.entries(
            recipe.output
        )
    ) {

        inventory[
            type
        ] =

            (
                inventory[
                    type
                ]
                || 0
            )

            +

            amount;

    }


    // =================================================
    // REMOVE ZERO ITEMS FROM HOTBAR
    // =================================================

    for (
        let i = 0;
        i < hotbarItems.length;
        i++
    ) {

        const type =
            hotbarItems[
                i
            ];


        if (
            type
            &&
            inventory[
                type
            ] <= 0
        ) {

            hotbarItems[
                i
            ] = null;

        }

    }


    // =================================================
    // ADD CRAFTED ITEMS TO HOTBAR
    // =================================================

    for (
        const type of
        Object.keys(
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
                emptyIndex !==
                -1
            ) {

                hotbarItems[
                    emptyIndex
                ] =
                    type;

            }

        }

    }


    updateHotbar();

    updateCraftingMenu();

}

// =====================================================
// UPDATE CRAFTING MENU
// =====================================================

function updateCraftingMenu() {

    craftingPanel.innerHTML =
        "";


    // =================================================
    // TITLE
    // =================================================

    const title =
        document.createElement(
            "div"
        );


    title.textContent =
        "INVENTORY / CRAFTING";


    Object.assign(
        title.style,
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


    craftingPanel.appendChild(
        title
    );


    const hint =
        document.createElement(
            "div"
        );


    hint.textContent =
        "Press E to close";


    Object.assign(
        hint.style,
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


    craftingPanel.appendChild(
        hint
    );


    // =================================================
    // INVENTORY TITLE
    // =================================================

    const inventoryTitle =
        document.createElement(
            "div"
        );


    inventoryTitle.textContent =
        "INVENTORY";


    Object.assign(
        inventoryTitle.style,
        {

            fontSize:
                "21px",

            marginBottom:
                "10px"

        }
    );


    craftingPanel.appendChild(
        inventoryTitle
    );


    // =================================================
    // INVENTORY GRID
    // =================================================

    const inventoryGrid =
        document.createElement(
            "div"
        );


    Object.assign(
        inventoryGrid.style,
        {

            display:
                "grid",

            gridTemplateColumns:
                "repeat(auto-fit, minmax(130px, 1fr))",

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
            document.createElement(
                "div"
            );


        Object.assign(
            card.style,
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
                    "8px"

            }
        );


        const icon =
            document.createElement(
                "div"
            );


        Object.assign(
            icon.style,
            {

                width:
                    "34px",

                height:
                    "34px",

                flex:
                    "0 0 34px",

                background:
                    getIconBackground(
                        type
                    ),

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


        card.appendChild(
            icon
        );


        card.appendChild(
            label
        );


        inventoryGrid.appendChild(
            card
        );

    }


    craftingPanel.appendChild(
        inventoryGrid
    );


    // =================================================
    // CRAFTING TITLE
    // =================================================

    const recipesTitle =
        document.createElement(
            "div"
        );


    recipesTitle.textContent =
        "CRAFTING";


    Object.assign(
        recipesTitle.style,
        {

            fontSize:
                "21px",

            marginBottom:
                "10px"

        }
    );


    craftingPanel.appendChild(
        recipesTitle
    );


    // =================================================
    // RECIPES
    // =================================================

    for (
        const recipe of
        recipes
    ) {

        const row =
            document.createElement(
                "div"
            );


        Object.assign(
            row.style,
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


        const recipeName =
            document.createElement(
                "div"
            );


        recipeName.textContent =
            recipe.name.toUpperCase();


        Object.assign(
            recipeName.style,
            {

                fontSize:
                    "20px",

                fontWeight:
                    "bold",

                marginBottom:
                    "4px"

            }
        );


        const recipeDescription =
            document.createElement(
                "div"
            );


        recipeDescription.textContent =
            recipe.description;


        recipeDescription.style.color =
            "#cfcfcf";


        info.appendChild(
            recipeName
        );


        info.appendChild(
            recipeDescription
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

                : "NEED WOOD";


        button.disabled =
            !available;


        Object.assign(
            button.style,
            {

                minWidth:
                    "130px",

                padding:
                    "12px 16px",

                font:
                    "inherit",

                fontWeight:
                    "bold",

                fontSize:
                    "17px",

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
            () => {

                craftRecipe(
                    recipe
                );

            }
        );


        row.appendChild(
            info
        );


        row.appendChild(
            button
        );


        craftingPanel.appendChild(
            row
        );

    }

}

// =====================================================
// OPEN / CLOSE CRAFTING
// =====================================================

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
        const key of
        Object.keys(
            keys
        )
    ) {

        keys[
            key
        ] = false;

    }


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

// =====================================================
// PLACING VS PLAYER
// =====================================================

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

// =====================================================
// HORIZONTAL MOVEMENT
// =====================================================

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
            )

            /

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

// =====================================================
// VERTICAL MOVEMENT
// =====================================================

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
            )

            /

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
// TARGET BLOCK
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

    if (
        craftingOpen
    ) {

        return;

    }


    const target =
        getTargetBlock();


    if (
        !target
    ) {

        return;

    }


    if (
        target.block.type ===
        "bedrock"
    ) {

        return;

    }


    const removed =

        removeLoadedBlock(

            target.block.x,

            target.block.y,

            target.block.z

        );


    if (
        !removed
    ) {

        return;

    }


    addItemToInventory(

        removed.type,

        1

    );

}

// =====================================================
// PLACE BLOCK
// =====================================================

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

        hotbarItems[
            selectedHotbarIndex
        ];


    if (
        type ===
        null
    ) {

        return;

    }


    if (
        !placeableTypes.has(
            type
        )
    ) {

        return;

    }


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
// MOVEMENT
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
        keys[
            "KeyW"
        ]
    ) {

        movement.add(
            forward
        );

    }


    if (
        keys[
            "KeyS"
        ]
    ) {

        movement.sub(
            forward
        );

    }


    if (
        keys[
            "KeyD"
        ]
    ) {

        movement.add(
            right
        );

    }


    if (
        keys[
            "KeyA"
        ]
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

// =====================================================
// RESPAWN
// =====================================================

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

            // =================================================
            // E = INVENTORY / CRAFTING
            // =================================================

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
            ] = true;


            // =================================================
            // JUMP
            // =================================================

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


            // =================================================
            // HOTBAR 1-7
            // =================================================

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

                breakTargetBlock();

            }


            if (
                event.button ===
                2
            ) {

                placeTargetBlock();

            }

        }

    );


    // =================================================
    // MOUSE WHEEL
    // =================================================

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

        },

        {

            passive:
                false

        }

    );

}

// =====================================================
// PLAY
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

// =====================================================
// START GAME
// =====================================================

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
    // BLOCKS
    // =================================================

    createMaterials();


    blockGeometry =

        new THREE.BoxGeometry(

            1,

            1,

            1

        );


    // =================================================
    // CONTROLS
    // =================================================

    setupControls();


    updateHotbar();


    updateCraftingMenu();


    // =================================================
    // SPAWN
    // =================================================

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
