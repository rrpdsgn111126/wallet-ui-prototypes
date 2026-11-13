# TransFi: UI alignment with alt.vu source components

**Visual authority:** `transfi-remittance/index.html`, the original archived alt.vu source.

**Scope:** SEPA and SWIFT flows, including both incoming bank details and outgoing configuration, recipient, review, processing and terminal states. No changes to transfer APIs, state machine, validation, or monetary formulas.

| TransFi | Original alt.vu component |
|---|---|
| Frame background / decorative top | `.view`, `.tint` |
| Back navigation and title | `.head .back .h1` |
| Scrollable content | `.wrap.tight` |
| Input, picker, balance source | `.fld.w`, `.fld.g`, `.fi`, `.fl` |
| Currency choice | `.seg` |
| Requirements, review | `.box .row .rt .rv` |
| Exchange and fee summary | `.tbl .rl` |
| Review summary | `.amt`, `.amsub` |
| Status indicator | `.hero`, `.okc`, native line-art SVG |
| Primary/secondary CTA | `.foot .btn`, `.btno` |

Bank-only CSS is located at `css/transfi-bank-altvu.css`, is scoped to `.phone.tf-phone` and loaded last by `transfi-remittance/legacy.html`. Do not change the original app-wide CSS or hand-draw new bank components unnecessarily.

**Acceptance:** same computed sizes as alt.vu where component shapes match (field height 68 px, CTA 52 px, title 20 px, box/table radius 20 px); no horizontal scrolling; all existing TransFi states render at 390 and 430 px; SWIFT config → recipient → review → processing works. Automated checks: `tests/bank-parity.mjs` / workflow `transfi-bank-parity.yml`.
