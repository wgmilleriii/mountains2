#!/bin/bash

# Create data directory if it doesn't exist
mkdir -p data/terrain

# First, get the list of available datasets
echo "Getting available datasets..."
curl -X GET "https://tnmaccess.nationalmap.gov/api/v1/datasets" \
  -H "Accept: application/json" \
  -o data/terrain/datasets.json

# Get the 3DEP dataset ID
THREE_DEP_ID=$(jq -r '.[] | select(.title | contains("3D Elevation Program")) | .id' data/terrain/datasets.json)

if [ ! -z "$THREE_DEP_ID" ]; then
    echo "Found 3DEP dataset ID: $THREE_DEP_ID"
    
    # Get available products for 3DEP
    echo "Getting available 3DEP products..."
    curl -X GET "https://tnmaccess.nationalmap.gov/api/v1/products?datasets=$THREE_DEP_ID&bbox=-109.05,31.33,-103.00,37.00&format=GeoTIFF" \
      -H "Accept: application/json" \
      -o data/terrain/products.json
    
    # Extract the first product ID
    PRODUCT_ID=$(jq -r '.data[0].id' data/terrain/products.json)
    
    if [ ! -z "$PRODUCT_ID" ] && [ "$PRODUCT_ID" != "null" ]; then
        echo "Found product ID: $PRODUCT_ID"
        
        # Get the download URL for this product
        echo "Getting download URL..."
        curl -X GET "https://tnmaccess.nationalmap.gov/api/v1/products/$PRODUCT_ID" \
          -H "Accept: application/json" \
          -o data/terrain/product_details.json
        
        # Extract and download the file
        DOWNLOAD_URL=$(jq -r '.data.downloadURL' data/terrain/product_details.json)
        
        if [ ! -z "$DOWNLOAD_URL" ] && [ "$DOWNLOAD_URL" != "null" ]; then
            echo "Downloading terrain data from: $DOWNLOAD_URL"
            curl -L "$DOWNLOAD_URL" -o "data/terrain/nm_terrain.tif"
            echo "Download complete!"
        else
            echo "No download URL found in the response"
            echo "Response contents:"
            cat data/terrain/product_details.json
        fi
    else
        echo "No product ID found in the response"
        echo "Response contents:"
        cat data/terrain/products.json
    fi
else
    echo "Could not find 3DEP dataset ID"
    echo "Available datasets:"
    cat data/terrain/datasets.json
fi 