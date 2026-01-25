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
│   └── supabase/
│       └── auth.ts          # AuthRepository for Supabase auth
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
