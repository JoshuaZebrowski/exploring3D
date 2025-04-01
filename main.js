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
const gridSize = 50; // Increased map size
const tiles = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Define tile types and colors
const TILE_TYPES = {
    GRASS: 'grass',
    PATH: 'path',
    STONE: 'stone',
    WATER: 'water'
};

const COLORS = {
    GRASS: 0x90EE90,
    PATH: 0xDEB887,
    STONE: 0x808080,
    WATER: 0x4169E1,
    TREE_TRUNK: 0x8B4513,
    TREE_TOP: 0x228B22,
    CASTLE_WALL: 0xA0A0A0,
    CASTLE_ROOF: 0x8B0000,
    HOUSE_WALL: 0xDEB887,
    HOUSE_ROOF: 0x8B4513
};

// Weather system
const WEATHER_TYPES = {
    SUNNY: 'sunny',
    NIGHT: 'night',
    RAIN: 'rain',
    STORM: 'storm'
};

let currentWeather = WEATHER_TYPES.SUNNY;
let lightningTimer = 0;
const burningTrees = new Set();

// Create cloud system for storm
const cloudGeometry = new THREE.BoxGeometry(100, 2, 100);
const cloudMaterial = new THREE.MeshPhongMaterial({
    color: 0x666666,
    transparent: true,
    opacity: 0
});
const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
clouds.position.y = 30;
scene.add(clouds);

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

// Function to create a castle
function createCastle(x, y, z) {
    const castle = new THREE.Group();
    
    // Main keep
    const keepGeometry = new THREE.BoxGeometry(4, 8, 4);
    const keepMaterial = new THREE.MeshPhongMaterial({ color: COLORS.CASTLE_WALL });
    const keep = new THREE.Mesh(keepGeometry, keepMaterial);
    keep.position.set(0, 4, 0);
    
    // Roof
    const roofGeometry = new THREE.ConeGeometry(3, 2, 4);
    const roofMaterial = new THREE.MeshPhongMaterial({ color: COLORS.CASTLE_ROOF });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(0, 9, 0);
    
    // Towers
    const createTower = (xPos, zPos) => {
        const towerGroup = new THREE.Group();
        const towerGeometry = new THREE.CylinderGeometry(0.8, 1, 10, 8);
        const tower = new THREE.Mesh(towerGeometry, keepMaterial);
        const towerRoof = new THREE.Mesh(
            new THREE.ConeGeometry(1, 1.5, 8),
            roofMaterial
        );
        tower.position.set(0, 5, 0);
        towerRoof.position.set(0, 10.5, 0);
        towerGroup.add(tower);
        towerGroup.add(towerRoof);
        towerGroup.position.set(xPos, 0, zPos);
        return towerGroup;
    };
    
    castle.add(keep);
    castle.add(roof);
    castle.add(createTower(3, 3));
    castle.add(createTower(-3, 3));
    castle.add(createTower(3, -3));
    castle.add(createTower(-3, -3));
    
    castle.position.set(x, y, z);
    return castle;
}

// Function to create a village house
function createHouse(x, y, z) {
    const house = new THREE.Group();
    
    // Main structure
    const wallsGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const wallsMaterial = new THREE.MeshPhongMaterial({ color: COLORS.HOUSE_WALL });
    const walls = new THREE.Mesh(wallsGeometry, wallsMaterial);
    walls.position.set(0, 0.75, 0);
    
    // Roof
    const roofGeometry = new THREE.ConeGeometry(1.2, 1, 4);
    const roofMaterial = new THREE.MeshPhongMaterial({ color: COLORS.HOUSE_ROOF });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(0, 2, 0);
    roof.rotation.y = Math.PI / 4;
    
    house.add(walls);
    house.add(roof);
    house.position.set(x, y, z);
    return house;
}

// Function to create a knight
function createKnight(x, y, z) {
    const knight = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.3, 0.5, 0.2);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x808080 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.25, 0);
    
    // Head
    const headGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.set(0, 0.6, 0);
    
    knight.add(body);
    knight.add(head);
    knight.position.set(x, y, z);
    return knight;
}

