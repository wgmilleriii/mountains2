import { getElevation } from './dem_reader.js';

// Test points (known locations in New Mexico)
const TEST_POINTS = [
    {
        name: 'Albuquerque',
        lat: 35.0844,
        lon: -106.6504,
        expectedQuadrant: 'northwest'
    },
    {
        name: 'Santa Fe',
        lat: 35.6870,
        lon: -105.9378,
        expectedQuadrant: 'northeast'
    }
];

// Test grid points across New Mexico
function generateTestGrid(numPoints = 20) {
    const points = [];
    const latStep = (37.00 - 31.33) / (numPoints - 1);
    const lonStep = (-103.00 - -109.05) / (numPoints - 1);
    
    for (let lat = 31.33; lat <= 37.00; lat += latStep) {
        for (let lon = -109.05; lon <= -103.00; lon += lonStep) {
            points.push({ lat, lon });
        }
    }
    
    return points;
}

async function runTests() {
    console.log('Starting DEM reader performance tests...\n');
    
    // Test 1: Single point lookup speed
    console.log('Test 1: Single point lookup speed');
    const point = TEST_POINTS[0];
    console.time('Single lookup');
    const elevation = await getElevation(point.lat, point.lon);
    console.timeEnd('Single lookup');
    console.log(`${point.name} elevation: ${elevation !== null ? elevation.toFixed(1) + 'm' : 'Not found'}\n`);
    
    // Test 2: Multiple lookups in same chunk
    console.log('Test 2: Multiple lookups in same chunk (should be faster)');
    const lat = point.lat;
    const lon = point.lon;
    console.time('5 nearby points');
    const results = await Promise.all([
        getElevation(lat, lon),
        getElevation(lat + 0.001, lon),
        getElevation(lat, lon + 0.001),
        getElevation(lat - 0.001, lon),
        getElevation(lat, lon - 0.001)
    ]);
    console.timeEnd('5 nearby points');
    console.log(`Found ${results.filter(e => e !== null).length} valid elevations\n`);
    
    // Test 3: Points in different chunks
    console.log('Test 3: Points in different chunks');
    console.time('Different chunks');
    for (const point of TEST_POINTS) {
        const elev = await getElevation(point.lat, point.lon);
        console.log(`${point.name}: ${elev !== null ? elev.toFixed(1) + 'm' : 'Not found'}`);
    }
    console.timeEnd('Different chunks');
}

// Run the tests
console.log('DEM Reader Performance Test Suite');
console.log('==============================\n');
runTests().catch(console.error); 