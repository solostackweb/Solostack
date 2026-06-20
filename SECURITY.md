# Security Policy

## Reporting A Vulnerability

Please email security reports to `support@stackivo.me` with the subject
`Security report: <short summary>`.

Include:
- Affected URL, feature, or API route.
- Steps to reproduce.
- Impact and any data exposure risk.
- Screenshots or proof-of-concept details, if safe to share.

We aim to acknowledge valid reports within 72 hours and will follow up with a
fix plan or clarification request. Please do not publicly disclose a vulnerability
until we have had a reasonable chance to investigate and ship a fix.

## Scope

In scope:
- Stackivo web app and public sharing pages.
- Auth, billing, contracts, invoices, portal, support, and admin surfaces.
- API routes, server actions, and storage access controls.

Out of scope:
- Social engineering.
- Denial-of-service testing beyond light rate-limit verification.
- Reports requiring access to another user's account unless you have permission.

## Safe Harbor

Good-faith testing that avoids data destruction, persistence, privacy violations,
and service disruption is welcome. If you accidentally access data that is not
yours, stop immediately and include only the minimum evidence needed in your
report.
