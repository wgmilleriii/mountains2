import os
import json
import rasterio

DEM_DIR = 'dem_files'
OUTPUT_FILE = 'elevation_cache.json'
SAMPLE_STEP = 10  # Change to 1 for all points, 10 for every 10th, etc.

elevation_cache = {}

for filename in os.listdir(DEM_DIR):
    if filename.endswith('.tif'):
        path = os.path.join(DEM_DIR, filename)
        print(f'Processing {filename}...')
        with rasterio.open(path) as src:
            band1 = src.read(1)
            for row in range(0, src.height, SAMPLE_STEP):
                for col in range(0, src.width, SAMPLE_STEP):
                    elev = float(band1[row, col])
                    if elev == src.nodata:
                        continue
                    lon, lat = src.xy(row, col)
                    key = f"{lat:.5f},{lon:.5f}"
                    elevation_cache[key] = elev

print(f"Writing {len(elevation_cache)} points to {OUTPUT_FILE}")
with open(OUTPUT_FILE, 'w') as f:
    json.dump(elevation_cache, f) 