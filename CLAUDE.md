# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in a chat interface, and the AI generates React code that renders in real-time within a sandboxed iframe.

## Commands

```bash
npm run setup      # Install deps, generate Prisma client, run migrations
npm run dev        # Start dev server with Turbopack (http://localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm run test       # Vitest (jsdom environment)
npm run db:reset   # Reset database with Prisma
```

Run a single test:
```bash
npx vitest run src/lib/__tests__/file-system.test.ts
```

## Architecture

### Core Flow

1. **Chat Interface** (`src/components/chat/`) - User describes desired component
2. **API Route** (`src/app/api/chat/route.ts`) - Streams AI responses using Vercel AI SDK with Claude
3. **AI Tools** - Two custom tools manipulate the virtual file system:
   - `str_replace_editor` (`src/lib/tools/str-replace.ts`) - Create/edit files with view, create, str_replace, insert commands
   - `file_manager` (`src/lib/tools/file-manager.ts`) - Rename/delete files
4. **Virtual File System** (`src/lib/file-system.ts`) - In-memory file system, no disk writes
5. **Live Preview** (`src/components/preview/PreviewFrame.tsx`) - Transforms JSX via Babel, creates import map with blob URLs, renders in sandboxed iframe

### Key Contexts

- **FileSystemContext** (`src/lib/contexts/file-system-context.tsx`) - Manages VirtualFileSystem state, handles tool calls from AI
- **ChatContext** (`src/lib/contexts/chat-context.tsx`) - Wraps Vercel AI SDK's useChat, syncs with file system

### Preview System

`src/lib/transform/jsx-transformer.ts` handles:
- JSX/TSX transformation via Babel
- Import map generation with blob URLs for local files
- Third-party packages resolved via esm.sh
- CSS file collection and injection
- `@/` alias resolution (maps to root `/`)

### Database

SQLite via Prisma (`prisma/schema.prisma`):
- `User` - email/password auth
- `Project` - stores messages (JSON) and file system data (JSON) per user

### Authentication

JWT-based sessions in `src/lib/auth.ts`, middleware protects `/api/projects` and `/api/filesystem` routes.

### AI Provider

`src/lib/provider.ts` - Uses Claude claude-haiku-4-5 when `ANTHROPIC_API_KEY` is set, otherwise falls back to MockLanguageModel for demo purposes.

## Conventions

- Entry point for generated apps is always `/App.jsx`
- All local imports use `@/` alias (e.g., `@/components/Button`)
- Components styled with Tailwind CSS, not inline styles
- System prompt in `src/lib/prompts/generation.tsx`
