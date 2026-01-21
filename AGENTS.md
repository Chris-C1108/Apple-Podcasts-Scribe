# Apple-Podcasts-Scribe Agent Guidelines

This document provides context and guidelines for AI agents working on the Apple-Podcasts-Scribe codebase.

## 1. Project Overview
Apple-Podcasts-Scribe is a web application that searches for Apple Podcasts, retrieves their RSS feeds, and uses Google Gemini 2.5 Flash to transcribe episodes.
*   **Stack**: React 19, TypeScript, Vite, Tailwind CSS.
*   **AI Service**: Google GenAI SDK (`@google/genai`).
*   **Key Features**: iTunes Search API integration, RSS parsing, Audio-to-Base64 conversion, Gemini transcription, Real-time UI logging.

## 2. Operational Commands

### Build & Run
*   **Install Dependencies**: `npm install`
*   **Start Development Server**: `npm run dev` (Runs on `localhost:5173` by default)
*   **Build for Production**: `npm run build`
*   **Preview Production Build**: `npm run preview`

### Testing & Linting
*   **Testing**: *No test suite is currently configured.*
    *   If adding tests, prefer **Vitest** + **React Testing Library**.
    *   *Agent Note*: Do not attempt to run `npm test` as it does not exist.
*   **Linting**: *No explicit lint script configured in package.json.*
    *   Follow standard TypeScript/React linting rules implicitly.
    *   Ensure no unused variables or implicit `any` types where possible.

## 3. Code Style & Standards

### TypeScript
*   **Strictness**: `tsconfig.json` does not enforce `strict: true`, but agents should write **strict** code.
*   **Types vs Interfaces**: Prefer `interface` for object definitions (e.g., `PodcastEpisode`, `PodcastMetadata`).
*   **Type Safety**: Avoid `any`. Use specific types or generics.
*   **Nullability**: Handle `null` and `undefined` explicitly (e.g., `collection || null`).

### React Components
*   **Structure**: Functional components with `React.FC`.
*   **Props**: Define prop interfaces explicitly.
    ```typescript
    interface MyComponentProps {
      data: SomeType;
      onAction: (item: SomeType) => void;
    }
    const MyComponent: React.FC<MyComponentProps> = ({ data, onAction }) => { ... }
    ```
*   **Hooks**: Use built-in hooks (`useState`, `useEffect`, `useRef`).
*   **Styling**: Use **Tailwind CSS** utility classes directly in `className`.
    *   Do not create separate CSS files unless absolutely necessary.

### Project Architecture
*   **`App.tsx`**: Main application logic and state orchestration.
*   **`components/`**: Reusable UI components (Presentation layer).
    *   `LogConsole.tsx`: For displaying system logs.
    *   `PodcastSearchResults.tsx`: Search results grid.
*   **`services/`**: Business logic and API interactions.
    *   `podcastService.ts`: iTunes API, Proxy calls, RSS parsing.
    *   `geminiService.ts`: Interaction with Google GenAI.
*   **`types.ts`**: Centralized type definitions.

### Logging & Error Handling
*   **UI Logging**: The application uses a custom logging system displayed in the UI (`LogConsole`).
    *   Pass the `addLog` (or `onLog`) callback to services to report progress.
    *   Type definition: `export type Logger = (message: string) => void;`
*   **Console**: Use `console.error` for debugging, but *always* notify the user via `addLog` or UI state for critical failures.
*   **Proxy Handling**:
    *   **Podcast RSS Proxy**: Network requests to RSS feeds are proxied via a custom Cloudflare Worker to handle CORS reliably.
        *   **Worker URL**: `https://podscribe-proxy.uni-kui.shop`
        *   **Source Code**: `cloudflare-worker/worker.js`
        *   **Configuration**: `cloudflare-worker/wrangler.toml`
        *   *Note*: iTunes Search/Lookup APIs are accessed DIRECTLY (CORS supported), bypassing the proxy to avoid IP blocks.
    *   **Gemini API Proxy**: Google GenAI requests are proxied to bypass network restrictions.
        *   **Worker URL**: `https://gemni.uni-kui.shop`
        *   **Source Code**: `cloudflare-worker/gemini-worker.js`
        *   **Configuration**: `cloudflare-worker/wrangler-gemini.toml`
        *   Configured in `services/geminiService.ts` via `httpOptions.baseUrl`.

### Naming Conventions
*   **Files**: PascalCase for Components (`PodcastCard.tsx`), camelCase for utilities/services (`podcastService.ts`).
*   **Variables/Functions**: camelCase (`fetchPodcastData`, `selectedEpisode`).
*   **Interfaces**: PascalCase (`PodcastMetadata`).

## 4. Specific Workflows

### Adding New Features
1.  Define types in `types.ts`.
2.  Implement logic in `services/`.
3.  Create/Update components in `components/`.
4.  Integrate in `App.tsx`, ensuring state management handles loading/error states.

### Search Implementation
*   The app supports two search modes in the same input:
    1.  **Direct URL**: Apple Podcasts URL.
    2.  **Keyword Search**: iTunes Search API.
*   Agents should preserve this dual-mode behavior.

### Environment Variables
*   `GEMINI_API_KEY`: Required for transcription. Access via `process.env.API_KEY` (handled by Vite define/env replacement usually, but check `vite.config.ts` if adding new env vars).

## 5. Cursor/Copilot Rules
*   *None currently present in repository.*
*   Agents should infer best practices from the existing React+Vite+Tailwind patterns.

## 6. Git & Deployment Protocols
*   **Strict User Initiation**: Local git commits and GitHub pushes **MUST** be explicitly initiated by the user. Agents should not perform these actions automatically.
*   **Local Commits**: Used for archiving work-in-progress and testing.
*   **GitHub Pushes**: Directly triggers a release to **Production**. Use with caution.
