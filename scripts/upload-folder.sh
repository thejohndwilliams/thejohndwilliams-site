#!/bin/bash
# Batch upload all images from a folder to Cloudflare Images
# Usage: ./upload-folder.sh <folder-path>
#
# This will upload all .jpg, .jpeg, .png, .webp files from the folder

set -e

FOLDER="${1:-.}"

if [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_API_TOKEN" ]; then
  echo "Error: Set CF_ACCOUNT_ID and CF_API_TOKEN environment variables"
  exit 1
fi

SCRIPT_DIR="$(dirname "$0")"

echo "Uploading images from: $FOLDER"
echo ""

for file in "$FOLDER"/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP} 2>/dev/null; do
  [ -f "$file" ] || continue
  echo "---"
  "$SCRIPT_DIR/upload-to-cloudflare.sh" "$file"
done

echo ""
echo "Done!"
