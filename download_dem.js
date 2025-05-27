import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// New Mexico bounds
const NM_BOUNDS = {
    minLat: 31.33,
    maxLat: 37.00,
    minLon: -109.05,
    maxLon: -103.00
};

// Configuration
const CONCURRENT_REQUESTS = 5;  // Number of parallel requests
const BATCH_SIZE = 10;          // Number of points to process in each batch
const RATE_LIMIT_DELAY = 50;    // Delay between requests in ms
const CACHE_FILE = 'elevation_cache_dem.json';
const PROGRESS_FILE = 'elevation_progress_dem.json';

// Create downloads directory if it doesn't exist
const DOWNLOAD_DIR = path.join(__dirname, 'dem_files');
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

// Load existing cache if it exists
let cache = {};
try {
    if (fs.existsSync(CACHE_FILE)) {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        console.log(`Loaded ${Object.keys(cache).length} existing points from cache`);
    }
} catch (e) {
    console.log('No existing cache found, starting fresh');
}

// Load progress if it exists
let progress = {
    completedPoints: new Set(),
    lastSaved: Date.now()
};

try {
    if (fs.existsSync(PROGRESS_FILE)) {
        const savedProgress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        progress.completedPoints = new Set(savedProgress.completedPoints);
        console.log(`Loaded progress: ${progress.completedPoints.size} points completed`);
    }
} catch (e) {
    console.log('No existing progress found, starting fresh');
}

// Function to save progress with debouncing
let saveTimeout;
function saveProgress() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        const progressToSave = {
            completedPoints: Array.from(progress.completedPoints),
            lastSaved: Date.now()
        };
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressToSave, null, 2));
    }, 1000);
}

// Function to download elevation data for a point with retries
async function getElevation(lat, lon, retries = 3) {
    const url = `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Meters`;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return new Promise((resolve, reject) => {
                const req = https.get(url, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve(Number(json.value));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                
                req.setTimeout(5000); // 5 second timeout
                req.on('error', reject);
            });
        } catch (err) {
            if (attempt === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
}

// Function to generate points for New Mexico
function generatePoints(resolution = 0.01) { // 0.01 degrees ≈ 1km
    const points = [];
    for (let lat = NM_BOUNDS.minLat; lat <= NM_BOUNDS.maxLat; lat += resolution) {
        for (let lon = NM_BOUNDS.minLon; lon <= NM_BOUNDS.maxLon; lon += resolution) {
            const key = `${lat},${lon}`;
            if (!cache[key] && !progress.completedPoints.has(key)) {
                points.push({ lat, lon });
            }
        }
    }
    return points;
}

// Function to process a batch of points
async function processBatch(points) {
    const results = await Promise.all(
        points.map(async (point) => {
            const key = `${point.lat},${point.lon}`;
            try {
                const elevation = await getElevation(point.lat, point.lon);
                cache[key] = elevation;
                progress.completedPoints.add(key);
                return { success: true, key };
            } catch (err) {
                console.error(`Error getting elevation for ${key}:`, err.message);
                return { success: false, key };
            }
        })
    );
    
    // Save cache and progress after each batch
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    saveProgress();
    
    return results;
}

// Main function to download elevation data
async function downloadElevationData() {
    const points = generatePoints();
    console.log(`Found ${points.length} new points to process for New Mexico`);
    
    let processed = 0;
    let errors = 0;
    
    // Process points in batches
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
        const batch = points.slice(i, i + BATCH_SIZE);
        const results = await processBatch(batch);
        
        processed += results.filter(r => r.success).length;
        errors += results.filter(r => !r.success).length;
        
        console.log(`Processed ${processed}/${points.length} points (${errors} errors)`);
        
        // Add a small delay between batches to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
    
    // Save final cache and progress
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    saveProgress();
    
    console.log(`Download complete! Processed ${processed} points with ${errors} errors`);
}

// Run the download
console.log('Starting elevation data collection...');
downloadElevationData().catch(console.error); 