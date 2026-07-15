#!/usr/bin/env bash
set -euo pipefail

# a11y-sdk setup script
# Wires the git pre-commit hook, installs the appropriate ESLint a11y plugin,
# and patches/creates AI context wrapper files at the project root.
# Run once after copying .a11y/ into your project root.

# pwd -L keeps the logical (symlink-preserving) path so that PROJECT_ROOT is
# the project that contains .a11y/, not the physical toolkit source directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -L)"
A11Y_DIR="$(cd "${SCRIPT_DIR}/.." && pwd -L)"
PROJECT_ROOT="$(cd "${A11Y_DIR}/.." && pwd -L)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()    { echo -e "${GREEN}✔${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC} $*"; }
error()   { echo -e "${RED}✖${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Step 1: Monorepo check — .a11y/ must be at the git root
# ---------------------------------------------------------------------------
GIT_ROOT="$(git -C "${PROJECT_ROOT}" rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "${GIT_ROOT}" ]; then
  error ".a11y/ is not inside a git repository. Initialize git first: git init"
  exit 1
fi

if [ "$(realpath "${GIT_ROOT}")" != "$(realpath "${PROJECT_ROOT}")" ]; then
  error ".a11y/ must be at the git root for core.hooksPath to work."
  error "Move it to: ${GIT_ROOT}/.a11y/ and re-run setup.sh from there."
  echo ""
  echo "  mv .a11y/ \"${GIT_ROOT}/.a11y/\""
  echo "  cd \"${GIT_ROOT}\""
  echo "  bash .a11y/scripts/setup.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 2: Make hook executable
# ---------------------------------------------------------------------------
chmod +x "${A11Y_DIR}/hooks/pre-commit"
info "Hook made executable: .a11y/hooks/pre-commit"

# ---------------------------------------------------------------------------
# Step 3: Wire the git hook
# ---------------------------------------------------------------------------
git -C "${PROJECT_ROOT}" config core.hooksPath .a11y/hooks
info "Git hook wired: core.hooksPath = .a11y/hooks"

# ---------------------------------------------------------------------------
# Step 4: Detect package manager
# ---------------------------------------------------------------------------
detect_package_manager() {
  if [ -f "${PROJECT_ROOT}/pnpm-lock.yaml" ]; then
    echo "pnpm"
  elif [ -f "${PROJECT_ROOT}/yarn.lock" ]; then
    echo "yarn"
  elif [ -f "${PROJECT_ROOT}/bun.lockb" ]; then
    echo "bun"
  else
    echo "npm"
  fi
}

PM="$(detect_package_manager)"
info "Detected package manager: ${PM}"

# ---------------------------------------------------------------------------
# Step 5: Detect framework
# ---------------------------------------------------------------------------
FRAMEWORK="$(node "${SCRIPT_DIR}/detect-framework.cjs" "${PROJECT_ROOT}" 2>/dev/null || echo "unknown")"
info "Detected framework: ${FRAMEWORK}"

# ---------------------------------------------------------------------------
# Step 6: Install ESLint a11y plugin
# ---------------------------------------------------------------------------
install_deps() {
  case "${PM}" in
    pnpm) (cd "${PROJECT_ROOT}" && pnpm add --save-dev "$@") ;;
    yarn) (cd "${PROJECT_ROOT}" && yarn add --dev "$@") ;;
    bun)  (cd "${PROJECT_ROOT}" && bun add --dev "$@") ;;
    *)    (cd "${PROJECT_ROOT}" && npm install --save-dev "$@") ;;
  esac
}

# The a11y plugins declare eslint as a peer dependency. npm >= 7 auto-installs
# peers, but yarn classic never does and pnpm can be configured not to — and
# without eslint the pre-commit hook dead-ends with "run setup.sh first".
ensure_eslint() {
  if (cd "${PROJECT_ROOT}" && node -e "require.resolve('eslint')" 2>/dev/null); then
    return 0
  fi
  warn "ESLint is not installed (your package manager did not auto-install the plugin's peer dependency)."
  info "Installing eslint@^9 …"
  install_deps "eslint@^9"
}

