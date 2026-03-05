#!/bin/bash

# Install git hooks for Basketball Scoring App

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

echo "🔧 Installing git hooks..."
echo "==========================="

# Create hooks directory if it doesn't exist
mkdir -p "$GIT_HOOKS_DIR"

# Create pre-push hook that runs CI checks before pushing to main
cat > "$GIT_HOOKS_DIR/pre-push" << 'HOOKEOF'
#!/bin/sh
# Pre-push hook to run CI checks before pushing to main
# Only runs when the target branch is 'main'

# Get the target branch name
remote="$1"
url="$2"

# Read local and remote refs
while read local_ref local_sha remote_ref remote_sha
do
    # Check if pushing to main branch
    if [ "$remote_ref" = "refs/heads/main" ]; then
        echo "🔍 Pushing to main branch - running CI checks..."
        echo ""
        
        # Run the full CI check
        npm run ci:check
        
        # Check the exit code
        if [ $? -ne 0 ]; then
            echo ""
            echo "❌ CI checks failed!"
            echo "Please fix the errors above before pushing to main."
            echo ""
            echo "Tip: You can run 'npm run ci:check' locally to verify fixes."
            exit 1
        fi
        
        echo ""
        echo "✅ All CI checks passed! Proceeding with push to main."
        echo ""
    fi
done

exit 0
HOOKEOF

chmod +x "$GIT_HOOKS_DIR/pre-push"
echo "✓ Installed pre-push hook"

echo ""
echo "✅ Git hooks installed successfully!"
echo ""
echo "The pre-push hook will:"
echo "  - Run CI checks only when pushing to 'main' branch"
echo "  - Allow pushes to other branches without checks"
echo ""
echo "To bypass the hook in emergencies: git push --no-verify"
