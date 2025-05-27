import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import gdal from 'gdal-async';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const INPUT_DIR = path.join(__dirname, 'dem_files');
const OUTPUT_DIR = path.join(__dirname, 'visualization');
const COLOR_RAMP = [
    { elevation: 0, color: [0, 102, 0] },     // Dark green for low elevations
    { elevation: 500, color: [51, 204, 51] }, // Light green for hills
    { elevation: 1000, color: [255, 255, 0] }, // Yellow for medium elevations
    { elevation: 2000, color: [204, 102, 0] }, // Brown for mountains
    { elevation: 3000, color: [153, 76, 0] },  // Dark brown for high mountains
    { elevation: 4000, color: [255, 255, 255] } // White for peaks
];

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// Function to interpolate colors
function interpolateColor(elevation, colorRamp) {
    for (let i = 0; i < colorRamp.length - 1; i++) {
        if (elevation <= colorRamp[i + 1].elevation) {
            const ratio = (elevation - colorRamp[i].elevation) / 
                         (colorRamp[i + 1].elevation - colorRamp[i].elevation);
            return colorRamp[i].color.map((c, j) => 
                Math.round(c + ratio * (colorRamp[i + 1].color[j] - c)));
        }
    }
    return colorRamp[colorRamp.length - 1].color;
}

async function processQuadrant(filename) {
    console.log(`Processing ${filename}...`);
    
    const dataset = await gdal.openAsync(path.join(INPUT_DIR, filename));
    const band = await dataset.bands.getAsync(1);
    const [width, height] = [dataset.rasterSize.x, dataset.rasterSize.y];
    
    // Read elevation data
    const elevationData = await band.pixels.readAsync(0, 0, width, height);
    
    // Create PNG
    const png = new PNG({ width, height });
    
    // Find min/max elevation for normalization
    let minElevation = Infinity;
    let maxElevation = -Infinity;
    for (let i = 0; i < elevationData.length; i++) {
        if (elevationData[i] > -9999) { // Filter out no-data values
            minElevation = Math.min(minElevation, elevationData[i]);
            maxElevation = Math.max(maxElevation, elevationData[i]);
        }
    }
    
    // Convert elevation data to colors
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (width * y + x);
            const elevation = elevationData[idx];
            
            // Skip no-data values
            if (elevation <= -9999) {
                png.data[idx * 4] = 0;
                png.data[idx * 4 + 1] = 0;
                png.data[idx * 4 + 2] = 0;
                png.data[idx * 4 + 3] = 0;
                continue;
            }
            
            const color = interpolateColor(elevation, COLOR_RAMP);
            png.data[idx * 4] = color[0];     // R
            png.data[idx * 4 + 1] = color[1]; // G
            png.data[idx * 4 + 2] = color[2]; // B
            png.data[idx * 4 + 3] = 255;      // A
        }
    }
    
    // Save PNG
    const outputName = path.basename(filename, '.tiff') + '.png';
    const outputPath = path.join(OUTPUT_DIR, outputName);
    
    await new Promise((resolve, reject) => {
        png.pack()
           .pipe(fs.createWriteStream(outputPath))
           .on('finish', resolve)
           .on('error', reject);
    });
    
    console.log(`Created visualization: ${outputPath}`);
    console.log(`Elevation range: ${minElevation.toFixed(1)}m to ${maxElevation.toFixed(1)}m`);
    
    await dataset.closeAsync();
}

async function visualizeAllQuadrants() {
    console.log('Starting DEM visualization...');
    
    const files = fs.readdirSync(INPUT_DIR)
                   .filter(file => file.endsWith('.tiff'));
    
    for (const file of files) {
        try {
            await processQuadrant(file);
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }
    
    console.log('Visualization complete! Check the visualization directory for the output images.');
}

// Run the visualization
visualizeAllQuadrants().catch(console.error); 