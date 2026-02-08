#!/bin/bash

# Basketball Scoring App - Pre-commit Security & Quality Check Script
# Run this script before committing to ensure code quality and security

set -e  # Exit on any error

echo "🔒 Running security and quality checks..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if all checks passed
ALL_CHECKS_PASSED=true

# Function to print status
print_status() {
    if [ "$2" == "pass" ]; then
        echo -e "${GREEN}✓${NC} $1"
    elif [ "$2" == "warn" ]; then
        echo -e "${YELLOW}⚠${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        ALL_CHECKS_PASSED=false
    fi
}

# 1. Run linting
echo ""
echo "1. Running linter..."
if command -v npm &> /dev/null; then
    if npm run lint &> /dev/null; then
        print_status "Linting passed" "pass"
    else
        print_status "Linting failed - run 'npm run lint' to see issues" "fail"
    fi
else
    print_status "npm not found - skipping lint" "warn"
fi

# 2. Run type checking
echo ""
echo "2. Running type checks..."
if npm run typecheck &> /dev/null; then
    print_status "Type checking passed" "pass"
else
    print_status "Type checking failed - run 'npm run typecheck' to see issues" "fail"
fi

# 3. Run security audit
echo ""
echo "3. Running security audit..."
if command -v npm &> /dev/null; then
    if npm audit --audit-level=high &> /dev/null; then
        print_status "Security audit passed (no high/critical vulnerabilities)" "pass"
    else
        print_status "Security vulnerabilities found - run 'npm audit' to review" "warn"
    fi
else
    print_status "npm not found - skipping security audit" "warn"
fi

# 4. Run tests
echo ""
echo "4. Running tests..."
if npm test &> /dev/null; then
    print_status "Tests passed" "pass"
else
    print_status "Tests failed - run 'npm test' to see failures" "fail"
fi

# 5. Check for secrets (basic patterns)
echo ""
echo "5. Checking for potential secrets..."
SECRETS_FOUND=false
if command -v git &> /dev/null; then
    # Check staged files for potential secrets
    SECRET_PATTERNS=(
        "AWS_ACCESS_KEY"
        "AWS_SECRET"
        "PRIVATE_KEY"
        "DB_PASSWORD"
        "api_key"
        "apikey"
        "secret_token"
        "auth_token"
    )

    for pattern in "${SECRET_PATTERNS[@]}"; do
        if git diff --cached --name-only | xargs grep -l "$pattern" 2>/dev/null | grep -v ".test.ts" | grep -v ".spec.ts" | grep -v "example" | grep -v "template" | grep -v "sample" | grep -v "_mock" &> /dev/null; then
            print_status "Potential secret found matching '$pattern'" "warn"
            SECRETS_FOUND=true
        fi
    done

    if [ "$SECRETS_FOUND" == "false" ]; then
        print_status "No obvious secrets detected" "pass"
    fi
else
    print_status "git not found - skipping secret check" "warn"
fi

# Summary
echo ""
echo "========================================"
if [ "$ALL_CHECKS_PASSED" == "true" ]; then
    echo -e "${GREEN}✅ All checks passed! Ready to commit.${NC}"
    echo ""
else
    echo -e "${RED}❌ Some checks failed. Please review the issues above.${NC}"
    echo ""
    read -p "Do you want to commit anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting commit."
        exit 1
    fi
fi

# Get commit message
echo "Enter commit message:"
read COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
    echo "No commit message provided. Aborting."
    exit 1
fi

# Commit and push
echo ""
echo "📦 Committing and pushing..."
git add .
git commit -m "$COMMIT_MSG"
git push

echo ""
echo -e "${GREEN}✅ Successfully committed and pushed!${NC}"
