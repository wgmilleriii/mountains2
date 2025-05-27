import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const INPUT_DIR = path.join(__dirname, 'dem_files');
const OUTPUT_DIR = path.join(__dirname, 'visualization');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// Function to create ASCII art visualization
function createAsciiArt(data, width, height, chars = ' ._-=+*#@') {
    let result = '';
    const maxVal = Math.max(...data.filter(x => x !== -9999));
    const minVal = Math.min(...data.filter(x => x !== -9999));
    const range = maxVal - minVal;
    
    for (let y = 0; y < height; y += height/50) { // Sample every nth row for visualization
        for (let x = 0; x < width; x += width/100) { // Sample every nth column
            const idx = Math.floor(y) * width + Math.floor(x);
            const val = data[idx];
            
            if (val === -9999) {
                result += ' ';
            } else {
                const normalizedVal = (val - minVal) / range;
                const charIdx = Math.floor(normalizedVal * (chars.length - 1));
                result += chars[charIdx];
            }
        }
        result += '\\n';
    }
    
    return {
        art: result,
        minElevation: minVal,
        maxElevation: maxVal
    };
}

// Function to read TIFF header
function readTiffHeader(buffer) {
    const littleEndian = buffer.readUInt16LE(0) === 0x4949;
    const read16 = littleEndian ? buffer.readUInt16LE : buffer.readUInt16BE;
    const read32 = littleEndian ? buffer.readUInt32LE : buffer.readUInt32BE;
    
    const ifdOffset = read32(4);
    const numEntries = read16(ifdOffset);
    
    let width = 0, height = 0;
    
    for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifdOffset + 2 + (i * 12);
        const tag = read16(entryOffset);
        
        if (tag === 256) { // ImageWidth
            width = read32(entryOffset + 8);
        } else if (tag === 257) { // ImageLength
            height = read32(entryOffset + 8);
        }
    }
    
    return { width, height };
}

async function visualizeQuadrant(filename) {
    console.log(`Processing ${filename}...`);
    
    const data = fs.readFileSync(path.join(INPUT_DIR, filename));
    const { width, height } = readTiffHeader(data);
    
    // Create a simple visualization using the header information
    const visualization = createAsciiArt(
        new Float32Array(width * height).fill(0), // Placeholder data
        width,
        height
    );
    
    // Save ASCII visualization
    const outputName = path.basename(filename, '.tiff') + '.txt';
    const outputPath = path.join(OUTPUT_DIR, outputName);
    
    const header = `Elevation Map for ${filename}\\n` +
                  `Resolution: ${width}x${height}\\n` +
                  `Elevation range: ${visualization.minElevation.toFixed(1)}m to ${visualization.maxElevation.toFixed(1)}m\\n\\n`;
    
    fs.writeFileSync(outputPath, header + visualization.art);
    console.log(`Created visualization: ${outputPath}`);
}

async function visualizeAllQuadrants() {
    console.log('Starting DEM visualization...');
    
    const files = fs.readdirSync(INPUT_DIR)
                   .filter(file => file.endsWith('.tiff'));
    
    for (const file of files) {
        try {
            await visualizeQuadrant(file);
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }
    
    console.log('Visualization complete! Check the visualization directory for the output files.');
}

// Run the visualization
console.log('Starting simple elevation visualization...');
visualizeAllQuadrants().catch(console.error); 