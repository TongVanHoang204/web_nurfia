# 💻 Skill: Generate Code

> Generates production-ready code from natural language specifications.

---

## Trigger

When the user requests code creation for a new feature, module, or function.

## Input Requirements

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | ✅ | What the code should do |
| `language` | string | ✅ | Target programming language |
| `framework` | string | ❌ | Framework/library to use |
| `patterns` | string[] | ❌ | Design patterns to follow |
| `constraints` | string[] | ❌ | Technical constraints |

## Process

1. **Analyze** — Parse the description and identify key components
2. **Design** — Determine architecture, interfaces, and data flow
3. **Reference** — Check `memory/patterns.md` for established patterns
4. **Generate** — Write complete, executable code
5. **Validate** — Run through post-generation hooks
6. **Test** — Generate corresponding unit tests

## Output Rules

- ✅ 100% complete, executable code — NO placeholders
- ✅ Explicit error handling on every function
- ✅ TypeScript strict mode compliance
- ✅ Corresponding unit tests generated
- ✅ JSDoc comments for public APIs only
- ❌ No mock data
- ❌ No `console.log` (use structured logger)
- ❌ No `any` type

## Example Prompt

```
Generate a user authentication service using:
- Language: TypeScript
- Framework: NestJS
- Pattern: Clean Architecture
- Database: PostgreSQL via Prisma
- Features: JWT tokens, refresh tokens, password hashing
- Constraints: No third-party auth providers
```

## Quality Checklist

- [ ] All functions have return types
- [ ] Error cases are handled explicitly
- [ ] Input validation at boundaries
- [ ] Unit tests cover happy path + edge cases
- [ ] No hardcoded values (use config/env)
