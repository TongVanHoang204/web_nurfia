# 💡 Skill: Product Ideation

> Generates and evaluates product ideas using structured frameworks.

---

## Trigger

When the user needs help brainstorming features, validating ideas, or planning product direction.

## Frameworks

### 1. Problem-Solution Fit
- **Who** has this problem?
- **What** is the current pain point?
- **Why** do existing solutions fail?
- **How** does our solution differ?

### 2. RICE Scoring
| Factor | Weight | Description |
|--------|--------|-------------|
| Reach | 1-10 | How many users are affected? |
| Impact | 1-10 | How significant is the improvement? |
| Confidence | 0-1 | How certain are we about estimates? |
| Effort | 1-10 | How much work is required? (inverse) |

**Score** = (Reach × Impact × Confidence) / Effort

### 3. Feature Prioritization Matrix

```
        High Impact
            │
    Quick   │   Strategic
    Wins    │   Bets
────────────┼────────────
    Fill    │   Money
    Ins     │   Pit
            │
        Low Impact
   Low Effort ──── High Effort
```

## Process

1. **Define** the problem space
2. **Brainstorm** 5-10 potential solutions
3. **Score** each using RICE
4. **Validate** top 3 with user personas
5. **Spec** the winning idea into user stories
6. **Plan** implementation using workflow: `build-feature.md`

## Output Format

```markdown
## Ideation Report

**Problem**: [Clear problem statement]
**Target User**: [Persona description]
**Ideas**: [Ranked list with RICE scores]
**Recommendation**: [Top pick with justification]
**Next Steps**: [Concrete action items]
```
