# @workspace/api-server

A project exported from Replit and hosted on GitHub.

## Getting Started

```bash
# Install dependencies
npm install

# dev
npm run dev  # export NODE_ENV=development && pnpm run build && pnpm run start

# build
npm run build  # node ./build.mjs

# start
npm run start  # node --enable-source-maps ./dist/index.mjs

# typecheck
npm run typecheck  # tsc -p tsconfig.json --noEmit
```

## Stack

- Node.js
- TypeScript
- Express
- Drizzle ORM

## CI

This project uses GitHub Actions for continuous integration. See `.github/workflows/ci.yml`.

## License

MIT
