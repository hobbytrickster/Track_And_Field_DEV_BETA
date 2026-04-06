#!/bin/bash
# Win Big: Track and Field — Give coins to a player
# Usage: ./give_coins.sh <team_name> <amount>
# Example: ./give_coins.sh Jake 5000

DATA_FILE="$(dirname "$0")/gamedata/data.json"

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./give_coins.sh <team_name> <amount>"
  echo "Example: ./give_coins.sh Jake 5000"
  exit 1
fi

if [ ! -f "$DATA_FILE" ]; then
  echo "No data file found at $DATA_FILE"
  exit 1
fi

PLAYER="$1"
AMOUNT="$2"

python3 -c "
import json, sys

with open('$DATA_FILE', 'r') as f:
    data = json.load(f)

user = next((u for u in data['users'] if u['email'] == '$PLAYER' or u['displayName'] == '$PLAYER'), None)
if not user:
    print(f'Player \"$PLAYER\" not found.')
    print('Available players:')
    for u in data['users']:
        print(f'  {u[\"email\"]:15s} ({u[\"displayName\"]}) — {u[\"coins\"]} coins')
    sys.exit(1)

old = user['coins']
user['coins'] += $AMOUNT

with open('$DATA_FILE', 'w') as f:
    json.dump(data, f)

print(f'Gave {$AMOUNT} coins to {user[\"displayName\"]}')
print(f'  Before: {old} coins')
print(f'  After:  {user[\"coins\"]} coins')
"

echo "Restarting container..."
podman restart winbig-track 2>/dev/null || echo "  (no container to restart)"
echo "✅ Done."
