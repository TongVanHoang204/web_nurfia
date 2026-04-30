# ✅ Hook: Post-Generation

> Validates AI-generated output AFTER generation and BEFORE delivery.

---

## Checks

### 1. Code Quality
- [ ] Code compiles/parses without errors
- [ ] No TypeScript `any` types
- [ ] No `console.log` statements
- [ ] No hardcoded values (magic numbers/strings)
- [ ] No TODO/FIXME without linked issues

### 2. Completeness
- [ ] All functions have return types
- [ ] All public APIs have documentation
- [ ] Error handling is explicit
- [ ] No placeholder or mock data
- [ ] Corresponding tests are generated

### 3. Security
- [ ] No exposed secrets or API keys
- [ ] Input validation at boundaries
- [ ] No SQL injection vectors
- [ ] No XSS vulnerabilities
- [ ] Authentication checks where needed

### 4. Standards Compliance
- [ ] Follows project naming conventions
- [ ] Uses structured logging (not console.log)
- [ ] Follows established patterns from `patterns.md`
- [ ] Compatible with existing architecture

## Failure Actions

| Check Failed | Action |
|-------------|--------|
| Code doesn't compile | Auto-fix or request regeneration |
| Missing tests | Generate tests automatically |
| Security issue | Block delivery, flag to Reviewer Agent |
| Standards violation | Auto-fix formatting, flag logic issues |
