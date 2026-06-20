# Stackivo Incident Response Runbook

## Severity

- **SEV1:** Active data breach, account takeover at scale, payment compromise,
  or public exploit. Page immediately.
- **SEV2:** Confirmed vulnerability with limited blast radius, webhook/cron
  failure affecting customers, or suspicious admin/security events.
- **SEV3:** Hardening issue, dependency advisory without known exploitation, or
  low-risk configuration drift.

## First 30 Minutes

1. Open the admin console and review security events, delivery failures, cron
   health, and recent admin actions.
2. Check Sentry for correlated exceptions and request IDs.
3. If abuse is ongoing, temporarily tighten Cloudflare WAF/rate-limit rules or
   disable the affected route/feature.
4. Preserve evidence: request IDs, timestamps, affected user IDs, event rows,
   provider logs, and deployed commit SHA.
5. Assign an owner and keep a short incident log with times in IST.

## Containment

- Rotate exposed secrets immediately in the provider dashboard and Vercel.
- Revoke affected sessions or credentials through Supabase/admin tools.
- Pause outbound email/payment actions if a provider credential is suspected.
- For public-token abuse, revoke or regenerate affected tokens where supported.

## Recovery

1. Ship the smallest safe fix.
2. Redeploy and verify with the exact reproduction steps.
3. Review logs for continued exploitation.
4. Notify affected customers when data, billing, or account integrity may have
   been impacted.

## Post-Incident

- Document root cause, blast radius, timeline, and prevention work.
- Add a regression test, rate-limit, audit event, or dashboard alert.
- Update `docs/SECURITY_SETUP_GUIDE.md` if setup or provider configuration
  changes.
