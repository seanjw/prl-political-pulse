#!/bin/bash

# Deploy script for Americas Pulse React site
# Builds the site, uploads to S3, and invalidates CloudFront cache

set -e  # Exit on any error

BUCKET_NAME="${PRL_S3_BUCKET:?Set PRL_S3_BUCKET}"
CLOUDFRONT_DIST_ID="${PRL_CLOUDFRONT_DIST_ID:?Set PRL_CLOUDFRONT_DIST_ID}"
DIST_DIR="dist"

# Set admin env vars for the build
export VITE_ADMIN_API_URL="${VITE_ADMIN_API_URL:?Set VITE_ADMIN_API_URL}"

echo "==================================="
echo "Building Americas Pulse React site"
echo "==================================="

# Build the site
npm run build

if [ ! -d "$DIST_DIR" ]; then
    echo "Error: Build failed - dist directory not found"
    exit 1
fi

echo ""
echo "==================================="
echo "Uploading to S3 bucket: $BUCKET_NAME"
echo "==================================="

# Sync dist folder to S3 bucket
# --delete removes files from S3 that don't exist locally
# Exclude data files managed separately (large datasets, admin-curated content)
aws s3 sync "$DIST_DIR" "s3://$BUCKET_NAME" --delete \
    --exclude "data/mediaMentions.json" \
    --exclude "data/westwood-publications.json" \
    --exclude "data/elite/*" \
    --exclude "data/international/*" \
    --exclude "data/all-data.zip" \
    --exclude "news/*" \
    --exclude "toplines/*" \
    --exclude "ai/*" \
    --exclude "files/*" \
    --exclude "primary/images/*"

# Set correct content types for common file types
echo ""
echo "Setting content types..."

# HTML files
aws s3 cp "s3://$BUCKET_NAME" "s3://$BUCKET_NAME" \
    --exclude "*" --include "*.html" \
    --content-type "text/html" \
    --metadata-directive REPLACE --recursive

# JavaScript files
aws s3 cp "s3://$BUCKET_NAME" "s3://$BUCKET_NAME" \
    --exclude "*" --include "*.js" \
    --content-type "application/javascript" \
    --metadata-directive REPLACE --recursive

# CSS files
aws s3 cp "s3://$BUCKET_NAME" "s3://$BUCKET_NAME" \
    --exclude "*" --include "*.css" \
    --content-type "text/css" \
    --metadata-directive REPLACE --recursive

# JSON files
aws s3 cp "s3://$BUCKET_NAME" "s3://$BUCKET_NAME" \
    --exclude "*" --include "*.json" \
    --content-type "application/json" \
    --metadata-directive REPLACE --recursive

# SVG files
aws s3 cp "s3://$BUCKET_NAME" "s3://$BUCKET_NAME" \
    --exclude "*" --include "*.svg" \
    --content-type "image/svg+xml" \
    --metadata-directive REPLACE --recursive

echo ""
echo "==================================="
echo "Invalidating CloudFront cache..."
echo "==================================="
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DIST_ID" --paths "/*"

echo ""
echo "==================================="
echo "Deployment complete!"
echo "==================================="
echo "Site uploaded to: s3://$BUCKET_NAME"
echo "CloudFront invalidation started - changes will propagate in 1-5 minutes"
