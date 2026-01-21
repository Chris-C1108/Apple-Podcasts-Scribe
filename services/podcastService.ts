
import { PodcastLookupResult, PodcastEpisode, PodcastMetadata, Logger, PodcastSearchResult } from '../types';

const parseRSSFeed = (xmlString: string, artistName: string, defaultArtwork: string): PodcastEpisode[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const items = xmlDoc.querySelectorAll("item");
  
  return Array.from(items).map((item, index) => {
    const title = item.querySelector("title")?.textContent || "Untitled Episode";
    
    // Robust description extraction
    const description = item.querySelector("description")?.textContent || 
                       item.getElementsByTagName("itunes:summary")[0]?.textContent || "";

    const pubDate = item.querySelector("pubDate")?.textContent || "";
    const enclosure = item.querySelector("enclosure");
    const audioUrl = enclosure?.getAttribute("url") || "";
    
    // Robust image extraction with namespace support
    const itunesImage = item.getElementsByTagName("itunes:image")[0]?.getAttribute("href");
    const googleImage = item.getElementsByTagName("googleplay:image")[0]?.getAttribute("href");
    const mediaContent = item.getElementsByTagName("media:content")[0];
    const mediaImage = (mediaContent?.getAttribute("medium") === "image") ? mediaContent.getAttribute("url") : null;
    
    // Use episode specific artwork or fallback to collection artwork
    const episodeArtwork = itunesImage || googleImage || mediaImage || defaultArtwork;
    
    const trackId = index + Date.now(); 

    return {
      trackId,
      trackName: title,
      artistName: artistName,
      description: description.replace(/<[^>]*>?/gm, ''), 
      releaseDate: pubDate,
      episodeUrl: audioUrl,
      artworkUrl60: episodeArtwork,
      artworkUrl600: episodeArtwork
    };
  });
};

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and dashes)
    .replace(/\s+/g, '-')     // Replace spaces with dashes
    .replace(/-+/g, '-')      // Collapse multiple dashes
    .trim();
};

// Helper to fetch with timeout and built-in AbortController
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 30000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Base URL for the proxy - this should be your deployed worker URL
// Example: https://podscribe-proxy.your-subdomain.workers.dev
// For local dev, you might need to run the worker locally or point to deployed one
const PROXY_BASE_URL = "https://podscribe-proxy.uni-kui.workers.dev";

// Helper to wrap URL with our worker proxy
const getProxyUrl = (targetUrl: string) => {
  return `${PROXY_BASE_URL}?url=${encodeURIComponent(targetUrl)}`;
};

export const searchPodcasts = async (term: string, onLog?: Logger): Promise<PodcastSearchResult[]> => {
  try {
    const encodedTerm = encodeURIComponent(term);
    const searchUrl = `https://itunes.apple.com/search?term=${encodedTerm}&entity=podcast&limit=10`;
    // Use our Cloudflare Worker proxy
    const searchProxy = getProxyUrl(searchUrl);

    onLog?.(`Searching iTunes for: "${term}"`);

    let searchData;
    try {
      const searchRes = await fetchWithTimeout(searchProxy, {}, 10000);
      if (!searchRes.ok) throw new Error(`Proxy error: ${searchRes.status}`);
      searchData = await searchRes.json();
    } catch (e: any) {
      console.error("Search proxy failed:", e);
      onLog?.(`Search proxy failed: ${e.message}`);
      if (e.name === 'AbortError') throw new Error("Search timed out (10s limit). Please check your connection.");
      throw new Error("Failed to contact podcast directory.");
    }
    
    // Cloudflare worker returns the direct JSON response
    const parsedSearch = searchData;
    onLog?.(`Found ${parsedSearch.resultCount} results.`);

    return parsedSearch.results.map((result: any) => ({
      collectionId: result.collectionId,
      collectionName: result.collectionName,
      artistName: result.artistName,
      artworkUrl600: result.artworkUrl600,
      feedUrl: result.feedUrl,
      primaryGenreName: result.primaryGenreName
    }));

  } catch (error: any) {
    console.error("Error searching podcasts:", error);
    onLog?.(`Error searching podcasts: ${error.message}`);
    throw new Error(error.message || "Failed to search podcasts.");
  }
};

