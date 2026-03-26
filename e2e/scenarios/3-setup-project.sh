#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# E2E Test: Setup Project
# Issue:    #3
# AC:       (setup)
# Flow:     Create a fresh project via API for test isolation
# ============================================================

# --- Config ---
BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
API_URL="${E2E_API_URL:-http://localhost:8788}"
SESSION="e2e-3-setup"
EVIDENCE_DIR="./e2e/evidence"
STATE_DIR="./e2e/state"

mkdir -p "$EVIDENCE_DIR" "$STATE_DIR"

[[ -f .env.e2e ]] && source .env.e2e

API_TOKEN="${E2E_API_TOKEN:-1522b4d2-c3e7-4c6c-949f-d0b49bdc09b8}"

# --- Cleanup on exit ---
cleanup() {
  agent-browser --session "$SESSION" close 2>/dev/null || true
}
trap cleanup EXIT

# ============================================================
# TEST STEPS
# ============================================================

echo ":: Running: Setup Project"

# Step 1: Create a unique project via API
PROJECT_NAME="E2E Test $(date +%s)"
echo "  Creating project: $PROJECT_NAME"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$API_URL/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d "{\"name\": \"$PROJECT_NAME\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" != "201" ]]; then
  echo "FAIL: Project creation returned HTTP $HTTP_CODE"
  echo "  Response: $BODY"
  exit 1
fi
echo "  ok: Project created (HTTP 201)"

# Step 2: Extract slug from response
SLUG=$(echo "$BODY" | jq -r '.slug // .data.slug // empty')
if [[ -z "$SLUG" ]]; then
  echo "FAIL: Could not extract slug from response"
  echo "  Response: $BODY"
  exit 1
fi
echo "  ok: Slug = $SLUG"

# Step 3: Save slug for dependent tests
echo "$SLUG" > "$STATE_DIR/project-slug.txt"
echo "  ok: Slug saved to $STATE_DIR/project-slug.txt"

# Step 4: Verify project is accessible via frontend
agent-browser --session "$SESSION" open "$BASE_URL/p/$SLUG"
agent-browser --session "$SESSION" wait --load networkidle

PAGE_TEXT=$(agent-browser --session "$SESSION" get text "body" --json 2>/dev/null | jq -r '.data.text // empty')
if [[ "$PAGE_TEXT" != *"Project Interview"* ]]; then
  echo "FAIL: Chat page did not load for slug $SLUG"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-setup.png"
  exit 1
fi
echo "  ok: Chat page loads at /p/$SLUG"

# Step 5: Evidence
agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/pass-setup.png"

echo "PASS: Setup Project"
exit 0
