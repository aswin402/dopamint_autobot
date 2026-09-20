# Template Architecture & Layout 🏗️

This project template is designed for building highly performant full-stack web applications with Next.js 16, TypeScript, Bun, and Prisma.

## 📂 Folder Structure

```text
├── app/                  # Next.js App Router routes & layouts
│   ├── actions/          # Next.js Server Actions (if any)
│   ├── api/              # API endpoints (auth, posts, seed)
│   ├── favicon.ico       # Favicon asset
│   ├── globals.css       # Global styles (Tailwind CSS v4 + tw-animate-css)
│   ├── layout.tsx        # Main application layout wrapping Providers
│   └── page.tsx          # Homepage UI feed and stack sandbox
├── components/           # Reusable UI & helper components
│   ├── ui/               # Lower-level Shadcn UI primitives (button, card, input)
│   ├── ThemeToggle.tsx   # SSR-safe client theme switcher button
│   ├── providers.tsx     # Consolidated context wrapper (Query, next-themes, Zustand)
│   └── Navbar.tsx        # Top navbar containing modal authorization
├── docs/                 # Architectural & configuration guides
├── hooks/                # React Query data fetching hooks (useAuth, usePosts)
├── lib/                  # Server-side & client-side utilities
│   ├── generated/prisma  # Custom target path for type-safe Prisma client
│   ├── api-client.ts     # Request interceptor Axios client
│   ├── auth-utils.ts     # Bcryptjs password hashing helpers
│   ├── jwt.ts            # Sign & verify tokens
│   ├── logger.ts         # Cross-environment terminal/console logger
│   ├── prisma.ts         # Singleton database connection client
│   └── utils.ts          # Tailwind cn utility function
├── prisma/               # Database schemas & seeds
├── store/                # Hydration-safe Zustand state stores
└── types/                # Zod schemas & shared TypeScript types
```

---

## 🔒 Authentication Flow

Authentication is handled via state-of-the-art secure JWTs.

1. **Registration/Login**: User posts credentials to `/api/auth/register` or `/api/auth/login`.
2. **Password Validation**: Passwords are hashed and checked using `bcryptjs` on the server.
3. **Session Issuing**: A JWT is generated containing the user info (`userId`, `email`, `role`) and sent back.
4. **Cookie & Storage Sync**:
   - The server sets the JWT as an `httpOnly` secure `sameSite=strict` cookie.
   - The client stores the JWT token in `localStorage` as fallback for authorization headers.
5. **State Sync**: The client hooks `useAuth` query `/api/auth/me` to fetch current user data and caches it into the **Zustand global store** `useAppStore` for instant page shell rendering.
6. **Log Out**: POSTing to `/api/auth/me` expires the browser cookie and wipes client memory stores.

---

## ⚛️ State Management & Data Fetching

### 1. Hydration-Safe Zustand
Next.js server-side renders (SSR) pages first. If Zustand loads persisted local storage state during SSR, a client-server mismatch warning triggers.
This template uses `skipHydration: true` on store definition, and manually triggers rehydration inside a client-side `useEffect` in the consolidated provider layout wrapper:
```typescript
useEffect(() => {
  useAppStore.persist.rehydrate();
}, []);
```

### 2. React Query Integration
Data fetching is managed by TanStack Query. It handles queries, mutations, cache invalidation, loading states, and API errors smoothly. The custom hooks (`useAuth` and `usePosts`) abstract API routing from the component layer.
