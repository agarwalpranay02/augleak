# Security policy

Please report vulnerabilities privately through GitHub's private vulnerability reporting
(Security → Report a vulnerability on this repository). Do not open public issues for security problems.

## Design summary
- **Images never leave the device** in the audit and the pair inspector: decoding, features, scores and statistics run in Web Workers in the browser.
- **Strict CSP** with per-request nonces and `strict-dynamic`; `frame-ancestors 'none'`, HSTS, no-sniff, Referrer-Policy and a locked-down Permissions-Policy; CSP violations are reported to `/api/csp-report`.
- **Auth**: better-auth sessions (httpOnly, SameSite=Lax, Secure in production); Google OAuth and email links, both optional.
- **API keys**: random, shown once, stored only as a peppered SHA-256 hash; per-key per-minute limits, monthly quotas and a per-IP shield.
- **Uploads to the API**: 2 MB and 25-megapixel caps, decoded with sharp, processed in memory and never stored.
- **CSRF**: cookie-authenticated mutations require a same-origin `Origin`.
- **Supply chain**: CodeQL, gitleaks, npm audit, pip-audit and Dependabot run in CI.
