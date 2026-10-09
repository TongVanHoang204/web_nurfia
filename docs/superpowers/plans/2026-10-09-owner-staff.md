# Owner and Staff Management Implementation Plan

> Execute inline using executing-plans, with regression tests before behavior changes. No subagent delegation or automatic commits/deployment.

**Goal:** Implement the approved Staff Management improvements and grant Owner to the existing admin account.
**Architecture:** Persistent isOwner flag with effective OWNER role, shared hierarchy checks, protected provisioning service and separate UI editor/model.
**Tech stack:** Existing Prisma/PostgreSQL, Express, React, Jest and Vitest.
**Spec:** ../specs/2026-10-09-owner-staff-design.md

## Constraints and review focus

- Preserve the existing admin account and current production backend compatibility; no hardcoded credentials.
- Check direct API escalation, self changes, protected Owner/Admin targets and activity rollback bypass.
- Check revoked/copied tokens, session expiry and all Owner login/navigation/socket gates.
- Keep mobile layout and keyboard drawer navigation usable; handle failed/stale requests and duplicate submits.
- Verify history contains actor and changes while excluding password material.

## Tasks

- [x] Write and run failing backend tests for Owner authorization, bounded delegation, session revocation, history and provisioning.
- [x] Add backend/utils/teamAccess.ts, User.isOwner/migration and effective role serialization in session/auth services; update admin/socket gates.
- [x] Enforce hierarchy in staff controller and rollback; add GET /staffs/:id/history; preserve audit snapshots and revoke security changes.
- [x] Add provisioning service and environment-driven CLI; test transaction and no password logging. Do not call real DB in tests.
- [x] Write failing frontend interaction tests, extract staff model and implement compact list/drawer/history with existing API and CSS.
- [x] Update Owner navigation, login destination, notifications and activity controls; run both suites/builds, audit and diff checks.
- [x] Provision the user-authorized existing admin account in configured DB only after checks pass; verify effective OWNER and password, document result/deployment.

