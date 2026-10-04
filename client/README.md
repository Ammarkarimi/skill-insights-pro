# SkillSphere frontend

React + Vite + Tailwind + shadcn/ui single-page app. See the [root README](../README.md) for setup,
architecture and deployment.

```bash
npm ci
npm run dev      # http://localhost:8080 (proxies /api to http://localhost:8000)
npm run build    # outputs dist/, which the backend serves in production
```

All HTTP calls go through `src/lib/api.ts`; auth state and credit balance live in `src/context/AuthContext.tsx`.
