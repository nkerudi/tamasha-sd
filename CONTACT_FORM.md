# Contact form backend

The Contact Us form sends messages to the `contact-submit` Supabase Edge
Function. The function validates the message, applies spam and rate-limit
checks, and inserts it into `public.contact_submissions`. Browser clients have
no direct database access.

## Deploy the backend

From the repository root:

```bash
npx supabase login
npx supabase link --project-ref mwjnoesjvajyiolxtxjj
npx supabase db push
npx supabase functions deploy contact-submit
```

The hosted function automatically receives the Supabase URL and backend keys.
Never put a secret or `service_role` key in the website code.

## Test locally

The deployed function permits the local origins used by this project. Start
the static site:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/contact.html`, send a test message, then open
**Table Editor > contact_submissions** in Supabase. A new row should have a
status of `new`.

Board members can use the Table Editor to change `status`, `assigned_to`, and
`internal_notes`. Direct public reads and writes are blocked by Row Level
Security.

## Add the production website

After the site has a production URL, allow it in addition to localhost:

```bash
npx supabase secrets set ALLOWED_ORIGINS="https://tamashasd.org,https://www.tamashasd.org" --project-ref mwjnoesjvajyiolxtxjj
```

Replace those domains if the final host uses a different URL. Edge Function
secrets update without another deployment.

## Limits and spam controls

- All inputs are validated again by the backend.
- The hidden honeypot absorbs simple form bots.
- A client may submit five times per ten-minute window.
- Client network addresses are irreversibly hashed and never stored directly.
- Messages are limited to 5,000 characters.
