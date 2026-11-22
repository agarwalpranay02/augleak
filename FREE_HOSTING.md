# Free hosting: Vercel and Neon

The audit, the inspector, the registry, the research pages and the exposure endpoint need nothing but Vercel.
Sign-in and API keys also need a Postgres database (Neon's free plan is enough).

## 1. Vercel
1. Import this repository in Vercel.
2. Set **Root Directory** to `apps/web`; the framework preset is detected as Next.js.
3. Add environment variables:
   - `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL`: your site URL, for example `https://augleak.vercel.app`
   - `BETTER_AUTH_SECRET`: `openssl rand -hex 32`
   - `API_KEY_PEPPER`: `openssl rand -hex 24` (never change it later, or existing keys stop working)
4. Deploy. Without a database the site works fully, and the account page says that sign-in is switched off.

## 2. Accounts and API keys (optional)
1. Create a free Neon project and copy its pooled connection string into `DATABASE_URL`.
2. Set `AUTO_MIGRATE=1` so the tables are created on the first request.
3. Google sign-in: create an OAuth client (Web application) in Google Cloud, add
   `https://<your-site>/api/auth/callback/google` as an authorised redirect URI, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Email sign-in links (optional): set `RESEND_API_KEY` and an `EMAIL_FROM` on a domain verified in Resend.
5. Redeploy.

## 3. Rate limits across instances (optional)
Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to share rate limits between serverless instances; without them, limits are kept per instance.
