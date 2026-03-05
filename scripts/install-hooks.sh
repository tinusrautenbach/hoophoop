#!/bin/bash

# Install git hooks for Basketball Scoring App

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

echo "🔧 Installing git hooks..."
echo "==========================="

# Create hooks directory if it doesn't exist
mkdir -p "$GIT_HOOKS_DIR"

# Copy pre-push hook
if [ -f "$SCRIPT_DIR/../githooks/pre-push" ]; then
    cp "$SCRIPT_DIR/../githooks/pre-push" "$GIT_HOOKS_DIR/pre-push"
    chmod +x "$GIT_HOOKS_DIR/pre-push"
    echo "✓ Installed pre-push hook"
else
    echo "✗ Pre-push hook not found at: $SCRIPT_DIR/../githooks/pre-push"
    exit 1
fi

echo ""
echo "✅ Git hooks installed successfully!"
echo ""
echo "The pre-push hook will:"
echo "  - Run CI checks only when pushing to 'main' branch"
echo "  - Allow pushes to other branches without checks"
echo ""
echo "To bypass the hook in emergencies: git push --no-verify"
