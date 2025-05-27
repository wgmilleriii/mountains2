import os
import json
import numpy as np
from osgeo import gdal
import glob

def read_tif_file(tif_path):
    """Read a TIF file and return its data and metadata."""
    try:
        dataset = gdal.Open(tif_path)
        if dataset is None:
            print(f"Error: Could not open {tif_path}")
            return None, None, None
        
        # Get the elevation data
        band = dataset.GetRasterBand(1)
        data = band.ReadAsArray()
        
        # Get the geotransform (contains pixel size and coordinates)
        geotransform = dataset.GetGeoTransform()
        
        # Get the projection
        projection = dataset.GetProjection()
        
        return data, geotransform, projection
    except Exception as e:
        print(f"Error processing {tif_path}: {str(e)}")
        return None, None, None

def process_tif_files():
    """Process all TIF files in the dem_files directory."""
    tif_dir = "dem_files"
    output_file = "public/elevation_tif.json"
    
    # Get all TIF files
    tif_files = glob.glob(os.path.join(tif_dir, "*.tif"))
    
    elevation_data = []
    
    for tif_file in tif_files:
        print(f"Processing {tif_file}...")
        data, geotransform, projection = read_tif_file(tif_file)
        
        if data is None or geotransform is None:
            print(f"Skipping {tif_file} due to read error")
            continue
            
        # Get the coordinates for each pixel
        x_origin = geotransform[0]
        y_origin = geotransform[3]
        pixel_width = geotransform[1]
        pixel_height = geotransform[5]
        
        # Sample every 100th pixel to reduce data size
        step = 100
        for i in range(0, data.shape[0], step):
            for j in range(0, data.shape[1], step):
                elevation = data[i, j]
                if elevation != -32768:  # Skip no-data values
                    lat = y_origin + i * pixel_height
                    lon = x_origin + j * pixel_width
                    elevation_data.append({
                        "lat": float(lat),
                        "lon": float(lon),
                        "elevation": float(elevation)
                    })
    
    # Save the data
    with open(output_file, 'w') as f:
        json.dump(elevation_data, f)
    
    print(f"Processed {len(elevation_data)} points from {len(tif_files)} TIF files")

if __name__ == "__main__":
    process_tif_files() 