#!/bin/bash

# Install git hooks for Basketball Scoring App

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SOURCE="$SCRIPT_DIR/pre-commit-hook"
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

echo "🔧 Installing git hooks..."
echo "==========================="

# Create hooks directory if it doesn't exist
mkdir -p "$GIT_HOOKS_DIR"

# Install pre-commit hook
if [ -f "$HOOK_SOURCE" ]; then
    cp "$HOOK_SOURCE" "$GIT_HOOKS_DIR/pre-commit"
    chmod +x "$GIT_HOOKS_DIR/pre-commit"
    echo "✓ Installed pre-commit hook"
else
    echo "✗ Pre-commit hook not found at: $HOOK_SOURCE"
fi

# Make this script executable
chmod +x "$SCRIPT_DIR/pre-commit-hook" 2>/dev/null || true

echo ""
echo "✅ Git hooks installed successfully!"
echo ""
echo "To use:"
echo "  - Run './scripts/pre-commit-check.sh' manually for interactive mode"
echo "  - Hooks run automatically on 'git commit'"
