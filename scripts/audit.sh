#!/bin/bash
# Comprehensive end-to-end audit script.
# Starts the dev server, waits for it, runs all tests, reports results.
cd /home/z/my-project

pkill -f "next dev" 2>/dev/null
sleep 2
> /home/z/my-project/dev.log

# Start server
node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready (up to 30s)
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/api/workspaces | grep -q "success"; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 1
done

PASS=0
FAIL=0
ERRORS=""

check() {
  local name="$1"
  local result="$2"
  if echo "$result" | grep -q '"success":true'; then
    echo "  ✓ $name"
    PASS=$((PASS+1))
  else
    echo "  ✗ $name"
    echo "    → $result" | head -c 200
    echo ""
    FAIL=$((FAIL+1))
    ERRORS="$ERRORS\n  - $name"
  fi
}

echo ""
echo "=== GET endpoints ==="
check "dashboard" "$(curl -s http://localhost:3000/api/dashboard)"
check "workspaces" "$(curl -s http://localhost:3000/api/workspaces)"
check "brands" "$(curl -s http://localhost:3000/api/brands)"
check "campaigns" "$(curl -s http://localhost:3000/api/campaigns)"
check "assets" "$(curl -s http://localhost:3000/api/assets)"
check "posts (all)" "$(curl -s http://localhost:3000/api/posts)"
check "posts (pending)" "$(curl -s 'http://localhost:3000/api/posts?status=pending_approval')"
check "calendar" "$(curl -s http://localhost:3000/api/calendar)"
check "analytics" "$(curl -s http://localhost:3000/api/analytics)"
check "conversation" "$(curl -s http://localhost:3000/api/conversation)"
check "distribution/accounts" "$(curl -s http://localhost:3000/api/distribution/accounts)"
check "audit" "$(curl -s http://localhost:3000/api/audit)"

echo ""
echo "=== Upload ==="
check "upload image" "$(curl -s -X POST http://localhost:3000/api/assets/upload -F 'files=@/tmp/test-upload.jpg')"

echo ""
echo "=== Mutations ==="

# Get IDs for mutations
WS_ID=$(curl -s http://localhost:3000/api/workspaces | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
BRAND_ID=$(curl -s http://localhost:3000/api/brands | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
PENDING_POST_ID=$(curl -s 'http://localhost:3000/api/posts?status=pending_approval' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d['data'] else '')")
PENDING_ASSET_ID=$(curl -s http://localhost:3000/api/assets | python3 -c "import sys,json; d=json.load(sys.stdin); print([a['id'] for a in d['data'] if a['analysisStatus']=='pending'][0] if [a for a in d['data'] if a['analysisStatus']=='pending'] else '')")

echo "  WS_ID=$WS_ID BRAND_ID=$BRAND_ID POST_ID=$PENDING_POST_ID ASSET_ID=$PENDING_ASSET_ID"

check "update workspace" "$(curl -s -X PATCH http://localhost:3000/api/workspaces/$WS_ID -H 'Content-Type: application/json' -d '{"approvalMode":"assisted"}')"
check "update brand" "$(curl -s -X PATCH http://localhost:3000/api/brands/$BRAND_ID -H 'Content-Type: application/json' -d '{"description":"Luxury local fashion retailer."}')"
check "update post" "$(curl -s -X PATCH http://localhost:3000/api/posts/$PENDING_POST_ID -H 'Content-Type: application/json' -d '{"caption":"Updated test caption."}')"
check "upload logo" "$(curl -s -X POST http://localhost:3000/api/workspaces/$WS_ID/logo -F 'file=@/tmp/test-logo.png')"
check "connect account" "$(curl -s -X POST http://localhost:3000/api/distribution/accounts -H 'Content-Type: application/json' -d '{"platform":"facebook","accountName":"Test Page","destination":{"type":"page","name":"Test Page"}}')"

# Get the new account ID and test disconnect
NEW_ACCT=$(curl -s http://localhost:3000/api/distribution/accounts | python3 -c "import sys,json; d=json.load(sys.stdin); print([a['id'] for a in d['data'] if a['name']=='Test Page'][0] if [a for a in d['data'] if a['name']=='Test Page'] else '')")
if [ -n "$NEW_ACCT" ]; then
  check "disconnect account" "$(curl -s -X DELETE http://localhost:3000/api/distribution/accounts/$NEW_ACCT)"
fi

# Test add destination
ACCT_ID=$(curl -s http://localhost:3000/api/distribution/accounts | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
check "add destination" "$(curl -s -X POST http://localhost:3000/api/distribution/destinations -H 'Content-Type: application/json' -d "{\"socialAccountId\":\"$ACCT_ID\",\"type\":\"group\",\"name\":\"Test Group\"}")"

# Get the new dest ID and test remove
NEW_DEST=$(curl -s http://localhost:3000/api/distribution/accounts | python3 -c "import sys,json; d=json.load(sys.stdin); print([x['id'] for x in d['data'][0]['destinations'] if x['name']=='Test Group'][0] if [x for x in d['data'][0]['destinations'] if x['name']=='Test Group'] else '')")
if [ -n "$NEW_DEST" ]; then
  check "remove destination" "$(curl -s -X DELETE http://localhost:3000/api/distribution/destinations/$NEW_DEST)"
fi

echo ""
echo "=== AI-powered endpoints (may take 10-60s each) ==="
if [ -n "$PENDING_ASSET_ID" ]; then
  echo "  Analyzing asset (VLM call)..."
  check "analyze asset" "$(curl -s -X POST http://localhost:3000/api/assets/$PENDING_ASSET_ID/analyze --max-time 90)"
fi

echo "  Regenerating post (LLM call)..."
check "regenerate post" "$(curl -s -X POST http://localhost:3000/api/posts/$PENDING_POST_ID/regenerate -H 'Content-Type: application/json' -d '{"instruction":"Make it shorter."}' --max-time 90)"

echo "  Assistant message (LLM call)..."
check "assistant message" "$(curl -s -X POST http://localhost:3000/api/conversation/message -H 'Content-Type: application/json' -d '{"message":"What is the active campaign?"}' --max-time 90)"

echo ""
echo "=== Publish test ==="
# Find a scheduled post and publish it
SCHEDULED_POST=$(curl -s 'http://localhost:3000/api/posts?status=scheduled' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d['data'] else '')")
if [ -n "$SCHEDULED_POST" ]; then
  check "publish post" "$(curl -s -X POST http://localhost:3000/api/posts/$SCHEDULED_POST/publish --max-time 30)"
fi

echo ""
echo "================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then
  echo "FAILED:$ERRORS"
fi
echo "================================"

# Kill server
kill $SERVER_PID 2>/dev/null