// Create tile map with terrain features
const tileMap = [];
for (let x = -gridSize/2; x < gridSize/2; x++) {
    tileMap[x + gridSize/2] = [];
    for (let z = -gridSize/2; z < gridSize/2; z++) {
        // Create varied terrain
        const distanceFromCenter = Math.sqrt(x*x + z*z);
        let type = TILE_TYPES.GRASS;
        
        // Create paths
        if (Math.abs(x) === 5 || Math.abs(z) === 5) {
            type = TILE_TYPES.PATH;
        }
        
        // Create castle area
        if (distanceFromCenter < 5 && Math.abs(x) < 4 && Math.abs(z) < 4) {
            type = TILE_TYPES.STONE;
        }
        
        const tile = createTileGeometry(type);
        tile.position.set(x * tileSize, type === TILE_TYPES.PATH ? -0.05 : 0, z * tileSize);
        tile.userData.type = type;
        tile.userData.originalPosition = tile.position.clone();
        
        scene.add(tile);
        tiles.push(tile);
        tileMap[x + gridSize/2][z + gridSize/2] = tile;
        
        // Add features based on position
        if (type === TILE_TYPES.GRASS) {
            if (Math.random() < 0.05) {
                const tree = createTree(x * tileSize, 0, z * tileSize);
                scene.add(tree);
            }
            // Add houses in village areas
            if (distanceFromCenter > 10 && distanceFromCenter < 15 && Math.random() < 0.1) {
                const house = createHouse(x * tileSize, 0, z * tileSize);
                scene.add(house);
            }
            // Add knights randomly
            if (Math.random() < 0.01) {
                const knight = createKnight(x * tileSize, 0, z * tileSize);
                scene.add(knight);
            }
        }
    }
}

// Add castle at center
const castle = createCastle(0, 0, 0);
scene.add(castle);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(3, 4, 2);
scene.add(directionalLight);

// Camera and control variables
const baseSpeed = 0.2;
const firstPersonSpeed = 0.1; // Slower speed for first person mode
const sprintMultiplier = 2.0;
const firstPersonSprintMultiplier = 1.5; // Slightly slower sprint for first person
const mouseSensitivity = 0.005;
let cameraDistance = 30;
const minZoom = 10;  // Minimum zoom distance
const maxZoom = 50;  // Maximum zoom distance
const zoomSpeed = 1.0;  // Speed of zooming
let cameraAngleHorizontal = 0;
let cameraAngleVertical = Math.PI / 4;
let cameraTarget = new THREE.Vector3(0, 0, 0);
let isFirstPerson = false;
let playerHeight = 1.7; // Height of the player in first person view

const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    arrowup: false,
    arrowdown: false
};

// Mouse control variables
let isMouseLooking = false;
let previousMousePosition = {
    x: 0,
    y: 0
};

// Mouse event handlers
document.addEventListener('mousedown', (event) => {
    isMouseLooking = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
});

document.addEventListener('mousemove', (event) => {
    if (!isMouseLooking) return;

    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;

    // Update camera angles
    cameraAngleHorizontal -= deltaX * mouseSensitivity;
    // Allow looking down in first person view
    if (isFirstPerson) {
        cameraAngleVertical = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraAngleVertical - deltaY * mouseSensitivity));
    } else {
        cameraAngleVertical = Math.max(0.1, Math.min(Math.PI / 2, cameraAngleVertical - deltaY * mouseSensitivity));
    }

    // Update camera position
    updateCameraPosition();

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
});

document.addEventListener('mouseup', () => {
    isMouseLooking = false;
});

