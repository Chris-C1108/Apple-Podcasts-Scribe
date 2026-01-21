
import { PodcastLookupResult, PodcastEpisode, PodcastMetadata } from '../types';

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

export const fetchPodcastData = async (url: string): Promise<PodcastLookupResult | null> => {
  try {
    const showIdMatch = url.match(/id(\d+)/);
    const slugMatch = url.match(/podcast\/([^/]+)\/id/);
    
    if (!showIdMatch) throw new Error("Invalid Apple Podcasts URL. No Show ID found.");

    const showId = showIdMatch[1];
    const slug = slugMatch ? slugMatch[1] : null;

    const lookupUrl = `https://itunes.apple.com/lookup?id=${showId}&entity=podcast`;
    // Use allorigins as a proxy to bypass CORS for iTunes API which doesn't support CORS
    const lookupProxy = `https://api.allorigins.win/get?url=${encodeURIComponent(lookupUrl)}`;
    
    let lookupData;
    try {
      // 15s timeout for lookup
      const lookupRes = await fetchWithTimeout(lookupProxy, {}, 15000);
      if (!lookupRes.ok) throw new Error(`Proxy error: ${lookupRes.status}`);
      lookupData = await lookupRes.json();
    } catch (e: any) {
      console.error("Lookup proxy failed:", e);
      // Fallback: If allorigins fails, try a user-friendly error or another proxy
      if (e.name === 'AbortError') throw new Error("Request timed out. Please check your connection.");
      throw new Error("Failed to contact podcast directory. Network or proxy error.");
    }
    
    if (!lookupData.contents) throw new Error("Proxy response empty");
    
    const parsedLookup = JSON.parse(lookupData.contents);

    if (parsedLookup.resultCount === 0) return null;

    const showInfo = parsedLookup.results[0];
    const feedUrl = showInfo.feedUrl;
    
    if (!feedUrl) throw new Error("Could not find RSS feed for this podcast.");

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
      const feedRes = await fetchWithTimeout(feedUrl, { method: 'GET' }, 15000); // 15s timeout for direct
      if (feedRes.ok) {
        feedContent = await feedRes.text();
      } else {
        throw new Error(`Direct fetch status: ${feedRes.status}`);
      }
    } catch (directError) {
      console.warn("Direct RSS fetch failed, falling back to proxy:", directError);
      try {
        const feedProxy = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
        const feedRes = await fetchWithTimeout(feedProxy, {}, 60000); // 60s timeout for proxy (slower for large files)
        if (!feedRes.ok) throw new Error(`RSS Proxy status: ${feedRes.status}`);
        const feedData = await feedRes.json();
        if (!feedData.contents) throw new Error("RSS Proxy response empty");
        feedContent = feedData.contents;
      } catch (proxyError: any) {
         console.error("RSS proxy failed:", proxyError);
         throw new Error("Failed to retrieve podcast RSS feed. The feed might be too large or inaccessible.");
      }
    }

    const episodes = parseRSSFeed(feedContent, collection.artistName, collection.artworkUrl);

    let matchedEpisodes = episodes;
    let isSpecific = false;

    if (slug) {
      console.log(`Looking for episode with slug: ${slug}`);
      // Find episode where the slugified title contains the URL slug
      // OR where the URL slug contains the slugified title (for partial matches)
      const found = episodes.find(ep => {
        const epSlug = slugify(ep.trackName);
        // We check if the URL slug is part of the generated episode slug
        return epSlug.includes(slug);
      });
      
      if (found) {
        console.log(`Found specific episode: ${found.trackName}`);
        matchedEpisodes = [found];
        isSpecific = true;
      } else {
        console.warn(`Could not find episode matching slug: ${slug}`);
      }
    }

    return {
      collection,
      episodes: matchedEpisodes,
      isSpecificEpisode: isSpecific
    };
  } catch (error: any) {
    console.error("Error fetching podcast metadata:", error);
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

export const downloadAudioAsBase64 = async (audioUrl: string): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

    const response = await fetch(audioUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Download failed (HTTP ${response.status})`);

    // Check size - Gemini inlineData limit is roughly 20-30MB base64 encoded
    // We'll increase the limit to 50MB to accommodate standard length episodes (approx 30-45 mins at 128kbps)
    const size = parseInt(response.headers.get('content-length') || '0');
    if (size > 50 * 1024 * 1024) {
      throw new Error(`File too large (${(size / 1024 / 1024).toFixed(1)}MB). Browser-based AI cannot process files larger than 50MB.`);
    }

    const buffer = await response.arrayBuffer();
    return bufferToBase64(buffer);
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error("Download timed out. The server is taking too long to respond.");
    throw new Error(e.message || "Could not retrieve audio. This is usually caused by CORS security settings on the podcast host.");
  }
};
