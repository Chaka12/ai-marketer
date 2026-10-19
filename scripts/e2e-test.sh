#!/bin/bash
# Comprehensive end-to-end audit script.
# Starts the server, waits for it, runs all tests, reports results, kills server.
cd /home/z/my-project

echo "=== Starting dev server ==="
pkill -f "next dev" 2>/dev/null
sleep 2
> dev.log
node node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready (up to 30s)
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/api/workspaces 2>/dev/null | grep -q "success"; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 1
done

# Generate test images
cat > /tmp/gen-img.ts << 'EOF'
import sharp from 'sharp'
const svg = `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="800" fill="#1e293b"/><text x="400" y="400" font-family="Georgia" font-size="48" fill="#e2e8f0" text-anchor="middle">Test Product</text></svg>`
await sharp(Buffer.from(svg)).jpeg().toFile('/tmp/test-img.jpg')
const logoSvg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" fill="#0f766e"/><text x="128" y="160" font-family="Georgia" font-size="120" font-weight="bold" fill="#fef2f2" text-anchor="middle">T</text></svg>`
await sharp(Buffer.from(logoSvg)).png().toFile('/tmp/test-logo.png')
EOF
bun run /tmp/gen-img.ts 2>&1 | tail -1

PASS=0
FAIL=0
FAILED_TESTS=""

check() {
  local name="$1"
  local result="$2"
  if echo "$result" | grep -q '"success":true'; then
    echo "  ✓ $name"
    PASS=$((PASS+1))
  else
    echo "  ✗ $name"
    echo "    → $(echo $result | head -c 200)"
    FAIL=$((FAIL+1))
    FAILED_TESTS="$FAILED_TESTS\n  - $name"
  fi
}

echo ""
echo "=== 1. GET ENDPOINTS ==="
check "GET /api/dashboard" "$(curl -s http://localhost:3000/api/dashboard)"
check "GET /api/workspaces" "$(curl -s http://localhost:3000/api/workspaces)"
check "GET /api/brands" "$(curl -s http://localhost:3000/api/brands)"
check "GET /api/campaigns" "$(curl -s http://localhost:3000/api/campaigns)"
check "GET /api/assets" "$(curl -s http://localhost:3000/api/assets)"
check "GET /api/posts" "$(curl -s http://localhost:3000/api/posts)"
check "GET /api/posts?status=pending_approval" "$(curl -s 'http://localhost:3000/api/posts?status=pending_approval')"
check "GET /api/calendar" "$(curl -s http://localhost:3000/api/calendar)"
check "GET /api/analytics" "$(curl -s http://localhost:3000/api/analytics)"
check "GET /api/conversation" "$(curl -s http://localhost:3000/api/conversation)"
check "GET /api/distribution/accounts" "$(curl -s http://localhost:3000/api/distribution/accounts)"
check "GET /api/audit" "$(curl -s http://localhost:3000/api/audit)"
check "GET /api/cron/publish" "$(curl -s http://localhost:3000/api/cron/publish)"

echo ""
echo "=== 2. FILE UPLOADS ==="
check "POST /api/assets/upload" "$(curl -s -X POST http://localhost:3000/api/assets/upload -F 'files=@/tmp/test-img.jpg')"

