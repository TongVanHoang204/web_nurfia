# 🌍 Global Memory

> Cross-project knowledge that persists across all sessions and projects.

---

## Tech Stack Preferences

- **Backend**: Node.js (Express/Fastify), NestJS for large-scale
- **Frontend**: React, Next.js, Flutter (mobile)
- **Database**: PostgreSQL (Prisma ORM), Firebase Firestore
- **Cloud**: Google Cloud Platform, Firebase
- **CI/CD**: GitHub Actions, Docker
- **Testing**: Jest, Mocha, flutter_test

## Coding Standards

- TypeScript strict mode for all Node.js projects
- ESLint + Prettier for code formatting
- Conventional commits for version control
- Explicit error handling — never swallow exceptions
- Structured logging with context (no `console.log` in production)

## Architecture Preferences

- Modular monolith over microservices for small-medium projects
- Clean Architecture (Controllers → Services → Repositories)
- Event-driven patterns for async operations
- API versioning from day one

## Common Pitfalls Learned

- Always validate environment variables at startup
- Use connection pooling for database connections
- Implement rate limiting on all public endpoints
- Never trust client-side validation alone
