#!/usr/bin/env bash
# init-samples.sh — initialize each sample app as its own git repo and wire
# the a11y toolkit's pre-commit hook. Run once after cloning a11y-sdk.
#
# Usage:
#   bash samples/init-samples.sh          # init all three
#   bash samples/init-samples.sh react    # init only the react-app
#
# Note: setup.sh is intentionally NOT called here. When .a11y is a symlink,
# setup.sh resolves PROJECT_ROOT via the physical path (a11y-sdk/) rather than
# the sample app root, so it installs plugins into the wrong directory. The
# hook and executable bit are wired directly below, which is all that's needed
# — ESLint plugins resolve through the symlink to a11y-sdk/node_modules.

# Don't use set -e so that one app failing doesn't abort the rest.
set -uo pipefail

SAMPLES_DIR="$(cd "$(dirname "$0")" && pwd -L)"
APPS=("react-app" "vue-app" "angular-app")

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✔${NC}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "  ${RED}✖${NC}  $*"; }

# --- filter to requested apps if arguments were given ---
if [[ $# -gt 0 ]]; then
  APPS=()
  for arg in "$@"; do
    APPS+=("${arg}-app")
  done
fi

ERRORS=0

for app in "${APPS[@]}"; do
  dir="$SAMPLES_DIR/$app"
  echo ""
  echo "── $app ──────────────────────────────────────"

  if [[ ! -d "$dir" ]]; then
    fail "$app: directory not found, skipping"
    (( ERRORS++ )) || true
    continue
  fi

  # 1. Init git repo and make an initial commit
  if [[ -d "$dir/.git" ]]; then
    ok "git repo already initialised"
  else
    if git -C "$dir" init -b main \
        && git -C "$dir" add . \
        && git -C "$dir" commit -m "chore: initial scaffold (intentional a11y violations)" \
        > /dev/null 2>&1; then
      ok "git init + initial commit"
    else
      fail "git init failed"
      (( ERRORS++ )) || true
      continue
    fi
  fi

  # 2. Check the .a11y symlink resolves
  if [[ ! -f "$dir/.a11y/hooks/pre-commit" ]]; then
    fail ".a11y/hooks/pre-commit not found — is the symlink broken?"
    (( ERRORS++ )) || true
    continue
  fi

  # 3. Make the hook executable
  if chmod +x "$dir/.a11y/hooks/pre-commit"; then
    ok "hook made executable: .a11y/hooks/pre-commit"
  else
    fail "chmod failed on hook"
    (( ERRORS++ )) || true
    continue
  fi

  # 4. Wire core.hooksPath
  if git -C "$dir" config core.hooksPath .a11y/hooks; then
    ok "git hook wired: core.hooksPath = .a11y/hooks"
  else
    fail "git config core.hooksPath failed"
    (( ERRORS++ )) || true
    continue
  fi

  ok "ready — make a change, git add, and git commit to trigger the hook"
done

echo ""
if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}$ERRORS app(s) had errors.${NC} See messages above."
  exit 1
else
  echo -e "${GREEN}All done.${NC} Each sample app is an independent git repo with the"
  echo "pre-commit hook active. No npm install needed — ESLint plugins resolve"
  echo "through the .a11y symlink to the parent a11y-sdk/node_modules."
  echo ""
  echo "  To test:  cd react-app && git add src/App.jsx && git commit -m test"
  echo "  To lint:  cd react-app && ../../node_modules/.bin/eslint src \\"
  echo "              --config .a11y/config/eslint/react.cjs"
fi
