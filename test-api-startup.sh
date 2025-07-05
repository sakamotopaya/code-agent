#!/bin/bash

# Test script to verify API server startup with new working directory

echo "Testing API server startup from project root..."

# Start the API server in background
./run-api.sh &
API_PID=$!

echo "API server started with PID: $API_PID"

# Wait a few seconds for startup
sleep 5

# Check if the process is still running
if kill -0 $API_PID 2>/dev/null; then
    echo "✅ API server is running successfully"
    
    # Test a simple health check if possible
    if command -v curl >/dev/null 2>&1; then
        echo "Testing health endpoint..."
        curl -s http://localhost:3000/health || echo "Health check failed (this might be expected)"
    fi
    
    # Stop the server
    echo "Stopping API server..."
    kill $API_PID
    wait $API_PID 2>/dev/null
    echo "✅ API server stopped successfully"
else
    echo "❌ API server failed to start or crashed"
    exit 1
fi

echo "Test completed successfully!"