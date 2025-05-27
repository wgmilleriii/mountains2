import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load existing elevation cache
const existingCache = JSON.parse(fs.readFileSync('elevation_cache.json', 'utf8'));

// Get list of downloaded DEM files
const demDir = path.join(__dirname, 'dem_files');
const demFiles = fs.readdirSync(demDir).filter(f => f.endsWith('.tif'));

console.log('Found DEM files:', demFiles.length);
console.log('Existing cache points:', Object.keys(existingCache).length);

// Sample a few points from existing cache to verify
const samplePoints = Object.entries(existingCache)
    .slice(0, 5)  // Take first 5 points
    .map(([key, elev]) => {
        const [lat, lon] = key.split(',').map(Number);
        return { lat, lon, elev };
    });

console.log('\nSample points from existing cache:');
samplePoints.forEach(p => {
    console.log(`Lat: ${p.lat}, Lon: ${p.lon}, Elev: ${p.elev}`);
});

// TODO: Add code to read DEM files and compare elevations
// This will require installing and using GDAL or similar library
// For now, we can verify the files exist and are non-empty

demFiles.forEach(file => {
    const stats = fs.statSync(path.join(demDir, file));
    console.log(`\n${file}:`);
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Last modified: ${stats.mtime}`);
}); 