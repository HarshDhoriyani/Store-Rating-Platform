# Store Rating Platform

A full-stack store-rating application provides role-based access for administrators, registered users, and store owners.

## Features

### System administrators

- View dashboard totals for users, stores, and submitted ratings.
- Create users with the administrator, normal-user, or store-owner role.
- Create stores and optionally assign an existing store owner.
- Search and filter listings by name, email, address, and user role.
- Sort user and store listings by supported fields.
- Open user details; store-owner details include their store rating.

### Normal users

- Register and sign in.
- Browse and search stores by name or address.
- View each store's average rating and their own submitted rating.
- Submit a 1–5 star rating or update a previous rating.
- Change their password.

### Store owners

- Sign in and change their password.
- View the average rating for their assigned store and the users who rated it.

### Shared

- One login flow for all roles; access is enforced by the API.
- Responsive React interface.
- Password hashing with bcrypt and signed, expiring JWTs.
- Helmet security headers, authentication rate limiting, parameterized SQL queries, and role checks.
- MySQL uniqueness and foreign-key constraints, including one rating per user/store pair.

## Technology

- **Frontend:** React 19, Vite
- **API:** Node.js, Express 5
- **Database:** MySQL 8+
- **Authentication:** JSON Web Tokens and bcrypt

## Requirements

- Node.js 20 or newer
- npm
- MySQL 8 or newer, with an account allowed to create/use the configured database

## Local setup

1. Install packages:

   ```sh
   npm ci
   ```

2. Copy `.env.example` to `.env` and set your local MySQL credentials and a unique JWT secret. In PowerShell, run `Copy-Item .env.example .env`; in macOS/Linux, run `cp .env.example .env`. Keep `.env` private; it is ignored by Git.

3. (Recommended) Provide the initial administrator details in `.env` before database setup:

   Set `ADMIN_NAME` to a real 20–60 character name, `ADMIN_EMAIL` to the administrator's email, and `ADMIN_PASSWORD` to a private password that meets the rules below. Do not copy a password from documentation or commit it to Git.

   The name must be 20–60 characters. Passwords must be 8–16 characters and include an uppercase letter and a special character. Set all three administrator variables together or leave all three empty.

4. Create the database tables and optionally the initial administrator:

   ```sh
   npm run db:setup
   ```

   This command creates missing tables and only creates the initial administrator when all `ADMIN_*` values are set. It does **not** create demo users, stores, or ratings, and does not clear existing application data. After the first administrator has been created, remove the bootstrap password from the environment.

5. Start the API and frontend:

   ```sh
   npm run dev
   ```

6. Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The Vite development server proxies `/api` requests to the Express API on port `3001`.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DB_HOST` | MySQL hostname | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | Empty |
| `DB_NAME` | Application database | `store_rating` |
| `JWT_SECRET` | Secret used to sign access tokens | Local development fallback only; required in production |
| `PORT` | Express listening port | `3001` |
| `HOST` | Express bind address | `0.0.0.0` |
| `NODE_ENV` | Runtime environment | Set by the runtime |
| `FRONTEND_ORIGIN` | Comma-separated allowed browser origins in production | Required in production |
| `ADMIN_NAME` | Optional initial administrator name | Unset |
| `ADMIN_EMAIL` | Optional initial administrator email | Unset |
| `ADMIN_PASSWORD` | Optional initial administrator password | Unset |

Use a long, randomly generated `JWT_SECRET` and a least-privilege MySQL account outside local development. Never commit `.env` or paste real credentials into source files.

## Database

The setup script creates these tables:

- `users`: account profile, password hash, and role.
- `stores`: store contact details and optional owner relationship.
- `ratings`: user/store rating from 1 to 5, with a unique user/store constraint.

The database setup script is an idempotent initial schema bootstrap, not a versioned migration system. Back up production data and use a migration process for future schema changes. The script does not reset or seed sample records.

## API overview

All endpoints are prefixed with `/api`. Authenticated requests use `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/signup` | Public | Register a normal user |
| `POST` | `/auth/login` | Public | Sign in and receive a token |
| `PUT` | `/auth/password` | Any signed-in role | Change the current user's password |
| `GET` | `/admin/dashboard` | Administrator | Read application totals |
| `GET` | `/admin/stores` | Administrator | Search/sort stores and average ratings |
| `POST` | `/admin/stores` | Administrator | Create a store and optionally assign its owner |
| `GET` | `/admin/users` | Administrator | Filter/sort users |
| `GET` | `/admin/users/:id` | Administrator | Read user details |
| `POST` | `/admin/users` | Administrator | Create an account with a role |
| `GET` | `/admin/store-owners` | Administrator | List store owners for assignment |
| `GET` | `/stores` | Normal user / Administrator | Search stores and read ratings |
| `POST` | `/stores/:id/rating` | Normal user | Submit or update a 1–5 rating |
| `GET` | `/owner/dashboard` | Store owner | Read assigned store rating and raters |
| `GET` | `/health` | Public | Application health check |

## Commands

```sh
npm run dev       # Run frontend and API for local development
npm run build     # Build the frontend for production
npm test          # Run validation tests
npm run check     # Build and run tests
npm start         # Start the Express application
npm run db:setup  # Create missing schema and optional initial administrator
```

## Production deployment checklist

1. Configure production MySQL credentials, a unique strong `JWT_SECRET`, `NODE_ENV=production`, and the exact frontend origin in `FRONTEND_ORIGIN`.
2. Use HTTPS at the hosting platform or trusted reverse proxy.
3. Use a least-privilege database user; do not use MySQL `root`.
4. Build the client with `npm ci` and `npm run build`, then start Express with `npm start`. In production, Express serves the built `dist` frontend and API from the same origin.
5. Create the first administrator through the one-time `ADMIN_*` environment values and remove `ADMIN_PASSWORD` after setup.
6. Configure database backups, monitoring, and a shared rate-limit store before running multiple API instances.
7. Review hosting-specific environment settings and run an end-to-end check with the production database before accepting real traffic.

This repository is prepared for professional code evaluation, but it is not a substitute for deployment-specific security review, database migrations, monitoring, or operational controls required for a live commercial service.

## Tests

`npm test` currently covers the password validation rules. `npm run check` verifies the frontend production build and the validation tests.
