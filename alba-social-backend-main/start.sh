#!/bin/sh

echo "Starting application..."

# Print environment variables for debugging (excluding sensitive info)
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL is set: $(if [ -n "$DATABASE_URL" ]; then echo true; else echo false; fi)"

# Start the application
node dist/src/main.js 