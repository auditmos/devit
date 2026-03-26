#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# E2E Test: Send and Receive Message
# Issue:    #3
# AC:       AC-2
# Flow:     Type message → send → see user msg + AI response
# ============================================================

# --- Config ---
BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
SESSION="e2e-3-send-receive"
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

echo ":: Running: Send and Receive Message"

# Step 1: Open chat page
agent-browser --session "$SESSION" open "$BASE_URL/p/$SLUG"
agent-browser --session "$SESSION" wait --load networkidle

# Step 2: Type a message
USER_MSG="I want to build a task management application"
agent-browser --session "$SESSION" find placeholder "Type your message..." fill "$USER_MSG"
echo "  ok: Message typed"

# Step 3: Click Send
agent-browser --session "$SESSION" find role button click --name "Send"
echo "  ok: Send clicked"

# Step 4: Wait for AI response (up to 30 seconds)
ATTEMPTS=0
MAX_ATTEMPTS=15
AI_RESPONDED=false

while [[ $ATTEMPTS -lt $MAX_ATTEMPTS ]]; do
  sleep 2
  PAGE_TEXT=$(agent-browser --session "$SESSION" get text "body" --json 2>/dev/null | jq -r '.data.text // empty')

  # Check if user message is visible
  if [[ "$PAGE_TEXT" == *"$USER_MSG"* ]]; then
    # Count non-empty text blocks to detect AI response (more than just user msg + header)
    # The AI response should appear as additional text beyond the user message
    USER_MSG_POS=$(echo "$PAGE_TEXT" | grep -n "$USER_MSG" | head -1 | cut -d: -f1)
    if [[ -n "$USER_MSG_POS" ]]; then
      # Check if there's substantial text after the user message area
      AFTER_USER=$(echo "$PAGE_TEXT" | tail -n +$((USER_MSG_POS + 1)) | head -20)
      # Filter out just UI chrome (Send button text, devtools)
      CONTENT_AFTER=$(echo "$AFTER_USER" | grep -v "^Send$" | grep -v "TanStack" | grep -v "^-$" | sed '/^$/d')
      if [[ -n "$CONTENT_AFTER" ]]; then
        AI_RESPONDED=true
        break
      fi
    fi
  fi

  ATTEMPTS=$((ATTEMPTS + 1))
done

if [[ "$AI_RESPONDED" != "true" ]]; then
  echo "FAIL: AI did not respond within 30 seconds"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-send-receive.png"
  exit 1
fi
echo "  ok: AI response received"

# Step 5: Verify user message is displayed
PAGE_TEXT=$(agent-browser --session "$SESSION" get text "body" --json 2>/dev/null | jq -r '.data.text // empty')
if [[ "$PAGE_TEXT" != *"$USER_MSG"* ]]; then
  echo "FAIL: User message not visible on page"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-send-receive.png"
  exit 1
fi
echo "  ok: User message displayed"

# Step 6: Verify input is cleared after send
SNAPSHOT=$(agent-browser --session "$SESSION" snapshot -i 2>/dev/null)
INPUT_VALUE=$(echo "$SNAPSHOT" | grep 'textbox "Type your message..."' | grep -o '\]: .*' || true)
if [[ "$INPUT_VALUE" == *"$USER_MSG"* ]]; then
  echo "FAIL: Input was not cleared after sending"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-send-receive.png"
  exit 1
fi
echo "  ok: Input cleared after send"

# Step 7: Evidence
agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/pass-send-receive.png"

echo "PASS: Send and Receive Message"
exit 0
