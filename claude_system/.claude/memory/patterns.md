# 🔁 Learned Patterns

> Patterns and preferences discovered through repeated interactions.

---

## Code Generation Patterns

### 1. Error Handling Pattern
```typescript
// ALWAYS use Result pattern over try-catch when possible
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

async function fetchUser(id: string): Promise<Result<User>> {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return { success: false, error: new Error(`User ${id} not found`) };
  return { success: true, data: user };
}
```

### 2. API Response Pattern
```typescript
// Standardized API responses
interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: { page: number; total: number; limit: number };
}
```

### 3. Validation Pattern
```typescript
// Validate at boundaries, trust internally
// Use Zod schemas for runtime validation
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'user', 'viewer']),
});
```

## Prompt Engineering Patterns

### Chain of Thought
- Break complex tasks into sequential reasoning steps
- Use numbered steps for clarity
- End with a synthesis/conclusion

### Few-Shot Examples
- Provide 2-3 concrete examples before the actual task
- Match the format of expected output
- Include edge cases in examples

### Role Assignment
- Assign specific expertise roles to the AI
- Define clear boundaries for each role
- Include context about the domain

## Workflow Patterns

### Feature Development
1. Understand requirements → 2. Design API → 3. Write tests → 4. Implement → 5. Review → 6. Deploy

### Bug Resolution
1. Reproduce → 2. Isolate root cause → 3. Write failing test → 4. Fix → 5. Verify → 6. Document
