import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SOURCE_FILE = 'elevation_cache.json';
const DEST_FILE = 'elevation_cache_reduced.json';
const RESOLUTION_FACTOR = 4; // Keep every Nth point

// Read the source data
console.log(`Reading ${SOURCE_FILE}...`);
const data = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));

// Convert to array of points for easier processing
const points = Object.entries(data).map(([key, elevation]) => {
    const [lat, lon] = key.split(',').map(Number);
    return { lat, lon, elevation };
});

// Sort points by latitude and longitude
points.sort((a, b) => {
    if (a.lat !== b.lat) return a.lat - b.lat;
    return a.lon - b.lon;
});

// Get unique latitudes and longitudes
const uniqueLats = [...new Set(points.map(p => p.lat))].sort((a, b) => a - b);
const uniqueLons = [...new Set(points.map(p => p.lon))].sort((a, b) => a - b);

// Sample points at regular intervals
const sampledLats = uniqueLats.filter((_, i) => i % RESOLUTION_FACTOR === 0);
const sampledLons = uniqueLons.filter((_, i) => i % RESOLUTION_FACTOR === 0);

// Create reduced dataset
const reducedData = {};
let keptPoints = 0;
let totalPoints = points.length;

points.forEach(point => {
    if (sampledLats.includes(point.lat) && sampledLons.includes(point.lon)) {
        const key = `${point.lat},${point.lon}`;
        reducedData[key] = point.elevation;
        keptPoints++;
    }
});

// Write the reduced data
console.log(`Original points: ${totalPoints}`);
console.log(`Kept points: ${keptPoints}`);
console.log(`Reduction ratio: ${(totalPoints / keptPoints).toFixed(2)}x`);

fs.writeFileSync(DEST_FILE, JSON.stringify(reducedData, null, 2));
console.log(`Reduced data written to ${DEST_FILE}`);

// Copy to public directory
const publicDestFile = path.join('public', DEST_FILE);
fs.copyFileSync(DEST_FILE, publicDestFile);
console.log(`Copied to ${publicDestFile}`); 