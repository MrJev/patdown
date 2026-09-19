# Replace dependencies through real seams
globs: `**/*.test.ts`
globs: `**/*.test.tsx`
globs: `**/*.spec.ts`
globs: `**/*.spec.tsx`
globs: `**/tests/**/*.ts`
globs: `**/tests/**/*.tsx`

Do not use Vitest/Jest `mock`, `doMock`, or `unstable_mockModule` to replace modules. Tests should swap dependencies through real interfaces (Effect Layers, constructor injection, test doubles you own).

## Not allowed

```
vi.mock('./db')
jest.unstable_mockModule('./db', () => ({ query: vi.fn() }))
```

## Exceptions

Temporary characterization tests against an unseamed third-party module may mock when introducing a seam in the same change set—and should delete the mock once the seam exists.
