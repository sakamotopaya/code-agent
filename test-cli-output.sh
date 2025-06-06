#!/bin/bash

echo "Testing CLI output improvements..."
echo

echo "1. Testing with verbose mode (should show debug logs):"
cd src && npm run build && node dist/cli/index.js --batch "list the files in the current directory" --verbose
echo

echo "2. Testing with quiet mode (should show minimal output):"
cd src && node dist/cli/index.js --batch "list the files in the current directory" --quiet
echo

echo "3. Testing normal mode (should show formatted LLM output without debug logs):"
cd src && node dist/cli/index.js --batch "list the files in the current directory"
echo

echo "Testing complete!"