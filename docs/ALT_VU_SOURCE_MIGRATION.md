# Alt.vu source migration

Source: user-provided Drive website export (2026-11-13), root `index.html`.

- `transfi-remittance/index.html`: complete original 67-view HTML/CSS/JS source, retaining original DOM classes and layout.
- The original built-in preview mode is enabled to prevent live banking operations, and synthetic `PV` data is injected.
- Navigation config uses `altMenu="bottom"` as previously requested. Static /assets URLs become relative `../assets` under GitHub Pages.
- `transfi-remittance/legacy.html`: previous TransFi flow preserved unchanged except `embedded=1` CSS and routing.
- SEPA/SWIFT rows have been appended to the original deposit and withdrawal sheets. Selecting one opens the previous working TransFi flow in an embedded frame.
- Original non-bank components are not manually redrawn; the source HTML and styles are the visual authority.
- CSP disallows network connections in the published prototype. All balances and account identifiers are fictional.

Run `node tests/source-smoke.mjs` via GitHub Actions to verify real rendering and navigation.
