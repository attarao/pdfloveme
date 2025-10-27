# PDFLoveMe — SaaS (GitHub-ready)

This repository contains a production-ready starter for a SaaS PDF tools site (frontend + backend + nginx + MongoDB).
Features included:
- Email/password signup & login (bcrypt + JWT)
- Auto-generated API keys at signup
- User plans: Free & Premium (limits enforced)
- PDF tools API: merge / split / compress / convert / sign (pdf-lib + LibreOffice)
- Rate-limiting per-user based on plan
- Docker + Docker Compose, Nginx reverse proxy (Let's Encrypt readiness)
- GitHub-ready structure and `.env.example`

## Quick start (development)
1. Copy `.env.example` to `.env` and edit values.
2. `docker compose up --build`
3. Backend API: `http://localhost:4000/api/...`
4. Frontend: served by nginx at `http://localhost` (configure hosts file or use real domain for SSL)

## Production notes
- The `backend` Dockerfile includes LibreOffice for conversion but increases image size.
- You must point DNS of your domain to the server and allow ports 80/443 for Certbot to issue certificates.
- Secure the `.env` and change JWT_SECRET.
- Consider adding email confirmation and payment gateway for paid plans (stripe integration not included by default).