WS_ID=$(curl -s http://localhost:3000/api/workspaces | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null)
if [ -n "$WS_ID" ]; then
  check "POST /api/workspaces/logo" "$(curl -s -X POST http://localhost:3000/api/workspaces/$WS_ID/logo -F 'file=@/tmp/test-logo.png')"
fi

echo ""
echo "=== 3. MUTATIONS ==="
BRAND_ID=$(curl -s http://localhost:3000/api/brands | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null)
POST_ID=$(curl -s 'http://localhost:3000/api/posts?status=pending_approval' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d['data'] else '')" 2>/dev/null)
echo "  IDs: WS=$WS_ID BRAND=$BRAND_ID POST=$POST_ID"

check "PATCH /api/workspaces (approvalMode)" "$(curl -s -X PATCH http://localhost:3000/api/workspaces/$WS_ID -H 'Content-Type: application/json' -d '{"approvalMode":"assisted"}')"
check "PATCH /api/brands" "$(curl -s -X PATCH http://localhost:3000/api/brands/$BRAND_ID -H 'Content-Type: application/json' -d '{"description":"Luxury fashion retailer."}')"
if [ -n "$POST_ID" ]; then
  check "PATCH /api/posts" "$(curl -s -X PATCH http://localhost:3000/api/posts/$POST_ID -H 'Content-Type: application/json' -d '{"caption":"Updated caption for testing."}')"
fi

echo ""
echo "=== 4. DISTRIBUTION MANAGEMENT ==="
check "POST /api/distribution/accounts (connect)" "$(curl -s -X POST http://localhost:3000/api/distribution/accounts -H 'Content-Type: application/json' -d '{"platform":"facebook","accountName":"Test Page","destination":{"type":"page","name":"Test Page"}}')"

ACCT_ID=$(curl -s http://localhost:3000/api/distribution/accounts | python3 -c "import sys,json; d=json.load(sys.stdin); print([a['id'] for a in d['data'] if a['name']=='Test Page'][0] if [a for a in d['data'] if a['name']=='Test Page'] else '')" 2>/dev/null)
if [ -n "$ACCT_ID" ]; then
  check "POST /api/distribution/destinations (add group)" "$(curl -s -X POST http://localhost:3000/api/distribution/destinations -H 'Content-Type: application/json' -d "{\"socialAccountId\":\"$ACCT_ID\",\"type\":\"group\",\"name\":\"Test Group\"}")"
  DEST_ID=$(curl -s http://localhost:3000/api/distribution/accounts | python3 -c "import sys,json; d=json.load(sys.stdin); accts=[a for a in d['data'] if a['name']=='Test Page']; print([x['id'] for x in accts[0]['destinations'] if x['name']=='Test Group'][0] if accts and [x for x in accts[0]['destinations'] if x['name']=='Test Group'] else '')" 2>/dev/null)
  if [ -n "$DEST_ID" ]; then
    check "DELETE /api/distribution/destinations (remove)" "$(curl -s -X DELETE http://localhost:3000/api/distribution/destinations/$DEST_ID)"
  fi
  check "DELETE /api/distribution/accounts (disconnect)" "$(curl -s -X DELETE http://localhost:3000/api/distribution/accounts/$ACCT_ID)"
fi

echo ""
echo "=== 5. AI-POWERED ENDPOINTS (may take 10-60s each) ==="
PENDING_ASSET=$(curl -s http://localhost:3000/api/assets | python3 -c "import sys,json; d=json.load(sys.stdin); print([a['id'] for a in d['data'] if a['analysisStatus']=='pending'][0] if [a for a in d['data'] if a['analysisStatus']=='pending'] else '')" 2>/dev/null)
if [ -n "$PENDING_ASSET" ]; then
  echo "  Analyzing asset (VLM)..."
  check "POST /api/assets/analyze" "$(curl -s -X POST http://localhost:3000/api/assets/$PENDING_ASSET/analyze --max-time 90)"
else
  echo "  (skipping asset analyze — no pending assets)"
fi

if [ -n "$POST_ID" ]; then
  echo "  Regenerating post (LLM)..."
  check "POST /api/posts/regenerate" "$(curl -s -X POST http://localhost:3000/api/posts/$POST_ID/regenerate -H 'Content-Type: application/json' -d '{"instruction":"Make it shorter."}' --max-time 90)"
fi

echo "  Assistant message (LLM)..."
check "POST /api/conversation/message" "$(curl -s -X POST http://localhost:3000/api/conversation/message -H 'Content-Type: application/json' -d '{"message":"What is the active campaign?"}' --max-time 90)"

echo ""
echo "=== 6. PUBLISHING ==="
SCHEDULED_POST=$(curl -s 'http://localhost:3000/api/posts?status=scheduled' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d['data'] else '')" 2>/dev/null)
if [ -n "$SCHEDULED_POST" ]; then
  check "POST /api/posts/publish" "$(curl -s -X POST http://localhost:3000/api/posts/$SCHEDULED_POST/publish --max-time 30)"
else
  echo "  (skipping publish — no scheduled posts)"
fi

echo ""
echo "================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then
  echo -e "FAILED:$FAILED_TESTS"
fi
echo "================================"

# Kill server
kill $SERVER_PID 2>/dev/null
