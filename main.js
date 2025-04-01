// Set up scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Light blue sky color
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Rain parameters
const rainCount = 1000;
const rainGeometry = new THREE.BufferGeometry();
const rainPositions = [];
const rainVelocities = [];

// Create rain drops
for (let i = 0; i < rainCount; i++) {
    rainPositions.push(
        Math.random() * 20 - 10, // x
        Math.random() * 20, // y
        Math.random() * 20 - 10  // z
    );
    rainVelocities.push(Math.random() * 0.1 + 0.1); // Different speeds for each drop
}

rainGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(rainPositions, 3)
);

// Create rain material
const rainMaterial = new THREE.PointsMaterial({
    color: 0xaaaaaa,
    size: 0.05,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true
});

// Create rain particle system
const rain = new THREE.Points(rainGeometry, rainMaterial);
scene.add(rain);

// Create a grid of tiles
const tileSize = 1;
const gridSize = 10;
const tiles = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Define tile types and colors
const TILE_TYPES = {
    GRASS: 'grass',
    PATH: 'path'
};

const COLORS = {
    GRASS: 0x90EE90, // Bright grass green
    PATH: 0xDEB887,  // Tan/beige
    TREE_TRUNK: 0x8B4513,
    TREE_TOP: 0x228B22
};

// Function to create tree
function createTree(x, y, z) {
    const group = new THREE.Group();
    
    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.5, 5);
    const trunkMaterial = new THREE.MeshPhongMaterial({ color: COLORS.TREE_TRUNK });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(0, 0.25, 0);
    
    // Tree top (multiple layers of spheres)
    const createLeafLayer = (y, scale) => {
        const leafGeometry = new THREE.SphereGeometry(0.4 * scale, 4, 4);
        const leafMaterial = new THREE.MeshPhongMaterial({ color: COLORS.TREE_TOP });
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf.position.set(0, y, 0);
        return leaf;
    };
    
    group.add(trunk);
    group.add(createLeafLayer(0.7, 1));
    group.add(createLeafLayer(0.9, 0.8));
    group.add(createLeafLayer(1.1, 0.6));
    
    group.position.set(x, y, z);
    return group;
}

// Function to create tile geometry
function createTileGeometry(type) {
    const geometry = new THREE.BoxGeometry(tileSize, type === TILE_TYPES.PATH ? 0.1 : 0.2, tileSize);
    const material = new THREE.MeshPhongMaterial({
        color: type === TILE_TYPES.PATH ? COLORS.PATH : COLORS.GRASS,
        shininess: 0 // Matte finish
    });
    return new THREE.Mesh(geometry, material);
}

// Create tile map with paths
const tileMap = [];
for (let x = -gridSize/2; x < gridSize/2; x++) {
    tileMap[x + gridSize/2] = [];
    for (let z = -gridSize/2; z < gridSize/2; z++) {
        // Create path pattern (simple cross pattern)
        const isPath = x === 0 || z === 0;
        const type = isPath ? TILE_TYPES.PATH : TILE_TYPES.GRASS;
        const tile = createTileGeometry(type);
        
        tile.position.set(x * tileSize, type === TILE_TYPES.PATH ? -0.05 : 0, z * tileSize);
        tile.userData.type = type;
        tile.userData.originalPosition = tile.position.clone();
        
        scene.add(tile);
        tiles.push(tile);
        tileMap[x + gridSize/2][z + gridSize/2] = tile;
        
        // Add trees randomly to grass tiles
        if (type === TILE_TYPES.GRASS && Math.random() < 0.1) {
            const tree = createTree(x * tileSize, 0, z * tileSize);
            scene.add(tree);
        }
    }
}

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(3, 4, 2);
scene.add(directionalLight);

// Set up camera position for isometric view
camera.position.set(8, 8, 8);
camera.lookAt(0, 0, 0);

// Mouse controls
let isDragging = false;
let isMovingTile = false;
let selectedTile = null;
let previousMousePosition = {
    x: 0,
    y: 0
};

// Function to handle tile movement
function moveTile(tile, deltaX, deltaZ) {
    tile.position.x += deltaX;
    tile.position.z += deltaZ;
}

// Mouse event handlers
document.addEventListener('mousedown', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(tiles);

    if (intersects.length > 0) {
        selectedTile = intersects[0].object;
        isMovingTile = true;
        selectedTile.material.emissive.setHex(0x333333);
    } else {
        isDragging = true;
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
});

document.addEventListener('mousemove', (event) => {
    if (isMovingTile && selectedTile) {
        const deltaX = (event.clientX - previousMousePosition.x) * 0.01;
        const deltaZ = (event.clientY - previousMousePosition.y) * 0.01;
        moveTile(selectedTile, deltaX, deltaZ);
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    } else if (isDragging) {
        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };
        camera.position.x -= deltaMove.x * 0.01;
        camera.position.z -= deltaMove.y * 0.01;
        camera.lookAt(0, 0, 0);
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
});

document.addEventListener('mouseup', () => {
    if (selectedTile) {
        selectedTile.material.emissive.setHex(0x000000);
        selectedTile = null;
    }
    isDragging = false;
    isMovingTile = false;
});

// Add hover effect
document.addEventListener('mousemove', (event) => {
    if (isDragging || isMovingTile) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(tiles);

    // Reset all tiles
    tiles.forEach(tile => {
        tile.material.emissive.setHex(0x000000);
    });

    // Highlight hovered tile
    if (intersects.length > 0) {
        intersects[0].object.material.emissive.setHex(0x222222);
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Update rain animation
function updateRain() {
    const positions = rain.geometry.attributes.position.array;
    
    for (let i = 0; i < rainCount; i++) {
        const i3 = i * 3; // Index for x,y,z
        
        // Update y position with velocity
        positions[i3 + 1] -= rainVelocities[i];
        
        // Reset drop to top when it falls below ground
        if (positions[i3 + 1] < 0) {
            positions[i3 + 1] = 20;
        }
    }
    
    rain.geometry.attributes.position.needsUpdate = true;
}

// Modified animation loop
function animate() {
    requestAnimationFrame(animate);
    updateRain();
    renderer.render(scene, camera);
}

animate(); 