#!/bin/bash
# Win Big: Track and Field — Podman deployment script
set -e

echo ""
echo "  ██╗    ██╗██╗███╗   ██╗    ██████╗ ██╗ ██████╗ "
echo "  ██║    ██║██║████╗  ██║    ██╔══██╗██║██╔════╝ "
echo "  ██║ █╗ ██║██║██╔██╗ ██║    ██████╔╝██║██║  ███╗"
echo "  ██║███╗██║██║██║╚██╗██║    ██╔══██╗██║██║   ██║"
echo "  ╚███╔███╔╝██║██║ ╚████║    ██████╔╝██║╚██████╔╝"
echo "   ╚══╝╚══╝ ╚═╝╚═╝  ╚═══╝    ╚═════╝ ╚═╝ ╚═════╝ "
echo "           TRACK  AND  FIELD — DEPLOY"
echo ""

CONTAINER_NAME="winbig-track"
IMAGE_NAME="winbig-track:latest"
DATA_DIR="$(pwd)/gamedata"

mkdir -p "$DATA_DIR"

echo "Stopping existing container..."
podman stop $CONTAINER_NAME 2>/dev/null || true
podman rm $CONTAINER_NAME 2>/dev/null || true

echo "Building container image..."
podman build -t $IMAGE_NAME -f Containerfile .

echo "Starting container..."
podman run -d \
  --name $CONTAINER_NAME \
  --restart=always \
  -p 3001:3001 \
  -p 8080:8080 \
  -v "$DATA_DIR:/app/data:Z" \
  $IMAGE_NAME

echo ""
echo "✅ Deployment complete!"
echo ""
echo "  Game:  http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):8080"
echo "  API:   http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3001"
echo ""
echo "  View logs:    podman logs -f $CONTAINER_NAME"
echo "  Stop:         podman stop $CONTAINER_NAME"
echo "  Restart:      podman restart $CONTAINER_NAME"
echo "  Game data:    $DATA_DIR/data.json"
echo ""
