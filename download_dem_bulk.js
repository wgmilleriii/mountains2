import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// New Mexico bounds (roughly divided into 4 quadrants for manageable downloads)
const NM_QUADRANTS = [
    {
        name: 'northwest',
        bounds: '&bbox=-109.05,35.0,-106.0,37.0'
    },
    {
        name: 'northeast',
        bounds: '&bbox=-106.0,35.0,-103.0,37.0'
    },
    {
        name: 'southwest',
        bounds: '&bbox=-109.05,31.33,-106.0,35.0'
    },
    {
        name: 'southeast',
        bounds: '&bbox=-106.0,31.33,-103.0,35.0'
    }
];

// Create downloads directory if it doesn't exist
const DOWNLOAD_DIR = path.join(__dirname, 'dem_files');
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        let fileSize = 0;
        
        const request = https.get(url, (response) => {
            if (response.statusCode !== 200) {
                fs.unlink(destPath, () => {});
                reject(new Error(`Failed to download: HTTP ${response.statusCode} - ${response.statusMessage}`));
                return;
            }
            
            response.on('data', (chunk) => {
                fileSize += chunk.length;
                process.stdout.write(`\\rDownloading... ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
                process.stdout.write('\\n');
                file.close();
                
                // Verify file size
                const stats = fs.statSync(destPath);
                if (stats.size === 0) {
                    fs.unlink(destPath, () => {});
                    reject(new Error('Downloaded file is empty'));
                    return;
                }
                
                resolve();
            });
        });
        
        request.setTimeout(30000); // 30 second timeout
        
        request.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
        
        file.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

async function downloadQuadrant(quadrant, retries = 3) {
    // Using TNM API instead of ArcGIS
    const baseUrl = 'https://tnmaccess.nationalmap.gov/api/v1/products';
    const params = new URLSearchParams({
        'datasets': 'National Elevation Dataset (NED) 1/3 arc-second',
        'bbox': quadrant.bounds.replace('&bbox=', ''),
        'outputFormat': 'JSON'
    }).toString();
    
    const url = `${baseUrl}?${params}`;
    const outputPath = path.join(DOWNLOAD_DIR, `nm_dem_${quadrant.name}.tiff`);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`\\nFetching download URL for ${quadrant.name} quadrant (attempt ${attempt}/${retries})...`);
            
            // First get the download URL
            const downloadInfo = await new Promise((resolve, reject) => {
                https.get(url, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            const result = JSON.parse(data);
                            if (result.items && result.items.length > 0) {
                                const downloadUrl = result.items[0].downloadURL;
                                resolve(downloadUrl);
                            } else {
                                reject(new Error('No download URL found in response'));
                            }
                        } catch (e) {
                            reject(e);
                        }
                    });
                }).on('error', reject);
            });
            
            // Then download the actual file
            console.log(`Downloading data for ${quadrant.name}...`);
            await downloadFile(downloadInfo, outputPath);
            console.log(`Successfully downloaded ${quadrant.name} quadrant to ${outputPath}`);
            return;
        } catch (error) {
            console.error(`Error downloading ${quadrant.name} (attempt ${attempt}/${retries}):`, error.message);
            if (attempt === retries) {
                throw error;
            }
            console.log('Retrying in 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

async function downloadAllQuadrants() {
    console.log('Starting bulk DEM download for New Mexico...');
    let successful = 0;
    let failed = 0;
    
    for (const quadrant of NM_QUADRANTS) {
        try {
            await downloadQuadrant(quadrant);
            successful++;
        } catch (error) {
            console.error(`Failed to download ${quadrant.name} after all retries:`, error.message);
            failed++;
        }
    }
    
    console.log(`\\nDownload complete!`);
    console.log(`Successfully downloaded: ${successful} quadrants`);
    console.log(`Failed to download: ${failed} quadrants`);
    
    if (successful === 0) {
        throw new Error('No quadrants were successfully downloaded. Please check your internet connection and try again.');
    }
}

// Run the download
console.log('Starting elevation data collection...');
downloadAllQuadrants().catch(console.error); 