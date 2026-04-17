#!/bin/bash

# Deploy the Scholar Stats Lambda function using AWS SAM

set -e

STACK_NAME="scholar-stats-updater"
S3_BUCKET="${S3_DEPLOY_BUCKET:?Set S3_DEPLOY_BUCKET to your deployment artifacts bucket}"
REGION="us-east-1"

echo "Building Lambda package..."
sam build

echo "Deploying to AWS..."
sam deploy \
    --stack-name $STACK_NAME \
    --s3-bucket $S3_BUCKET \
    --region $REGION \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

echo "Deployment complete!"

# Optionally invoke the function immediately to test
read -p "Do you want to invoke the function now to test? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Invoking function..."
    aws lambda invoke \
        --function-name scholar-stats-updater \
        --region $REGION \
        --log-type Tail \
        /tmp/scholar-stats-output.json

    echo "Response:"
    cat /tmp/scholar-stats-output.json
    echo
fi
