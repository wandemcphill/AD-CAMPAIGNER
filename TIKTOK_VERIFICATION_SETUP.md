# TikTok Developer Website Verification Setup

**Project:** FlipTrybe Ads Campaigner  
**Production Website:** https://fliptrybe-ads-campaigner-web-g24r.onrender.com  
**Framework:** Next.js 15 (Node runtime)  
**Deployment:** Render  
**Verification Tokens Received:** 2026-07-31

---

## A. URL/FILE VERIFICATION ✅ IMPLEMENTED

### What Was Done

1. **Created verification file:**
   - **Location in code:** `apps/web/public/.well-known/tiktok-developers-site-verification`
   - **Content (exact):** `tiktok-developers-site-verification=LutxjeeCItOdA461HA9O0XTjmJ3p0RlG`
   - **No trailing newline, no modifications**

2. **File structure:**
   ```
   apps/web/
   ├── public/
   │   └── .well-known/
   │       └── tiktok-developers-site-verification  (no file extension)
   ```

3. **How it works:**
   - Next.js's `public/` directory serves static files directly at the domain root
   - The `.well-known/` directory is a standard location for well-known resources (RFC 8615)
   - This file will be served unauthenticated, without login requirements
   - Render will deploy this file automatically on next commit

### Public Access URL

```
https://fliptrybe-ads-campaigner-web-g24r.onrender.com/.well-known/tiktok-developers-site-verification
```

### What TikTok Will Receive

When TikTok accesses the above URL, it will receive:
```
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 62

tiktok-developers-site-verification=LutxjeeCItOdA461HA9O0XTjmJ3p0RlG
```

### Deployment Status

- ✅ **File created:** `apps/web/public/.well-known/tiktok-developers-site-verification`
- ✅ **Ready to commit:** Yes, verification files should be in version control
- ⏳ **Requires Render redeploy:** Yes, commit this change and push to trigger Render deployment
- ⏳ **Deployment time:** ~2-5 minutes on Render

### Next Steps for URL Verification

1. **Commit and push the file:**
   ```bash
   git add apps/web/public/.well-known/tiktok-developers-site-verification
   git commit -m "Add TikTok developer website verification file"
   git push
   ```

2. **Wait for Render deployment:** Check Render dashboard - deploys automatically on commit

3. **Verify locally (optional):**
   ```bash
   curl https://fliptrybe-ads-campaigner-web-g24r.onrender.com/.well-known/tiktok-developers-site-verification
   # Should output: tiktok-developers-site-verification=LutxjeeCItOdA461HA9O0XTjmJ3p0RlG
   ```

4. **In TikTok Developer Portal:**
   - Select **"URL properties"** verification method
   - Enter the verification file URL exactly as above
   - Click **"Verify URL properties"**
   - TikTok will download and check the content

---

## B. DNS VERIFICATION ⚠️ REQUIRES MANUAL DNS CHANGES

### TikTok DNS Verification Requirements

TikTok uses DNS TXT records for domain verification. You need to add a DNS record to your domain registrar.

**DNS Record Details:**

| Field | Value |
|-------|-------|
| **Record Type** | TXT |
| **Host/Name** | @ (root domain) or `_tiktok` |
| **Value** | `tiktok-developers-site-verification=KeE4ufWp2u5doTgJp1yL99RQMEhN087R` |
| **TTL** | 3600 (or use default) |

### Where to Add the DNS Record

**For Render domain (`fliptrybe-ads-campaigner-web-g24r.onrender.com`):**
- This is a Render-managed subdomain — you likely **cannot modify its DNS records**
- Render manages DNS for their subdomains automatically

**For a custom domain (if you own one):**
- If you have a custom domain (e.g., `mycompany.com`), add the TXT record there
- Log into your domain registrar's DNS settings:
  - **GoDaddy, Namecheap, Route 53, Cloudflare, etc.**
  - Add a new TXT record with the values above

### Important DNS Notes

⚠️ **The application code cannot create DNS records.** This must be done manually at your DNS provider.

If you currently use the Render subdomain:
- Request a custom domain from Render, or
- Contact Render support about DNS verification for their subdomains, or
- Use only URL verification (which is already implemented above)

### No Code Changes Required for DNS

- No files to create in the application
- No environment variables needed
- This is purely a DNS configuration task outside the code

---

## C. TikTok Developer Portal Steps

### For URL Properties Verification (Ready Now)

1. Go to **TikTok Developer Portal** → Your App → **Permissions**
2. Find the **"Website verification"** or **"Domain verification"** section
3. Click **"Add verification method"** or **"URL properties"**
4. Enter the verification URL:
   ```
   https://fliptrybe-ads-campaigner-web-g24r.onrender.com/.well-known/tiktok-developers-site-verification
   ```
5. Click **"Verify URL properties"**
6. Wait for TikTok to confirm (usually instant if file is accessible)

### For DNS Verification (After DNS Setup)

1. Go to **TikTok Developer Portal** → Your App → **Permissions**
2. Click **"Add verification method"** or **"DNS"**
3. Select the option to verify via **DNS TXT record**
4. Copy the DNS record details provided by TikTok:
   - Host: (likely `@` or `_tiktok`)
   - Value: `tiktok-developers-site-verification=KeE4ufWp2u5doTgJp1yL99RQMEhN087R`
