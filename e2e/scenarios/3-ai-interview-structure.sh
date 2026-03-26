#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# E2E Test: AI Interview Structure
# Issue:    #3
# AC:       AC-3
# Flow:     Send first message → AI responds with interview question
# ============================================================

# --- Config ---
BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
API_URL="${E2E_API_URL:-http://localhost:8788}"
SESSION="e2e-3-ai-interview"
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

# --- Cleanup on exit ---
cleanup() {
  agent-browser --session "$SESSION" close 2>/dev/null || true
}
trap cleanup EXIT

# ============================================================
# TEST STEPS
# ============================================================

echo ":: Running: AI Interview Structure"

# Step 1: Get the latest AI response from the API (messages already exist from prior test)
MESSAGES=$(curl -s "$API_URL/chat/$SLUG/messages" 2>/dev/null)
MSG_COUNT=$(echo "$MESSAGES" | jq 'length')

if [[ "$MSG_COUNT" -lt 2 ]]; then
  echo "FAIL: Expected at least 2 messages (user + assistant), got $MSG_COUNT"
  exit 1
fi
echo "  ok: Found $MSG_COUNT messages in conversation"

# Step 2: Get the last assistant message
LAST_ASSISTANT=$(echo "$MESSAGES" | jq -r '[.[] | select(.role == "assistant")] | last | .content // empty')

if [[ -z "$LAST_ASSISTANT" ]]; then
  echo "FAIL: No assistant message found"
  exit 1
fi
echo "  ok: Assistant message found"

# Step 3: Verify the AI response contains a question (discovery interview pattern)
# A discovery interview should ask questions to understand the project
HAS_QUESTION=false
if echo "$LAST_ASSISTANT" | grep -qE '\?'; then
  HAS_QUESTION=true
fi

if [[ "$HAS_QUESTION" != "true" ]]; then
  echo "FAIL: AI response does not contain a question mark — not following interview structure"
  echo "  Response: $LAST_ASSISTANT"
  exit 1
fi
echo "  ok: AI response contains a question (interview structure)"

# Step 4: Verify the response is substantive (not just a one-word reply)
WORD_COUNT=$(echo "$LAST_ASSISTANT" | wc -w | tr -d ' ')
if [[ "$WORD_COUNT" -lt 10 ]]; then
  echo "FAIL: AI response too short ($WORD_COUNT words) — not a proper interview response"
  echo "  Response: $LAST_ASSISTANT"
  exit 1
fi
echo "  ok: AI response is substantive ($WORD_COUNT words)"

# Step 5: Visual verification — open page and confirm AI message renders
agent-browser --session "$SESSION" open "$BASE_URL/p/$SLUG"
agent-browser --session "$SESSION" wait --load networkidle
sleep 1

PAGE_TEXT=$(agent-browser --session "$SESSION" get text "body" --json 2>/dev/null | jq -r '.data.text // empty')

# Check a snippet of the assistant response appears on page
SNIPPET=$(echo "$LAST_ASSISTANT" | head -1 | cut -c1-40)
if [[ "$PAGE_TEXT" != *"$SNIPPET"* ]]; then
  echo "FAIL: AI response not rendered on chat page"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-ai-interview.png"
  exit 1
fi
echo "  ok: AI response visible on page"

# Step 6: Evidence
agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/pass-ai-interview.png"

echo "PASS: AI Interview Structure"
exit 0
