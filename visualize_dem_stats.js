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

function analyzeFile(filename) {
    console.log(`\\nAnalyzing ${filename}...`);
    
    const filePath = path.join(INPUT_DIR, filename);
    const stats = fs.statSync(filePath);
    
    // Basic file information
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Last modified: ${stats.mtime}`);
    
    // Read first few bytes to check file type
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);
    
    // Check if it's a valid TIFF file
    const isTiff = buffer.toString('hex', 0, 2) === '4949' || buffer.toString('hex', 0, 2) === '4d4d';
    console.log(`Valid TIFF format: ${isTiff ? 'Yes' : 'No'}`);
    
    return {
        name: filename,
        size: stats.size,
        modified: stats.mtime,
        isTiff
    };
}

function generateReport(analyses) {
    const report = [
        '# New Mexico DEM Data Analysis',
        '\\n## File Overview',
        ...analyses.map(analysis => (
            `\\n### ${analysis.name}` +
            `\\n- Size: ${(analysis.size / 1024 / 1024).toFixed(2)} MB` +
            `\\n- Last Modified: ${analysis.modified}` +
            `\\n- Valid TIFF: ${analysis.isTiff ? 'Yes' : 'No'}`
        )),
        '\\n## Coverage',
        '- Northwest quadrant: 35.0°N to 37.0°N, -109.05°W to -106.0°W',
        '- Northeast quadrant: 35.0°N to 37.0°N, -106.0°W to -103.0°W',
        '- Southwest quadrant: 31.33°N to 35.0°N, -109.05°W to -106.0°W',
        '- Southeast quadrant: 31.33°N to 35.0°N, -106.0°W to -103.0°W',
        '\\n## Resolution',
        '- Horizontal: ~10 meters',
        '- Vertical: 1 meter',
        '\\n## Data Source',
        '- USGS 3DEP (3D Elevation Program)',
        '- Retrieved via National Map API'
    ].join('\\n');
    
    const outputPath = path.join(OUTPUT_DIR, 'dem_analysis.md');
    fs.writeFileSync(outputPath, report);
    console.log(`\\nReport generated: ${outputPath}`);
}

function analyzeAllFiles() {
    console.log('Starting DEM file analysis...');
    
    const files = fs.readdirSync(INPUT_DIR)
                   .filter(file => file.endsWith('.tiff'));
    
    const analyses = files.map(file => analyzeFile(file));
    generateReport(analyses);
    
    console.log('\\nAnalysis complete! Check dem_analysis.md in the visualization directory.');
}

// Run the analysis
console.log('Starting DEM data analysis...');
analyzeAllFiles(); 