// Function to update camera position
function updateCameraPosition() {
    const moveSpeed = keys.shift ? baseSpeed * sprintMultiplier : baseSpeed;
    const firstPersonMoveSpeed = keys.shift ? firstPersonSpeed * firstPersonSprintMultiplier : firstPersonSpeed;

    // Calculate forward and right directions based on camera angle
    const forward = new THREE.Vector3(
        Math.sin(cameraAngleHorizontal),
        0,
        Math.cos(cameraAngleHorizontal)
    );
    const right = new THREE.Vector3(
        Math.sin(cameraAngleHorizontal + Math.PI/2),
        0,
        Math.cos(cameraAngleHorizontal + Math.PI/2)
    );

    // Calculate new target position
    const newTarget = cameraTarget.clone();
    if (isFirstPerson) {
        // First person movement with slower speed
        if (keys.w) newTarget.add(forward.multiplyScalar(firstPersonMoveSpeed));
        if (keys.s) newTarget.sub(forward.multiplyScalar(firstPersonMoveSpeed));
        if (keys.a) newTarget.add(right.multiplyScalar(firstPersonMoveSpeed));
        if (keys.d) newTarget.sub(right.multiplyScalar(firstPersonMoveSpeed));
    } else {
        // Top down movement with normal speed
        if (keys.w) newTarget.sub(forward.multiplyScalar(moveSpeed));
        if (keys.s) newTarget.add(forward.multiplyScalar(moveSpeed));
        if (keys.a) newTarget.add(right.multiplyScalar(moveSpeed));
        if (keys.d) newTarget.sub(right.multiplyScalar(moveSpeed));

        // Update target height based on arrow keys
        if (keys.arrowup) newTarget.y += moveSpeed;
        if (keys.arrowdown) newTarget.y -= moveSpeed;
    }

    // Check if new position is within map boundaries
    const mapSize = gridSize * tileSize / 2;
    const boundaryOffset = 1; // Small offset to prevent walking right to the edge
    
    // Clamp the position to map boundaries
    newTarget.x = Math.max(-mapSize + boundaryOffset, Math.min(mapSize - boundaryOffset, newTarget.x));
    newTarget.z = Math.max(-mapSize + boundaryOffset, Math.min(mapSize - boundaryOffset, newTarget.z));
    
    // Only update camera target if within boundaries
    cameraTarget.copy(newTarget);

    if (isFirstPerson) {
        // Set camera position slightly above the target (player height)
        camera.position.set(
            cameraTarget.x,
            cameraTarget.y + playerHeight,
            cameraTarget.z
        );

        // Calculate look direction based on mouse movement
        const lookDirection = new THREE.Vector3(
            Math.sin(cameraAngleHorizontal) * Math.cos(cameraAngleVertical),
            Math.sin(cameraAngleVertical),
            Math.cos(cameraAngleHorizontal) * Math.cos(cameraAngleVertical)
        );
        camera.lookAt(
            camera.position.x + lookDirection.x,
            camera.position.y + lookDirection.y,
            camera.position.z + lookDirection.z
        );
    } else {
        // Calculate camera position in orbit around target
        const x = cameraTarget.x + cameraDistance * Math.sin(cameraAngleVertical) * Math.sin(cameraAngleHorizontal);
        const y = cameraTarget.y + cameraDistance * Math.cos(cameraAngleVertical);
        const z = cameraTarget.z + cameraDistance * Math.sin(cameraAngleVertical) * Math.cos(cameraAngleHorizontal);

        camera.position.set(x, y, z);
        camera.lookAt(cameraTarget);
    }
}

// Initial camera setup
updateCameraPosition();

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

// Add keyboard controls
document.addEventListener('keydown', (event) => {
    switch(event.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
        case 'shift': keys.shift = true; break;
        case 'arrowup': keys.arrowup = true; break;
        case 'arrowdown': keys.arrowdown = true; break;
    }
});

document.addEventListener('keyup', (event) => {
    switch(event.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
        case 'shift': keys.shift = false; break;
        case 'arrowup': keys.arrowup = false; break;
        case 'arrowdown': keys.arrowdown = false; break;
    }
});

