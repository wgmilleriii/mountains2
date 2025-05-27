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
const DOWNLOAD_DIR = path.join(__dirname, 'dem_files');
const BASE_URL = 'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/ArcGrid/';
const DATES = [
    '20240416', '20240308', '20231208', '20220811', '20220721', 
    '20211229', '20211207', '20210811', '20210702', '20210630',
    '20210624', '20210616', '20210607', '20210301', '20201228'
];

// Create downloads directory if it doesn't exist
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

// Function to check if a file exists on the server
async function checkFileExists(url) {
    return new Promise((resolve) => {
        https.get(url, (response) => {
            resolve(response.statusCode === 200);
        }).on('error', () => {
            resolve(false);
        });
    });
}

// Function to download a DEM file
async function downloadDEM(lat, lon) {
    const latStr = Math.abs(Math.floor(lat)).toString().padStart(2, '0');
    const lonStr = Math.abs(Math.floor(lon)).toString().padStart(3, '0');
    const latPrefix = lat >= 0 ? 'n' : 's';
    const lonPrefix = lon >= 0 ? 'e' : 'w';
    
    // Try each date until we find a valid file
    for (const date of DATES) {
        const filename = `USGS_13_${latPrefix}${latStr}${lonPrefix}${lonStr}_${date}.tif`;
        const url = `${BASE_URL}${filename}`;
        const outputPath = path.join(DOWNLOAD_DIR, filename);

        // Skip if file already exists
        if (fs.existsSync(outputPath)) {
            console.log(`File already exists: ${filename}`);
            return true;
        }

        // Check if file exists on server
        const exists = await checkFileExists(url);
        if (!exists) {
            console.log(`File not found: ${filename}`);
            continue;
        }

        // Download the file
        return new Promise((resolve, reject) => {
            console.log(`Downloading ${filename}...`);
            const file = fs.createWriteStream(outputPath);
            
            https.get(url, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`Downloaded ${filename}`);
                        resolve(true);
                    });
                } else {
                    console.error(`Failed to download ${filename}: ${response.statusCode}`);
                    fs.unlink(outputPath, () => {});
                    reject(new Error(`HTTP ${response.statusCode}`));
                }
            }).on('error', (err) => {
                fs.unlink(outputPath, () => {});
                reject(err);
            });
        });
    }
    
    console.error(`No valid file found for coordinates ${lat},${lon}`);
    return false;
}

// Function to generate missing tile coordinates
function generateMissingTiles() {
    const tiles = [];
    for (let lat = 31; lat <= 37; lat++) {
        for (let lon = -109; lon <= -103; lon++) {
            const filename = `USGS_13_n${lat}w${Math.abs(lon)}_*.tif`;
            const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(`USGS_13_n${lat}w${Math.abs(lon)}_`));
            
            if (files.length === 0) {
                tiles.push({ lat, lon });
            }
        }
    }
    return tiles;
}

// Main function to download missing tiles
async function downloadMissingTiles() {
    const missingTiles = generateMissingTiles();
    console.log(`Found ${missingTiles.length} missing tiles to download`);

    let successCount = 0;
    let failureCount = 0;

    for (const tile of missingTiles) {
        try {
            const success = await downloadDEM(tile.lat, tile.lon);
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }
            // Add a small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
            console.error(`Error downloading tile at ${tile.lat},${tile.lon}:`, err.message);
            failureCount++;
        }
    }

    console.log(`\nDownload Summary:`);
    console.log(`Successfully downloaded: ${successCount} tiles`);
    console.log(`Failed to download: ${failureCount} tiles`);
}

// Run the download
console.log('Starting download of missing DEM tiles...');
downloadMissingTiles().catch(console.error); 