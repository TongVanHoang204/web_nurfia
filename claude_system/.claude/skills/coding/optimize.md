# ⚡ Skill: Optimize Code

> Analyzes and improves code performance, readability, and maintainability.

---

## Trigger

When the user requests performance improvements, refactoring, or code quality enhancements.

## Optimization Dimensions

### 1. Performance
- Algorithm complexity analysis (Big-O)
- Database query optimization (N+1, indexing, batching)
- Memory allocation reduction
- Caching strategies (in-memory, Redis, CDN)
- Async/parallel execution opportunities

### 2. Readability
- Function decomposition (single responsibility)
- Meaningful naming conventions
- Consistent code style
- Reduce cognitive complexity
- Extract magic numbers to named constants

### 3. Maintainability
- Reduce coupling between modules
- Increase cohesion within modules
- Apply SOLID principles
- Remove dead code
- Simplify conditional logic

### 4. Security
- Input sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens
- Rate limiting
- Secrets management

## Process

1. **Profile** — Identify bottlenecks (measure before optimizing)
2. **Analyze** — Determine root cause of inefficiency
3. **Propose** — Present optimization options with trade-offs
4. **Implement** — Apply the approved optimization
5. **Benchmark** — Measure improvement with before/after metrics
6. **Document** — Record the optimization in patterns.md

## Output Format

```markdown
## Optimization Report

**Target**: [File/Function being optimized]
**Dimension**: [Performance | Readability | Maintainability | Security]
**Before**: [Metrics/description of current state]
**After**: [Metrics/description of optimized state]
**Trade-offs**: [What was sacrificed, if anything]
**Changes**: [Diff of code changes]
```
