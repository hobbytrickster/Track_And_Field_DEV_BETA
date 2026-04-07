#!/bin/bash
# Win Big: Track and Field — Clear all challenge replays
# Preserves all other data (users, athletes, friends, coins, etc.)

DATA_FILE="$(dirname "$0")/gamedata/data.json"

if [ ! -f "$DATA_FILE" ]; then
  echo "No data file found at $DATA_FILE"
  exit 1
fi

echo "Clearing challenge replays..."
python3 -c "
import json
with open('$DATA_FILE', 'r') as f:
    data = json.load(f)

c = len(data.get('challenges', []))
e = len(data.get('challengeEntries', []))
print(f'  Removing {c} challenges and {e} entries...')

data['challenges'] = []
data['challengeEntries'] = []

with open('$DATA_FILE', 'w') as f:
    json.dump(data, f)

print('  Done!')
"

echo "Stopping container..."
podman stop winbig-track 2>/dev/null || true
sleep 1
echo "Starting container..."
podman start winbig-track 2>/dev/null || true
echo "✅ Challenge replays cleared. All other data preserved."
