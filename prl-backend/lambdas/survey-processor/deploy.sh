#!/bin/bash
set -e

echo "=== Survey Processor Lambda Deployment (ZIP) ==="

# Configuration
LAMBDA_NAME="survey-processor"
REGION="us-east-1"
RUNTIME="python3.11"
HANDLER="handler.lambda_handler"
TIMEOUT=900
MEMORY=4096

# AWS pandas layer ARN (AWS-provided for Python 3.11)
# See: https://aws-sdk-pandas.readthedocs.io/en/stable/layers.html
PANDAS_LAYER="arn:aws:lambda:us-east-1:336392948345:layer:AWSSDKPandas-Python311:20"

# Load environment variables if .env exists
if [ -f .env ]; then
    echo "Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
fi

# Clean up
rm -rf package/ lambda.zip

# Create package directory
mkdir -p package

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt -t package/ --quiet --platform manylinux2014_x86_64 --only-binary=:all:

# Copy application code
echo "Copying application code..."
cp handler.py package/
cp -r processing package/
cp -r config package/

# Create ZIP
echo "Creating ZIP package..."
cd package
zip -r ../lambda.zip . -x "*.pyc" -x "*__pycache__*" -x "*.dist-info/*" -q
cd ..

# Get ZIP size
ZIP_SIZE=$(du -h lambda.zip | cut -f1)
echo "ZIP package size: $ZIP_SIZE"

# Check if Lambda exists
if aws lambda get-function --function-name $LAMBDA_NAME --region $REGION 2>/dev/null; then
    echo "Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name $LAMBDA_NAME \
        --zip-file fileb://lambda.zip \
        --region $REGION \
        --query 'LastModified' \
        --output text

    # Wait for update to complete
    echo "Waiting for update to complete..."
    aws lambda wait function-updated --function-name $LAMBDA_NAME --region $REGION

    # Update configuration
    echo "Updating Lambda configuration..."
    aws lambda update-function-configuration \
        --function-name $LAMBDA_NAME \
        --runtime $RUNTIME \
        --handler $HANDLER \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --layers $PANDAS_LAYER \
        --region $REGION \
        --query 'LastModified' \
        --output text

    # Wait for config update
    aws lambda wait function-updated --function-name $LAMBDA_NAME --region $REGION

    # Update environment variables if provided
    if [ -n "${DB_USER}" ] && [ -n "${DB_PASSWORD}" ] && [ -n "${DB_HOST}" ]; then
        echo "Updating environment variables..."
        aws lambda update-function-configuration \
            --function-name $LAMBDA_NAME \
            --environment "Variables={DB_HOST=${DB_HOST},DB_USER=${DB_USER},DB_PASSWORD=${DB_PASSWORD},DB_PORT=${DB_PORT:-3306},S3_BUCKET=${S3_BUCKET:-${SURVEY_S3_BUCKET:?Set SURVEY_S3_BUCKET}}}" \
            --region $REGION \
            --query 'LastModified' \
            --output text > /dev/null
    fi
else
    echo "Creating new Lambda function..."

    # Get the existing role from another lambda
    ROLE_ARN=$(aws lambda get-function --function-name legislator-sear-dev --region $REGION --query 'Configuration.Role' --output text 2>/dev/null || echo "")

    if [ -z "$ROLE_ARN" ]; then
        echo "Error: Could not find execution role. Please create the Lambda manually first."
        exit 1
    fi

    # Build environment string
    ENV_VARS="DB_HOST=${DB_HOST:-},DB_USER=${DB_USER:-},DB_PASSWORD=${DB_PASSWORD:-},DB_PORT=${DB_PORT:-3306},S3_BUCKET=${S3_BUCKET:-${SURVEY_S3_BUCKET:?Set SURVEY_S3_BUCKET}}"

    aws lambda create-function \
        --function-name $LAMBDA_NAME \
        --runtime $RUNTIME \
        --handler $HANDLER \
        --role $ROLE_ARN \
        --zip-file fileb://lambda.zip \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --layers $PANDAS_LAYER \
        --environment "Variables={$ENV_VARS}" \
        --region $REGION
fi

# Clean up
rm -rf package/

echo ""
echo "=== Deployment Complete ==="
echo "Lambda: $LAMBDA_NAME"
echo ""
echo "Test with:"
echo "  aws lambda invoke --function-name $LAMBDA_NAME --payload '{\"action\": \"process_all\"}' /tmp/response.json && cat /tmp/response.json"
echo ""
echo "If you need to configure VPC access for RDS:"
echo "  aws lambda update-function-configuration \\"
echo "    --function-name $LAMBDA_NAME \\"
echo "    --vpc-config SubnetIds=subnet-xxx,SecurityGroupIds=sg-xxx"
