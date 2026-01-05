# Server & Development Rules

## Development Server Management

- **DO NOT start development servers** - user manages their own instances
- Server runs on localhost:4040 (already running)
- Client runs on localhost:3000 (Vite dev server)
- Always test APIs with curl before making changes
- Never run `npm run dev`, `pnpm dev`, or similar commands unless explicitly requested

## API Testing

- Use `curl -s http://localhost:4040/api/endpoint` to test server endpoints
- Check server status with `lsof -i :4040` if needed
- The user handles server restarts and process management
- Focus on code changes, not server operations

## Environment Management

- Use environment variables from env.shared.ts
- Respect the user's existing development setup
- Don't modify server configuration without permission
- Test endpoints before implementing client-side changes

## Build Process

- Use the established build pipeline (turbo + pnpm)
- Respect the existing TypeScript configuration
- Don't modify core build scripts without discussion
- Focus on code quality over build optimization
