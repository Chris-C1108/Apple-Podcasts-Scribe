export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing 'url' query parameter" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }

    try {
      new URL(targetUrl);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid URL provided" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }

    try {
      let userAgent = request.headers.get("User-Agent") || "";
      
      // If no UA or it looks like a script (curl, wget, python, etc), use a real browser UA
      // This ensures even command line tools get through the WAF
      if (!userAgent || userAgent.match(/(curl|wget|python|axios|node|go-http)/i)) {
        userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
      }

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "User-Agent": userAgent,
          "Accept": "application/json, text/javascript, */*; q=0.01",
          // Removing Referer to avoid triggering anti-scraping protections for specific terms
          // "Referer": "https://podcasts.apple.com/" 
        },
        redirect: 'follow'
      });

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Expose-Headers", "*");

      // If upstream returns 403/401, try to provide a useful error body
      if (!response.ok) {
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch (e) {
          // ignore read error
        }

        if (!errorBody && (response.status === 403 || response.status === 401)) {
           errorBody = JSON.stringify({ 
             error: `Upstream service (${new URL(targetUrl).hostname}) returned ${response.status}. Request might be blocked.` 
           });
           newHeaders.set("Content-Type", "application/json");
        }
        
        return new Response(errorBody, {
           status: response.status,
           statusText: response.statusText,
           headers: newHeaders
        });
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }
  },
};
