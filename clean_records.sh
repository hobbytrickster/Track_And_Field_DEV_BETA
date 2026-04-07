#!/bin/bash
# Win Big: Track and Field — Clear all timing records

DATA_FILE="$(dirname "$0")/gamedata/data.json"

if [ ! -f "$DATA_FILE" ]; then
  echo "No data file found at $DATA_FILE"
  exit 1
fi

echo "Stopping container..."
podman stop winbig-track 2>/dev/null || true
sleep 2

echo "Clearing timing records..."
python3 -c "
import json
with open('$DATA_FILE', 'r') as f:
    data = json.load(f)

count = len(data.get('records', []))
print(f'  Removing {count} timing records...')

data['records'] = []

with open('$DATA_FILE', 'w') as f:
    json.dump(data, f)

print('  Done!')
"

echo "Starting container..."
podman start winbig-track 2>/dev/null || true
echo "✅ Timing records cleared. All other data preserved."
