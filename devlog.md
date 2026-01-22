# Development Log

## 2026-01-22: Proxy and Search Fixes + Performance Optimization

### Issues Resolved
1.  **Cloudflare Worker 404 Error**: The worker at `podscribe-proxy.uni-kui.shop` was returning 404s.
    *   **Root Cause**: The worker was not deployed correctly despite code being present.
    *   **Fix**: Deployed the worker using `wrangler deploy`.
2.  **iTunes Search CORS/Blocking**: Direct search was failing for some users/regions, and the proxy was returning 403 Forbidden for specific keywords (e.g., "all ear").
    *   **Root Cause**: Apple's WAF was blocking requests from Cloudflare IPs that had suspicious User-Agents (like `curl`) or included the `Referer: https://podcasts.apple.com/` header which is not standard for API calls.
    *   **Fix**:
        *   Updated `services/podcastService.ts` to try direct iTunes search first, then fallback to the proxy.
        *   Updated `cloudflare-worker/worker.js` to intelligently handle User-Agents. It now forwards the client's real User-Agent or masquerades as a modern browser if the request comes from a script/tool.
        *   Removed the injected `Referer` header from the proxy to avoid triggering anti-scraping protections.
3.  **Slow RSS Feed Loading**: Users experienced long wait times (up to 15s) when loading podcast metadata.
    *   **Root Cause**: The original logic attempted a Direct Fetch (waiting 15s for timeout) before trying the Proxy. Since many RSS feeds block CORS, users were forced to wait for the timeout on every load.
    *   **Fix**: Implemented a **Parallel Race Strategy** using `Promise.any()`. The app now launches both Direct Fetch and Proxy Fetch simultaneously. Whichever succeeds first (usually the Proxy for CORS-blocked feeds, or Direct for permitted ones) returns the result immediately.

### Verification
*   Local `wrangler dev` testing confirmed the worker logic.
*   `curl` tests confirmed the deployed proxy now returns 200 OK and correctly handles search terms that were previously blocked.
*   Build verification (`npm run build`) passed.
*   Verified that RSS feeds now load significantly faster due to the parallel fetch strategy.
