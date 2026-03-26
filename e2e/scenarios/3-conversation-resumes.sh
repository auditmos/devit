#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# E2E Test: Conversation Resumes
# Issue:    #3
# AC:       AC-5, AC-6
# Flow:     Close tab → reopen → history loads → AI continues
# ============================================================

# --- Config ---
BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
API_URL="${E2E_API_URL:-http://localhost:8788}"
SESSION="e2e-3-resumes"
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

echo ":: Running: Conversation Resumes"

# Step 1: Get existing messages from API (baseline)
MESSAGES_BEFORE=$(curl -s "$API_URL/chat/$SLUG/messages" 2>/dev/null)
MSG_COUNT_BEFORE=$(echo "$MESSAGES_BEFORE" | jq 'length')
echo "  ok: Baseline: $MSG_COUNT_BEFORE messages exist"

# Get the user message content we expect to see
FIRST_USER_MSG=$(echo "$MESSAGES_BEFORE" | jq -r '[.[] | select(.role == "user")] | first | .content // empty')
if [[ -z "$FIRST_USER_MSG" ]]; then
  echo "FAIL: No user messages found — need prior conversation"
  exit 1
fi

# Step 2: Open the page in a fresh browser session (simulates "reopening the link")
agent-browser --session "$SESSION" open "$BASE_URL/p/$SLUG"
agent-browser --session "$SESSION" wait --load networkidle
sleep 2

# Step 3: Verify conversation history loaded on page
PAGE_TEXT=$(agent-browser --session "$SESSION" get text "body" --json 2>/dev/null | jq -r '.data.text // empty')

# Check user message from prior session is visible
FIRST_USER_SNIPPET=$(echo "$FIRST_USER_MSG" | cut -c1-30)
if [[ "$PAGE_TEXT" != *"$FIRST_USER_SNIPPET"* ]]; then
  echo "FAIL: Previous user message not loaded on page"
  echo "  Expected to see: $FIRST_USER_SNIPPET..."
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-resumes.png"
  exit 1
fi
echo "  ok: Previous user message visible"

# Check assistant response from prior session is visible
FIRST_ASST_MSG=$(echo "$MESSAGES_BEFORE" | jq -r '[.[] | select(.role == "assistant")] | first | .content // empty')
ASST_SNIPPET=$(echo "$FIRST_ASST_MSG" | head -1 | cut -c1-30)
if [[ "$PAGE_TEXT" != *"$ASST_SNIPPET"* ]]; then
  echo "FAIL: Previous assistant message not loaded on page"
  echo "  Expected to see: $ASST_SNIPPET..."
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-resumes.png"
  exit 1
fi
echo "  ok: Previous assistant message visible"

# Step 4: Verify "Welcome" empty state is NOT shown (conversation exists)
if [[ "$PAGE_TEXT" == *"Welcome!"* ]] && [[ "$PAGE_TEXT" == *"Send a message to start"* ]]; then
  echo "FAIL: Empty state shown despite existing conversation"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-resumes.png"
  exit 1
fi
echo "  ok: Empty state not shown (conversation loaded)"

# Step 5: Send a follow-up message to verify AI continues
FOLLOWUP_MSG="The app should support creating tasks with priorities and due dates"
agent-browser --session "$SESSION" find placeholder "Type your message..." fill "$FOLLOWUP_MSG"
agent-browser --session "$SESSION" find role button click --name "Send"
echo "  ok: Follow-up message sent"

# Wait for AI response
ATTEMPTS=0
MAX_ATTEMPTS=15
AI_RESPONDED=false

while [[ $ATTEMPTS -lt $MAX_ATTEMPTS ]]; do
  sleep 2
  PAGE_TEXT=$(agent-browser --session "$SESSION" get text "body" --json 2>/dev/null | jq -r '.data.text // empty')
  if [[ "$PAGE_TEXT" == *"$FOLLOWUP_MSG"* ]]; then
    # Check for new content after the follow-up message
    FOLLOWUP_POS=$(echo "$PAGE_TEXT" | grep -n "$FOLLOWUP_MSG" | head -1 | cut -d: -f1)
    if [[ -n "$FOLLOWUP_POS" ]]; then
      AFTER=$(echo "$PAGE_TEXT" | tail -n +$((FOLLOWUP_POS + 1)) | head -20)
      CONTENT_AFTER=$(echo "$AFTER" | grep -v "^Send$" | grep -v "TanStack" | grep -v "^-$" | sed '/^$/d')
      if [[ -n "$CONTENT_AFTER" ]]; then
        AI_RESPONDED=true
        break
      fi
    fi
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
done

if [[ "$AI_RESPONDED" != "true" ]]; then
  echo "FAIL: AI did not respond to follow-up within 30 seconds"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-resumes.png"
  exit 1
fi
echo "  ok: AI responded to follow-up"

# Step 6: Verify message count increased (proves continuity)
MESSAGES_AFTER=$(curl -s "$API_URL/chat/$SLUG/messages" 2>/dev/null)
MSG_COUNT_AFTER=$(echo "$MESSAGES_AFTER" | jq 'length')

EXPECTED_MIN=$((MSG_COUNT_BEFORE + 2))
if [[ "$MSG_COUNT_AFTER" -lt "$EXPECTED_MIN" ]]; then
  echo "FAIL: Expected at least $EXPECTED_MIN messages after follow-up, got $MSG_COUNT_AFTER"
  exit 1
fi
echo "  ok: Message count increased ($MSG_COUNT_BEFORE -> $MSG_COUNT_AFTER)"

# Step 7: Evidence
agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/pass-resumes.png"

echo "PASS: Conversation Resumes"
exit 0
