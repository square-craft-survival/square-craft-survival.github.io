import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

console.log("SQUARE CRAFT SURVIVAL - BIG WORLD UPDATE");

// ============================================================
// HELPERS
// ============================================================
const $ = id => document.getElementById(id);
const css = (el, styles) => (Object.assign(el.style, styles), el);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const key3 = (x, y, z) => `${x},${y},${z}`;
const key2 = (x, z) => `${x},${z}`;

function hash2(x, z, seed = 0) {
    const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
    return n - Math.floor(n);
}

function hash3(x, y, z, seed = 0) {
    const n = Math.sin(x * 157.7 + y * 269.5 + z * 113.5 + seed * 41.3) * 43758.5453123;
    return n - Math.floor(n);
}

// ============================================================
// HTML / HUD
// ============================================================
const playButton = $("playButton");
const startScreen = $("startScreen");
const gameContainer = $("game");
const hotbar = $("hotbar");

if (!playButton || !startScreen || !gameContainer || !hotbar) {
    throw new Error("SCS needs #playButton, #startScreen, #game, and #hotbar in index.html");
}

gameContainer.style.display = "none";
hotbar.innerHTML = "";

for (let i = 0; i < 7; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    hotbar.appendChild(slot);
}

const hotbarSlots = [...document.querySelectorAll(".slot")];

const itemLabel = css(document.createElement("div"), {
    position: "fixed",
    left: "50%",
    bottom: "94px",
    transform: "translateX(-50%)",
    color: "white",
    fontWeight: "bold",
    fontSize: "20px",
    textShadow: "2px 2px #000",
    pointerEvents: "none",
    zIndex: "20"
});

gameContainer.appendChild(itemLabel);

const miningBar = css(document.createElement("div"), {
    position: "fixed",
    left: "50%",
    top: "56%",
    transform: "translateX(-50%)",
    width: "160px",
    height: "14px",
    background: "rgba(0,0,0,.7)",
    border: "3px solid #111",
    display: "none",
    zIndex: "30",
    pointerEvents: "none"
});

const miningFill = css(document.createElement("div"), {
    width: "0%",
    height: "100%",
    background: "#eee"
});

miningBar.appendChild(miningFill);
gameContainer.appendChild(miningBar);

const survivalHud = css(document.createElement("div"), {
    position: "fixed",
    top: "16px",
    left: "16px",
    color: "white",
    fontWeight: "bold",
    textShadow: "2px 2px #000",
    zIndex: "40",
    pointerEvents: "none"
});

gameContainer.appendChild(survivalHud);

function makeMeter(name, filled, empty) {
    const row = css(document.createElement("div"), {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        marginBottom: "6px"
    });

    const label = css(document.createElement("div"), {
        width: "88px",
        fontSize: "14px"
    });

    const cells = css(document.createElement("div"), {
        display: "flex",
        gap: "2px"
    });

    const parts = [];

    for (let i = 0; i < 10; i++) {
        const p = css(document.createElement("div"), {
            width: "15px",
            height: "15px",
            border: "2px solid #111",
            boxSizing: "border-box"
        });

        p.dataset.filled = filled;
        p.dataset.empty = empty;

        cells.appendChild(p);
        parts.push(p);
    }

    row.append(label, cells);
    survivalHud.appendChild(row);

    return {
        label,
        parts
    };
}

const healthMeter = makeMeter("HEALTH", "#b92e2e", "#3a2020");
const hungerMeter = makeMeter("HUNGER", "#c8872d", "#3d2d1c");

const clockHud = css(document.createElement("div"), {
    position: "fixed",
    top: "16px",
    right: "18px",
    color: "white",
    fontSize: "16px",
    fontWeight: "bold",
    textShadow: "2px 2px #000",
    zIndex: "40",
    pointerEvents: "none"
});

gameContainer.appendChild(clockHud);

const damageFlash = css(document.createElement("div"), {
    position: "fixed",
    inset: "0",
    background: "rgba(170,0,0,.28)",
    opacity: "0",
    transition: "opacity .12s",
    pointerEvents: "none",
    zIndex: "900"
});

document.body.appendChild(damageFlash);

// ============================================================
// GAME STATE
// ============================================================
let scene;
let camera;
let renderer;
let clock;
let blockGeometry;

let sunLight;
let ambientLight;

let started = false;

const materials = {};
const keys = {};

let yaw = 0;
let pitch = 0;
let verticalVelocity = 0;
let onGround = false;
let craftingOpen = false;

const MOVE_SPEED = 7;
const GRAVITY = 20;
const JUMP_POWER = 7.5;

const EYE_HEIGHT = 1.7;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.32;

let health = 20;
let hunger = 20;

const MAX_HEALTH = 20;
const MAX_HUNGER = 20;

let hungerTimer = 0;
let starvationTimer = 0;
let regenTimer = 0;

// ============================================================
// WORLD SETTINGS
// ============================================================
const CHUNK_SIZE = 16;
const LOAD_DISTANCE = 4;

const FOG_NEAR = 42;
const FOG_FAR = 62;

const BEDROCK_Y = -12;
const MAX_BUILD_Y = 64;

const loadedChunks = new Map();
const chunkEdits = new Map();
const interactiveMeshes = new Set();

let lastChunkX = null;
let lastChunkZ = null;

const BLOCKS = [
    "grass",
    "dirt",
    "wood",
    "leaves",
    "stone",
    "craftingWood",
    "coalOre",
    "ironOre",
    "goldOre",
    "diamondOre",
    "bedrock"
];

const PLACEABLE = new Set([
    "grass",
    "dirt",
    "wood",
    "leaves",
    "stone",
    "craftingWood",
    "coalOre",
    "ironOre",
    "goldOre",
    "diamondOre"
]);

