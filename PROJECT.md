# ROTZ Project Guide

This document outlines the high-level architecture and how to deploy and operate ROTZ.

## Architecture
- Remix app served by Node (`remix-serve`)
- Local SQLite database via `better-sqlite3` (persisted in `/data/rotz.sqlite`)
- Cookie-based sessions (`sid`) and local auth
- Admin API and panel for user management
- Provider keys and preferences persisted per user
- LLM providers (OpenAI, Anthropic, Groq, OpenRouter, HuggingFace, Mistral, xAI, DeepSeek, Bedrock) plus local providers (Ollama, LM Studio, OpenAI-compatible)

## Key paths
- Auth/session: `app/lib/server/auth.ts`
- Database: `app/lib/server/db.ts`
- Admin: `app/routes/api.admin.users.ts`, UI in `app/components/@settings/tabs/users/AdminPanel.client.tsx`
- Auth routes: `/api/auth/local/login`, `/api/auth/local/logout`, `/api/auth/local/bootstrap`
- API keys persistence: `/api/user/api-keys`

## Deploy
See README for docker compose. Ensure `./data` is writable by Docker.

## Operations
- Bootstrap first admin via `/api/auth/local/bootstrap`
- Rotate cookies by restarting app
- Backup: snapshot `./data/rotz.sqlite`
- Restore: stop app, replace sqlite file, start app

## Roadmap
- Encrypt API keys at rest using an environment secret
- Conversation/history persistence in SQLite (optional)
- Audit logs for admin actions
- Rate limiting and brute-force protection on login
