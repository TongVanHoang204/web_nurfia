# 🐛 Skill: Debug Code

> Systematically diagnoses and resolves code issues using first-principles analysis.

---

## Trigger

When the user reports a bug, error, or unexpected behavior.

## Process

### Phase 1: Reproduce
1. Understand the expected vs actual behavior
2. Identify the minimum reproduction steps
3. Confirm the environment (Node version, OS, dependencies)

### Phase 2: Isolate
1. Read error messages and stack traces carefully
2. Identify the failing module/function
3. Check recent changes (git diff)
4. Narrow down to the smallest failing unit

### Phase 3: Root Cause Analysis
1. Apply first-principles thinking — WHY does this fail?
2. Check `memory/mistakes.md` for similar past issues
3. Trace data flow from input to failure point
4. Identify the exact line/condition causing the issue

### Phase 4: Fix
1. Write a failing test that reproduces the bug
2. Implement the minimal fix
3. Verify the test passes
4. Check for regression — run full test suite

### Phase 5: Document
1. Log the issue in `memory/mistakes.md`
2. Update `memory/patterns.md` if a new pattern emerges
3. Add inline comment explaining the non-obvious fix

## Output Format

```markdown
## Bug Report

**Symptom**: [What the user observed]
**Root Cause**: [First-principles explanation]
**Fix**: [Code changes applied]
**Prevention**: [How to avoid this in the future]
**Tests Added**: [List of new test cases]
```

## Common Debugging Checklist

- [ ] Check environment variables are loaded
- [ ] Verify database connection string
- [ ] Check for race conditions in async code
- [ ] Validate input data shape matches schema
- [ ] Check for null/undefined propagation
- [ ] Verify third-party API response format
- [ ] Check for version mismatches in dependencies
