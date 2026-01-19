#!/bin/bash
# Cloudflare Images Upload Script
# Usage: ./upload-to-cloudflare.sh <image-file> [custom-id]
#
# Setup:
# 1. Get your Account ID from Cloudflare Dashboard → Images
# 2. Create an API token at https://dash.cloudflare.com/profile/api-tokens
#    - Use template "Cloudflare Images" or create custom with Images:Edit permission
# 3. Set environment variables:
#    export CF_ACCOUNT_ID="your-account-id"
#    export CF_API_TOKEN="your-api-token"

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <image-file> [custom-id]"
  echo "Example: $0 linkedin-preview.jpg linkedin-preview"
  exit 1
fi

IMAGE_FILE="$1"
CUSTOM_ID="${2:-$(basename "$IMAGE_FILE" | sed 's/\.[^.]*$//')}"

if [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_API_TOKEN" ]; then
  echo "Error: Set CF_ACCOUNT_ID and CF_API_TOKEN environment variables"
  echo ""
  echo "export CF_ACCOUNT_ID='your-account-id'"
  echo "export CF_API_TOKEN='your-api-token'"
  exit 1
fi

echo "Uploading $IMAGE_FILE as '$CUSTOM_ID'..."

RESPONSE=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -F "file=@$IMAGE_FILE" \
  -F "id=$CUSTOM_ID")

SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true' || true)

if [ -n "$SUCCESS" ]; then
  IMAGE_URL=$(echo "$RESPONSE" | grep -o '"variants":\["[^"]*"' | head -1 | sed 's/"variants":\["//' | sed 's/"$//')
  echo "✓ Upload successful!"
  echo ""
  echo "Image URL: $IMAGE_URL"
  echo ""
  echo "Use in your site:"
  echo "  preview: '$IMAGE_URL'"
else
  echo "✗ Upload failed:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
