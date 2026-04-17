#!/bin/bash
set -e

# Legislator Search Lambda Deployment Script
# Usage: ./deploy.sh [dev|prod]

STAGE="${1:-dev}"
FUNCTION_NAME="legislator-sear-${STAGE}"
BUILD_DIR="/tmp/lambda-search-build"
ZIP_FILE="/tmp/lambda-search-${STAGE}.zip"

echo "🚀 Deploying Lambda: ${FUNCTION_NAME}"

# Check for required tools
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed."; exit 1; }
command -v pip >/dev/null 2>&1 || { echo "❌ pip is required but not installed."; exit 1; }

# Load environment variables if .env exists
if [ -f .env ]; then
    echo "📦 Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
fi

# Clean and create build directory
echo "📁 Preparing build directory..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt -t "${BUILD_DIR}" --quiet --upgrade

# Copy application code
echo "📋 Copying application code..."
cp -r app "${BUILD_DIR}/"
cp handler.py "${BUILD_DIR}/"
cp zappa_settings.py "${BUILD_DIR}/"

# Create deployment package
echo "📦 Creating deployment package..."
cd "${BUILD_DIR}"
zip -r "${ZIP_FILE}" . -x "*.pyc" -x "__pycache__/*" -x "*.dist-info/*" -x "pip/*" -x "setuptools/*" -x "wheel/*" > /dev/null

# Check zip size
ZIP_SIZE=$(du -h "${ZIP_FILE}" | cut -f1)
echo "📦 Package size: ${ZIP_SIZE}"

# Deploy to Lambda
echo "🚀 Deploying to AWS Lambda..."
aws lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --zip-file "fileb://${ZIP_FILE}" \
    --query 'LastModified' \
    --output text

# Update environment variables if .env exists
if [ -n "${DB_USER}" ] && [ -n "${DB_PASSWORD}" ] && [ -n "${DB_HOST}" ]; then
    echo "🔧 Updating environment variables..."
    aws lambda update-function-configuration \
        --function-name "${FUNCTION_NAME}" \
        --environment "Variables={AWS_REGION=us-east-1,DB_DIALECT=mysql+pymysql,DB_USER=${DB_USER},DB_PASSWORD=${DB_PASSWORD},DB_HOST=${DB_HOST},DB_PORT=${DB_PORT:-3306},DB_NAME=${DB_NAME:-elite},FLASK_ENV=production,S3_BUCKET=${S3_EXPORT_BUCKET:?Set S3_EXPORT_BUCKET}}" \
        --query 'LastModified' \
        --output text > /dev/null
fi

# Clean up
rm -rf "${BUILD_DIR}"
rm -f "${ZIP_FILE}"

echo "✅ Deployment complete!"
echo ""
echo "Test the API:"
echo "  curl -X POST \${SEARCH_API_URL}/${STAGE}/warmup"
