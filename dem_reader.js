import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as GeoTIFF from 'geotiff';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEM_DIR = path.join(__dirname, 'dem_files');

// Cache for TIFF instances and metadata
const tiffCache = new Map();
const CHUNK_SIZE = 256; // Read data in 256x256 pixel chunks
const chunkCache = new Map();

// Function to determine which DEM file contains a point
function getDEMFile(lat, lon) {
    if (lat >= 35.0) {
        return lon >= -106.0 ? 'nm_dem_northeast.tiff' : 'nm_dem_northwest.tiff';
    } else {
        return lon >= -106.0 ? 'nm_dem_southeast.tiff' : 'nm_dem_southwest.tiff';
    }
}

// Function to get or create TIFF instance
async function getTiffInstance(filename) {
    if (!tiffCache.has(filename)) {
        const filePath = path.join(DEM_DIR, filename);
        const tiff = await GeoTIFF.fromFile(filePath);
        const image = await tiff.getImage();
        tiffCache.set(filename, {
            tiff,
            image,
            width: image.getWidth(),
            height: image.getHeight(),
            bounds: {
                north: filename.includes('north') ? 37.00 : 35.00,
                south: filename.includes('north') ? 35.00 : 31.33,
                east: filename.includes('east') ? -103.00 : -106.00,
                west: filename.includes('east') ? -106.00 : -109.05
            }
        });
    }
    return tiffCache.get(filename);
}

// Function to get chunk key
function getChunkKey(filename, chunkX, chunkY) {
    return `${filename}_${chunkX}_${chunkY}`;
}

// Function to read a specific chunk of data
async function readChunk(filename, chunkX, chunkY) {
    const key = getChunkKey(filename, chunkX, chunkY);
    if (chunkCache.has(key)) {
        return chunkCache.get(key);
    }

    const { image } = await getTiffInstance(filename);
    const startX = chunkX * CHUNK_SIZE;
    const startY = chunkY * CHUNK_SIZE;
    const width = Math.min(CHUNK_SIZE, image.getWidth() - startX);
    const height = Math.min(CHUNK_SIZE, image.getHeight() - startY);

    const rasters = await image.readRasters({
        window: [startX, startY, startX + width, startY + height]
    });

    const chunk = rasters[0];
    chunkCache.set(key, chunk);
    
    // Basic cache management - keep only last 10 chunks
    if (chunkCache.size > 10) {
        const firstKey = chunkCache.keys().next().value;
        chunkCache.delete(firstKey);
    }
    
    return chunk;
}

// Function to get elevation for a specific lat/lon
async function getElevation(lat, lon) {
    try {
        const filename = getDEMFile(lat, lon);
        const tiffData = await getTiffInstance(filename);
        
        // Convert lat/lon to pixel coordinates
        const x = Math.floor((lon - tiffData.bounds.west) / (tiffData.bounds.east - tiffData.bounds.west) * tiffData.width);
        const y = Math.floor((tiffData.bounds.north - lat) / (tiffData.bounds.north - tiffData.bounds.south) * tiffData.height);
        
        if (x < 0 || x >= tiffData.width || y < 0 || y >= tiffData.height) {
            throw new Error('Point outside DEM bounds');
        }
        
        // Calculate which chunk this point belongs to
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkY = Math.floor(y / CHUNK_SIZE);
        const chunk = await readChunk(filename, chunkX, chunkY);
        
        // Calculate position within chunk
        const localX = x % CHUNK_SIZE;
        const localY = y % CHUNK_SIZE;
        const chunkWidth = Math.min(CHUNK_SIZE, tiffData.width - (chunkX * CHUNK_SIZE));
        
        const elevation = chunk[localY * chunkWidth + localX];
        return elevation > -9999 ? elevation : null;
    } catch (error) {
        console.error('Error reading elevation:', error);
        return null;
    }
}

export { getElevation }; 