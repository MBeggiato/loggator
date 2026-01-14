# Loggator - Copilot Instructions

## Architecture Overview

This is a **SvelteKit 2** application using:

- **Svelte 5** with runes (`$props`, `$state`, `$derived`, `$effect`)
- **TypeScript** with strict mode enabled
- **Vite 7** for bundling
- **adapter-auto** for deployment flexibility

## Key Project Conventions

### Svelte 5 Runes (Critical)

- Use **Svelte 5 runes syntax**, not the older `export let` prop syntax
- Props: `let { children } = $props()` (see [+layout.svelte](../src/routes/+layout.svelte#L4))
- State: `let count = $state(0)`
- Derived: `let doubled = $derived(count * 2)`
- Effects: `$effect(() => { ... })`

### File Structure

- Routes in `src/routes/` follow SvelteKit file-based routing
- Reusable components/utilities go in `src/lib/`
- Use `$lib` alias for imports: `import { thing } from '$lib/components'`
- Static assets in `src/lib/assets/` can be imported directly (e.g., [favicon](../src/routes/+layout.svelte#L2))
- Public static files in `static/` are served from root

### TypeScript

- Strict TypeScript is enabled (`strict: true`)
- `allowJs` and `checkJs` are enabled - all JS files are type-checked
- Path aliases managed by SvelteKit config, not tsconfig.json
- Always use `rewriteRelativeImportExtensions: true` for proper module resolution

### Code Quality

- ESLint uses flat config format ([eslint.config.js](../eslint.config.js))
- Prettier for formatting with `prettier-plugin-svelte`
- `no-undef` rule is disabled for TypeScript files (TypeScript handles this)
- Svelte-specific ESLint rules from `eslint-plugin-svelte` are enabled

## Essential Commands

```bash
bun run dev              # Start dev server (Vite)
bun run build            # Production build
bun run preview          # Preview production build locally
bun run check            # Type-check with svelte-check
bun run check:watch      # Type-check in watch mode
bun run format           # Format all files with Prettier
bun run lint             # Run Prettier check + ESLint
```

## Development Workflow

1. **Adding new routes**: Create `+page.svelte` in `src/routes/<path>/`
2. **Layouts**: Use `+layout.svelte` for shared UI (see [root layout](../src/routes/+layout.svelte))
3. **Type-safety**: Run `bun run check` before committing to catch type errors
4. **Syncing types**: SvelteKit auto-generates types in `.svelte-kit/` - use `svelte-kit sync` if out of sync

## Important Notes

- This project uses **ESM** (`"type": "module"` in package.json)
- Svelte 5 is a major change from Svelte 4 - always use runes, not legacy reactive syntax
- The `prepare` script runs `svelte-kit sync` to keep generated types updated
