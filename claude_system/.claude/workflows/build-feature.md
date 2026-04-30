# 🔨 Workflow: Build Feature

> End-to-end pipeline for developing a new feature from idea to merge.

---

## Pipeline Overview

```
Ideation → Design → Implement → Review → Test → Merge
```

## Stages

### Stage 1: Ideation (Product Agent)
- [ ] Define the problem statement
- [ ] Identify target users
- [ ] RICE score the feature
- [ ] Write user stories
- [ ] Get stakeholder sign-off

### Stage 2: Design (Architect Agent)
- [ ] Design system architecture changes
- [ ] Define API contracts
- [ ] Create data model changes
- [ ] Write ADR if architectural decision needed
- [ ] Review with team

### Stage 3: Implement (Coder Agent)
- [ ] Create feature branch: `feature/<name>`
- [ ] Implement backend logic
- [ ] Implement frontend UI
- [ ] Write unit tests (>80% coverage)
- [ ] Write integration tests
- [ ] Handle error cases explicitly

### Stage 4: Review (Reviewer Agent)
- [ ] Self-review checklist passed
- [ ] AI code review completed
- [ ] Security review (if applicable)
- [ ] Performance review (if applicable)
- [ ] Address all critical/warning feedback

### Stage 5: Test (Automated)
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Performance benchmarks within threshold
- [ ] No security vulnerabilities

### Stage 6: Merge & Deploy
- [ ] PR approved by reviewer
- [ ] CI/CD pipeline green
- [ ] Merge to main branch
- [ ] Deploy to staging
- [ ] Smoke test in staging
- [ ] Deploy to production
- [ ] Monitor for 24 hours

## Completion Criteria

- All tests pass
- Code review approved
- Documentation updated
- CHANGELOG updated
- No critical alerts in monitoring
