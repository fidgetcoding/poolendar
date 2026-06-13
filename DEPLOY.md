# Poolendar Deployment Guide

## 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com) under the `lorecraft-io` org.
2. Run the initial migration — either:
   - CLI: `supabase db push` from the repo root (requires `supabase` CLI linked to the project)
   - Manual: paste `supabase/migrations/001_initial_schema.sql` into the SQL Editor in the dashboard
3. Copy these values from **Project Settings > API**:
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_ANON_KEY` (anon/public key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role key — never expose client-side)
4. Under **Authentication > Providers**, enable Google OAuth with the same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` used in `.env`.
5. Set the Site URL to `https://poolendar.com` and add `https://poolendar.com/callback` to the Redirect URLs.

## 2. Vercel Setup

1. Import repo from GitHub (`fidgetcoding/poolendar`).
2. Set **Root Directory** to `apps/web`.
3. Set **Framework Preset** to `Next.js`.
4. Add environment variables (all from `.env.example`):

   | Variable | Value | Exposure |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase | Client + Server |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase | Client + Server |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase | Server only |
   | `GOOGLE_CLIENT_ID` | from GCP console | Server only |
   | `GOOGLE_CLIENT_SECRET` | from GCP console | Server only |
   | `GOOGLE_REDIRECT_URI` | `https://poolendar.com/api/auth/google/callback` | Server only |
   | `RESEND_API_KEY` | from Resend | Server only |
   | `RESEND_FROM_EMAIL` | `noreply@poolendar.com` | Server only |
   | `NEXT_PUBLIC_APP_URL` | `https://poolendar.com` | Client + Server |
   | `NEXT_PUBLIC_BOOKING_DOMAIN` | `poolendar.com` | Client + Server |

5. Deploy. Vercel will run `npm install` then `cd apps/web && npm run build`.

## 3. DNS: Squarespace to Vercel

The domain `poolendar.com` is currently managed through Squarespace DNS.

### Current Records (to be replaced)

- 4x A records pointing to Squarespace IPs (198.185.159.144, 198.185.159.145, 198.49.23.144, 198.49.23.145)
- CNAME `www` pointing to `ext-cust.squarespace.com`
- TXT records for DKIM, DMARC, SPF (email — keep these)

### Steps

1. **Vercel: add domains**
   - Go to Vercel Project Settings > Domains
   - Add `poolendar.com`
   - Add `www.poolendar.com`
   - Add `*.poolendar.com` (for booking-page subdomains)

2. **Squarespace DNS: update records**
   - Navigate to Domains > poolendar.com > DNS > DNS Settings > Custom Records
   - **Delete** all 4 A records (the 198.x.x.x Squarespace IPs)
   - **Add** A record: Host `@`, Value `76.76.21.21` (Vercel)
   - **Update** CNAME `www` to point to `cname.vercel-dns.com` (replace `ext-cust.squarespace.com`)
   - **Add** CNAME `*` pointing to `cname.vercel-dns.com` (wildcard for booking subdomains)

3. **Keep all existing TXT records** (SPF, DKIM, DMARC) — those are for email delivery and are unrelated to hosting.

4. **SSL**: Vercel auto-provisions certificates via Let's Encrypt once DNS propagates (typically <15 min, can take up to 48h).

### Verification

After DNS propagation:
- `https://poolendar.com` loads the Next.js app
- `https://www.poolendar.com` redirects to apex (Vercel handles this)
- `https://anyuser.poolendar.com` hits the booking-page subdomain route (middleware.ts rewrites to `/(booking)`)

## 4. Wildcard Subdomain Booking Pages

Booking pages use `{username}.poolendar.com`. The infrastructure for this:

- **DNS**: the `*` CNAME record above covers all subdomains
- **Vercel**: the `*.poolendar.com` domain entry enables wildcard routing
- **App**: `middleware.ts` detects subdomains that are not `app`, `www`, `poolendar`, or `localhost` and rewrites the request to the `/(booking)` route group, passing the username via `x-booking-username` header

No additional configuration is needed beyond the DNS and Vercel domain entries.

## 5. Google OAuth Redirect URI

Update the authorized redirect URI in the Google Cloud Console OAuth credentials:
- Remove: `http://localhost:3000/api/auth/google/callback`
- Add: `https://poolendar.com/api/auth/google/callback`
- Keep localhost for local development if using a separate OAuth client.