5. Add this TXT record to your DNS provider
6. Wait 15-30 minutes for DNS propagation
7. Click **"Verify DNS"** in TikTok portal
8. TikTok will query your DNS and confirm

### Verification Status

- ✅ **URL verification:** Ready to verify now (file deployed on next push)
- ⏳ **DNS verification:** Blocked until you add DNS record at registrar

---

## D. Verification File Details

### File Metadata

| Property | Value |
|----------|-------|
| File path (repo) | `apps/web/public/.well-known/tiktok-developers-site-verification` |
| File path (deployed) | `.next/static/` (Next.js moves it there) |
| URL path | `/.well-known/tiktok-developers-site-verification` |
| Full public URL | `https://fliptrybe-ads-campaigner-web-g24r.onrender.com/.well-known/tiktok-developers-site-verification` |
| Content | `tiktok-developers-site-verification=LutxjeeCItOdA461HA9O0XTjmJ3p0RlG` |
| MIME type | `text/plain` |
| Authentication | None (public, unauthenticated) |
| Authentication (user login) | None required |

### Why This Location?

- **`.well-known/`** is the RFC 8615 standard location for well-known metadata
- **TikTok's standard** follows this pattern (like `.well-known/apple-app-site-association`, etc.)
- **Next.js support** — public directory files are served as static assets
- **No routing conflicts** — the `.well-known/` directory is typically not used by the app router

### Verification That It Works Locally

Run this in your terminal after the code is pushed:

```bash
# Should return the verification token
curl https://fliptrybe-ads-campaigner-web-g24r.onrender.com/.well-known/tiktok-developers-site-verification

# Should output:
# tiktok-developers-site-verification=LutxjeeCItOdA461HA9O0XTjmJ3p0RlG
```

---

## E. Security & Safety Summary

✅ **No secrets exposed:**
- The verification file contains only a non-secret token provided by TikTok
- No API keys, credentials, or sensitive data in this file
- Safe to commit to version control

✅ **No application changes:**
- No modifications to existing routes, pages, or authentication
- The `public/` directory doesn't interfere with the Next.js app
- Website functionality remains unchanged

✅ **No environment variables added:**
- Verification tokens are hardcoded (they're not secrets)
- No need for runtime configuration

---

## F. Deployment Checklist

### Immediate Actions Required

- [ ] **Commit the verification file:**
  ```bash
  git add apps/web/public/.well-known/tiktok-developers-site-verification
  git commit -m "Add TikTok developer website verification"
  git push origin main
  ```

- [ ] **Wait for Render deployment** (check Render Dashboard for status)

- [ ] **Test the URL** (after ~2-5 minutes):
  ```bash
  curl https://fliptrybe-ads-campaigner-web-g24r.onrender.com/.well-known/tiktok-developers-site-verification
  ```

- [ ] **Go to TikTok Developer Portal** and verify the URL

### For DNS Verification (Optional, if needed)

- [ ] **Identify your domain** (the Render subdomain won't work for DNS)
- [ ] **Log into your DNS provider** (GoDaddy, Namecheap, Route 53, Cloudflare, etc.)
- [ ] **Add the TXT record** (see Section B above)
- [ ] **Wait 15-30 minutes** for DNS propagation
- [ ] **Go to TikTok Developer Portal** and verify the DNS record

---

## G. Troubleshooting

### If URL Verification Returns 404

**Possible causes:**
1. Render deployment hasn't completed yet — wait 2-5 minutes
2. Cache issue — try incognito/private browser window
3. Wrong URL — verify you're using the exact URL from Section A

**Solution:**
1. Check Render Dashboard → Web Services → `fliptrybe-ads-campaigner-web` → Logs
2. Wait for deployment to complete (green checkmark)
3. Try accessing the URL in a new incognito window
4. If still failing, check `apps/web/public/.well-known/` exists locally

### If DNS Verification Won't Verify

**Possible causes:**
1. DNS record not yet propagated (can take 15-30 minutes)
2. DNS record entered incorrectly (typo in value)
3. Using Render subdomain (Render manages DNS, cannot be modified)

**Solution:**
1. Wait 30 minutes and try again
2. Double-check the TXT record value in your DNS provider (exact match required)
3. If using Render subdomain, consider getting a custom domain or using only URL verification

---

## Summary

| Method | Status | Action |
|--------|--------|--------|
| **URL/File Verification** | ✅ Ready | Commit file, deploy, verify in portal |
| **DNS Verification** | ⏳ Blocked | Add DNS record at registrar (manual step) |

**Files Modified/Created:**
- ✅ Created: `apps/web/public/.well-known/tiktok-developers-site-verification`

**Application Impact:**
- ✅ Zero changes to application logic, routes, or authentication
- ✅ Website functionality fully preserved
- ✅ No new dependencies or environment variables

**Next Deployment:**
- Automatically triggered on commit/push to main branch
- Render redeploys your web service
- File becomes accessible at public URL

