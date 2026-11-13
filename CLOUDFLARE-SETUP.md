# Cloudflare Setup for Deployment Hardening

## DNS Setup
1. Add the site to Cloudflare.
2. Change the nameservers at your domain registrar to the values provided by Cloudflare.
3. Keep the existing CNAME/A record pointing to Vercel.
4. In Cloudflare, set SSL/TLS encryption mode to **Full (Strict)**.
5. Wait for DNS propagation before verifying the site.

## Security Rules to Create
Cloudflare Free tier: 5 custom rules plus 1 rate limit rule.

### Rule 1 — Challenge payment/checkout paths

Expression:
```text
(http.request.uri.path contains "/payment") or
(http.request.uri.path contains "/checkout") or
(http.request.uri.path contains "/book-trip") or
(http.request.uri.path contains "/quote-checkout") or
(http.request.uri.path contains "/payment-result") or
(http.request.uri.path contains "/group-deposit") or
(http.request.uri.path contains "/update-payment-method")
```

Action: **Managed Challenge**

### Rule 2 — Challenge auth POSTs

Expression:
```text
(http.request.method eq "POST") and
(http.request.uri.path starts with "/api/")
```

Action: **Managed Challenge**

### Rule 3 — Block non-served countries

Expression:
```text
ip.src.country in {list}
```

Action: **Block**

Replace `{list}` with the countries you do not serve.

### Rule 4 — Block known bad bots

Expression:
```text
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "masscan") or
(http.user_agent contains "nmap")
```

Action: **Block**

### Rule 5 — Spare

Leave unused for future use.

### Rate Limit Rule (1 available)

Expression:
```text
http.request.uri.path contains "/login"
```

- Limit: 5 requests per 10 seconds per IP
- Action: **Block**

## Other Settings
- Bot Fight Mode: **ON**
- SSL/TLS: **Full (Strict)**
- Auto Minify: **ON** (JS, CSS, HTML)

## Verification
After DNS propagation, run:

```bash
curl -I https://yourdomain.com
```

Confirm these security headers are present:
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

Also:
- Test payment pages load correctly.
- Confirm Supabase calls still work; they go direct and not through Cloudflare.

## Do Not Change
- Do not change any application code, HTML, CSS, or JS.
- Do not add a Cloudflare-specific JS SDK or beacon.
- Do not modify Supabase client configuration.
- Do not change the publish directory or build configuration.
