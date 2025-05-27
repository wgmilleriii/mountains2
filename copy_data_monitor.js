import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SOURCE_FILE = 'elevation_cache.json';
const DEST_DIR = 'public';
const DEST_FILE = path.join(DEST_DIR, 'elevation_cache.json');
const MONITOR_INTERVAL = 5000; // 5 seconds
const LOG_FILE = 'copy_monitor.log';

// Monitoring state
let lastSourceSize = 0;
let lastDestSize = 0;
let lastSourceModTime = 0;
let lastDestModTime = 0;
let isMonitoring = false;
let monitorInterval = null;

// Create readline interface for user input
const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

// Logging function
function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Function to get file stats
function getFileStats(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return {
            size: stats.size,
            modTime: stats.mtime.getTime(),
            exists: true
        };
    } catch (error) {
        return {
            size: 0,
            modTime: 0,
            exists: false
        };
    }
}

// Function to format file size
function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Function to check file integrity
function checkFileIntegrity(filePath) {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
            isValid: true,
            pointCount: Object.keys(data).length
        };
    } catch (error) {
        return {
            isValid: false,
            error: error.message
        };
    }
}

// Function to copy file with progress
async function copyFileWithProgress() {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(SOURCE_FILE);
        const writeStream = fs.createWriteStream(DEST_FILE);
        let bytesCopied = 0;
        const sourceStats = fs.statSync(SOURCE_FILE);
        
        readStream.on('data', (chunk) => {
            bytesCopied += chunk.length;
            const progress = (bytesCopied / sourceStats.size * 100).toFixed(2);
            process.stdout.write(`\rCopying: ${progress}% (${formatFileSize(bytesCopied)} / ${formatFileSize(sourceStats.size)})`);
        });
        
        readStream.on('end', () => {
            process.stdout.write('\n');
            resolve();
        });
        
        readStream.on('error', reject);
        writeStream.on('error', reject);
        
        readStream.pipe(writeStream);
    });
}

// Function to monitor files
function startMonitoring() {
    if (isMonitoring) return;
    
    isMonitoring = true;
    log('Starting file monitoring...');
    
    monitorInterval = setInterval(() => {
        const sourceStats = getFileStats(SOURCE_FILE);
        const destStats = getFileStats(DEST_FILE);
        
        // Check for source file changes
        if (sourceStats.exists && (sourceStats.size !== lastSourceSize || sourceStats.modTime !== lastSourceModTime)) {
            log(`Source file changed: ${formatFileSize(sourceStats.size)} (was ${formatFileSize(lastSourceSize)})`);
            lastSourceSize = sourceStats.size;
            lastSourceModTime = sourceStats.modTime;
            
            // Verify source file integrity
            const sourceIntegrity = checkFileIntegrity(SOURCE_FILE);
            if (!sourceIntegrity.isValid) {
                log(`Source file integrity check failed: ${sourceIntegrity.error}`, 'ERROR');
            } else {
                log(`Source file contains ${sourceIntegrity.pointCount} data points`);
            }
        }
        
        // Check for destination file changes
        if (destStats.exists && (destStats.size !== lastDestSize || destStats.modTime !== lastDestModTime)) {
            log(`Destination file changed: ${formatFileSize(destStats.size)} (was ${formatFileSize(lastDestSize)})`);
            lastDestSize = destStats.size;
            lastDestModTime = destStats.modTime;
            
            // Verify destination file integrity
            const destIntegrity = checkFileIntegrity(DEST_FILE);
            if (!destIntegrity.isValid) {
                log(`Destination file integrity check failed: ${destIntegrity.error}`, 'ERROR');
            } else {
                log(`Destination file contains ${destIntegrity.pointCount} data points`);
            }
        }
        
        // Check for file synchronization
        if (sourceStats.exists && destStats.exists) {
            if (sourceStats.size !== destStats.size) {
                log(`Files are out of sync! Source: ${formatFileSize(sourceStats.size)}, Dest: ${formatFileSize(destStats.size)}`, 'WARNING');
            }
        }
    }, MONITOR_INTERVAL);
}

// Function to stop monitoring
function stopMonitoring() {
    if (!isMonitoring) return;
    
    clearInterval(monitorInterval);
    isMonitoring = false;
    log('Stopped file monitoring');
}

// Main function
async function main() {
    // Ensure public directory exists
    if (!fs.existsSync(DEST_DIR)) {
        log(`Creating ${DEST_DIR} directory...`);
        fs.mkdirSync(DEST_DIR);
    }
    
    // Initialize monitoring state
    const initialSourceStats = getFileStats(SOURCE_FILE);
    const initialDestStats = getFileStats(DEST_FILE);
    
    if (initialSourceStats.exists) {
        lastSourceSize = initialSourceStats.size;
        lastSourceModTime = initialSourceStats.modTime;
        log(`Initial source file size: ${formatFileSize(lastSourceSize)}`);
    }
    
    if (initialDestStats.exists) {
        lastDestSize = initialDestStats.size;
        lastDestModTime = initialDestStats.modTime;
        log(`Initial destination file size: ${formatFileSize(lastDestSize)}`);
    }
    
    // Start monitoring
    startMonitoring();
    
    // Copy the file
    try {
        log(`Copying ${SOURCE_FILE} to ${DEST_FILE}...`);
        await copyFileWithProgress();
        log('Copy completed successfully!');
        
        // Verify the copy
        const sourceStats = getFileStats(SOURCE_FILE);
        const destStats = getFileStats(DEST_FILE);
        
        log('\nVerification:');
        log(`Source file size: ${formatFileSize(sourceStats.size)}`);
        log(`Destination file size: ${formatFileSize(destStats.size)}`);
        log(`Files match: ${sourceStats.size === destStats.size ? 'Yes' : 'No'}`);
        
        // Count data points
        const sourceIntegrity = checkFileIntegrity(SOURCE_FILE);
        const destIntegrity = checkFileIntegrity(DEST_FILE);
        
        if (sourceIntegrity.isValid && destIntegrity.isValid) {
            log(`\nData points in source: ${sourceIntegrity.pointCount}`);
            log(`Data points in destination: ${destIntegrity.pointCount}`);
            log(`Data points match: ${sourceIntegrity.pointCount === destIntegrity.pointCount ? 'Yes' : 'No'}`);
        }
        
    } catch (error) {
        log(`Error copying file: ${error.message}`, 'ERROR');
        process.exit(1);
    }
    
    // Keep monitoring until user presses 'q'
    log('\nPress "q" to quit monitoring...');
    rl.on('line', (input) => {
        if (input.toLowerCase() === 'q') {
            stopMonitoring();
            rl.close();
            process.exit(0);
        }
    });
}

// Run the script
main().catch(error => {
    log(`Fatal error: ${error.message}`, 'ERROR');
    process.exit(1);
}); 