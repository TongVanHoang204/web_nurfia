# 📖 Runbook: Incident Response

> Step-by-step guide for handling production incidents.

---

## Severity Classification

| Severity | Impact | Response Time | Escalation |
|----------|--------|---------------|------------|
| SEV-1 | Production down | Immediate | Engineering Lead + On-call |
| SEV-2 | Major feature broken | < 1 hour | On-call engineer |
| SEV-3 | Minor feature broken | < 4 hours | Team during business hours |
| SEV-4 | Cosmetic issue | Next sprint | Backlog |

## Response Steps

### 1. Acknowledge (< 5 min)
- Acknowledge the alert in monitoring system
- Join the incident channel
- Assign incident commander

### 2. Assess (< 15 min)
- Determine severity level
- Identify affected systems/users
- Check recent deployments
- Review error logs and dashboards

### 3. Mitigate (< 30 min for SEV-1)
- If deployment-related: rollback immediately
- If traffic-related: enable rate limiting
- If data-related: disable write operations
- Communicate status to stakeholders

### 4. Resolve
- Identify root cause
- Implement fix using `fix-bug.md` workflow
- Deploy fix through expedited pipeline
- Verify fix in production

### 5. Post-Mortem (< 48 hours)
- Write incident report
- Identify contributing factors
- Define action items with owners
- Log lessons in `memory/mistakes.md`
- Update runbooks if needed

## Emergency Contacts

| Role | Contact |
|------|---------|
| Engineering Lead | [Configure] |
| DevOps On-call | [Configure] |
| Product Owner | [Configure] |
