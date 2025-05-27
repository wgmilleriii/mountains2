const fs = require('fs');
const https = require('https');

// West and east base coordinates
const start = { lat: 35.150, lon: -106.600 };
const end = { lat: 35.210, lon: -106.400 };
const numPoints = 20;

// Generate evenly spaced points
function interpolatePoints(start, end, num) {
  const points = [];
  for (let i = 0; i < num; i++) {
    const t = i / (num - 1);
    points.push({
      lat: start.lat + t * (end.lat - start.lat),
      lon: start.lon + t * (end.lon - start.lon),
    });
  }
  return points;
}

// Fetch elevation for a single point
function fetchElevation(point) {
  const url = `https://nationalmap.gov/epqs/pqs.php?x=${point.lon}&y=${point.lat}&units=Meters&output=json`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const elevation = json.USGS_Elevation_Point_Query_Service.Elevation_Query.Elevation;
          resolve({ ...point, elevation });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const points = interpolatePoints(start, end, numPoints);
  const elevations = [];
  for (const pt of points) {
    try {
      const result = await fetchElevation(pt);
      elevations.push(result);
      console.log(`Fetched: lat=${result.lat}, lon=${result.lon}, elev=${result.elevation}`);
    } catch (e) {
      console.error('Error fetching elevation:', e);
      elevations.push({ ...pt, elevation: 0 });
    }
  }

  // Scale to SVG
  const width = 800;
  const height = 300;
  const margin = 40;
  const minElev = Math.min(...elevations.map(e => e.elevation));
  const maxElev = Math.max(...elevations.map(e => e.elevation));
  const scaleX = (i) => margin + (i / (numPoints - 1)) * (width - 2 * margin);
  const scaleY = (elev) => height - margin - ((elev - minElev) / (maxElev - minElev)) * (height - 2 * margin);

  const pointsStr = elevations.map((e, i) => `${scaleX(i)},${scaleY(e.elevation)}`).join(' ');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <polyline points="${pointsStr}" fill="none" stroke="black" stroke-width="2" />
  <text x="${margin}" y="${height - 10}" font-size="14">Sandia Mountains Elevation Profile</text>
</svg>`;

  fs.writeFileSync('sandia_outline.svg', svg);
  console.log('SVG written to sandia_outline.svg');
}

main(); 