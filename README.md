# ROTZ

ROTZ is an AI builder based on Bolt DIY, rebranded and adapted to run entirely self‑hosted with a local database. It provides:

- Local, containerized deployment (Ubuntu 24.04 ready)
- Built‑in auth with cookie sessions, roles (admin/user/blocked), and whitelist support
- Admin panel for user management (create/remove/block/whitelist)
- Secure storage for provider API keys in a local SQLite database
- Support for custom LLM endpoints including local providers (Ollama, LM Studio, OpenAI‑compatible)

## What changed vs. upstream

- Rebranded to ROTZ (product name and metadata)
- Switched from Cloudflare Pages runtime to Node server (`remix-serve`)
- Added local SQLite (`better-sqlite3`) database mounted to a volume
- Implemented local auth (no Supabase required)
- Added admin API and UI for user management
- Locked server endpoints (chat/models/llm calls) behind local session auth

## Quick start (Docker, Ubuntu 24.04)

Prereqs:
- Docker Engine and Compose
- Git

Clone and build:
```bash
git clone https://github.com/rotzmediagroup/rotz_ai_builder.git
cd rotz_ai_builder
# Optional: create a local env file for API keys
cp .env.local.example .env.local || true
# Build and start production profile
docker compose --profile production up -d --build
```

By default the app runs on port 3000 in production.

Persisted data:
- SQLite DB is stored in `./data/rotz.sqlite` (mounted to `/data` in the container)

### Bootstrap the first admin user
Only required once when the `users` table is empty.
```bash
# Replace with your admin email/password
curl -X POST http://localhost:3000/api/auth/local/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"ChangeMe!"}'
```
Then open `http://<your-server>:3000/login`, sign in, and manage users in Settings → Users.

## Environment variables
You can set these in `.env.local` (used by docker-compose) or pass via environment.

- DB_DIR: Directory for database (default `/data`)
- Provider keys (optional):
  - OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, OPEN_ROUTER_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY, HuggingFace_API_KEY, TOGETHER_API_KEY, XAI_API_KEY
- Custom endpoints (optional):
  - OLLAMA_API_BASE_URL (e.g., `http://host.docker.internal:11434` or your LAN host)
  - OPENAI_LIKE_API_BASE_URL
  - TOGETHER_API_BASE_URL
- App tuning (optional):
  - VITE_LOG_LEVEL (default: `debug`)
  - DEFAULT_NUM_CTX (default: `32768`)

## Development (local)

Prereqs:
- Node.js >= 18.18 (Node 20 recommended)
- pnpm

Install and run:
```bash
pnpm install
pnpm run dev
```
Dev server runs on port 5173. For production parity (Node runtime + SQLite), prefer running with Docker.

## Production (compose overview)

`docker-compose.yaml` (profile `production`) configures:
- Port mapping: `3000:3000`
- DB volume: `./data:/data`
- Environment from `.env.local` if present
- Command: `pnpm run start:node` (remix-serve)

Useful commands:
```bash
# Build & start
docker compose --profile production up -d --build
# Logs
docker compose logs -f app-prod
# Restart
docker compose --profile production restart app-prod
# Stop
docker compose --profile production down
```

## Admin panel & roles
- Admins can view/update users, set role to `admin`/`user`/`blocked`, and toggle whitelist
- Only authenticated users can access chat/model APIs
- Blocked users receive `403` on protected endpoints

## API keys
- Enter API keys in Settings → Providers. Keys are stored in cookies on the client for immediate use
- Keys are also POSTed to the server endpoint and stored in the local DB per user for persistence
- You can later fetch/export them via the data tab or via `GET /api/user/api-keys`

## Local LLMs (Ollama/LM Studio/OpenAI‑compatible)
- Configure base URLs in Settings → Local Providers (or Providers → Cloud, for OpenAI‑compatible)
- For Docker, if Ollama runs on the host, use `http://host.docker.internal:11434` on Docker Desktop,
  or your server's LAN IP if on Linux

## Security notes
- Sessions use an HTTP‑only cookie (`sid`), SameSite=Lax, Secure when `NODE_ENV=production`
- API keys are stored in the DB as provided; consider setting up encryption at rest if required for your environment

## Upgrading
```bash
git pull
# Rebuild and restart
docker compose --profile production up -d --build
```

## Troubleshooting
- 401 Unauthorized on `/`: visit `/login` and sign in
- No admin exists: call bootstrap endpoint again only if the users table is empty
- Database issues: check `./data/rotz.sqlite` permissions; container user must be able to read/write
- Ollama not reachable: verify `OLLAMA_API_BASE_URL` is correct and reachable from the container

## License
MIT (Parts derived from Bolt DIY).