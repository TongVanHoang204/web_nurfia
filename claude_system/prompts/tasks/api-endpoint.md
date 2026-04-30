# Task Prompt: API Endpoint

Generate a complete REST API endpoint with the following specification:

## Input Variables
- `{{RESOURCE_NAME}}` — The resource being managed (e.g., "User", "Product", "Order")
- `{{HTTP_METHOD}}` — GET, POST, PUT, PATCH, DELETE
- `{{FRAMEWORK}}` — Express, Fastify, NestJS
- `{{DATABASE}}` — PostgreSQL (Prisma), MongoDB (Mongoose), Firebase

## Requirements
1. Controller with input validation (Zod schema)
2. Service with business logic
3. Repository with database operations
4. DTOs for request/response
5. Error handling with standardized ApiResponse
6. Unit tests for service layer

## Template

```typescript
// Controller: {{RESOURCE_NAME}}Controller
// Route: {{HTTP_METHOD}} /api/v1/{{resource_name_plural}}
// Validation: Zod schema
// Response: ApiResponse<{{RESOURCE_NAME}}>

// Service: {{RESOURCE_NAME}}Service
// Business logic with explicit error handling
// Returns Result<T, Error> pattern

// Repository: {{RESOURCE_NAME}}Repository
// Database operations via Prisma
// Connection error handling
```

## Constraints
- Follow Clean Architecture layering
- Use dependency injection
- Implement pagination for list endpoints
- Add rate limiting middleware
- Log all operations with structured logger
