# Deploy to Global Install

Push local changes to `~/.claude/get-shit-done/`:

```bash
npm install -g .
node scripts/build-hooks.js
get-shit-done-cc --claude --global
```

**Why 3 steps?** `npm install -g .` doesn't trigger `prepublishOnly` on npm v10+, so hooks must be built manually before deploying.

Wait until other projects finish active plan executions before running.
