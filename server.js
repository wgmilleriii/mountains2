import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getElevation } from './dem_reader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to parse JSON body from request
async function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

// Helper function to get elevation profile points
function generateProfilePoints(start, end, numPoints = 100) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const fraction = i / (numPoints - 1);
        const lat = start.lat + (end.lat - start.lat) * fraction;
        const lon = start.lon + (end.lon - start.lon) * fraction;
        points.push({ lat, lon });
    }
    return points;
}

// Calculate distance between two points in meters
function calculateDistance(point1, point2) {
    const R = 6371000; // Earth's radius in meters
    const lat1 = point1.lat * Math.PI / 180;
    const lat2 = point2.lat * Math.PI / 180;
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // Handle single elevation request
        if (req.url.startsWith('/api/elevation/')) {
            const [_, __, ___, lat, lon] = req.url.split('/');
            if (lat && lon) {
                const elevation = await getElevation(parseFloat(lat), parseFloat(lon));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ elevation }));
                return;
            }
        }
        
        // Handle batch elevation requests
        if (req.url === '/api/elevation/batch' && req.method === 'POST') {
            const body = await getRequestBody(req);
            if (!Array.isArray(body.points)) {
                throw new Error('Invalid request body: points array required');
            }
            
            const results = await Promise.all(
                body.points.map(async point => {
                    const elevation = await getElevation(point.lat, point.lon);
                    return { ...point, elevation };
                })
            );
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ points: results }));
            return;
        }
        
        // Handle elevation profile requests
        if (req.url === '/api/elevation/profile' && req.method === 'POST') {
            const body = await getRequestBody(req);
            if (!body.start || !body.end) {
                throw new Error('Invalid request body: start and end points required');
            }
            
            const numPoints = body.numPoints || 100;
            const profilePoints = generateProfilePoints(body.start, body.end, numPoints);
            
            // Calculate total distance
            const totalDistance = calculateDistance(body.start, body.end);
            const distanceStep = totalDistance / (numPoints - 1);
            
            const results = await Promise.all(
                profilePoints.map(async (point, index) => {
                    const elevation = await getElevation(point.lat, point.lon);
                    return {
                        ...point,
                        elevation,
                        distance: distanceStep * index
                    };
                })
            );
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                points: results,
                metadata: {
                    totalDistance,
                    numPoints,
                    start: body.start,
                    end: body.end
                }
            }));
            return;
        }
        
        // Handle static files
        let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
        
        // Get file extension
        const ext = path.extname(filePath);
        
        // Set content type based on file extension
        const contentType = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg'
        }[ext] || 'text/plain';
        
        // Read file
        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    res.writeHead(500);
                    res.end('Server error: ' + err.code);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
});

const port = 3000;
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 