const INVENTORY = {
    grass: 0,
    dirt: 0,
    wood: 0,
    leaves: 0,
    stone: 0,
    craftingWood: 0,

    coal: 0,
    iron: 0,
    gold: 0,
    diamond: 0,

    sticks: 0,

    woodAxe: 0,
    woodPickaxe: 0,

    stoneAxe: 0,
    stonePickaxe: 0,

    ironAxe: 0,
    ironPickaxe: 0,

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

let selectedHotbar = 0;

const RECIPES = [
    {
        name: "Crafting Wood",
        input: {
            wood: 1
        },
        output: {
            craftingWood: 5
        },
        text: "1 Wood → 5 Crafting Wood"
    },

    {
        name: "Sticks",
        input: {
            craftingWood: 2
        },
        output: {
            sticks: 4
        },
        text: "2 Crafting Wood → 4 Sticks"
    },

    {
        name: "Wood Axe",
        input: {
            craftingWood: 3,
            sticks: 2
        },
        output: {
            woodAxe: 1
        },
        text: "3 Crafting Wood + 2 Sticks"
    },

    {
        name: "Wood Pickaxe",
        input: {
            craftingWood: 3,
            sticks: 2
        },
        output: {
            woodPickaxe: 1
        },
        text: "3 Crafting Wood + 2 Sticks"
    },

    {
        name: "Stone Axe",
        input: {
            stone: 3,
            sticks: 2
        },
        output: {
            stoneAxe: 1
        },
        text: "3 Stone + 2 Sticks"
    },

    {
        name: "Stone Pickaxe",
        input: {
            stone: 3,
            sticks: 2
        },
        output: {
            stonePickaxe: 1
        },
        text: "3 Stone + 2 Sticks"
    },

    {
        name: "Iron Axe",
        input: {
            iron: 3,
            sticks: 2
        },
        output: {
            ironAxe: 1
        },
        text: "3 Iron + 2 Sticks"
    },

    {
        name: "Iron Pickaxe",
        input: {
            iron: 3,
            sticks: 2
        },
        output: {
            ironPickaxe: 1
        },
        text: "3 Iron + 2 Sticks"
    }
];

const FOOD = {
    beef: 6,
    pork: 5,
    mutton: 4
};

const NAMES = {
    grass: "Grass",
    dirt: "Dirt",
    wood: "Wood",
    leaves: "Leaves",
    stone: "Stone",

    craftingWood: "Crafting Wood",

    coal: "Coal",
    iron: "Iron",
    gold: "Gold",
    diamond: "Diamond",

    woodAxe: "Wood Axe",
    woodPickaxe: "Wood Pickaxe",

    stoneAxe: "Stone Axe",
    stonePickaxe: "Stone Pickaxe",

    ironAxe: "Iron Axe",
    ironPickaxe: "Iron Pickaxe",

    sticks: "Sticks",

    beef: "Beef",
    pork: "Pork",
    mutton: "Mutton"
};

const nameOf = type => NAMES[type] || type;
const selectedItem = () => hotbarItems[selectedHotbar];

const isAxe = item =>
    [
        "woodAxe",
        "stoneAxe",
        "ironAxe"
    ].includes(item);

const isPickaxe = item =>
    [
        "woodPickaxe",
        "stonePickaxe",
        "ironPickaxe"
    ].includes(item);

const pickTier = item =>
    item === "ironPickaxe"
        ? 3
        : item === "stonePickaxe"
            ? 2
            : item === "woodPickaxe"
                ? 1
                : 0;

const axeTier = item =>
    item === "ironAxe"
        ? 3
        : item === "stoneAxe"
            ? 2
            : item === "woodAxe"
                ? 1
                : 0;

// ============================================================
// DAY / NIGHT
// ============================================================
const DAY_LENGTH = 240;

let worldTime = 0.28;
let isNight = false;

function updateDayNight(delta) {
    worldTime =
        (
            worldTime +
            delta /
            DAY_LENGTH
        ) % 1;

    const angle =
        worldTime *
        Math.PI *
        2 -
        Math.PI /
        2;

    const sunY =
        Math.sin(
            angle
        );

    const daylight =
        clamp(
            (
                sunY +
                0.18
            ) /
            1.18,

            0,
            1
        );

    isNight =
        daylight <
        0.22;

    sunLight.position.set(
        Math.cos(angle) *
        55,

        sunY *
        70,

        Math.sin(angle) *
        40
    );

    sunLight.intensity =
        lerp(
            0.08,
            1.25,
            daylight
        );

    ambientLight.intensity =
        lerp(
            0.12,
            0.46,
            daylight
        );

    const day =
        new THREE.Color(
            0x72bfe7
        );

    const dusk =
        new THREE.Color(
            0x7c5267
        );

    const night =
        new THREE.Color(
            0x08111f
        );

    let sky;

    if (
        daylight >
        0.35
    ) {
        sky =
            night
                .clone()
                .lerp(
                    day,

                    clamp(
                        (
                            daylight -
                            0.35
                        ) /
                        0.65,

                        0,
                        1
                    )
                );
    }

    else {
        sky =
            night
                .clone()
                .lerp(
                    dusk,

                    daylight /
                    0.35
                );
    }

    scene.background.copy(
        sky
    );

    scene.fog.color.copy(
        sky
    );

    const totalMinutes =
        Math.floor(
            worldTime *
            24 *
            60
        );

    const hour =
        Math.floor(
            totalMinutes /
            60
        ) % 24;

    const minute =
        totalMinutes %
        60;

    clockHud.textContent =
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${isNight ? "NIGHT" : "DAY"}`;
}

// ============================================================
// TERRAIN / CAVES / ORES / STRUCTURES
// ============================================================
const chunkOf =
    v =>
        Math.floor(
            v /
            CHUNK_SIZE
        );

function terrainHeight(
    x,
    z
) {
    const broad =
        Math.sin(
            x *
            0.025
        ) *
        3.1

        +

        Math.cos(
            z *
            0.022
        ) *
        2.8;

    const ridges =
        Math.sin(
            (
                x +
                z
            ) *
            0.047
        ) *
        1.8

        +

        Math.cos(
            (
                x -
                z
            ) *
            0.039
        ) *
        1.3;

    const bumps =
        Math.sin(
            x *
            0.11
        ) *
        0.75

        +

        Math.cos(
            z *
            0.10
        ) *
        0.75;

    return clamp(
        Math.floor(
            6 +
            broad +
            ridges +
            bumps
        ),

        1,
        15
    );
}

function caveNoise(
    x,
    y,
    z
) {
    return (
        Math.sin(
            x *
            0.17
        )

        +

        Math.sin(
            z *
            0.19
        )

        +

        Math.sin(
            (
                x +
                z
            ) *
            0.08
        )

        +

        Math.cos(
            y *
            0.42 +
            x *
            0.05
        )

        +

        Math.sin(
            y *
            0.33 +
            z *
            0.06
        )
    );
}

function structureForChunk(
    cx,
    cz
) {
    if (
        Math.abs(cx) <= 1
        &&
        Math.abs(cz) <= 1
    ) {
        return null;
    }

    const r =
        hash2(
            cx,
            cz,
            808
        );

    if (
        r <
        0.025
    ) {
        return "hut";
    }

    if (
        r <
        0.043
    ) {
        return "ruin";
    }

    return null;
}

function structureCenter(
    cx,
    cz
) {
    return {
        x:
            cx *
            CHUNK_SIZE +
            8,

        z:
            cz *
            CHUNK_SIZE +
            8
    };
}

function nearStructure(
    x,
    z,
    radius = 5
) {
    const cx =
        chunkOf(
            x
        );

    const cz =
        chunkOf(
            z
        );

    for (
        let dx = -1;
        dx <= 1;
        dx++
    ) {
        for (
            let dz = -1;
            dz <= 1;
            dz++
        ) {
            const scx =
                cx +
                dx;

            const scz =
                cz +
                dz;

            if (
                !structureForChunk(
                    scx,
                    scz
                )
            ) {
                continue;
            }

            const c =
                structureCenter(
                    scx,
                    scz
                );

            if (
                Math.hypot(
                    x -
                    c.x,

                    z -
                    c.z
                ) <=
                radius
            ) {
                return true;
            }
        }
    }

    return false;
}

function caveEntranceForChunk(
    cx,
    cz
) {
    const r =
        hash2(
            cx,
            cz,
            404
        );

    if (
        r >
        0.075
        ||
        structureForChunk(
            cx,
            cz
        )
    ) {
        return null;
    }

    const x =
        cx *
        CHUNK_SIZE +
        4 +
        Math.floor(
            hash2(
                cx,
                cz,
                405
            ) *
            8
        );

    const z =
        cz *
        CHUNK_SIZE +
        4 +
        Math.floor(
            hash2(
                cx,
                cz,
                406
            ) *
            8
        );

    return {
        x,
        z,

        ground:
            terrainHeight(
                x,
                z
            )
    };
}

function insideEntrance(
    x,
    y,
    z
) {
    const cx =
        chunkOf(
            x
        );

    const cz =
        chunkOf(
            z
        );

    for (
        let dx = -1;
        dx <= 1;
        dx++
    ) {
        for (
            let dz = -1;
            dz <= 1;
            dz++
        ) {
            const e =
                caveEntranceForChunk(
                    cx +
                    dx,

                    cz +
                    dz
                );

            if (
                !e
            ) {
                continue;
            }

            const dist =
                Math.hypot(
                    x -
                    e.x,

                    z -
                    e.z
                );

            if (
                dist <
                1.45
                &&
                y <=
                e.ground +
                1
                &&
                y >=
                e.ground -
                7
            ) {
                return true;
            }

            if (
                dist <
                2.3
                &&
                y <=
                e.ground -
                4
                &&
                y >=
                e.ground -
                8
            ) {
                return true;
            }
        }
    }

    return false;
}

function shouldCarveCave(
    x,
    y,
    z,
    surface
) {
    if (
        y >=
        surface -
        2
        ||
        y <=
        BEDROCK_Y +
        1
    ) {
        return false;
    }

    if (
        insideEntrance(
            x,
            y,
            z
        )
    ) {
        return true;
    }

    const n =
        caveNoise(
            x,
            y,
            z
        );

    const wobble =
        (
            hash3(
                Math.floor(
                    x /
                    3
                ),

                Math.floor(
                    y /
                    2
                ),

                Math.floor(
                    z /
                    3
                ),

                99
            )
            -
            0.5
        )
        *
        0.7;

    return (
        n +
        wobble
        >
        2.55
    );
}

function oreAt(
    x,
    y,
    z
) {
    const r =
        hash3(
            x,
            y,
            z,
            777
        );

    if (
        y <=
        -6
        &&
        r <
        0.006
    ) {
        return "diamondOre";
    }

    if (
        y <=
        -2
        &&
        r <
        0.016
    ) {
        return "goldOre";
    }

    if (
        y <=
        4
        &&
        r <
        0.045
    ) {
        return "ironOre";
    }

    if (
        r <
        0.095
    ) {
        return "coalOre";
    }

    return "stone";
}

function treeCanSpawn(
    x,
    z
) {
    if (
        Math.hypot(
            x,
            z - 8
        ) <
        9
        ||
        nearStructure(
            x,
            z,
            6
        )
    ) {
        return false;
    }

    if (
        hash2(
            x,
            z,
            12
        ) >
        0.028
    ) {
        return false;
    }

    const h =
        terrainHeight(
            x,
            z
        );

    return (
        Math.abs(
            h -
            terrainHeight(
                x + 1,
                z
            )
        ) <= 1

        &&

        Math.abs(
            h -
            terrainHeight(
                x - 1,
                z
            )
        ) <= 1

        &&

        Math.abs(
            h -
            terrainHeight(
                x,
                z + 1
            )
        ) <= 1

        &&

        Math.abs(
            h -
            terrainHeight(
                x,
                z - 1
            )
        ) <= 1
    );
}

function treeBlocks(
    x,
    z
) {
    if (
        !treeCanSpawn(
            x,
            z
        )
    ) {
        return [];
    }

    const ground =
        terrainHeight(
            x,
            z
        );

    const height =
        hash2(
            x,
            z,
            13
        ) >
        0.5
            ? 5
            : 4;

    const out = [];

    for (
        let y = 1;
        y <= height;
        y++
    ) {
        out.push({
            x,

            y:
                ground +
                y,

            z,

            type:
                "wood"
        });
    }

    const base =
        ground +
        height;

    for (
        let yy = 0;
        yy <= 1;
        yy++
    ) {
        for (
            let dx = -2;
            dx <= 2;
            dx++
        ) {
            for (
                let dz = -2;
                dz <= 2;
                dz++
            ) {
                if (
                    Math.abs(dx) === 2
                    &&
                    Math.abs(dz) === 2
                ) {
                    continue;
                }

                if (
                    yy === 0
                    &&
                    dx === 0
                    &&
                    dz === 0
                ) {
                    continue;
                }

                out.push({
                    x:
                        x +
                        dx,

                    y:
                        base +
                        yy,

                    z:
                        z +
                        dz,

                    type:
                        "leaves"
                });
            }
        }
    }

    for (
        let dx = -1;
        dx <= 1;
        dx++
    ) {
        for (
            let dz = -1;
            dz <= 1;
            dz++
        ) {
            out.push({
                x:
                    x +
                    dx,

                y:
                    base +
                    2,

                z:
                    z +
                    dz,

                type:
                    "leaves"
            });
        }
    }

    out.push({
        x,

        y:
            base +
            3,

        z,

        type:
            "leaves"
    });

    return out;
}

function structureBlocks(
    cx,
    cz
) {
    const type =
        structureForChunk(
            cx,
            cz
        );

    if (
        !type
    ) {
        return [];
    }

    const {
        x: ox,
        z: oz
    } =
        structureCenter(
            cx,
            cz
        );

    const g =
        terrainHeight(
            ox,
            oz
        );

    const out = [];

    const add =
        (
            x,
            y,
            z,
            blockType
        ) =>
            out.push({
                x,
                y,
                z,
                type:
                    blockType
            });

    if (
        type ===
        "hut"
    ) {
        for (
            let x = -2;
            x <= 2;
            x++
        ) {
            for (
                let z = -2;
                z <= 2;
                z++
            ) {
                add(
                    ox +
                    x,

                    g +
                    1,

                    oz +
                    z,

                    "craftingWood"
                );
            }
        }

        for (
            let y = 2;
            y <= 4;
            y++
        ) {
            for (
                let x = -2;
                x <= 2;
                x++
            ) {
                for (
                    let z = -2;
                    z <= 2;
                    z++
                ) {
                    const edge =
                        Math.abs(x) === 2
                        ||
                        Math.abs(z) === 2;

                    const door =
                        z === 2
                        &&
                        x === 0
                        &&
                        y <= 3;

                    if (
                        edge
                        &&
                        !door
                    ) {
                        add(
                            ox +
                            x,

                            g +
                            y,

                            oz +
                            z,

                            y === 2
                            &&
                            Math.abs(x) === 2
                            &&
                            Math.abs(z) === 2

                                ? "wood"

                                : "craftingWood"
                        );
                    }
                }
            }
        }

        for (
            let x = -3;
            x <= 3;
            x++
        ) {
            for (
                let z = -3;
                z <= 3;
                z++
            ) {
                add(
                    ox +
                    x,

                    g +
                    5,

                    oz +
                    z,

                    "wood"
                );
            }
        }
    }

    else {
        for (
            let x = -2;
            x <= 2;
            x++
        ) {
            for (
                let z = -2;
                z <= 2;
                z++
            ) {
                if (
                    hash2(
                        ox +
                        x,

                        oz +
                        z,

                        900
                    ) >
                    0.25
                ) {
                    add(
                        ox +
                        x,

                        g +
                        1,

                        oz +
                        z,

                        "stone"
                    );
                }
            }
        }

        for (
            let y = 2;
            y <= 4;
            y++
        ) {
            for (
                const [
                    x,
                    z
                ]
                of [
                    [-2, -2],
                    [2, -2],
                    [-2, 2],
                    [2, 2]
                ]
            ) {
                if (
                    hash3(
                        ox +
                        x,

                        g +
                        y,

                        oz +
                        z,

                        901
                    ) >
                    0.2
                ) {
                    add(
                        ox +
                        x,

                        g +
                        y,

                        oz +
                        z,

                        "stone"
                    );
                }
            }
        }

        add(
            ox,

            g +
            2,

            oz,

            "goldOre"
        );
    }

    return out;
}

// ============================================================
// WORLD EDITS / CHUNK GENERATION
// ============================================================
function getChunkForWorld(
    x,
    z
) {
    return loadedChunks.get(
        key2(
            chunkOf(x),
            chunkOf(z)
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
        key2(
            chunkOf(x),
            chunkOf(z)
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
            key3(
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

    const put =
        (
            x,
            y,
            z,
            type,
            overwrite = false
        ) => {
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

            const k =
                key3(
                    x,
                    y,
                    z
                );

            if (
                overwrite
                ||
                !blocks.has(
                    k
                )
            ) {
                blocks.set(
                    k,

                    {
                        x,
                        y,
                        z,
                        type
                    }
                );
            }
        };

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
            const surface =
                terrainHeight(
                    x,
                    z
                );

            for (
                let y =
                    BEDROCK_Y;

                y <=
                    surface;

                y++
            ) {
                if (
                    y ===
                    BEDROCK_Y
                ) {
                    put(
                        x,
                        y,
                        z,
                        "bedrock"
                    );

                    continue;
                }

                if (
                    insideEntrance(
                        x,
                        y,
                        z
                    )
                    ||
                    shouldCarveCave(
                        x,
                        y,
                        z,
                        surface
                    )
                ) {
                    continue;
                }

                if (
                    y ===
                    surface
                ) {
                    put(
                        x,
                        y,
                        z,
                        "grass"
                    );
                }

                else if (
                    y >=
                    surface -
                    2
                ) {
                    put(
                        x,
                        y,
                        z,
                        "dirt"
                    );
                }

                else {
                    put(
                        x,
                        y,
                        z,

                        oreAt(
                            x,
                            y,
                            z
                        )
                    );
                }
            }
        }
    }

    for (
        let tx =
            minX -
            2;

        tx <=
            maxX +
            2;

        tx++
    ) {
        for (
            let tz =
                minZ -
                2;

            tz <=
                maxZ +
                2;

            tz++
        ) {
            for (
                const b
                of treeBlocks(
                    tx,
                    tz
                )
            ) {
                put(
                    b.x,
                    b.y,
                    b.z,
                    b.type
                );
            }
        }
    }

    for (
        let sx =
            cx -
            1;

        sx <=
            cx +
            1;

        sx++
    ) {
        for (
            let sz =
                cz -
                1;

            sz <=
                cz +
                1;

            sz++
        ) {
            for (
                const b
                of structureBlocks(
                    sx,
                    sz
                )
            ) {
                put(
                    b.x,
                    b.y,
                    b.z,
                    b.type,
                    true
                );
            }
        }
    }

    const edits =
        chunkEdits.get(
            key2(
                cx,
                cz
            )
        );

    if (
        edits
    ) {
        for (
            const [
                k,
                type
            ]
            of edits
        ) {
            if (
                type ===
                null
            ) {
                blocks.delete(
                    k
                );
            }

            else {
                const [
                    x,
                    y,
                    z
                ] =
                    k
                        .split(",")
                        .map(Number);

                blocks.set(
                    k,

                    {
                        x,
                        y,
                        z,
                        type
                    }
                );
            }
        }
    }

    return blocks;
}

// ============================================================
// TEXTURES
// ============================================================
function makeCanvas() {
    const c =
        document.createElement(
            "canvas"
        );

    c.width =
        16;

    c.height =
        16;

    return c;
}

function finishTexture(
    c
) {
    const t =
        new THREE.CanvasTexture(
            c
        );

    t.magFilter =
        THREE.NearestFilter;

    t.minFilter =
        THREE.NearestFilter;

    t.generateMipmaps =
        false;

    return t;
}

function speckled(
    base,
    colors,
    count = 48
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
        i < count;
        i++
    ) {
        x.fillStyle =
            colors[
                i %
                colors.length
            ];

        x.fillRect(
            (
                i *
                7 +
                i *
                i
            ) %
            16,

            (
                i *
                11 +
                3
            ) %
            16,

            i %
            13 === 0
                ? 2
                : 1,

            1
        );
    }

    return finishTexture(
        c
    );
}

function grassSideTexture() {
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

    for (
        let i = 0;
        i < 26;
        i++
    ) {
        x.fillStyle =
            [
                "#80563a",
                "#593923",
                "#744b30"
            ][
                i %
                3
            ];

        x.fillRect(
            (
                i *
                5 +
                2
            ) %
            16,

            5 +
            (
                (
                    i *
                    9 +
                    1
                ) %
                11
            ),

            1,
            1
        );
    }

    return finishTexture(
        c
    );
}

function woodSideTexture() {
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

    for (
        let i = 1;
        i < 16;
        i += 3
    ) {
        x.fillStyle =
            [
                "#4f311d",
                "#7c5434",
                "#5b3922"
            ][
                i %
                3
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

    return finishTexture(
        c
    );
}

function woodTopTexture() {
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

    return finishTexture(
        c
    );
}

function craftingWoodTexture() {
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

    return finishTexture(
        c
    );
}

function oreTexture(
    colorA,
    colorB
) {
    const c =
        makeCanvas();

    const x =
        c.getContext(
            "2d"
        );

    x.fillStyle =
        "#686868";

    x.fillRect(
        0,
        0,
        16,
        16
    );

    for (
        let i = 0;
        i < 26;
        i++
    ) {
        x.fillStyle =
            i %
            2
                ? "#777"
                : "#555";

        x.fillRect(
            (
                i *
                7 +
                2
            ) %
            16,

            (
                i *
                5 +
                1
            ) %
            16,

            1,
            1
        );
    }

    const spots = [
        [3, 3],
        [10, 2],
        [7, 7],
        [12, 9],
        [4, 12],
        [9, 13]
    ];

    for (
        const [
            sx,
            sy
        ]
        of spots
    ) {
        x.fillStyle =
            colorA;

        x.fillRect(
            sx,
            sy,
            2,
            2
        );

        x.fillStyle =
            colorB;

        x.fillRect(
            sx + 1,
            sy,
            1,
            1
        );
    }

    return finishTexture(
        c
    );
}

function createMaterials() {
    const grassTop =
        new THREE.MeshLambertMaterial({
            map:
                speckled(
                    "#4b9d38",

                    [
                        "#5bb347",
                        "#3f8730",
                        "#67bc4e",
                        "#36792b"
                    ],

                    60
                )
        });

    const grassSide =
        new THREE.MeshLambertMaterial({
            map:
                grassSideTexture()
        });

    const dirt =
        new THREE.MeshLambertMaterial({
            map:
                speckled(
                    "#70492f",

                    [
                        "#85593a",
                        "#5c3a24",
                        "#986641",
                        "#67412a"
                    ],

                    54
                )
        });

    const woodSide =
        new THREE.MeshLambertMaterial({
            map:
                woodSideTexture()
        });

    const woodTop =
        new THREE.MeshLambertMaterial({
            map:
                woodTopTexture()
        });

    materials.grass = [
        grassSide,
        grassSide,
        grassTop,
        dirt,
        grassSide,
        grassSide
    ];

    materials.dirt =
        dirt;

    materials.wood = [
        woodSide,
        woodSide,
        woodTop,
        woodTop,
        woodSide,
        woodSide
    ];

    materials.leaves =
        new THREE.MeshLambertMaterial({
            map:
                speckled(
                    "#2e6d2c",

                    [
                        "#3d8538",
                        "#245822",
                        "#4a9141",
                        "#326f2e"
                    ],

                    76
                )
        });

    materials.stone =
        new THREE.MeshLambertMaterial({
            map:
                speckled(
                    "#686868",

                    [
                        "#7d7d7d",
                        "#555",
                        "#8c8c8c",
                        "#606060"
                    ],

                    48
                )
        });

    materials.craftingWood =
        new THREE.MeshLambertMaterial({
            map:
                craftingWoodTexture()
        });

    materials.coalOre =
        new THREE.MeshLambertMaterial({
            map:
                oreTexture(
                    "#1f1f1f",
                    "#090909"
                )
        });

    materials.ironOre =
        new THREE.MeshLambertMaterial({
            map:
                oreTexture(
                    "#a36d4f",
                    "#c48a68"
                )
        });

    materials.goldOre =
        new THREE.MeshLambertMaterial({
            map:
                oreTexture(
                    "#d7b42c",
                    "#f0d95a"
                )
        });

    materials.diamondOre =
        new THREE.MeshLambertMaterial({
            map:
                oreTexture(
                    "#35c9c8",
                    "#8af1ed"
                )
        });

    materials.bedrock =
        new THREE.MeshLambertMaterial({
            map:
                speckled(
                    "#282828",

                    [
                        "#111",
                        "#454545",
                        "#333",
                        "#5a5a5a"
                    ],

                    82
                )
        });
}

// ============================================================
// CHUNK RENDERING
// ============================================================
function blockTint(
    block
) {
    const s =
        0.92 +
        hash3(
            block.x,
            block.y,
            block.z,
            52
        ) *
        0.08;

    return new THREE.Color(
        s,
        s,
        s
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

    const groups =
        Object.fromEntries(
            BLOCKS.map(
                t => [
                    t,
                    []
                ]
            )
        );

    const exposed =
        b => {
            const neighbors = [
                [1, 0, 0],
                [-1, 0, 0],
                [0, 1, 0],
                [0, -1, 0],
                [0, 0, 1],
                [0, 0, -1]
            ];

            return neighbors.some(
                (
                    [
                        dx,
                        dy,
                        dz
                    ]
                ) =>
                    !chunk.blocks.has(
                        key3(
                            b.x +
                            dx,

                            b.y +
                            dy,

                            b.z +
                            dz
                        )
                    )
            );
        };

    for (
        const b
        of chunk.blocks.values()
    ) {
        if (
            exposed(
                b
            )
        ) {
            groups[
                b.type
            ]?.push(
                b
            );
        }
    }

    const dummy =
        new THREE.Object3D();

    for (
        const type
        of BLOCKS
    ) {
        const blocks =
            groups[
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
            const b =
                blocks[i];

            dummy.position.set(
                b.x,
                b.y,
                b.z
            );

            dummy.updateMatrix();

            mesh.setMatrixAt(
                i,
                dummy.matrix
            );

            mesh.setColorAt(
                i,
                blockTint(
                    b
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
    const k =
        key2(
            cx,
            cz
        );

    if (
        loadedChunks.has(
            k
        )
    ) {
        return loadedChunks.get(
            k
        );
    }

    const chunk = {
        key:
            k,

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
        k,
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
    k
) {
    const chunk =
        loadedChunks.get(
            k
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
        const id
        of [
            ...chunk.entityIds
        ]
    ) {
        removeEntity(
            id,
            false
        );
    }

    loadedChunks.delete(
        k
    );
}

function refreshChunks(
    force = false
) {
    if (
        !camera
    ) {
        return;
    }

    const pcx =
        chunkOf(
            camera.position.x
        );

    const pcz =
        chunkOf(
            camera.position.z
        );

    if (
        !force
        &&
        pcx ===
        lastChunkX
        &&
        pcz ===
        lastChunkZ
    ) {
        return;
    }

    lastChunkX =
        pcx;

    lastChunkZ =
        pcz;

    const needed =
        new Set();

    const radius =
        LOAD_DISTANCE +
        0.4;

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
                dx *
                dx
                +
                dz *
                dz
                >
                radius *
                radius
            ) {
                continue;
            }

            const cx =
                pcx +
                dx;

            const cz =
                pcz +
                dz;

            const k =
                key2(
                    cx,
                    cz
                );

            needed.add(
                k
            );

            loadChunk(
                cx,
                cz
            );
        }
    }

    for (
        const k
        of [
            ...loadedChunks.keys()
        ]
    ) {
        if (
            !needed.has(
                k
            )
        ) {
            unloadChunk(
                k
            );
        }
    }
}

function getBlock(
    x,
    y,
    z
) {
    return getChunkForWorld(
        x,
        z
    )?.blocks.get(
        key3(
            x,
            y,
            z
        )
    ) || null;
}

const blockExists =
    (
        x,
        y,
        z
    ) =>
        !!getBlock(
            x,
            y,
            z
        );

function removeBlock(
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

    const k =
        key3(
            x,
            y,
            z
        );

    const b =
        chunk.blocks.get(
            k
        );

    if (
        !b
        ||
        b.type ===
        "bedrock"
    ) {
        return null;
    }

    chunk.blocks.delete(
        k
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

    return b;
}

function addBlock(
    x,
    y,
    z,
    type
) {
    const chunk =
        loadChunk(
            chunkOf(
                x
            ),

            chunkOf(
                z
            )
        );

    const k =
        key3(
            x,
            y,
            z
        );

    if (
        chunk.blocks.has(
            k
        )
    ) {
        return false;
    }

    chunk.blocks.set(
        k,

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

// ============================================================
// INVENTORY ICONS
// ============================================================
const iconCache =
    new Map();

function itemIcon(
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

    const blockIcon =
        (
            base,
            detail
        ) => {
            x.fillStyle =
                base;

            x.fillRect(
                2,
                2,
                12,
                12
            );

            x.fillStyle =
                detail;

            for (
                let i = 0;
                i < 12;
                i++
            ) {
                x.fillRect(
                    3 +
                    (
                        i *
                        5
                    ) %
                    10,

                    3 +
                    (
                        i *
                        7
                    ) %
                    10,

                    1,
                    1
                );
            }
        };

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
    }

    else if (
        type ===
        "dirt"
    ) {
        blockIcon(
            "#70492f",
            "#986641"
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
    }

    else if (
        type ===
        "leaves"
    ) {
        blockIcon(
            "#2e6d2c",
            "#4a9141"
        );
    }

    else if (
        type ===
        "stone"
    ) {
        blockIcon(
            "#686868",
            "#8c8c8c"
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
    }

    else if (
        [
            "coal",
            "iron",
            "gold",
            "diamond"
        ].includes(
            type
        )
    ) {
        const colors = {
            coal: [
                "#222",
                "#080808"
            ],

            iron: [
                "#a36d4f",
                "#d09a79"
            ],

            gold: [
                "#d7b42c",
                "#ffe36b"
            ],

            diamond: [
                "#35c9c8",
                "#9afff6"
            ]
        }[
            type
        ];

        blockIcon(
            colors[0],
            colors[1]
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
        type
            .toLowerCase()
            .includes(
                "axe"
            )
    ) {
        const tier =
            type.startsWith(
                "wood"
            )

                ? "#9a6a40"

                : type.startsWith(
                    "stone"
                )

                    ? "#888"

                    : "#c7c7c7";

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
            tier;

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
    }

    else if (
        type
            .toLowerCase()
            .includes(
                "pickaxe"
            )
    ) {
        const tier =
            type.startsWith(
                "wood"
            )

                ? "#9a6a40"

                : type.startsWith(
                    "stone"
                )

                    ? "#888"

                    : "#c7c7c7";

        x.fillStyle =
            tier;

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
    }

    else if (
        [
            "beef",
            "pork",
            "mutton"
        ].includes(
            type
        )
    ) {
        const base =
            type ===
            "beef"

                ? "#7f2f25"

                : type ===
                "pork"

                    ? "#c56f73"

                    : "#8c4b3e";

        x.fillStyle =
            base;

        x.fillRect(
            3,
            4,
            10,
            8
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

function addItem(
    type,
    amount = 1
) {
    if (
        !(type in INVENTORY)
    ) {
        return;
    }

    INVENTORY[type] +=
        amount;

    if (
        !hotbarItems.includes(
            type
        )
    ) {
        const i =
            hotbarItems.indexOf(
                null
            );

        if (
            i !==
            -1
        ) {
            hotbarItems[i] =
                type;
        }
    }

    updateHotbar();
    updateCraftingMenu();
}

function removeItem(
    type,
    amount = 1
) {
    if (
        !(type in INVENTORY)
        ||
        INVENTORY[type] <
        amount
    ) {
        return false;
    }

    INVENTORY[type] -=
        amount;

    if (
        INVENTORY[type] <=
        0
    ) {
        INVENTORY[type] =
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

function assignHotbar(
    type
) {
    if (
        !type
        ||
        INVENTORY[type] <=
        0
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
        selectedHotbar
    ] =
        type;

    updateHotbar();
}

function updateHotbar() {
    hotbarSlots.forEach(
        (
            slot,
            i
        ) => {
            const type =
                hotbarItems[i];

            slot.classList.toggle(
                "selected",
                i ===
                selectedHotbar
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

            const num =
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
                            "1px 1px #000",

                        zIndex:
                            "3"
                    }
                );

            num.textContent =
                i + 1;

            slot.appendChild(
                num
            );

            if (
                !type
            ) {
                slot.title =
                    "Empty";

                return;
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
                            `url(${itemIcon(type)})`,

                        backgroundSize:
                            "100% 100%",

                        imageRendering:
                            "pixelated",

                        border:
                            "2px solid rgba(0,0,0,.5)",

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
                            "1px 1px #000",

                        zIndex:
                            "3"
                    }
                );

            count.textContent =
                INVENTORY[type];

            slot.appendChild(
                count
            );

            slot.title =
                `${nameOf(type)}: ${INVENTORY[type]}`;
        }
    );

    const type =
        selectedItem();

    itemLabel.textContent =
        type
            ? `${nameOf(type).toUpperCase()} x${INVENTORY[type]}`
            : "EMPTY";
}

// ============================================================
// CRAFTING MENU
// ============================================================
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
                "rgba(0,0,0,.64)",

            zIndex:
                "1000",

            alignItems:
                "center",

            justifyContent:
                "center"
        }
    );

const craftingPanel =
    css(
        document.createElement(
            "div"
        ),

        {
            width:
                "min(820px,92vw)",

            maxHeight:
                "84vh",

            overflowY:
                "auto",

            background:
                "#252525",

            color:
                "white",

            border:
                "5px solid #111",

            boxShadow:
                "inset 3px 3px #555,inset -3px -3px #080808,0 10px 30px rgba(0,0,0,.55)",

            padding:
                "24px",

            boxSizing:
                "border-box"
        }
    );

craftingOverlay.appendChild(
    craftingPanel
);

document.body.appendChild(
    craftingOverlay
);

function canCraft(
    recipe
) {
    return Object.entries(
        recipe.input
    ).every(
        (
            [
                t,
                n
            ]
        ) =>
            (
                INVENTORY[t]
                ||
                0
            ) >=
            n
    );
}

function craft(
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
            t,
            n
        ]
        of Object.entries(
            recipe.input
        )
    ) {
        INVENTORY[t] -=
            n;
    }

    for (
        const [
            t,
            n
        ]
        of Object.entries(
            recipe.output
        )
    ) {
        INVENTORY[t] =
            (
                INVENTORY[t]
                ||
                0
            )
            +
            n;
    }

    for (
        let i = 0;
        i < hotbarItems.length;
        i++
    ) {
        if (
            hotbarItems[i]
            &&
            INVENTORY[
                hotbarItems[i]
            ] <=
            0
        ) {
            hotbarItems[i] =
                null;
        }
    }

    for (
        const t
        of Object.keys(
            recipe.output
        )
    ) {
        if (
            !hotbarItems.includes(
                t
            )
        ) {
            const i =
                hotbarItems.indexOf(
                    null
                );

            if (
                i !==
                -1
            ) {
                hotbarItems[i] =
                    t;
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
                    "30px",

                fontWeight:
                    "bold",

                textAlign:
                    "center",

                textShadow:
                    "3px 3px #000"
            }
        );

    title.textContent =
        "INVENTORY / CRAFTING";

    const hint =
        css(
            document.createElement(
                "div"
            ),

            {
                textAlign:
                    "center",

                color:
                    "#bbb",

                margin:
                    "8px 0 20px"
            }
        );

    hint.textContent =
        "Press E to close • Click an item to put it in the selected hotbar slot";

    craftingPanel.append(
        title,
        hint
    );

    const invTitle =
        document.createElement(
            "h3"
        );

    invTitle.textContent =
        "INVENTORY";

    craftingPanel.appendChild(
        invTitle
    );

    const grid =
        css(
            document.createElement(
                "div"
            ),

            {
                display:
                    "grid",

                gridTemplateColumns:
                    "repeat(auto-fit,minmax(145px,1fr))",

                gap:
                    "8px",

                marginBottom:
                    "24px"
            }
        );

    for (
        const [
            type,
            amount
        ]
        of Object.entries(
            INVENTORY
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
                        `url(${itemIcon(type)})`,

                    backgroundSize:
                        "100% 100%",

                    imageRendering:
                        "pixelated",

                    border:
                        "2px solid #111"
                }
            );

        const label =
            document.createElement(
                "div"
            );

        label.textContent =
            `${nameOf(type)} x${amount}`;

        card.append(
            icon,
            label
        );

        if (
            amount >
            0
        ) {
            card.addEventListener(
                "click",

                () =>
                    assignHotbar(
                        type
                    )
            );
        }

        grid.appendChild(
            card
        );
    }

    craftingPanel.appendChild(
        grid
    );

    const craftTitle =
        document.createElement(
            "h3"
        );

    craftTitle.textContent =
        "CRAFTING";

    craftingPanel.appendChild(
        craftTitle
    );

    for (
        const recipe
        of RECIPES
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
                        "9px"
                }
            );

        const info =
            document.createElement(
                "div"
            );

        const rn =
            css(
                document.createElement(
                    "div"
                ),

                {
                    fontSize:
                        "18px",

                    fontWeight:
                        "bold",

                    marginBottom:
                        "4px"
                }
            );

        rn.textContent =
            recipe.name.toUpperCase();

        const rd =
            css(
                document.createElement(
                    "div"
                ),

                {
                    color:
                        "#ccc"
                }
            );

        rd.textContent =
            recipe.text;

        info.append(
            rn,
            rd
        );

        const button =
            document.createElement(
                "button"
            );

        button.textContent =
            canCraft(
                recipe
            )
                ? "CRAFT"
                : "MISSING ITEMS";

        button.disabled =
            !canCraft(
                recipe
            );

        css(
            button,

            {
                minWidth:
                    "140px",

                padding:
                    "12px",

                font:
                    "inherit",

                fontWeight:
                    "bold",

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
                craft(
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

function setCrafting(
    open
) {
    craftingOpen =
        open;

    craftingOverlay.style.display =
        open
            ? "flex"
            : "none";

    Object.keys(
        keys
    ).forEach(
        k =>
            keys[k] =
                false
    );

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

// ============================================================
// SURVIVAL
// ============================================================
function updateSurvivalHud() {
    const paint =
        (
            meter,
            value
        ) =>
            meter.parts.forEach(
                (
                    p,
                    i
                ) => {
                    const points =
                        value -
                        i *
                        2;

                    p.style.background =
                        points >=
                        2

                            ? p.dataset.filled

                            : points >
                            0

                                ? `linear-gradient(to right,${p.dataset.filled} 50%,${p.dataset.empty} 50%)`

                                : p.dataset.empty;
                }
            );

    paint(
        healthMeter,
        health
    );

    paint(
        hungerMeter,
        hunger
    );

    healthMeter.label.textContent =
        `HEALTH ${health}`;

    hungerMeter.label.textContent =
        `HUNGER ${hunger}`;
}

function takeDamage(
    amount
) {
    health =
        clamp(
            health -
            amount,

            0,
            MAX_HEALTH
        );

    damageFlash.style.opacity =
        "1";

    setTimeout(
        () =>
            damageFlash.style.opacity =
                "0",

        90
    );

    updateSurvivalHud();

    if (
        health <=
        0
    ) {
        respawnPlayer();

        health =
            MAX_HEALTH;

        hunger =
            MAX_HUNGER;

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
                hunger -
                1
            );

        updateSurvivalHud();
    }

    if (
        hunger <=
        0
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
        hunger >=
        18
        &&
        health <
        MAX_HEALTH
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
                    MAX_HEALTH,
                    health +
                    1
                );

            hunger =
                Math.max(
                    0,
                    hunger -
                    1
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
    const t =
        selectedItem();

    if (
        !FOOD[t]
    ) {
        return false;
    }

    if (
        INVENTORY[t] <=
        0
        ||
        hunger >=
        MAX_HUNGER
    ) {
        return true;
    }

    removeItem(
        t,
        1
    );

    hunger =
        Math.min(
            MAX_HUNGER,

            hunger +
            FOOD[t]
        );

    updateSurvivalHud();

    return true;
}

// ============================================================
// ENTITIES
// ============================================================
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
    pos
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
        pos.x,
        pos.y,
        pos.z
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

function buildAnimalModel(
    type,
    id
) {
    const g =
        new THREE.Group();

    const part =
        (
            size,
            color,
            pos
        ) =>
            addEntityPart(
                g,
                id,
                size,
                color,
                pos
            );

    // ========================================================
    // PIG
    // ========================================================
    if (
        type ===
        "pig"
    ) {
        part(
            {
                x: 0.82,
                y: 0.72,
                z: 1.22
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
                x: 0.56,
                y: 0.54,
                z: 0.54
            },

            0xe58d94,

            {
                x: 0,
                y: 0.78,
                z: 0.88
            }
        );

        part(
            {
                x: 0.36,
                y: 0.22,
                z: 0.18
            },

            0xf0a0a5,

            {
                x: 0,
                y: 0.72,
                z: 1.22
            }
        );

        part(
            {
                x: 0.07,
                y: 0.07,
                z: 0.03
            },

            0x221111,

            {
                x: -0.15,
                y: 0.84,
                z: 1.16
            }
        );

        part(
            {
                x: 0.07,
                y: 0.07,
                z: 0.03
            },

            0x221111,

            {
                x: 0.15,
                y: 0.84,
                z: 1.16
            }
        );

        part(
            {
                x: 0.12,
                y: 0.16,
                z: 0.10
            },

            0xc66e76,

            {
                x: -0.18,
                y: 1.08,
                z: 0.83
            }
        );

        part(
            {
                x: 0.12,
                y: 0.16,
                z: 0.10
            },

            0xc66e76,

            {
                x: 0.18,
                y: 1.08,
                z: 0.83
            }
        );

        for (
            const [
                x,
                z
            ]
            of [
                [-0.24, -0.35],
                [0.24, -0.35],
                [-0.24, 0.35],
                [0.24, 0.35]
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
                    x,
                    y: 0.24,
                    z
                }
            );
        }
    }

    // ========================================================
    // COW
    // ========================================================
    else if (
        type ===
        "cow"
    ) {
        part(
            {
                x: 0.86,
                y: 0.84,
                z: 1.38
            },

            0x6a432d,

            {
                x: 0,
                y: 0.84,
                z: 0
            }
        );

        part(
            {
                x: 0.05,
                y: 0.28,
                z: 0.34
            },

            0xd9cbb5,

            {
                x: -0.44,
                y: 0.95,
                z: 0.18
            }
        );

        part(
            {
                x: 0.05,
                y: 0.24,
                z: 0.28
            },

            0xd9cbb5,

            {
                x: 0.44,
                y: 0.72,
                z: -0.22
            }
        );

        part(
            {
                x: 0.58,
                y: 0.60,
                z: 0.56
            },

            0x754a31,

            {
                x: 0,
                y: 0.90,
                z: 0.96
            }
        );

        part(
            {
                x: 0.42,
                y: 0.22,
                z: 0.18
            },

            0xc79c7e,

            {
                x: 0,
                y: 0.77,
                z: 1.28
            }
        );

        part(
            {
                x: 0.07,
                y: 0.07,
                z: 0.03
            },

            0x1d1410,

            {
                x: -0.15,
                y: 0.93,
                z: 1.20
            }
        );

        part(
            {
                x: 0.07,
                y: 0.07,
                z: 0.03
            },

            0x1d1410,

            {
                x: 0.15,
                y: 0.93,
                z: 1.20
            }
        );

        part(
            {
                x: 0.09,
                y: 0.16,
                z: 0.09
            },

            0xe4dac5,

            {
                x: -0.18,
                y: 1.22,
                z: 0.93
            }
        );

        part(
            {
                x: 0.09,
                y: 0.16,
                z: 0.09
            },

            0xe4dac5,

            {
                x: 0.18,
                y: 1.22,
                z: 0.93
            }
        );

        for (
            const [
                x,
                z
            ]
            of [
                [-0.26, -0.42],
                [0.26, -0.42],
                [-0.26, 0.42],
                [0.26, 0.42]
            ]
        ) {
            part(
                {
                    x: 0.18,
                    y: 0.62,
                    z: 0.18
                },

                0x2e211b,

                {
                    x,
                    y: 0.31,
                    z
                }
            );
        }
    }

    // ========================================================
    // SHEEP
    // ========================================================
    else if (
        type ===
        "sheep"
    ) {
        part(
            {
                x: 0.92,
                y: 0.94,
                z: 1.34
            },

            0xe6e2d7,

            {
                x: 0,
                y: 0.88,
                z: 0
            }
        );

        part(
            {
                x: 0.70,
                y: 0.18,
                z: 0.92
            },

            0xf2efe8,

            {
                x: 0,
                y: 1.34,
                z: 0
            }
        );

        part(
            {
                x: 0.46,
                y: 0.56,
                z: 0.48
            },

            0x444341,

            {
                x: 0,
                y: 0.84,
                z: 0.92
            }
        );

        part(
            {
                x: 0.52,
                y: 0.16,
                z: 0.36
            },

            0xf0ede5,

            {
                x: 0,
                y: 1.12,
                z: 0.90
            }
        );

        part(
            {
                x: 0.07,
                y: 0.07,
                z: 0.03
            },

            0x111111,

            {
                x: -0.13,
                y: 0.92,
                z: 1.16
            }
        );

        part(
            {
                x: 0.07,
                y: 0.07,
                z: 0.03
            },

            0x111111,

            {
                x: 0.13,
                y: 0.92,
                z: 1.16
            }
        );

        for (
            const [
                x,
                z
            ]
            of [
                [-0.24, -0.40],
                [0.24, -0.40],
                [-0.24, 0.40],
                [0.24, 0.40]
            ]
        ) {
            part(
                {
                    x: 0.16,
                    y: 0.54,
                    z: 0.16
                },

                0x2f2f2f,

                {
                    x,
                    y: 0.27,
                    z
                }
            );
        }
    }

    // ========================================================
    // MIMIC
    // ========================================================
    else if (
        type ===
        "mimic"
    ) {
        part(
            {
                x: 0.60,
                y: 0.92,
                z: 0.40
            },

            0x181513,

            {
                x: 0,
                y: 1.22,
                z: 0
            }
        );

        part(
            {
                x: 0.82,
                y: 0.24,
                z: 0.48
            },

            0x27211e,

            {
                x: 0,
                y: 1.73,
                z: -0.06
            }
        );

        part(
            {
                x: 0.40,
                y: 0.42,
                z: 0.34
            },

            0x201b18,

            {
                x: 0,
                y: 1.67,
                z: 0.34
            }
        );

        part(
            {
                x: 0.30,
                y: 0.20,
                z: 0.12
            },

            0x0d0b0a,

            {
                x: 0,
                y: 1.56,
                z: 0.55
            }
        );

        part(
            {
                x: 0.055,
                y: 0.055,
                z: 0.025
            },

            0xc40000,

            {
                x: -0.09,
                y: 1.70,
                z: 0.53
            }
        );

        part(
            {
                x: 0.055,
                y: 0.055,
                z: 0.025
            },

            0xc40000,

            {
                x: 0.09,
                y: 1.70,
                z: 0.53
            }
        );

        part(
            {
                x: 0.11,
                y: 0.92,
                z: 0.11
            },

            0x11100f,

            {
                x: -0.43,
                y: 1.08,
                z: 0.02
            }
        );

        part(
            {
                x: 0.11,
                y: 0.92,
                z: 0.11
            },

            0x11100f,

            {
                x: 0.43,
                y: 1.08,
                z: 0.02
            }
        );

        part(
            {
                x: 0.13,
                y: 0.14,
                z: 0.16
            },

            0x080808,

            {
                x: -0.43,
                y: 0.57,
                z: 0.09
            }
        );

        part(
            {
                x: 0.13,
                y: 0.14,
                z: 0.16
            },

            0x080808,

            {
                x: 0.43,
                y: 0.57,
                z: 0.09
            }
        );

        part(
            {
                x: 0.13,
                y: 1.08,
                z: 0.13
            },

            0x0d0c0b,

            {
                x: -0.17,
                y: 0.54,
                z: -0.02
            }
        );

        part(
            {
                x: 0.13,
                y: 1.08,
                z: 0.13
            },

            0x0d0c0b,

            {
                x: 0.17,
                y: 0.54,
                z: -0.02
            }
        );
    }

    return g;
}

function entityStats(
    type
) {
    if (
        type ===
        "cow"
    ) {
        return {
            health:
                5,

            speed:
                0.75
        };
    }

    if (
        type ===
        "pig"
    ) {
        return {
            health:
                4,

            speed:
                0.9
        };
    }

    if (
        type ===
        "sheep"
    ) {
        return {
            health:
                4,

            speed:
                0.7
        };
    }

    return {
        health:
            10,

        speed:
            1.0
    };
}

function canEntityStand(
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

    const g =
        terrainHeight(
            rx,
            rz
        );

    return (
        !blockExists(
            rx,
            g + 1,
            rz
        )

        &&

        !insideEntrance(
            rx,
            g,
            rz
        )
    );
}

function spawnEntityForChunk(
    chunk
) {
    const r =
        hash2(
            chunk.cx,
            chunk.cz,
            505
        );

    let type =
        r <
        0.11

            ? "cow"

            : r <
            0.22

                ? "pig"

                : r <
                0.33

                    ? "sheep"

                    : r <
                    0.365

                        ? "mimic"

                        : null;

    if (
        !type
    ) {
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

    let x =
        chunk.cx *
        CHUNK_SIZE +
        8;

    let z =
        chunk.cz *
        CHUNK_SIZE +
        8;

    for (
        let a = 0;
        a < 8;
        a++
    ) {
        x =
            chunk.cx *
            CHUNK_SIZE +
            2 +
            Math.floor(
                hash2(
                    chunk.cx +
                    a *
                    13,

                    chunk.cz,

                    506
                ) *
                12
            );

        z =
            chunk.cz *
            CHUNK_SIZE +
            2 +
            Math.floor(
                hash2(
                    chunk.cx,

                    chunk.cz +
                    a *
                    17,

                    507
                ) *
                12
            );

        if (
            Math.hypot(
                x,
                z - 8
            ) >
            10

            &&

            canEntityStand(
                x,
                z
            )

            &&

            !nearStructure(
                x,
                z,
                5
            )
        ) {
            break;
        }
    }

    if (
        !canEntityStand(
            x,
            z
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
        x,

        terrainHeight(
            Math.round(
                x
            ),

            Math.round(
                z
            )
        ) +
        0.5,

        z
    );

    scene.add(
        group
    );

    const e = {
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
            hash2(
                x,
                z,
                508
            ) *
            Math.PI *
            2,

        wander:
            1 +
            hash2(
                x,
                z,
                509
            ) *
            3,

        attackCooldown:
            0,

        flee:
            0,

        chunkKey:
            chunk.key
    };

    entities.set(
        id,
        e
    );

    chunk.entityIds.add(
        id
    );
}

function removeEntity(
    id,
    killed = false
) {
    const e =
        entities.get(
            id
        );

    if (
        !e
    ) {
        return;
    }

    e.group.traverse(
        o => {
            if (
                o.isMesh
            ) {
                entityHitMeshes.delete(
                    o
                );
            }
        }
    );

    scene.remove(
        e.group
    );

    loadedChunks
        .get(
            e.chunkKey
        )
        ?.entityIds
        .delete(
            id
        );

    entities.delete(
        id
    );

    if (
        killed
    ) {
        killedEntityIds.add(
            id
        );
    }
}

function transferEntityChunk(
    e
) {
    const k =
        key2(
            chunkOf(
                e.group.position.x
            ),

            chunkOf(
                e.group.position.z
            )
        );

    if (
        k ===
        e.chunkKey
        ||
        !loadedChunks.has(
            k
        )
    ) {
        return;
    }

    loadedChunks
        .get(
            e.chunkKey
        )
        ?.entityIds
        .delete(
            e.id
        );

    loadedChunks
        .get(
            k
        )
        .entityIds
        .add(
            e.id
        );

    e.chunkKey =
        k;
}

const raycaster =
    new THREE.Raycaster();

const screenCenter =
    new THREE.Vector2(
        0,
        0
    );

raycaster.far =
    6;

function targetEntity() {
    raycaster.setFromCamera(
        screenCenter,
        camera
    );

    const hits =
        raycaster.intersectObjects(
            [
                ...entityHitMeshes
            ],

            false
        );

    for (
        const hit
        of hits
    ) {
        const e =
            entities.get(
                hit.object.userData.entityId
            );

        if (
            e
        ) {
            return {
                entity:
                    e,

                hit
            };
        }
    }

    return null;
}

function killEntity(
    e
) {
    if (
        e.type ===
        "cow"
    ) {
        addItem(
            "beef",
            2
        );
    }

    else if (
        e.type ===
        "pig"
    ) {
        addItem(
            "pork",
            2
        );
    }

    else if (
        e.type ===
        "sheep"
    ) {
        addItem(
            "mutton",
            1
        );
    }

    else {
        addItem(
            "coal",
            1
        );

        if (
            Math.random() <
            0.35
        ) {
            addItem(
                "iron",
                1
            );
        }
    }

    removeEntity(
        e.id,
        true
    );
}

let attackCooldown =
    0;

function attackEntity(
    e
) {
    if (
        attackCooldown >
        0
    ) {
        return;
    }

    attackCooldown =
        0.28;

    const tool =
        selectedItem();

    const damage =
        isAxe(
            tool
        )

            ? 2 +
            axeTier(
                tool
            ) *
            0.6

            : isPickaxe(
                tool
            )

                ? 1.8 +
                pickTier(
                    tool
                ) *
                0.45

                : 1;

    e.health -=
        damage;

    if (
        e.type !==
        "mimic"
    ) {
        e.direction =
            Math.atan2(
                e.group.position.x -
                camera.position.x,

                e.group.position.z -
                camera.position.z
            );

        e.flee =
            2;
    }

    if (
        e.health <=
        0
    ) {
        killEntity(
            e
        );
    }
}

function entityCanMove(
    e,
    nx,
    nz
) {
    const a =
        terrainHeight(
            Math.round(
                e.group.position.x
            ),

            Math.round(
                e.group.position.z
            )
        );

    const b =
        terrainHeight(
            Math.round(
                nx
            ),

            Math.round(
                nz
            )
        );

    if (
        Math.abs(
            b -
            a
        ) >
        1

        ||

        insideEntrance(
            Math.round(
                nx
            ),

            b,

            Math.round(
                nz
            )
        )
    ) {
        return false;
    }

    return !blockExists(
        Math.round(
            nx
        ),

        b +
        1,

        Math.round(
            nz
        )
    );
}

function updateEntities(
    delta
) {
    for (
        const e
        of [
            ...entities.values()
        ]
    ) {
        e.attackCooldown =
            Math.max(
                0,
                e.attackCooldown -
                delta
            );

        e.flee =
            Math.max(
                0,
                e.flee -
                delta
            );

        const dx =
            camera.position.x -
            e.group.position.x;

        const dz =
            camera.position.z -
            e.group.position.z;

        const dist =
            Math.hypot(
                dx,
                dz
            );

        let speed =
            e.speed;

        let dir =
            e.direction;

        const mimicAggro =
            e.type ===
            "mimic"
            &&
            dist <
            (
                isNight
                    ? 22
                    : 9
            );

        if (
            mimicAggro
        ) {
            dir =
                Math.atan2(
                    dx,
                    dz
                );

            speed =
                isNight

                    ? (
                        dist <
                        8

                            ? 3.2

                            : 2.25
                    )

                    : 1.7;

            if (
                dist <
                1.45
                &&
                e.attackCooldown <=
                0
            ) {
                e.attackCooldown =
                    1.0;

                takeDamage(
                    isNight
                        ? 3
                        : 2
                );
            }
        }

        else if (
            e.flee >
            0
        ) {
            speed =
                1.8;
        }

        else {
            e.wander -=
                delta;

            if (
                e.wander <=
                0
            ) {
                e.direction +=
                    (
                        Math.random()
                        -
                        0.5
                    ) *
                    2.2;

                e.wander =
                    1.5 +
                    Math.random() *
                    3;
            }

            dir =
                e.direction;
        }

        const nx =
            e.group.position.x +
            Math.sin(
                dir
            ) *
            speed *
            delta;

        const nz =
            e.group.position.z +
            Math.cos(
                dir
            ) *
            speed *
            delta;

        if (
            entityCanMove(
                e,
                nx,
                nz
            )
        ) {
            e.group.position.x =
                nx;

            e.group.position.z =
                nz;

            e.direction =
                dir;
        }

        else {
            e.direction +=
                Math.PI *
                (
                    0.5 +
                    Math.random() *
                    0.5
                );
        }

        e.group.position.y =
            terrainHeight(
                Math.round(
                    e.group.position.x
                ),

                Math.round(
                    e.group.position.z
                )
            ) +
            0.5;

        e.group.rotation.y =
            dir;

        if (
            e.type ===
            "mimic"
            &&
            mimicAggro
        ) {
            e.group.rotation.z =
                Math.sin(
                    performance.now() *
                    0.012
                ) *
                0.035;
        }

        transferEntityChunk(
            e
        );
    }
}

// ============================================================
// COLLISION / MOVEMENT
// ============================================================
function playerCollides(
    x,
    y,
    z
) {
    const feet =
        y -
        EYE_HEIGHT;

    const minX =
        x -
        PLAYER_RADIUS;

    const maxX =
        x +
        PLAYER_RADIUS;

    const minZ =
        z -
        PLAYER_RADIUS;

    const maxZ =
        z +
        PLAYER_RADIUS;

    const minY =
        feet +
        0.06;

    const maxY =
        feet +
        PLAYER_HEIGHT -
        0.05;

    for (
        let bx =
            Math.ceil(
                minX -
                0.5
            );

        bx <=
            Math.floor(
                maxX +
                0.5
            );

        bx++
    ) {
        for (
            let by =
                Math.ceil(
                    minY -
                    0.5
                );

            by <=
                Math.floor(
                    maxY +
                    0.5
                );

            by++
        ) {
            for (
                let bz =
                    Math.ceil(
                        minZ -
                        0.5
                    );

                bz <=
                    Math.floor(
                        maxZ +
                        0.5
                    );

                bz++
            ) {
                if (
                    !blockExists(
                        bx,
                        by,
                        bz
                    )
                ) {
                    continue;
                }

                if (
                    maxX >
                    bx -
                    0.5

                    &&

                    minX <
                    bx +
                    0.5

                    &&

                    maxY >
                    by -
                    0.5

                    &&

                    minY <
                    by +
                    0.5

                    &&

                    maxZ >
                    bz -
                    0.5

                    &&

                    minZ <
                    bz +
                    0.5
                ) {
                    return true;
                }
            }
        }
    }

    return false;
}

function blockHitsPlayer(
    x,
    y,
    z
) {
    const feet =
        camera.position.y -
        EYE_HEIGHT;

    return (
        camera.position.x +
        PLAYER_RADIUS >
        x -
        0.5

        &&

        camera.position.x -
        PLAYER_RADIUS <
        x +
        0.5

        &&

        feet +
        PLAYER_HEIGHT -
        0.05 >
        y -
        0.5

        &&

        feet +
        0.06 <
        y +
        0.5

        &&

        camera.position.z +
        PLAYER_RADIUS >
        z -
        0.5

        &&

        camera.position.z -
        PLAYER_RADIUS <
        z +
        0.5
    );
}

function moveAxis(
    axis,
    amount
) {
    if (
        !amount
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
        let x =
            camera.position.x;

        let z =
            camera.position.z;

        if (
            axis ===
            "x"
        ) {
            x +=
                step;
        }

        else {
            z +=
                step;
        }

        if (
            !playerCollides(
                x,
                camera.position.y,
                z
            )
        ) {
            camera.position.x =
                x;

            camera.position.z =
                z;

            continue;
        }

        const up =
            camera.position.y +
            1.01;

        if (
            !playerCollides(
                x,
                up,
                z
            )
        ) {
            camera.position.set(
                x,
                up,
                z
            );

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
        !amount
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
        const y =
            camera.position.y +
            step;

        if (
            playerCollides(
                camera.position.x,
                y,
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
            y;
    }
}

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

    const m =
        new THREE.Vector3();

    if (
        keys.KeyW
    ) {
        m.add(
            forward
        );
    }

    if (
        keys.KeyS
    ) {
        m.sub(
            forward
        );
    }

    if (
        keys.KeyD
    ) {
        m.add(
            right
        );
    }

    if (
        keys.KeyA
    ) {
        m.sub(
            right
        );
    }

    if (
        m.lengthSq()
    ) {
        m
            .normalize()
            .multiplyScalar(
                MOVE_SPEED *
                delta
            );

        moveAxis(
            "x",
            m.x
        );

        moveAxis(
            "z",
            m.z
        );
    }

    refreshChunks();

    onGround =
        false;

    verticalVelocity -=
        GRAVITY *
        delta;

    moveVertical(
        verticalVelocity *
        delta
    );

    if (
        camera.position.y <
        BEDROCK_Y -
        12
    ) {
        respawnPlayer();
    }
}

function respawnPlayer() {
    const x =
        0;

    const z =
        8;

    const y =
        terrainHeight(
            x,
            z
        );

    camera.position.set(
        x,

        y +
        0.5 +
        EYE_HEIGHT,

        z
    );

    verticalVelocity =
        0;

    onGround =
        false;

    resetMining();

    refreshChunks(
        true
    );
}

// ============================================================
// MINING / PLACING
// ============================================================
let miningHeld = false;
let miningTarget = null;
let miningProgress = 0;

function targetBlock() {
    raycaster.setFromCamera(
        screenCenter,
        camera
    );

    const hits =
        raycaster.intersectObjects(
            [
                ...interactiveMeshes
            ],

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

        const b =
            hit.object.userData.blocks[
                hit.instanceId
            ];

        if (
            b
        ) {
            return {
                block:
                    b,

                hit
            };
        }
    }

    return null;
}

function resetMining() {
    miningTarget =
        null;

    miningProgress =
        0;

    miningFill.style.width =
        "0%";

    miningBar.style.display =
        "none";
}

function miningTime(
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
        return 0.45;
    }

    if (
        blockType ===
        "grass"
        ||
        blockType ===
        "dirt"
    ) {
        return 0.85;
    }

    if (
        blockType ===
        "wood"
        ||
        blockType ===
        "craftingWood"
    ) {
        return isAxe(
            tool
        )

            ? [
                0,
                1,
                0.72,
                0.5
            ][
                axeTier(
                    tool
                )
            ]

            : 3;
    }

    if (
        [
            "stone",
            "coalOre",
            "ironOre",
            "goldOre",
            "diamondOre"
        ].includes(
            blockType
        )
    ) {
        if (
            !isPickaxe(
                tool
            )
        ) {
            return 5;
        }

        return [
            0,
            3,
            2,
            1.35
        ][
            pickTier(
                tool
            )
        ];
    }

    return 2;
}

function blockDrop(
    type
) {
    if (
        type ===
        "coalOre"
    ) {
        return "coal";
    }

    if (
        type ===
        "ironOre"
    ) {
        return "iron";
    }

    if (
        type ===
        "goldOre"
    ) {
        return "gold";
    }

    if (
        type ===
        "diamondOre"
    ) {
        return "diamond";
    }

    return type;
}

function canHarvest(
    type
) {
    const tier =
        pickTier(
            selectedItem()
        );

    if (
        type ===
        "diamondOre"
        ||
        type ===
        "goldOre"
    ) {
        return tier >=
            2;
    }

    if (
        type ===
        "ironOre"
    ) {
        return tier >=
            1;
    }

    return true;
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

    const bt =
        targetBlock();

    const et =
        targetEntity();

    if (
        et
        &&
        (
            !bt
            ||
            et.hit.distance <
            bt.hit.distance
        )
    ) {
        resetMining();

        return;
    }

    if (
        !bt
        ||
        bt.block.type ===
        "bedrock"
    ) {
        resetMining();

        return;
    }

    const k =
        key3(
            bt.block.x,
            bt.block.y,
            bt.block.z
        );

    if (
        k !==
        miningTarget
    ) {
        miningTarget =
            k;

        miningProgress =
            0;
    }

    const need =
        miningTime(
            bt.block.type
        );

    miningProgress +=
        delta;

    miningBar.style.display =
        "block";

    miningFill.style.width =
        `${Math.min(
            1,

            miningProgress /
            need
        ) * 100}%`;

    if (
        miningProgress >=
        need
    ) {
        const removed =
            removeBlock(
                bt.block.x,
                bt.block.y,
                bt.block.z
            );

        if (
            removed
            &&
            canHarvest(
                removed.type
            )
        ) {
            addItem(
                blockDrop(
                    removed.type
                ),

                1
            );
        }

        resetMining();
    }
}

function placeBlock() {
    const t =
        selectedItem();

    const target =
        targetBlock();

    if (
        !t
        ||
        !PLACEABLE.has(
            t
        )
        ||
        !target?.hit.face
        ||
        INVENTORY[t] <=
        0
    ) {
        return;
    }

    const n =
        target.hit.face.normal;

    const x =
        target.block.x +
        Math.round(
            n.x
        );

    const y =
        target.block.y +
        Math.round(
            n.y
        );

    const z =
        target.block.z +
        Math.round(
            n.z
        );

    if (
        y <
        BEDROCK_Y
        ||
        y >
        MAX_BUILD_Y
        ||
        blockExists(
            x,
            y,
            z
        )
        ||
        blockHitsPlayer(
            x,
            y,
            z
        )
    ) {
        return;
    }

    const blockType =
        t ===
        "coal"

            ? "coalOre"

            : t ===
            "iron"

                ? "ironOre"

                : t ===
                "gold"

                    ? "goldOre"

                    : t ===
                    "diamond"

                        ? "diamondOre"

                        : t;

    if (
        addBlock(
            x,
            y,
            z,
            blockType
        )
    ) {
        removeItem(
            t,
            1
        );
    }
}

// ============================================================
// CONTROLS
// ============================================================
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

        e =>
            e.preventDefault()
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

        e => {
            if (
                craftingOpen
                ||
                document.pointerLockElement !==
                renderer.domElement
            ) {
                return;
            }

            yaw -=
                e.movementX *
                0.002;

            pitch =
                clamp(
                    pitch -
                    e.movementY *
                    0.002,

                    -Math.PI /
                    2 +
                    0.01,

                    Math.PI /
                    2 -
                    0.01
                );

            camera.rotation.y =
                yaw;

            camera.rotation.x =
                pitch;
        }
    );

    document.addEventListener(
        "keydown",

        e => {
            if (
                e.code ===
                "KeyE"
                &&
                !e.repeat
            ) {
                e.preventDefault();

                setCrafting(
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
                e.code
            ] =
                true;

            if (
                e.code ===
                "Space"
            ) {
                e.preventDefault();

                if (
                    onGround
                ) {
                    verticalVelocity =
                        JUMP_POWER;

                    onGround =
                        false;
                }
            }

            if (
                e.code.startsWith(
                    "Digit"
                )
            ) {
                const n =
                    Number(
                        e.code.slice(
                            5
                        )
                    );

                if (
                    n >=
                    1
                    &&
                    n <=
                    7
                ) {
                    selectedHotbar =
                        n -
                        1;

                    updateHotbar();
                    resetMining();
                }
            }
        }
    );

    document.addEventListener(
        "keyup",

        e =>
            keys[
                e.code
            ] =
                false
    );

    renderer.domElement.addEventListener(
        "mousedown",

        e => {
            if (
                craftingOpen
                ||
                document.pointerLockElement !==
                renderer.domElement
            ) {
                return;
            }

            if (
                e.button ===
                0
            ) {
                const bt =
                    targetBlock();

                const et =
                    targetEntity();

                if (
                    et
                    &&
                    (
                        !bt
                        ||
                        et.hit.distance <
                        bt.hit.distance
                    )
                ) {
                    attackEntity(
                        et.entity
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
                e.button ===
                2
            ) {
                if (
                    !eatSelectedFood()
                ) {
                    placeBlock();
                }
            }
        }
    );

    document.addEventListener(
        "mouseup",

        e => {
            if (
                e.button ===
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

        e => {
            if (
                craftingOpen
                ||
                document.pointerLockElement !==
                renderer.domElement
            ) {
                return;
            }

            e.preventDefault();

            selectedHotbar +=
                e.deltaY >
                0

                    ? 1

                    : -1;

            if (
                selectedHotbar >
                6
            ) {
                selectedHotbar =
                    0;
            }

            if (
                selectedHotbar <
                0
            ) {
                selectedHotbar =
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

// ============================================================
// START / LOOP
// ============================================================
playButton.addEventListener(
    "click",

    () => {
        if (
            started
        ) {
            return;
        }

        started =
            true;

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

    scene.background =
        new THREE.Color(
            0x72bfe7
        );

    scene.fog =
        new THREE.Fog(
            0x72bfe7,
            FOG_NEAR,
            FOG_FAR
        );

    camera =
        new THREE.PerspectiveCamera(
            75,

            innerWidth /
            innerHeight,

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
        innerWidth,
        innerHeight
    );

    renderer.setPixelRatio(
        Math.min(
            devicePixelRatio,
            2
        )
    );

    gameContainer.appendChild(
        renderer.domElement
    );

    sunLight =
        new THREE.DirectionalLight(
            0xffffff,
            1.25
        );

    sunLight.position.set(
        40,
        70,
        25
    );

    scene.add(
        sunLight
    );

    ambientLight =
        new THREE.AmbientLight(
            0xffffff,
            0.45
        );

    scene.add(
        ambientLight
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

    const x =
        0;

    const z =
        8;

    const y =
        terrainHeight(
            x,
            z
        );

    camera.position.set(
        x,

        y +
        0.5 +
        EYE_HEIGHT,

        z
    );

    refreshChunks(
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

    attackCooldown =
        Math.max(
            0,
            attackCooldown -
            delta
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

    updateDayNight(
        delta
    );

    renderer.render(
        scene,
        camera
    );
}

addEventListener(
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
            innerWidth /
            innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            innerWidth,
            innerHeight
        );
    }
);
