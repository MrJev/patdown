# anti-slop pack

Fuzzy companion to oxlint anti-slop: widen-then-assert, cast laundering, empty-object spreads.

## Rules

- [Do not widen then assert](do-not-widen-then-assert.md)
- [Do not silence anti-slop with type laundering](do-not-silence-anti-slop-with-type-laundering.md)
- [Prefer named owner types over escape-hatch dictionaries](prefer-named-owner-types-over-escape-hatch-dictionaries.md)
- [Do not hide omission behind empty-object spreads](do-not-hide-omission-behind-empty-object-spreads.md)

## Use

```sh
npx patdown --rules ./packs/anti-slop
```
