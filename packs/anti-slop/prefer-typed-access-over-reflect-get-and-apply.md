# Prefer typed access over Reflect get and apply
globs: `**/*.ts`
globs: `**/*.tsx`

Do not use global `Reflect.get` or `Reflect.apply` to reach properties or call functions when typed property access or a normal call would do. Dynamic input should be parsed into a domain type (or modeled behind an interface), not probed with Reflect.

## Not allowed

```
const value = Reflect.get(object, key)
Reflect.apply(fn, thisArg, args)
```

## Exceptions

Polyfill / proxy implementation code that must speak Reflect for correctness is fine. Test harnesses that intentionally exercise Reflect behavior are fine.
