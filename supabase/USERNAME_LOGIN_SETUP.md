# Username login setup (Supabase)

This repository's existing login uses Supabase Auth email/password. Supabase Auth itself does not accept a username as the password-grant identifier, so this change adds a server-side username lookup without exposing account email addresses to the browser.

## What changed
- Signup now asks for a unique username as well as the existing required email, full name, role, and password.
- Login accepts either username or email plus password.
- Username-to-email mapping is stored in `public.auth_username_lookup`, with RLS enabled and no client policies.
- The `username-login` Edge Function performs the lookup using the service role key and then delegates password checking, email-confirmation enforcement, and auth rate limits to Supabase Auth.
- Unknown usernames and wrong passwords receive a generic response.

## Required Supabase setup
1. Open the project's Supabase SQL Editor and run `supabase/migrations/202610270001_username_login.sql`.
2. Deploy the Edge Function:
   ```sh
   supabase functions deploy username-login --no-verify-jwt
   ```
3. Set Edge Function secrets in the Supabase project:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

   Keep the service-role key in Supabase secrets only. Never put it in `config.js`, frontend code, or GitHub.
4. In Supabase Auth settings, keep email confirmations enabled if you want email verification before first login.
5. Test with a new account: sign up using a unique username and a valid email, confirm the email, then sign in with username/password and email/password.

## Notes
- Usernames are 3–24 characters and accept letters, numbers, underscores, and periods. Matching is case-insensitive.
- Existing accounts are backfilled with a generated `user_<id>` username to avoid collisions with legacy metadata. Existing users can continue signing in with email; new signups store the chosen username.
- Deploying code to GitHub alone does not deploy the SQL migration or Edge Function. The Supabase steps above are required.
- For production, also configure Supabase Edge Function rate limits / gateway protections and monitor failed authentication attempts.
