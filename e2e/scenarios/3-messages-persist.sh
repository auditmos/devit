#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# E2E Test: Messages Persist
# Issue:    #3
# AC:       AC-4
# Flow:     Check API for persisted user + assistant messages
# ============================================================

# --- Config ---
API_URL="${E2E_API_URL:-http://localhost:8788}"
EVIDENCE_DIR="./e2e/evidence"
STATE_DIR="./e2e/state"

mkdir -p "$EVIDENCE_DIR" "$STATE_DIR"

[[ -f .env.e2e ]] && source .env.e2e

# --- Load project slug ---
SLUG_FILE="$STATE_DIR/project-slug.txt"
if [[ ! -f "$SLUG_FILE" ]]; then
  echo "FAIL: No project slug found. Run 3-setup-project.sh first."
  exit 1
fi
SLUG=$(cat "$SLUG_FILE")

# ============================================================
# TEST STEPS
# ============================================================

echo ":: Running: Messages Persist"

# Step 1: Fetch messages from API
MESSAGES=$(curl -s "$API_URL/chat/$SLUG/messages" 2>/dev/null)

if ! echo "$MESSAGES" | jq empty 2>/dev/null; then
  echo "FAIL: API response is not valid JSON"
  echo "  Response: $MESSAGES"
  exit 1
fi
echo "  ok: API returns valid JSON"

# Step 2: Check that messages exist
MSG_COUNT=$(echo "$MESSAGES" | jq 'length')
if [[ "$MSG_COUNT" -lt 2 ]]; then
  echo "FAIL: Expected at least 2 messages, got $MSG_COUNT"
  exit 1
fi
echo "  ok: $MSG_COUNT messages persisted"

# Step 3: Check for user messages
USER_COUNT=$(echo "$MESSAGES" | jq '[.[] | select(.role == "user")] | length')
if [[ "$USER_COUNT" -lt 1 ]]; then
  echo "FAIL: No user messages found in database"
  exit 1
fi
echo "  ok: $USER_COUNT user message(s) persisted"

# Step 4: Check for assistant messages
ASST_COUNT=$(echo "$MESSAGES" | jq '[.[] | select(.role == "assistant")] | length')
if [[ "$ASST_COUNT" -lt 1 ]]; then
  echo "FAIL: No assistant messages found in database"
  exit 1
fi
echo "  ok: $ASST_COUNT assistant message(s) persisted"

# Step 5: Check messages have required fields
FIRST_MSG=$(echo "$MESSAGES" | jq '.[0]')
HAS_ID=$(echo "$FIRST_MSG" | jq -r '.id // empty')
HAS_ROLE=$(echo "$FIRST_MSG" | jq -r '.role // empty')
HAS_CONTENT=$(echo "$FIRST_MSG" | jq -r '.content // empty')
HAS_CREATED=$(echo "$FIRST_MSG" | jq -r '.createdAt // empty')

MISSING=""
[[ -z "$HAS_ID" ]] && MISSING="$MISSING id"
[[ -z "$HAS_ROLE" ]] && MISSING="$MISSING role"
[[ -z "$HAS_CONTENT" ]] && MISSING="$MISSING content"
[[ -z "$HAS_CREATED" ]] && MISSING="$MISSING createdAt"

if [[ -n "$MISSING" ]]; then
  echo "FAIL: Message missing fields:$MISSING"
  echo "  Message: $FIRST_MSG"
  exit 1
fi
echo "  ok: Messages have all required fields (id, role, content, createdAt)"

# Step 6: Check messages are in chronological order
DATES=$(echo "$MESSAGES" | jq -r '.[].createdAt')
SORTED_DATES=$(echo "$DATES" | sort)
if [[ "$DATES" != "$SORTED_DATES" ]]; then
  echo "FAIL: Messages are not in chronological order"
  exit 1
fi
echo "  ok: Messages in chronological order"

echo "PASS: Messages Persist"
exit 0