export const fetchPodcastData = async (url: string, onLog?: Logger): Promise<PodcastLookupResult | null> => {
  try {
    const showIdMatch = url.match(/id(\d+)/);
    const slugMatch = url.match(/podcast\/([^/]+)\/id/);
    
    if (!showIdMatch) throw new Error("Invalid Apple Podcasts URL. No Show ID found.");

    const showId = showIdMatch[1];
    const slug = slugMatch ? slugMatch[1] : null;

    onLog?.(`Found Show ID: ${showId}${slug ? `, Slug: ${slug}` : ''}`);

    const lookupUrl = `https://itunes.apple.com/lookup?id=${showId}&entity=podcast`;
    // Use our Cloudflare Worker proxy
    const lookupProxy = getProxyUrl(lookupUrl);
    
    onLog?.(`Fetching podcast metadata via proxy...`);

    let lookupData;
    try {
      const lookupRes = await fetchWithTimeout(lookupProxy, {}, 30000);
      if (!lookupRes.ok) throw new Error(`Proxy error: ${lookupRes.status}`);
      lookupData = await lookupRes.json();
    } catch (e: any) {
      console.error("Lookup proxy failed:", e);
      onLog?.(`Lookup proxy failed: ${e.message}`);
      // Fallback: If proxy fails
      if (e.name === 'AbortError') throw new Error("Request timed out. Please check your connection.");
      throw new Error("Failed to contact podcast directory. Network or proxy error.");
    }
    
    const parsedLookup = lookupData;

    if (parsedLookup.resultCount === 0) return null;

    const showInfo = parsedLookup.results[0];
    const feedUrl = showInfo.feedUrl;
    
    if (!feedUrl) throw new Error("Could not find RSS feed for this podcast.");
    
    onLog?.(`RSS Feed URL found: ${feedUrl}`);

    const collection: PodcastMetadata = {
      id: showId,
      title: showInfo.collectionName,
      artistName: showInfo.artistName,
      artworkUrl: showInfo.artworkUrl600 || showInfo.artworkUrl100,
      description: showInfo.primaryGenreName
    };

    // Try fetching RSS feed directly first (many hosts support CORS)
    // If that fails, fallback to proxy
    let feedContent = "";
    try {
      console.log("Attempting direct RSS fetch:", feedUrl);
      onLog?.("Attempting direct RSS fetch...");
      const feedRes = await fetchWithTimeout(feedUrl, { method: 'GET' }, 15000); // 15s timeout for direct
      if (feedRes.ok) {
        feedContent = await feedRes.text();
        onLog?.("Direct RSS fetch successful.");
      } else {
        throw new Error(`Direct fetch status: ${feedRes.status}`);
      }
    } catch (directError: any) {
      const msg = `Direct RSS fetch failed: ${directError.message}. Falling back to proxy...`;
      console.warn(msg);
      onLog?.(msg);
      try {
        const feedProxy = getProxyUrl(feedUrl);
        const feedRes = await fetchWithTimeout(feedProxy, {}, 60000); // 60s timeout for proxy (slower for large files)
        if (!feedRes.ok) throw new Error(`RSS Proxy status: ${feedRes.status}`);
        const feedText = await feedRes.text();
        feedContent = feedText;
        onLog?.("RSS fetch via proxy successful.");
      } catch (proxyError: any) {
         console.error("RSS proxy failed:", proxyError);
         onLog?.(`RSS proxy failed: ${proxyError.message}`);
         throw new Error("Failed to retrieve podcast RSS feed. The feed might be too large or inaccessible.");
      }
    }

    const episodes = parseRSSFeed(feedContent, collection.artistName, collection.artworkUrl);
    onLog?.(`Parsed ${episodes.length} episodes from RSS feed.`);

    let matchedEpisodes = episodes;
    let isSpecific = false;

    if (slug) {
      console.log(`Looking for episode with slug: ${slug}`);
      onLog?.(`Searching for episode with slug: ${slug}`);
      // Find episode where the slugified title contains the URL slug
      // OR where the URL slug contains the slugified title (for partial matches)
      const found = episodes.find(ep => {
        const epSlug = slugify(ep.trackName);
        // We check if the URL slug is part of the generated episode slug
        return epSlug.includes(slug);
      });
      
      if (found) {
        console.log(`Found specific episode: ${found.trackName}`);
        onLog?.(`Found specific episode: "${found.trackName}"`);
        matchedEpisodes = [found];
        isSpecific = true;
      } else {
        console.warn(`Could not find episode matching slug: ${slug}`);
        onLog?.(`Could not find episode matching slug: ${slug}`);
      }
    }

    return {
      collection,
      episodes: matchedEpisodes,
      isSpecificEpisode: isSpecific
    };
  } catch (error: any) {
    console.error("Error fetching podcast metadata:", error);
    onLog?.(`Error fetching podcast metadata: ${error.message}`);
    throw new Error(error.message || "Failed to process podcast data.");
  }
};

/**
 * Optimized ArrayBuffer to Base64 conversion
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export const downloadAudioAsBase64 = async (audioUrl: string, onLog?: Logger): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

    onLog?.(`Starting audio download from: ${audioUrl}`);
    onLog?.("Timeout set to 90 seconds.");

    const response = await fetch(audioUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Download failed (HTTP ${response.status})`);

    // Check size - Gemini inlineData limit is roughly 20-30MB base64 encoded
    // We'll increase the limit to 50MB to accommodate standard length episodes (approx 30-45 mins at 128kbps)
    const size = parseInt(response.headers.get('content-length') || '0');
    
    if (size > 0) {
      onLog?.(`Content-Length: ${(size / 1024 / 1024).toFixed(2)} MB`);
    }

    if (size > 50 * 1024 * 1024) {
      throw new Error(`File too large (${(size / 1024 / 1024).toFixed(1)}MB). Browser-based AI cannot process files larger than 50MB.`);
    }

    onLog?.("Buffering audio data...");
    const buffer = await response.arrayBuffer();
    onLog?.(`Audio buffered. Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    
    onLog?.("Converting to Base64...");
    const base64 = bufferToBase64(buffer);
    onLog?.("Base64 conversion complete.");

    return base64;
  } catch (e: any) {
    onLog?.(`Download failed: ${e.message}`);
    if (e.name === 'AbortError') throw new Error("Download timed out. The server is taking too long to respond.");
    throw new Error(e.message || "Could not retrieve audio. This is usually caused by CORS security settings on the podcast host.");
  }
};
