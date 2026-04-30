# 🐛 Workflow: Fix Bug

> Structured pipeline for resolving bugs from report to verified fix.

---

## Pipeline Overview

```
Report → Reproduce → Isolate → Fix → Verify → Deploy → Document
```

## Stages

### Stage 1: Report
- [ ] Capture the bug report
- [ ] Assign severity level (P0-P3)
- [ ] Identify affected users/systems
- [ ] Check `memory/mistakes.md` for similar past issues

### Stage 2: Reproduce
- [ ] Set up reproduction environment
- [ ] Follow exact reproduction steps
- [ ] Confirm expected vs actual behavior
- [ ] Capture error logs/stack traces
- [ ] Document minimum reproduction case

### Stage 3: Isolate (Debug Skill)
- [ ] Narrow down to the failing module
- [ ] Identify the exact failing line/condition
- [ ] Determine root cause using first principles
- [ ] Check if the bug exists in other areas (pattern search)

### Stage 4: Fix (Coder Agent)
- [ ] Write a failing test that reproduces the bug
- [ ] Implement the minimal fix
- [ ] Ensure no regressions (run full test suite)
- [ ] Get code review (Reviewer Agent)

### Stage 5: Verify
- [ ] Failing test now passes
- [ ] Full test suite passes
- [ ] Manual testing confirms fix
- [ ] Edge cases tested

### Stage 6: Deploy
- [ ] Merge fix to main branch
- [ ] Deploy via `ship-product.md` workflow
- [ ] Hotfix path for P0 issues:
  - Branch from production tag
  - Cherry-pick the fix
  - Deploy directly to production

### Stage 7: Document
- [ ] Log in `memory/mistakes.md`
- [ ] Update `memory/patterns.md` if new pattern emerged
- [ ] Close the bug ticket
- [ ] Update CHANGELOG.md

## Severity Levels

| Level | Response Time | Example |
|-------|--------------|---------|
| P0 - Critical | Immediate | Production down, data loss |
| P1 - High | < 4 hours | Major feature broken |
| P2 - Medium | < 24 hours | Minor feature broken |
| P3 - Low | Next sprint | Cosmetic issue |
