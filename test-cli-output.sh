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

npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "Create a TypeScript file at 'test-run-output/sample-code.ts' with various code definitions including classes, functions, interfaces, and enums. Then use list_code_definition_names to extract all the definitions and verify they are correctly identified."

npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "list your MCP servers"

npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "use the github mcp server to summarize issue #8. you can run git status or git remote to get the repo name"