#!/bin/bash
# Restart Docker stack and rebuild app

# Stop all running containers
echo "Stopping Docker containers..."
docker compose down

# Rebuild the app service without cache to ensure latest code is used
echo "Rebuilding app container..."
docker compose build --no-cache app

# Start all services in foreground
echo "Starting Docker containers..."
docker compose up

echo "Docker stack restarted successfully."