// Lightning effect
function createLightning() {
    const lightning = new THREE.PointLight(0xffffff, 0, 100);
    const x = (Math.random() - 0.5) * 50;
    const z = (Math.random() - 0.5) * 50;
    lightning.position.set(x, 20, z);
    scene.add(lightning);

    // Flash effect
    lightning.intensity = 2;
    setTimeout(() => lightning.intensity = 0, 100);
    setTimeout(() => lightning.intensity = 1.5, 150);
    setTimeout(() => lightning.intensity = 0, 200);
    setTimeout(() => scene.remove(lightning), 250);

    // Check for tree strikes
    const raycaster = new THREE.Raycaster(
        lightning.position,
        new THREE.Vector3(0, -1, 0)
    );
    const intersects = raycaster.intersectObjects(scene.children);
    
    intersects.forEach(intersect => {
        const object = intersect.object;
        if (object.parent && object.parent.isTree) {
            setTreeOnFire(object.parent);
        }
    });
}

// Fire effect for trees
function setTreeOnFire(tree) {
    if (burningTrees.has(tree)) return;
    
    burningTrees.add(tree);
    
    // Create fire light
    const fireLight = new THREE.PointLight(0xff4500, 1, 3);
    fireLight.position.y = 1;
    tree.add(fireLight);
    
    // Change tree color to burnt
    tree.traverse(child => {
        if (child.isMesh) {
            child.material.color.setHex(0x333333);
            child.material.emissive.setHex(0xff4500);
            child.material.emissiveIntensity = 0.5;
        }
    });
}

// Weather control functions
function setWeather(weatherType) {
    currentWeather = weatherType;
    
    // Update UI
    document.querySelectorAll('.weather-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(weatherType + 'Btn').classList.add('active');
    
    // Reset weather effects
    rain.visible = false;
    clouds.material.opacity = 0;
    scene.background = new THREE.Color(0x87CEEB);
    ambientLight.intensity = 0.6;
    directionalLight.intensity = 0.8;
    
    // Apply weather-specific effects
    switch(weatherType) {
        case WEATHER_TYPES.SUNNY:
            break;
            
        case WEATHER_TYPES.NIGHT:
            scene.background = new THREE.Color(0x000033);
            ambientLight.intensity = 0.2;
            directionalLight.intensity = 0.1;
            break;
            
        case WEATHER_TYPES.RAIN:
            rain.visible = true;
            clouds.material.opacity = 0.5;
            scene.background = new THREE.Color(0x4a4a4a);
            ambientLight.intensity = 0.4;
            directionalLight.intensity = 0.4;
            break;
            
        case WEATHER_TYPES.STORM:
            rain.visible = true;
            clouds.material.opacity = 0.8;
            scene.background = new THREE.Color(0x333333);
            ambientLight.intensity = 0.2;
            directionalLight.intensity = 0.2;
            break;
    }
}

// Add weather button listeners
document.getElementById('sunnyBtn').addEventListener('click', () => setWeather(WEATHER_TYPES.SUNNY));
document.getElementById('nightBtn').addEventListener('click', () => setWeather(WEATHER_TYPES.NIGHT));
document.getElementById('rainBtn').addEventListener('click', () => setWeather(WEATHER_TYPES.RAIN));
document.getElementById('stormBtn').addEventListener('click', () => setWeather(WEATHER_TYPES.STORM));

// Modify tree creation to add identifier
const originalCreateTree = createTree;
createTree = function(x, y, z) {
    const tree = originalCreateTree(x, y, z);
    tree.isTree = true;
    return tree;
};

// Modified animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update rain if visible
    if (rain.visible) {
        updateRain();
    }
    
    // Update lightning in storm
    if (currentWeather === WEATHER_TYPES.STORM) {
        lightningTimer++;
        if (lightningTimer > Math.random() * 200 + 100) {
            createLightning();
            lightningTimer = 0;
        }
    }
    
    // Update burning trees
    burningTrees.forEach(tree => {
        if (tree.children.length > 0) {
            const fireLight = tree.children[tree.children.length - 1];
            if (fireLight.isLight) {
                fireLight.intensity = 0.5 + Math.random() * 0.5;
            }
        }
    });
    
    updateCameraPosition();
    renderer.render(scene, camera);
}

