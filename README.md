# Yorbis Prospect Intelligence

Private, CEO-first prospect discovery for Yorbis. The application uses Gemini-grounded research, Turso persistence, and Auth.js email-link access.

Approved login addresses:

- `sun@yorbisapp.com`
- `anant@yorbisapp.com`

## Production environment

Configure every variable listed in `.env.example` in Vercel. Never commit real credentials.

`AUTH_EMAIL_FROM` must use a sender/domain verified in Resend. Generate `AUTH_SECRET` with a cryptographically secure random value.

## Data setup

The app creates the required Turso tables on first authenticated use. Running `npm run seed` initializes the schema without adding synthetic prospects.

## Development

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
