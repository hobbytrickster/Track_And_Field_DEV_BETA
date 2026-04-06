#!/bin/bash
# Win Big: Track and Field — Reset all game data
# This deletes all player data, friends, challenges, etc.
# Seeded accounts will be recreated on next server start.

echo "⚠️  This will DELETE all game data (players, friends, challenges, etc.)"
read -p "Are you sure? (y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Cancelled."
  exit 0
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
rm -f "$DIR/packages/server/data.json"
echo "✅ Data reset. Seeded accounts will be recreated on next server start."
