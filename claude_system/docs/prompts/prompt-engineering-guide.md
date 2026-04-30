# 📝 Prompt Engineering Guide

> Best practices for writing effective AI prompts within this project.

---

## Prompt Structure Formula

```
ROLE + CONTEXT + TASK + FORMAT + CONSTRAINTS
```

### 1. Role (Who is the AI?)
```
You are a Senior TypeScript Engineer with expertise in NestJS and PostgreSQL.
```

### 2. Context (What's the situation?)
```
We are building an e-commerce platform with user authentication, product catalog, and order management.
The project uses Clean Architecture with Controllers → Services → Repositories.
```

### 3. Task (What to do?)
```
Generate a complete OrderService that:
- Creates orders from cart items
- Calculates total with tax and shipping
- Integrates with Stripe for payment
- Sends confirmation email via SMTP
```

### 4. Format (How to output?)
```
Output the complete TypeScript file with:
- All imports
- Class with all methods
- Corresponding unit test file
- JSDoc for public methods only
```

### 5. Constraints (What to avoid?)
```
Constraints:
- No mock data — use real Prisma queries
- No `any` type — use strict TypeScript
- No console.log — use structured Logger
- Handle all error cases explicitly
```

## Anti-Patterns

| ❌ Bad | ✅ Good |
|--------|---------|
| "Write some code for auth" | "Generate a JWT authentication service with refresh token rotation using NestJS and Passport" |
| "Fix this bug" | "This function returns null when the array is empty. Add a guard clause to return an empty array instead" |
| "Make it faster" | "Optimize this database query — it's doing N+1 queries on the orders table. Use a JOIN or batch query instead" |

## Prompt Templates

See `/prompts/system/` for system-level prompts and `/prompts/tasks/` for task-specific templates.
