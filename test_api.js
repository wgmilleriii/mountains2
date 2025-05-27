import http from 'http';

const TEST_POINTS = [
    {
        name: 'Albuquerque',
        lat: 35.0844,
        lon: -106.6504
    },
    {
        name: 'Santa Fe',
        lat: 35.6870,
        lon: -105.9378
    }
];

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: JSON.parse(body)
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('Starting API tests...\n');
    
    try {
        // Test 1: Single point elevation
        console.log('Test 1: Single point elevation');
        console.time('Single point');
        const point = TEST_POINTS[0];
        const singleResult = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/elevation/${point.lat}/${point.lon}`,
            method: 'GET'
        });
        console.timeEnd('Single point');
        console.log(`${point.name} elevation: ${singleResult.body.elevation}m\n`);
        
        // Test 2: Batch elevation request
        console.log('Test 2: Batch elevation request');
        console.time('Batch request');
        const batchResult = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/elevation/batch',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, {
            points: TEST_POINTS
        });
        console.timeEnd('Batch request');
        console.log('Batch results:');
        batchResult.body.points.forEach(point => {
            console.log(`  ${point.lat}, ${point.lon}: ${point.elevation}m`);
        });
        console.log('');
        
        // Test 3: Elevation profile
        console.log('Test 3: Elevation profile');
        console.time('Profile request');
        const profileResult = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/elevation/profile',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, {
            start: TEST_POINTS[0],
            end: TEST_POINTS[1],
            numPoints: 20  // Use fewer points for testing
        });
        console.timeEnd('Profile request');
        
        const { points, metadata } = profileResult.body;
        console.log('Profile results:');
        console.log(`  Total distance: ${(metadata.totalDistance / 1000).toFixed(1)}km`);
        console.log(`  Number of points: ${points.length}`);
        console.log(`  Elevation range: ${Math.min(...points.map(p => p.elevation))}m to ${Math.max(...points.map(p => p.elevation))}m`);
        console.log('');
        
        // Test 4: Error handling
        console.log('Test 4: Error handling');
        try {
            await makeRequest({
                hostname: 'localhost',
                port: 3000,
                path: '/api/elevation/invalid/coordinates',
                method: 'GET'
            });
        } catch (error) {
            console.log('  Successfully caught invalid coordinates error');
        }
        
        try {
            await makeRequest({
                hostname: 'localhost',
                port: 3000,
                path: '/api/elevation/batch',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }, {
                invalid: 'data'
            });
        } catch (error) {
            console.log('  Successfully caught invalid batch request error');
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the tests
console.log('API Test Suite');
console.log('=============\n');
runTests(); 