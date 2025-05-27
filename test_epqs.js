
const https = require('https');

// Example: Sandia Crest (approximate)
const testPoint = { lat: 35.2111, lon: -106.4447 };

function fetchElevation(point) {
  const url = `https://epqs.nationalmap.gov/v1/json?x=${point.lon}&y=${point.lat}&units=Meters`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          console.log('Raw API response:', data);  // Log the raw response
          const json = JSON.parse(data);
          console.log('Parsed JSON:', json);  // Log the parsed JSON
          const elevation = Number(json.value);
          resolve(elevation);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

fetchElevation(testPoint)
  .then(elevation => {
    console.log('Received elevation:', elevation);  // Log the elevation value
    if (typeof elevation === 'number' && !isNaN(elevation)) {
      console.log(`Test passed: Elevation at Sandia Crest is ${elevation} meters.`);
    } else {
      console.error(`Test failed: Unexpected elevation value: ${elevation}`);
    }
  })
  .catch(err => {
    console.error('Test failed: Error fetching elevation:', err);
  }); 