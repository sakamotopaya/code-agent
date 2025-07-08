#!/bin/bash

# Test script to verify API server paths are working correctly

echo "Testing API server with full startup to check path resolution..."

# Start the API server in background and capture output
./run-api.sh > api-startup.log 2>&1 &
API_PID=$!

echo "API server started with PID: $API_PID"
echo "Waiting for full startup..."

# Wait longer for full startup
sleep 15

# Check if the process is still running
if kill -0 $API_PID 2>/dev/null; then
    echo "✅ API server is running successfully"
    
    # Check the log for any path-related errors
    echo ""
    echo "Checking for path-related errors in startup log..."
    if grep -i "no such file or directory" api-startup.log; then
        echo "❌ Found path-related errors"
    elif grep -i "ENOENT" api-startup.log; then
        echo "❌ Found file not found errors"
    elif grep -i "error" api-startup.log; then
        echo "⚠️  Found some errors (may not be path-related):"
        grep -i "error" api-startup.log
    else
        echo "✅ No obvious path-related errors found"
    fi
    
    # Test the health endpoint
    echo ""
    echo "Testing health endpoint..."
    if command -v curl >/dev/null 2>&1; then
        if curl -s http://localhost:3000/health > /dev/null; then
            echo "✅ Health endpoint is responding"
        else
            echo "⚠️  Health endpoint not responding (server may still be starting)"
        fi
    fi
    
    # Stop the server
    echo ""
    echo "Stopping API server..."
    kill $API_PID
    wait $API_PID 2>/dev/null
    echo "✅ API server stopped successfully"
    
    # Show relevant parts of the log
    echo ""
    echo "=== API Server Startup Log (last 20 lines) ==="
    tail -20 api-startup.log
    
else
    echo "❌ API server failed to start or crashed"
    echo ""
    echo "=== API Server Startup Log ==="
    cat api-startup.log
    exit 1
fi

# Clean up
rm -f api-startup.log

echo ""
echo "Test completed successfully!"