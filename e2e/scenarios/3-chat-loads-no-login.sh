#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# E2E Test: Chat Loads Without Login
# Issue:    #3
# AC:       AC-1
# Flow:     Open project link → see chat UI → no login required
# ============================================================

# --- Config ---
BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
SESSION="e2e-3-chat-loads"
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

echo ":: Running: Chat Loads Without Login"

# Step 1: Open the project link directly (no prior login)
agent-browser --session "$SESSION" open "$BASE_URL/p/$SLUG"
agent-browser --session "$SESSION" wait --load networkidle

# Step 2: Verify we are NOT redirected to a login page
CURRENT_URL=$(agent-browser --session "$SESSION" get url --json 2>/dev/null | jq -r '.data.url // empty')
if [[ "$CURRENT_URL" == *"signin"* ]] || [[ "$CURRENT_URL" == *"login"* ]]; then
  echo "FAIL: Redirected to login page: $CURRENT_URL"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-chat-loads.png"
  exit 1
fi
echo "  ok: No login redirect (URL: $CURRENT_URL)"

# Step 3: Verify chat UI elements are present
SNAPSHOT=$(agent-browser --session "$SESSION" snapshot -i 2>/dev/null)

# Check heading
if ! echo "$SNAPSHOT" | grep -q 'heading "Project Interview"'; then
  echo "FAIL: Missing 'Project Interview' heading"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-chat-loads.png"
  exit 1
fi
echo "  ok: 'Project Interview' heading present"

# Check message input
if ! echo "$SNAPSHOT" | grep -q 'textbox "Type your message..."'; then
  echo "FAIL: Missing message input textbox"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-chat-loads.png"
  exit 1
fi
echo "  ok: Message input present"

# Check send button
if ! echo "$SNAPSHOT" | grep -q 'button "Send"'; then
  echo "FAIL: Missing Send button"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-chat-loads.png"
  exit 1
fi
echo "  ok: Send button present"

# Step 4: Verify welcome message (empty state)
PAGE_TEXT=$(agent-browser --session "$SESSION" get text "body" --json 2>/dev/null | jq -r '.data.text // empty')
if [[ "$PAGE_TEXT" != *"Welcome"* ]]; then
  echo "FAIL: Missing 'Welcome' empty state text"
  agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/fail-chat-loads.png"
  exit 1
fi
echo "  ok: Welcome empty state shown"

# Step 5: Evidence
agent-browser --session "$SESSION" screenshot "$EVIDENCE_DIR/pass-chat-loads.png"

echo "PASS: Chat Loads Without Login"
exit 0
