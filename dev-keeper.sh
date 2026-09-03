#!/bin/bash
# Keep the dev server alive — restart if it dies
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting dev server..." >> /home/z/my-project/dev-keeper.log
  node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Dev server exited with code $EXIT_CODE, restarting in 2s..." >> /home/z/my-project/dev-keeper.log
  sleep 2
done
