# 🛡️ Hook: Validation

> Rules for validating all AI outputs and code changes.

---

## Validation Rules

### Rule 1: No Mock Data
```
IF output contains "mock", "fake", "dummy", "placeholder", "lorem ipsum"
THEN reject and request real implementation
```

### Rule 2: Explicit Error Handling
```
IF function has async operations OR external calls
AND does not have error handling
THEN reject and request error handling
```

### Rule 3: Test Coverage
```
IF output is a new function or module
AND no corresponding test file exists
THEN generate test file before accepting
```

### Rule 4: Type Safety
```
IF language is TypeScript
AND output contains "any" type
THEN reject and request specific types
```

### Rule 5: Security Boundaries
```
IF output handles user input
AND does not validate/sanitize input
THEN reject and request input validation
```

### Rule 6: Logging Standards
```
IF output contains "console.log" or "console.error"
THEN replace with structured logger
```

## Custom Validators

Add project-specific validation rules here as the project evolves.

```typescript
interface ValidationRule {
  id: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (code: string) => ValidationResult;
}

interface ValidationResult {
  passed: boolean;
  message: string;
  line?: number;
  suggestion?: string;
}
```
