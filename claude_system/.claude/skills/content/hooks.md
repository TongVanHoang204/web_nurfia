# 🪝 Skill: Git Hooks & Automation Hooks

> Defines automation triggers for pre/post operations in the development workflow.

---

## Git Hooks

### Pre-commit
```bash
#!/bin/sh
# Run linter
npm run lint

# Run type check
npm run type-check

# Run unit tests on changed files
npm run test -- --changedSince=HEAD
```

### Pre-push
```bash
#!/bin/sh
# Run full test suite
npm run test

# Check for security vulnerabilities
npm audit --audit-level=high
```

### Commit Message
```
# Format: <type>(<scope>): <description>
# Types: feat, fix, refactor, docs, test, chore, ci, perf

feat(auth): add JWT refresh token rotation
fix(api): handle null response from payment gateway
refactor(db): optimize user query with index
docs(readme): update deployment instructions
test(auth): add edge cases for token expiry
```

## AI Generation Hooks

### Pre-Generation
- Validate input requirements are complete
- Check memory for relevant patterns
- Load project-specific context

### Post-Generation
- Run linter on generated code
- Execute generated tests
- Validate against project coding standards
- Check for security anti-patterns
