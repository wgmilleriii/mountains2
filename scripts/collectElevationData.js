import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateTestElevationData } from '../public/js/utils/elevationData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update file paths to be relative to script location
const CACHE_FILE = path.join(__dirname, '..', 'elevation_cache.json');
const PROGRESS_FILE = path.join(__dirname, '..', 'elevation_progress.json');

// New Mexico bounds
const NM_BOUNDS = {
    minLat: 31.33,
    maxLat: 37.00,
    minLon: -109.05,
    maxLon: -103.00
};

// Grid configuration
const GRID_SIZE = 10; // 10x10 grid
const RESOLUTION_STEPS = [5, 10, 20, 40]; // Increasing resolutions
const CONCURRENT_REQUESTS = 5; // Number of concurrent API requests
const BATCH_SIZE = 10; // Number of points to process in each batch

// Load or initialize cache
function loadCache() {
    try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

// Load or initialize progress
function loadProgress() {
    try {
        const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        if (progress.completedChunks && Array.isArray(progress.completedChunks)) {
            progress.completedChunks = new Set(progress.completedChunks);
        } else {
            progress.completedChunks = new Set();
        }
        return progress;
    } catch (e) {
        return {
            currentResolution: 0,
            currentChunk: 0,
            totalChunks: GRID_SIZE * GRID_SIZE,
            completedChunks: new Set()
        };
    }
}

// Save progress with debouncing
let saveProgressTimeout;
function saveProgress(progress) {
    clearTimeout(saveProgressTimeout);
    saveProgressTimeout = setTimeout(() => {
        const progressToSave = { ...progress, completedChunks: Array.from(progress.completedChunks) };
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressToSave, null, 2));
    }, 1000); // Debounce for 1 second
}

// Save cache with debouncing
let saveCacheTimeout;
function saveCache(cache) {
    clearTimeout(saveCacheTimeout);
    saveCacheTimeout = setTimeout(() => {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    }, 1000); // Debounce for 1 second
}

// Generate points for a chunk
function generateChunkPoints(chunkX, chunkY, resolution) {
    const points = [];
    const chunkWidth = (NM_BOUNDS.maxLon - NM_BOUNDS.minLon) / GRID_SIZE;
    const chunkHeight = (NM_BOUNDS.maxLat - NM_BOUNDS.minLat) / GRID_SIZE;
    
    const minLon = NM_BOUNDS.minLon + chunkX * chunkWidth;
    const maxLon = minLon + chunkWidth;
    const minLat = NM_BOUNDS.minLat + chunkY * chunkHeight;
    const maxLat = minLat + chunkHeight;

    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            const lat = minLat + (i / (resolution - 1)) * (maxLat - minLat);
            const lon = minLon + (j / (resolution - 1)) * (maxLon - minLon);
            points.push({ lat, lon });
        }
    }
    return points;
}

// Fetch elevation with improved rate limiting and retries
async function fetchElevation(point, retries = 3) {
    const url = `https://epqs.nationalmap.gov/v1/json?x=${point.lon}&y=${point.lat}&units=Meters`;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            await new Promise(resolve => setTimeout(resolve, 50)); // Reduced rate limiting
            const result = await new Promise((resolve, reject) => {
                const req = https.get(url, (res) => {
                    let data = '';
                    res.on('data', (chunk) => (data += chunk));
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve({ ...point, elevation: Number(json.value) });
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                req.setTimeout(5000); // 5 second timeout
                req.on('error', reject);
            });
            return result;
        } catch (e) {
            if (attempt === retries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // Reduced backoff
        }
    }
}

// Process points in batches
async function processBatch(points, cache) {
    const results = [];
    const uncachedPoints = [];
    const uncachedKeys = [];

    // First, check cache for all points
    for (const point of points) {
        const key = `${point.lat},${point.lon}`;
        if (cache[key]) {
            results.push({ ...point, elevation: cache[key] });
            console.log(`Cached: ${key} = ${cache[key]}`);
        } else {
            uncachedPoints.push(point);
            uncachedKeys.push(key);
        }
    }

    // Process uncached points in parallel
    if (uncachedPoints.length > 0) {
        const chunks = [];
        for (let i = 0; i < uncachedPoints.length; i += CONCURRENT_REQUESTS) {
            chunks.push(uncachedPoints.slice(i, i + CONCURRENT_REQUESTS));
        }

        for (const chunk of chunks) {
            const chunkResults = await Promise.all(
                chunk.map(point => fetchElevation(point))
            );
            
            chunkResults.forEach((result, index) => {
                const key = uncachedKeys[chunks.indexOf(chunk) * CONCURRENT_REQUESTS + index];
                cache[key] = result.elevation;
                results.push(result);
                console.log(`Fetched: ${key} = ${result.elevation}`);
            });
        }
    }

    return results;
}

// Process a single chunk
async function processChunk(chunkX, chunkY, resolution, cache) {
    console.log(`Processing chunk (${chunkX}, ${chunkY}) with resolution ${resolution}x${resolution}`);
    
    const points = generateChunkPoints(chunkX, chunkY, resolution);
    const results = [];
    
    // Process points in batches
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
        const batch = points.slice(i, i + BATCH_SIZE);
        const batchResults = await processBatch(batch, cache);
        results.push(...batchResults);
        saveCache(cache); // Save cache after each batch
    }
    
    return results;
}

// Main function
async function main() {
    const cache = loadCache();
    let progress = loadProgress();
    
    console.log('Starting elevation data collection for New Mexico');
    console.log(`Current resolution: ${RESOLUTION_STEPS[progress.currentResolution]}x${RESOLUTION_STEPS[progress.currentResolution]}`);
    console.log(`Progress: ${progress.completedChunks.size}/${GRID_SIZE * GRID_SIZE} chunks completed`);
    
    while (progress.currentResolution < RESOLUTION_STEPS.length) {
        const resolution = RESOLUTION_STEPS[progress.currentResolution];
        
        // Process chunks in parallel
        const chunks = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const chunkId = `${x},${y}`;
                if (!progress.completedChunks.has(chunkId)) {
                    chunks.push({ x, y });
                }
            }
        }

        // Process chunks in parallel with concurrency limit
        for (let i = 0; i < chunks.length; i += CONCURRENT_REQUESTS) {
            const chunkGroup = chunks.slice(i, i + CONCURRENT_REQUESTS);
            await Promise.all(
                chunkGroup.map(async ({ x, y }) => {
                    try {
                        await processChunk(x, y, resolution, cache);
                        progress.completedChunks.add(`${x},${y}`);
                        saveProgress(progress);
                    } catch (e) {
                        console.error(`Error processing chunk (${x}, ${y}):`, e);
                    }
                })
            );
        }
        
        // Move to next resolution
        progress.currentResolution++;
        progress.completedChunks.clear();
        saveProgress(progress);
        console.log(`Completed resolution ${resolution}x${resolution}`);
    }
    
    console.log('Elevation data collection completed!');
}

// Run the script
main().catch(console.error); 
