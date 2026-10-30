# Changelog

## Unreleased

- **`@stenographers/markdown`, in the stenographers monorepo.** The package moves to `packages/markdown` and takes the family's scope; its code is unchanged except below.
- **It passes the stenography suite** (`@stenographers/stenography`): all seven laws.
- **Refusals carry the shared codes**: `open-unreadable`, `path-malformed`, `edit-target-absent`, `edit-unrepresentable`. A path that is not a string, or a value that is not EditData (a plain object), throws a `TypeError`.
- **Paths are RFC 6901 in syntax.** `@` is no longer escaped as `~2`: a heading's text is written as it is, and a heading whose own text ends in `@` and digits takes its ordinal even when first (`Note@2@1`), so a step's last `@n` is always its ordinal. Paths of headings containing `@` change.

## 0.1.0 — 2026-10-29

- **First release on npm.** stenographers was extracted from beltype-studio-experiment's Markdown work and lived in this repository unpublished. It is now `stenographers` on npmjs.org, its repository is Codeberg, and a workflow publishes a release tag from the GitHub mirror, by npm trusted publishing.
