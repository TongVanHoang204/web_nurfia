# 🔒 Hook: Pre-Generation

> Validates inputs and loads context BEFORE AI generates code.

---

## Checks

### 1. Input Completeness
- [ ] Task description is clear and unambiguous
- [ ] Target language/framework specified
- [ ] Constraints and requirements listed
- [ ] Success criteria defined

### 2. Context Loading
- [ ] Load relevant files from `memory/`
- [ ] Check `patterns.md` for applicable patterns
- [ ] Check `mistakes.md` for relevant past errors
- [ ] Load project-specific coding standards

### 3. Scope Validation
- [ ] Task is appropriately scoped (not too large)
- [ ] Dependencies are identified
- [ ] Breaking changes are flagged
- [ ] Estimated complexity is reasonable

## Failure Actions

| Check Failed | Action |
|-------------|--------|
| Input incomplete | Request missing information from user |
| Relevant mistake found | Include prevention strategy in prompt |
| Scope too large | Suggest breaking into subtasks |
| Breaking change detected | Escalate to Architect Agent |
