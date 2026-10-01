This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Auth configuration

Professional sign-up (`/signup/professional`) offers **Continue with Google** alongside email + password. In the Supabase dashboard:

1. **Authentication → Sign In / Providers → Google**: enable it and paste the OAuth **Client ID** and **Client Secret** from Google Cloud Console (APIs & Services → Credentials → OAuth client ID, type "Web application").
2. In that Google OAuth client, add the Supabase callback as an **Authorized redirect URI**: `https://<project-ref>.supabase.co/auth/v1/callback` (shown on the Supabase Google provider page).
3. **Authentication → URL Configuration**: set **Site URL** to the app URL and add every app origin to **Redirect URLs** with a wildcard on `/callback`, e.g. `https://app.example.com/callback**`, `https://*-<team>.vercel.app/callback**` (previews) and `http://localhost:3000/callback**`. Without these, Supabase falls back to the Site URL and drops the `?next=` path.
4. Set `NEXT_PUBLIC_APP_URL` in each environment; OAuth and email-confirmation links are built from it (falling back to the request/browser origin).

Flow: Google → `/callback?next=/onboarding/account` (PKCE code exchange) → `/onboarding/account` collects whatever OAuth skipped (US phone, Terms/Privacy consent recorded as `terms_accepted_at`/`terms_version` in user metadata, and name if Google didn't supply one) → `/onboarding/professional`. New Google users get role `contractor` from the `handle_new_user` default, so Google is intentionally not offered on `/login` or client/organization sign-up.

Phone numbers are stored in `profiles.phone` as E.164 (`+1XXXXXXXXXX`, US/NANP only — see `src/lib/phone.ts`).

When `REQUIRE_MFA=true`, `/onboarding/*` goes through the same MFA gate as other app pages.