// Start with sunny weather
setWeather(WEATHER_TYPES.SUNNY);

// Info modal controls
const infoBtn = document.getElementById('infoBtn');
const infoModal = document.getElementById('infoModal');
const closeInfo = document.getElementById('closeInfo');

// Function to update info modal content based on current perspective
function updateInfoModal() {
    const modalContent = `
        <h2>${isFirstPerson ? 'First Person View Controls' : 'Top Down View Controls'}</h2>
        <ul>
            <li><span class="key">W</span> Move forward</li>
            <li><span class="key">S</span> Move backward</li>
            <li><span class="key">A</span> ${isFirstPerson ? 'Strafe left' : 'Move left'}</li>
            <li><span class="key">D</span> ${isFirstPerson ? 'Strafe right' : 'Move right'}</li>
            ${!isFirstPerson ? `
            <li><span class="key">↑</span> Move camera up</li>
            <li><span class="key">↓</span> Move camera down</li>
            ` : ''}
            <li><span class="key">Shift</span> Hold to sprint${isFirstPerson ? ' (1.5x speed)' : ''}</li>
            <li><span class="key">Mouse</span> ${isFirstPerson ? 'Look around' : 'Hold and drag to look around'}</li>
            ${!isFirstPerson ? '<li><span class="key">Scroll</span> Zoom in/out</li>' : ''}
        </ul>
        <h3>Weather Controls</h3>
        <ul>
            <li><span class="key">Sunny</span> Clear weather</li>
            <li><span class="key">Night</span> Dark mode</li>
            <li><span class="key">Rain</span> Rainy weather</li>
            <li><span class="key">Thunderstorm</span> Storm with lightning</li>
        </ul>
    `;

    const modalContentDiv = document.querySelector('#infoModal .modal-content');
    if (modalContentDiv) {
        modalContentDiv.innerHTML = modalContent;
    }
}

// Toggle info modal
infoBtn.addEventListener('click', () => {
    updateInfoModal();
    infoModal.style.display = infoModal.style.display === 'block' ? 'none' : 'block';
});

closeInfo.addEventListener('click', () => {
    infoModal.style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === infoModal) {
        infoModal.style.display = 'none';
    }
});

// Update info modal when perspective changes
document.getElementById('topDownBtn').addEventListener('click', () => {
    isFirstPerson = false;
    document.getElementById('topDownBtn').classList.add('active');
    document.getElementById('firstPersonBtn').classList.remove('active');
    // Reset camera to a good top-down position
    cameraAngleVertical = Math.PI / 4;
    cameraDistance = 30;
    updateCameraPosition();
    // Update info modal if it's open
    if (infoModal.style.display === 'block') {
        updateInfoModal();
    }
});

document.getElementById('firstPersonBtn').addEventListener('click', () => {
    isFirstPerson = true;
    document.getElementById('firstPersonBtn').classList.add('active');
    document.getElementById('topDownBtn').classList.remove('active');
    // Reset camera to first person position
    cameraAngleVertical = 0;
    updateCameraPosition();
    // Update info modal if it's open
    if (infoModal.style.display === 'block') {
        updateInfoModal();
    }
});

// Modify mouse wheel handler to only work in top-down view
document.addEventListener('wheel', (event) => {
    if (isFirstPerson) return;
    
    // Prevent default scrolling
    event.preventDefault();
    
    // Update camera distance based on scroll direction
    const zoomAmount = event.deltaY * 0.01 * zoomSpeed;
    cameraDistance = Math.max(minZoom, Math.min(maxZoom, cameraDistance + zoomAmount));
    
    // Update camera position immediately
    updateCameraPosition();
}, { passive: false });

// Start animation
animate(); 