#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker and try again."
  exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create a .env file with DATABASE_URL."
  exit 1
fi

# Extract DATABASE_URL directly
DATABASE_URL=$(grep DATABASE_URL .env | cut -d '"' -f2)

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found in .env file or has incorrect format."
  exit 1
fi

echo "DATABASE_URL found. Checking format..."
if [[ ! "$DATABASE_URL" =~ ^postgresql:// && ! "$DATABASE_URL" =~ ^postgres:// ]]; then
  echo "Error: DATABASE_URL must start with postgresql:// or postgres://"
  exit 1
fi

echo "DATABASE_URL format is valid."

# Build the Docker image
echo "Building Docker image..."
docker build -t alba-social-backend .

# Run the Docker container with environment variables
echo "Running Docker container..."
echo "Container will be available at http://localhost:3000"

# Run container with DATABASE_URL as an explicit environment variable
docker run -p 3000:3000 \
  --env DATABASE_URL="$DATABASE_URL" \
  --env-file .env \
  alba-social-backend 