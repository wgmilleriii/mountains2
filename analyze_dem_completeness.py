import rasterio
import numpy as np

dem_path = 'dem_files/USGS_13_n33w110_20211229.tif'

with rasterio.open(dem_path) as src:
    band1 = src.read(1)
    nodata = src.nodata
    total_pixels = band1.size
    valid_mask = band1 != nodata
    valid_pixels = np.count_nonzero(valid_mask)
    nodata_pixels = total_pixels - valid_pixels
    percent_valid = (valid_pixels / total_pixels) * 100

    # Exclude nodata for min/max
    valid_elevations = band1[valid_mask]
    min_elev = valid_elevations.min() if valid_pixels > 0 else None
    max_elev = valid_elevations.max() if valid_pixels > 0 else None

    print(f"File: {dem_path}")
    print(f"Total pixels: {total_pixels}")
    print(f"Valid pixels: {valid_pixels}")
    print(f"Nodata pixels: {nodata_pixels}")
    print(f"Percent valid: {percent_valid:.2f}%")
    print(f"Elevation range: {min_elev} to {max_elev} meters") 