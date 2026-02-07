# WordPress Blog Sync Feature Design

**Goal:** Sync WordPress blog posts to Supabase with a manual sync button in the UI.

**Approach:** Create a dedicated `WordPressBlogRepository` following the existing repository pattern, using WordPress REST API v2 endpoints.

---

## Overview

This feature pulls published blog posts from a WordPress site and stores them in Supabase. Users trigger syncs manually from a new `/blogs` page. The system handles pagination, shows real-time progress, and updates existing posts by WordPress ID.

**Key Requirements:**
- Sync core fields: title, slug, content (HTML), excerpt, featured image
- Include metadata: status, dates, author, Yoast SEO fields, categories, tags
- Full sync strategy: insert new posts, update existing by `wordpress_id`
- Paginated fetch with progress indicator
- Manual sync button on dedicated blogs page

---

## Architecture

### Components

```
┌─────────────┐      ┌─────────────────┐      ┌──────────────────┐
│   Frontend  │ ───> │  API Route      │ ───> │  WordPress REST  │
│  /blogs.vue │      │  /sync/posts    │      │      API v2      │
└─────────────┘      └─────────────────┘      └──────────────────┘
                             │
                             ▼
                      ┌──────────────────┐
                      │  Supabase        │
                      │  posts table     │
                      └──────────────────┘
```

### New Repository

**File:** `app/repositories/supabase/wordpress-blog.ts`

```typescript
export class WordPressBlogRepository {
  private getConfig() { /* Reuse WooCommerce credentials */ }

  async listPosts(options: {
    page?: number
    perPage?: number
    status?: string
  }): Promise<WpPost[]>

  async getTotalPosts(): Promise<number>

  transformPost(wpPost: WpPost): SupabasePost
}
```

The repository reuses WordPress OAuth credentials from the existing `WooCommerceRepository` config.

---

## Data Schema

### Supabase Table: `posts`

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wordpress_id BIGINT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image_url TEXT,
  featured_image_alt TEXT,
  status TEXT NOT NULL,
  wordpress_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  wordpress_date TIMESTAMPTZ,
  wordpress_modified TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  author_id BIGINT,
  author_name TEXT,

  seo_title TEXT,
  seo_description TEXT,
  seo_focus_keyword TEXT,

  categories JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX idx_posts_wordpress_id ON posts(wordpress_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_wordpress_date ON posts(wordpress_date DESC);
```

### WordPress API Endpoints Used

- `GET /wp-json/wp/v2/posts` - List posts
- `GET /wp-json/wp/v2/posts/{id}` - Single post
- `GET /wp-json/wp/v2/media/{id}` - Featured image details

### Field Mapping

| WordPress | Supabase | Notes |
|-----------|----------|-------|
| `id` | `wordpress_id` | Unique key for upsert |
| `title.rendered` | `title` | HTML rendered title |
| `slug` | `slug` | URL slug |
| `content.rendered` | `content` | HTML content |
| `excerpt.rendered` | `excerpt` | May be null |
| `link` | `wordpress_url` | Original permalink |
| `date` | `wordpress_date` | ISO 8601 |
| `modified` | `wordpress_modified` | ISO 8601 |
| `status` | `status` | 'publish', 'draft', etc. |
| `author` | `author_id` | WordPress user ID |
| `yoast_meta` | `seo_*` | Parsed from meta array |

---

## API Endpoints

### POST /api/sync/wordpress/posts

Triggers sync and streams progress via Server-Sent Events.

**Request:**
```http
POST /api/sync/wordpress/posts
```

**Response (SSE stream):**
```
data: {"status":"started","message":"Starting sync..."}

data: {"status":"progress","total":150,"processed":45}

data: {"status":"complete","total":150,"processed":150,"message":"Sync complete!"}
```

**Implementation:**
1. Fetch total post count from WordPress
2. Paginate through posts (20 per page)
3. Transform and upsert each post to Supabase
4. Stream progress after each batch
5. Handle errors and send error events

### GET /api/posts

List synced posts with pagination.

**Query params:** `page` (default 0), `limit` (default 20)

**Response:** Array of post objects ordered by `wordpress_date` DESC.

---

## Frontend

### New Page: /blogs

**File:** `app/pages/blogs.vue`

**Features:**
- Table listing synced posts (title, date, status, last synced)
- "Sync from WordPress" button with loading state
- Real-time progress bar during sync
- Error alerts with retry option
- Post title links to individual post view (future)

**State Management:**
- `posts` - Array of synced posts
- `syncing` - Boolean sync state
- `syncProgress` - Object with `{ total, processed, message, status }`

**Sync Flow:**
1. User clicks sync button
2. Frontend opens SSE connection to `/api/sync/wordpress/posts`
3. Update progress bar as events arrive
4. On complete, refresh posts list
5. Show success/error alert

### Composable: useWordPressSync

**File:** `app/composables/useWordPressSync.ts`

Extracts sync logic for reuse across components. Returns `syncing`, `progress`, and `sync()` function.

---

## Error Handling

### Scenarios

| Scenario | Handling |
|----------|----------|
| WordPress API unreachable | Catch error, send SSE error event, show alert with retry |
| Auth credentials missing | Reuse WooCommerceRepository error message |
| Malformed post data | Validate with Zod, skip post, log warning, count in summary |
| Request timeout | Paginated approach prevents timeout; retry failed pages |
| Duplicate wordpress_id | Upsert handles automatically; update existing record |

### User Feedback

- **Progress:** "45/100 posts synced" with percentage bar
- **Success:** "Synced 100 posts successfully, 2 skipped"
- **Error:** Clear message with retry button
- **Validation errors:** Counted in final summary

---

## Implementation Tasks

1. Create `posts` table in Supabase via migration
2. Generate TypeScript types: `bun run gen:types`
3. Create `WordPressBlogRepository` class
4. Add Zod schema in `app/entities/Post.schema.ts`
5. Build sync API endpoint with SSE streaming
6. Create list posts API endpoint
7. Build `/blogs.vue` page with sync button
8. Create `useWordPressSync` composable
9. Test with real WordPress site
10. Typecheck and test all endpoints

---

## Future Enhancements

- Automatic scheduled syncs (cron job)
- Sync by date range (e.g., last 7 days)
- Individual post view page at `/blogs/[slug]`
- Post editing and re-publishing to WordPress
- Category/tag filtering in list view
- Bulk operations (delete, unpublish)
