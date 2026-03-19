# CHANGELOG.md

> All notable changes to SketchAI are documented here.
> Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
> Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

### In Progress
- Supabase project setup — auth, database, RLS policies
- SQL migrations — profiles, diagrams, usage, subscriptions
- Rust backend scaffolding — Axum, SQLx, Supabase JWT verification
- React frontend scaffolding — Vite, TypeScript, Tailwind, Excalidraw, Supabase SDK

---

## [0.1.0] — Phase 1 MVP — Upcoming

### Added
- Initial project structure — React frontend, Rust/Axum backend
- Supabase integration — auth and PostgreSQL database
- Environment configuration via `.env`
- Health check endpoint `GET /health`

---

_Entries will be added here as features ship._

---

## Versioning Guide

| Version | Meaning |
|---|---|
| `0.x.x` | Pre-launch. Breaking changes are expected. |
| `1.0.0` | Public launch. Phase 1 complete. API stable. |
| `1.x.0` | New features, backwards compatible. |
| `1.x.x` | Bug fixes and patches. |