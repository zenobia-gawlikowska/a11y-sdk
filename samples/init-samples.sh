#!/usr/bin/env bash
# init-samples.sh — initialize each sample app as its own git repo and wire
# the a11y toolkit's pre-commit hook. Run once after cloning a11y-sdk.
#
# Usage:
#   bash samples/init-samples.sh          # init all three
#   bash samples/init-samples.sh react    # init only the react-app

set -euo pipefail

SAMPLES_DIR="$(cd "$(dirname "$0")" && pwd)"
APPS=("react-app" "vue-app" "angular-app")

# --- filter to requested app if an argument was given ---
if [[ $# -gt 0 ]]; then
  APPS=()
  for arg in "$@"; do
    APPS+=("${arg}-app")
  done
fi

for app in "${APPS[@]}"; do
  dir="$SAMPLES_DIR/$app"

  if [[ ! -d "$dir" ]]; then
    echo "⚠️  $app: directory not found, skipping"
    continue
  fi

  echo ""
  echo "── $app ──────────────────────────────────────"

  # Init git repo if not already done
  if [[ -d "$dir/.git" ]]; then
    echo "✓  git repo already initialised"
  else
    git -C "$dir" init -b main
    git -C "$dir" add .
    git -C "$dir" commit -m "chore: initial scaffold (intentional a11y violations)"
    echo "✓  git init + initial commit done"
  fi

  # Wire the pre-commit hook via the toolkit's setup script
  if [[ -f "$dir/.a11y/scripts/setup.sh" ]]; then
    bash "$dir/.a11y/scripts/setup.sh"
    echo "✓  toolkit hook wired"
  else
    echo "⚠️  .a11y/scripts/setup.sh not found — symlink missing?"
  fi
done

echo ""
echo "Done. Each sample app is now an independent git repo with the pre-commit"
echo "hook active. Stage a file and run 'git commit' inside any sample to"
echo "trigger the a11y check."
