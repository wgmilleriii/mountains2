import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source and destination paths
const SOURCE_CACHE = path.join(__dirname, 'elevation_cache.json');
const SOURCE_PROGRESS = path.join(__dirname, 'elevation_progress.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEST_CACHE = path.join(PUBLIC_DIR, 'elevation_cache.json');
const DEST_PROGRESS = path.join(PUBLIC_DIR, 'elevation_progress.json');

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Function to copy file with error handling
function copyFile(source, destination) {
    try {
        if (fs.existsSync(source)) {
            fs.copyFileSync(source, destination);
            console.log(`Copied ${path.basename(source)} to public directory`);
        } else {
            console.log(`Warning: ${path.basename(source)} not found`);
        }
    } catch (error) {
        console.error(`Error copying ${path.basename(source)}:`, error.message);
    }
}

// Copy both files
copyFile(SOURCE_CACHE, DEST_CACHE);
copyFile(SOURCE_PROGRESS, DEST_PROGRESS);

// Watch for changes and copy automatically
console.log('Watching for changes in elevation data...');
fs.watch(__dirname, (eventType, filename) => {
    if (filename === 'elevation_cache.json') {
        copyFile(SOURCE_CACHE, DEST_CACHE);
    } else if (filename === 'elevation_progress.json') {
        copyFile(SOURCE_PROGRESS, DEST_PROGRESS);
    }
}); 