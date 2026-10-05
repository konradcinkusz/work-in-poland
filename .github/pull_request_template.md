## What changes

<!-- One or two sentences. What behaviour is different after this PR? -->

## Why

<!-- Link the issue or ticket. If there is none, explain the problem this solves. -->

## Approach and alternatives

<!-- What you did, and what you considered and rejected. Record a deviation from
     docs/architecture/00-ARCHITECTURE.md in its register, with a date and a reason. -->

## Security and privacy impact

<!-- What can an attacker do after this change that they could not before? Does it touch
     personal data (RODO)? "None" is a fine answer for a docs change. -->

## Schema changes

<!-- Entity model changed? Add a migration (scripts/add-migration.sh <Name>); CI fails while
     the model and the migrations disagree. -->

## Checklist

- [ ] `dotnet build` and `dotnet test` pass
- [ ] `pnpm -C web lint && pnpm -C web typecheck && pnpm -C web test` pass
- [ ] Behaviour changes are covered by a test at the layer that holds the logic
- [ ] README / docs updated where the change is user-visible
- [ ] No secret, key or personal data in the diff
