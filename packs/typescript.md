# Prefer discriminated unions over flag bags

globs: **/_.ts
globs: \**/_.tsx

Model related states as a tagged union so invalid combinations cannot compile. A single object with several optional fields or booleans that only make sense together is a violation when those fields represent mutually exclusive outcomes.

## Not allowed

```
type LoadState = { loading: boolean; user?: User; error?: string }
```

## Exceptions

Independent optional fields that can all be present at once are fine. Transport DTOs that mirror a wire format before decoding into a union are fine when the next step narrows them.

# Do not launder types with casts

globs: **/_.ts
globs: \**/_.tsx

Do not use `as`, non-null assertions, or chained assertions to make a value look like a narrower type after discarding evidence. Validate at the boundary or keep the precise type. A cast whose only job is to silence the type checker is a violation.

## Not allowed

```
const id = raw as UserId
const value = (data as unknown as Config).port!
```

## Exceptions

`as const` is fine. A cast next to a `SAFETY:` comment that names the invariant is fine when the surrounding code actually establishes that invariant. Test fixtures that build incomplete objects for a fake may cast when the fake's contract is intentional.

# Keep branded and precise types through boundaries

globs: **/_.ts
globs: \**/_.tsx

Do not strip branded or precise types by re-annotating them as `string`, `number`, `object`, `unknown`, or an anonymous structural type when the branded/precise type is still available. Prefer deriving with `Pick`, `Omit`, `Parameters`, `ReturnType`, or the schema's type.

## Not allowed

```
function save(userId: string) { /* userId was UserId one call up */ }
const row: { id: string } = brandedUser
```

## Exceptions

Encoding to JSON/storage where the wire type is truly a string is fine at the encoder boundary. Public API surfaces that intentionally accept plain strings and brand inside are fine.

# Prefer named object parameters for multi-arg functions

globs: **/_.ts
globs: \**/_.tsx

Exported or cross-module functions with two or more parameters of similar or swappable types should take one named object instead of positional args. Swappable strings, numbers, or ids in adjacent positions are the main violation.

## Not allowed

```
export function sendEmail(subject: string, body: string) {}
```

## Exceptions

Hot numeric kernels, well-known callbacks (`(err, value) => …`), constructors matching a platform API, and single-parameter functions are fine. Methods that already use a destructured object parameter are fine.
