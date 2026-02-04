# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Nuxt 4** application built with **TypeScript**, **Vue 3 Composition API**, and **Supabase** for authentication and database. The project uses **Bun** as its primary package manager and **Nuxt UI v4** (Tailwind CSS) for the component library. **Zod v4** is used for schema validation.

## Development Commands

```bash
# Primary package manager is Bun (npm/pnpm/yarn alternatives exist)
bun install              # Install dependencies

# Database operations
bun run gen:types        # Generate TypeScript types from Supabase (requires SUPABASE_DB_URL env var)
bun run seed:users       # Seed database with test users

# Linting (ESLint is configured via @nuxt/eslint)
# Run via your IDE or add a lint script if needed

# Type checking
npx nuxt typecheck      # Run TypeScript type checking before completing tasks
```

## Environment Variables

Required in `.env`:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `SUPABASE_DB_URL` - PostgreSQL database URL (for type generation)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `WATERMARK_API_KEY` - API key for watermark microservice (x-api-key header)
- `WATERMARK_BASE_URL` - Base URL of watermark microservice (default: http://localhost:8005)

## Architecture

### Directory Structure

```
app/                          # Nuxt app directory (Vue 3 Composition API)
├── assets/css/               # Global styles (Tailwind + Nuxt UI)
├── entities/                 # Zod schemas and type definitions
│   └── *.schema.ts          # Domain schemas (use z.record(keySchema, valueSchema) for JSON fields)
├── pages/                    # File-based routing
│   ├── index.vue            # Home page
│   └── login.vue            # Login page with auth
├── repositories/             # Data access layer (Repository pattern)
│   ├── supabase/
│   │   └── auth.ts          # AuthRepository for Supabase auth
│   └── watermark.ts          # WatermarkRepository for watermark service
├── types/                    # TypeScript definitions
│   └── database.types.ts    # Generated from Supabase (do not edit manually)

server/api/                   # Server API routes (Nitro serverless)
└── generate-product.ts      # API endpoints

scripts/                      # Utility scripts
└── seed-users.ts            # Database seeding
```

### Key Patterns

**Entity Schemas** (Zod v4): Domain entities are defined as Zod schemas in `app/entities/*.schema.ts`. Each schema corresponds to a database table with proper types, defaults, and validations. Export both `Schema` (for validation), `Type` (output type), and `InsertType` (input type).

**Zod v4 Syntax Notes**:
- JSON/JSONB columns: `z.record(keySchema, valueSchema)` - requires both key and value schemas
- Example: `z.record(z.string(), z.any())` for string-keyed objects with any values
- Do NOT use `z.record(z.any())` - this is v3 syntax and will error

**Repository Pattern**: Data access is abstracted through repository classes in `app/repositories/supabase/`. For example, `AuthRepository` encapsulates all Supabase authentication logic. Follow this pattern for new data access (e.g., `UserRepository`, `ProductRepository`).

**WatermarkRepository**: Client for watermark microservice at `app/repositories/watermark.ts`. Handles POST requests to `/water-mark` endpoint with image_url and optional parameters (position, opacity).

**Type-Safe Forms**: Forms use Zod schemas with Nuxt UI's `UAuthForm` component. See `login.vue` for the pattern - define a `z.object()` schema, type it with `z.output<typeof schema>`, and pass to the form component.

**Supabase Integration**: The `@nuxtjs/supabase` module provides `useSupabaseClient()` and `useSupabaseUser()` composables. Auth redirects are configured in `nuxt.config.ts` (login: `/login`, callback: `/confirm`).

**Server API Routes**: Place server-side endpoints in `server/api/`. These are Nitro serverless functions that can access environment variables directly.

**Type Generation**: After database schema changes, run `bun run gen:types` to regenerate `app/types/database.types.ts` from Supabase. Import types for type-safe queries.

**Quality Gate**: Before completing any task that involves code changes, run `npx nuxt typecheck` to ensure TypeScript types are correct and there are no type errors.

**UTable Hydration**: When using `UTable` with custom column render functions, always resolve components at module level (top of `<script setup>`) to avoid hydration mismatches. Do NOT call `resolveComponent()` inside `cell` functions.

### Configuration Files

- `nuxt.config.ts` - Main Nuxt config, enables modules (Content, ESLint, UI, Supabase)
- `eslint.config.mjs` - Extends `.nuxt/eslint.config.mjs` (auto-generated)
- `tsconfig.json` - Project references to Nuxt-generated configs

### MCP Servers (for Claude Code)

The project has MCP servers configured in `.claude/settings.json`:
- **nuxt-ui-remote** - Nuxt UI component documentation at https://ui.nuxt.com/mcp
- **supabase** - Local Supabase MCP at http://localhost:8000/mcp (must be running)

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->



"categories":
[{
"id":"629",
"name":"Nước Tẩy Trang",
"slug":"nuoc-tay-trang"
},
{
"id":"716",
"name":"Tẩy trang",
"slug":"tay-trang"
},
{
"id":"238",
"name":"Shiseido",
"slug":"shiseido"
}]