# Version pins below MUST match FRAMEWORK_DEPS in src/recipes/r2-commit-gate.ts
# (the CLI installer) — the two install paths must produce the same lint baseline.
case "${FRAMEWORK}" in
  react)
    info "Installing eslint-plugin-jsx-a11y@^6.9.0 …"
    install_deps "eslint-plugin-jsx-a11y@^6.9.0"
    ensure_eslint
    ;;
  vue)
    info "Installing eslint-plugin-vuejs-accessibility@^2.5.0 eslint-plugin-vue …"
    install_deps "eslint-plugin-vuejs-accessibility@^2.5.0" "eslint-plugin-vue"
    ensure_eslint
    ;;
  svelte)
    # Svelte plugin v3 requires Node >= 18.20.4
    NODE_VERSION="$(node --version | sed 's/v//')"
    NODE_MAJOR="$(echo "${NODE_VERSION}" | cut -d. -f1)"
    NODE_MINOR="$(echo "${NODE_VERSION}" | cut -d. -f2)"
    NODE_PATCH="$(echo "${NODE_VERSION}" | cut -d. -f3)"
    if [ "${NODE_MAJOR}" -lt 18 ] || \
       { [ "${NODE_MAJOR}" -eq 18 ] && [ "${NODE_MINOR}" -lt 20 ]; } || \
       { [ "${NODE_MAJOR}" -eq 18 ] && [ "${NODE_MINOR}" -eq 20 ] && [ "${NODE_PATCH}" -lt 4 ]; }; then
      warn "eslint-plugin-svelte v3 requires Node >= 18.20.4 (you have ${NODE_VERSION}). Upgrade Node or switch to a compatible version."
    fi
    info "Installing eslint-plugin-svelte@^3.0.0 …"
    install_deps "eslint-plugin-svelte@^3.0.0"
    ensure_eslint
    ;;
  angular)
    info "Installing @angular-eslint/eslint-plugin-template@^19.0.0 @angular-eslint/template-parser@^19.0.0 …"
    install_deps "@angular-eslint/eslint-plugin-template@^19.0.0" "@angular-eslint/template-parser@^19.0.0"
    ensure_eslint
    ;;
  unknown)
    warn "Framework not detected. Install the appropriate ESLint a11y plugin manually:"
    echo "  React:   ${PM} add --save-dev eslint-plugin-jsx-a11y@^6.9.0"
    echo "  Vue:     ${PM} add --save-dev eslint-plugin-vuejs-accessibility@^2.5.0 eslint-plugin-vue"
    echo "  Svelte:  ${PM} add --save-dev eslint-plugin-svelte@^3.0.0"
    echo "  Angular: ${PM} add --save-dev @angular-eslint/eslint-plugin-template@^19.0.0 @angular-eslint/template-parser@^19.0.0"
    ;;
esac

# ---------------------------------------------------------------------------
# Step 7: Patch CLAUDE.md (append if exists, create if not)
# ---------------------------------------------------------------------------
CLAUDE_MD="${PROJECT_ROOT}/CLAUDE.md"
A11Y_MARKER="@.a11y/context.md"

if [ -f "${CLAUDE_MD}" ]; then
  if grep -qF "${A11Y_MARKER}" "${CLAUDE_MD}"; then
    info "CLAUDE.md already contains a11y context reference — skipping"
  else
    printf "\n\n%s\n" "${A11Y_MARKER}" >> "${CLAUDE_MD}"
    info "CLAUDE.md: appended a11y context reference"
  fi
else
  cp "${A11Y_DIR}/wrappers/CLAUDE.md" "${CLAUDE_MD}"
  info "CLAUDE.md: created from .a11y/wrappers/CLAUDE.md"
fi

# ---------------------------------------------------------------------------
# Step 8: Create .cursorrules (never overwrites)
# ---------------------------------------------------------------------------
CURSORRULES="${PROJECT_ROOT}/.cursorrules"
if [ -f "${CURSORRULES}" ]; then
  info ".cursorrules already exists — skipping"
else
  cp "${A11Y_DIR}/wrappers/.cursorrules" "${CURSORRULES}"
  info ".cursorrules: created from .a11y/wrappers/.cursorrules"
fi

# ---------------------------------------------------------------------------
# Step 9: Create AGENTS.md (never overwrites)
# ---------------------------------------------------------------------------
AGENTS_MD="${PROJECT_ROOT}/AGENTS.md"
if [ -f "${AGENTS_MD}" ]; then
  info "AGENTS.md already exists — skipping"
else
  cp "${A11Y_DIR}/wrappers/AGENTS.md" "${AGENTS_MD}"
  info "AGENTS.md: created from .a11y/wrappers/AGENTS.md"
fi

# ---------------------------------------------------------------------------
# Step 9b: Create .github/copilot-instructions.md (append if exists)
# ---------------------------------------------------------------------------
COPILOT_MD="${PROJECT_ROOT}/.github/copilot-instructions.md"
mkdir -p "${PROJECT_ROOT}/.github"
if [ -f "${COPILOT_MD}" ]; then
  if grep -qF ".a11y/context.md" "${COPILOT_MD}"; then
    info ".github/copilot-instructions.md already references a11y context — skipping"
  else
    printf "\n\n" >> "${COPILOT_MD}"
    cat "${A11Y_DIR}/wrappers/copilot-instructions.md" >> "${COPILOT_MD}"
    info ".github/copilot-instructions.md: appended a11y context reference"
  fi
else
  cp "${A11Y_DIR}/wrappers/copilot-instructions.md" "${COPILOT_MD}"
  info ".github/copilot-instructions.md: created from .a11y/wrappers/copilot-instructions.md"
fi

# ---------------------------------------------------------------------------
# Step 10: Summary
# ---------------------------------------------------------------------------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  a11y-sdk setup complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Layer 1 (AI context):  active immediately"
echo "  Layer 2 (static hook): active on next commit"
echo "  Layer 3 (audit):       run 'node .a11y/scripts/audit.cjs <url>'"
echo "                         and 'node .a11y/scripts/behave.cjs <url>'"
echo ""
echo "  Config:  .a11y/config/a11y.config.json"
echo "  Rules:   .a11y/rules/"
echo ""
