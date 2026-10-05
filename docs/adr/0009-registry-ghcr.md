# ADR 0009 — Container registry: GHCR

**Status:** Accepted
**Date:** 2026-10-05

## Context

The constitution's §2 disagreement table settles the registry as **GHCR** (portable, free at this
scale, P12); the Fly guide's pipeline is written against `registry.fly.io`.

## Decision

Images are `ghcr.io/konradcinkusz/work-in-poland-api` and `…-web`, built once per tag and deployed
with `flyctl deploy --image ghcr.io/…`. authservice is pulled from
`ghcr.io/konradcinkusz/authservice:<pinned tag>`.

## Consequences

The images contain no secrets (P5) and the repository is MIT, so the two application packages are
meant to be made **public** in GHCR after the first push — Fly then pulls them without a
credential. A *private* package would need a registry pull credential configured on the Fly side;
that path is not set up or tested here. Choosing `registry.fly.io` instead is the same one-line
ADR and changes only the build job's login and tag.
