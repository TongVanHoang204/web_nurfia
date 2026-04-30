# 🚢 Workflow: Ship Product

> End-to-end pipeline for deploying to production.

---

## Pipeline Overview

```
Prepare → Build → Test → Stage → Verify → Deploy → Monitor
```

## Stages

### Stage 1: Prepare
- [ ] Version bump in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Review all pending PRs
- [ ] Merge approved PRs to main
- [ ] Create release branch: `release/v<version>`

### Stage 2: Build
- [ ] Clean install dependencies: `npm ci`
- [ ] Run linter: `npm run lint`
- [ ] Run type check: `npm run type-check`
- [ ] Build production bundle: `npm run build`
- [ ] Build Docker image: `docker build -t app:<version> .`

### Stage 3: Test
- [ ] Run unit tests: `npm run test`
- [ ] Run integration tests: `npm run test:integration`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Run security audit: `npm audit --audit-level=high`
- [ ] Run AI evals: `npm run eval`

### Stage 4: Stage
- [ ] Deploy to staging environment
- [ ] Run smoke tests against staging
- [ ] Verify database migrations
- [ ] Check environment variables
- [ ] Test critical user flows manually

### Stage 5: Verify
- [ ] Load testing passes
- [ ] No P0/P1 bugs in staging
- [ ] Rollback procedure documented
- [ ] Team notified of deployment
- [ ] On-call engineer identified

### Stage 6: Deploy
- [ ] Deploy to production
- [ ] Verify health checks pass
- [ ] Run production smoke tests
- [ ] Verify monitoring dashboards

### Stage 7: Monitor
- [ ] Watch error rates for 1 hour
- [ ] Check response times
- [ ] Verify no memory leaks
- [ ] Monitor business metrics
- [ ] Send deployment notification to team

## Rollback Procedure

1. Detect issue via monitoring/alerts
2. Confirm the issue is deployment-related
3. Execute rollback: `deploy rollback <previous-version>`
4. Verify rollback health checks
5. Create incident report
6. Log in `memory/mistakes.md`
