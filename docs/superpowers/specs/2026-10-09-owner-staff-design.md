# Owner and Staff Management

Approved scope: compact staff table with mobile cards, editing drawer, understandable permission presets, audit history, controlled delegation and session revocation. The user additionally authorizes promoting the existing `admin` account to Owner and setting their supplied password. Passwords must never enter repository files or logs.

Owner is the highest effective role. Persist `is_owner` on an underlying ADMIN record so the currently deployed backend continues to recognize the account before a new deployment. New API responses and authorization expose OWNER. Owner accounts cannot be created, changed or deleted through staff endpoints; a separate administrative provisioning service upgrades an existing account. Only Owner manages ADMIN accounts. Admin manages MANAGER/STAFF. Delegated managers manage STAFF only, with permissions contained in their own set; self modification is forbidden.

Role, permissions, status or password changes revoke existing JWTs and live connections. Staff-history and activity rollback must enforce the same hierarchy to prevent bypass. Ordinary nonsecurity profile changes preserve sessions. Record actor, before/after values and passwordChanged boolean, never password/hash.

UI: three statistics, compact desktop rows/mobile cards, role/status filters, selection toolbar, secondary actions menu, protected Owner badge. Drawer tabs Information, Permissions, History; job presets Sales, Catalog, Content and Support; visible assignable permissions, grant preview, pending save lock and unsaved-change confirmation. Read-only profiles remain inspectable. History loads a dedicated staff audit endpoint scoped to the chosen account.

Account provisioning occurs only after code/tests/builds pass. Use the configured DB and upgrade username admin in a transaction, hashing the supplied password, enabling the account and incrementing tokenVersion. Add the owner column idempotently, preserve existing data, verify role and password without printing secrets. Do not deploy or push automatically. Explain that the effective Owner UI requires deployment while the current backend keeps recognizing ADMIN.
