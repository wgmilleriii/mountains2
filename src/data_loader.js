export async function loadElevationData() {
    try {
        const response = await fetch('/data/elevation_cache.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const elevationData = await response.json();
        
        // Convert lat/long data to grid format
        const gridSize = 32;
        const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
        
        // Get min/max lat/long for normalization
        const coords = Object.keys(elevationData).map(key => key.split(',').map(Number));
        const minLat = Math.min(...coords.map(([lat]) => lat));
        const maxLat = Math.max(...coords.map(([lat]) => lat));
        const minLng = Math.min(...coords.map(([, lng]) => lng));
        const maxLng = Math.max(...coords.map(([, lng]) => lng));
        
        // Convert each lat/long point to grid coordinates
        Object.entries(elevationData).forEach(([key, value]) => {
            const [lat, lng] = key.split(',').map(Number);
            
            // Normalize coordinates to 0-1 range
            const normalizedLat = (lat - minLat) / (maxLat - minLat);
            const normalizedLng = (lng - minLng) / (maxLng - minLng);
            
            // Convert to grid coordinates
            const x = Math.floor(normalizedLng * (gridSize - 1));
            const y = Math.floor(normalizedLat * (gridSize - 1));
            
            if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
                grid[x][y] = value;
            }
        });
        
        return grid;
    } catch (error) {
        console.error('Error loading elevation data:', error);
        throw error;
    }
} 