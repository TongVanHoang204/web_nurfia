# Task Prompt: Database Migration

Generate a database migration with the following specification:

## Input Variables
- `{{TABLE_NAME}}` — Name of the table to create/modify
- `{{OPERATION}}` — create, alter, drop, seed
- `{{ORM}}` — Prisma, TypeORM, Knex
- `{{FIELDS}}` — List of fields with types

## Requirements
1. Migration file with up/down functions
2. Updated schema file (if Prisma)
3. Seed data file (if applicable)
4. Validation that migration is reversible

## Template

```typescript
// Migration: {{OPERATION}}_{{TABLE_NAME}}
// ORM: {{ORM}}
// Fields: {{FIELDS}}

// Up: Apply the migration
// Down: Reverse the migration (must be reversible)

// Seed: Generate realistic seed data (NOT mock/lorem ipsum)
```

## Constraints
- All migrations must be reversible
- Add appropriate indexes for query patterns
- Use appropriate column types (not just VARCHAR for everything)
- Add foreign key constraints where applicable
- Include created_at and updated_at timestamps
