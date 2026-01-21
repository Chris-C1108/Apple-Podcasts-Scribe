import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const execPromise = util.promisify(exec);

// Configuration
const AUDIO_URL = "https://traffic.megaphone.fm/ALLE6861895815.mp3?updated=1767775777";
const TEMP_DIR = path.resolve('temp_audio');
const ORIGINAL_FILE = path.join(TEMP_DIR, 'original.mp3');
const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

// Chunk settings (Test mode: Short chunks to verify logic quickly)
const CHUNK_DURATION = 60; // seconds
const OVERLAP_DURATION = 15; // seconds
const TEST_CHUNKS_COUNT = 2; // Only process first 2 chunks for this test

if (!API_KEY) {
  console.error("❌ API Key not found in environment variables.");
  process.exit(1);
}

// 1. Download Audio
async function downloadAudio(url: string, dest: string): Promise<void> {
  if (fs.existsSync(dest)) {
    console.log(`ℹ️  File already exists at ${dest}, skipping download.`);
    return;
  }

  console.log(`⬇️  Downloading audio from ${url}...`);
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(dest);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log("✅ Download complete.");
        resolve();
      });
      writer.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  } catch (error: any) {
    throw new Error(`Download failed: ${error.message}`);
  }
}

// 2. Split Audio
async function splitAudio(filePath: string, chunkIndex: number, startTime: number, duration: number): Promise<string> {
  const outputName = `chunk_${chunkIndex}.mp3`;
  const outputPath = path.join(TEMP_DIR, outputName);
  
  // ffmpeg -i input.mp3 -ss START -t DURATION -c copy output.mp3
  // Using -c copy is faster but might be slightly inaccurate on cut points. 
  // For strict testing, re-encoding is safer but slower. Let's use re-encoding for precision.
  const cmd = `ffmpeg -y -i "${filePath}" -ss ${startTime} -t ${duration} -acodec libmp3lame -q:a 4 "${outputPath}"`;
  
  console.log(`✂️  Splitting chunk ${chunkIndex}: Start=${startTime}s, Duration=${duration}s`);
  await execPromise(cmd);
  return outputPath;
}

// 3. Transcribe with Gemini
async function transcribeChunk(
  filePath: string, 
  chunkIndex: number, 
  previousContext: string = ""
): Promise<{ text: string; json: any[] }> {
  
  const ai = new GoogleGenAI({ 
    apiKey: API_KEY!,
    httpOptions: { baseUrl: 'https://gemni.uni-kui.shop' } // Custom proxy
  });

  const fileBuffer = fs.readFileSync(filePath);
  const base64Audio = fileBuffer.toString('base64');

  console.log(`🧠 Sending Chunk ${chunkIndex} to Gemini... (Context length: ${previousContext.length})`);

  const prompt = `
  You are a professional transcription engine specializing in generating synchronized lyrics/subtitles.
  
  TASK:
  Transcribe the provided audio chunk into a valid JSON Array.
  
  CONTEXT & OVERLAP HANDLING:
  - This audio chunk is part ${chunkIndex + 1} of a podcast.
  - ${chunkIndex > 0 ? `The first ${OVERLAP_DURATION} seconds of this audio overlap with the previous chunk.` : "This is the start of the audio."}
  - PREVIOUS CONTEXT (End of last chunk): "${previousContext}"
  - INSTRUCTION: Use the context to maintain consistency (names, spellings).
  - INSTRUCTION: If you recognize the overlapping audio from the context, perform a "best fit" transcription but ensuring valid JSON. 
  
  OUTPUT FORMAT (Strict JSON):
  [
    {
      "start": 12.5,
      "end": 15.2,
      "text": "Hello world",
      "speaker": "Speaker Name",
      "isMusic": false
    }
  ]
  - Use relative time (seconds from the beginning of THIS file).
  - "speaker": Try to identify speakers (e.g., "Host", "Guest", "Narrator").
  - "isMusic": Set to true for music segments (intro/outro/interludes).
  - Do not use Markdown code blocks. Just the raw JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/mp3', data: base64Audio } },
          { text: prompt }
        ]
      },
      config: { temperature: 0.2 } // Low temperature for precision
    });

    const rawText = response.text || "[]";
    // Clean potential markdown blocks if Gemini ignores instructions
    const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let jsonData;
    try {
      jsonData = JSON.parse(jsonStr);
    } catch (e) {
      console.warn(`⚠️  Failed to parse JSON for chunk ${chunkIndex}. Raw:`, rawText.substring(0, 100) + "...");
      jsonData = [];
    }

    return { text: rawText, json: jsonData };

  } catch (error: any) {
    console.error(`❌ Error transcribing chunk ${chunkIndex}:`, error.message);
    return { text: "", json: [] };
  }
}

// Main Execution
async function main() {
  try {
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

    // 1. Download
    await downloadAudio(AUDIO_URL, ORIGINAL_FILE);

    // 2. Process Chunks
    let context = "";
    
    for (let i = 0; i < TEST_CHUNKS_COUNT; i++) {
      // Calculate times
      // Chunk 0: 0 to 60 (duration 60)
      // Chunk 1: (60 - 15) = 45 to (45 + 60) = 105
      const startTime = i === 0 ? 0 : (i * CHUNK_DURATION) - (i * OVERLAP_DURATION);
      const chunkPath = await splitAudio(ORIGINAL_FILE, i, startTime, CHUNK_DURATION);

      // 3. Transcribe
      const result = await transcribeChunk(chunkPath, i, context);

      console.log(`\n📄 RESULT CHUNK ${i}:`);
      console.log(JSON.stringify(result.json.slice(0, 3), null, 2)); // Print first 3 lines
      console.log(`... (${result.json.length} lines total)`);

      // 4. Update Context for next loop
      if (result.json.length > 0) {
        const lastItems = result.json.slice(-5);
        context = lastItems.map((item: any) => item.text).join(" ");
        console.log(`📝 Updated Context: "${context.substring(0, 50)}..."`);
      }
      
      // Store result for merging
      allChunksResults.push({
        chunkIndex: i,
        startTime: startTime,
        items: result.json
      });
    }

    // 5. Merge and Deduplicate
    console.log("\n🔄 Merging and Deduplicating...");
    const mergedLyrics = mergeLyrics(allChunksResults, OVERLAP_DURATION);
    
    console.log("\n✨ FINAL MERGED LYRICS (Overlap Transition Area):");
    // Show items around the 45s mark (where chunk 1 starts)
    const transitionItems = mergedLyrics.filter(item => item.start > 35 && item.start < 65);
    console.log(JSON.stringify(transitionItems, null, 2));
    
    console.log(`\n✅ Test Complete. Total lines: ${mergedLyrics.length}`);

  } catch (err) {
    console.error("Fatal Error:", err);
  }
}

// Data structures
interface LyricItem {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  isMusic?: boolean;
}

interface ChunkResult {
  chunkIndex: number;
  startTime: number;
  items: LyricItem[];
}

function mergeLyrics(chunks: ChunkResult[], overlapDuration: number): LyricItem[] {
  let finalLyrics: LyricItem[] = [];
  const HANDOVER_BUFFER = 5; // Seconds to trust the old chunk into the overlap

  for (let i = 0; i < chunks.length; i++) {
    const currentChunk = chunks[i];
    const nextChunkStartTime = (i < chunks.length - 1) 
      ? chunks[i + 1].startTime 
      : Infinity;

    // Define the cutoff point for this chunk
    // We trust this chunk until: Next Chunk Start + Buffer
    // Example: Chunk 0 (0-60), Chunk 1 (45-105). Next Start = 45.
    // Cutoff = 45 + 5 = 50s.
    // We keep Chunk 0 items starting before 50s.
    // Chunk 1 items (which start at 45s absolute) will be filtered by their own loop
    // But wait, the loop processes chunks sequentially. We need to apply the filter logic strictly.
    
    // Logic:
    // If it's not the last chunk, we stop taking items at `nextChunkStartTime + buffer`.
    // If it's not the first chunk, we logically "start" taking items at `thisChunkStartTime + buffer`? 
    // No, simpler: We just apply the "End Cutoff" to the current chunk.
    // The next chunk will naturally pick up from its beginning.
    // BUT we need to ensure we don't duplicate.
    // If Chunk 0 goes up to 50s.
    // Chunk 1 starts at 45s. We convert its times to absolute.
    // Chunk 1 items at 45, 46, 47... 49 will be duplicates of Chunk 0 items.
    // So we need to filter Chunk 1 starts >= 50s.
    
    // Let's use a global "High Water Mark" (lastEndTime) to avoid overlaps?
    // No, strict time slicing is better for stability.
    
    const cutOffTime = (i < chunks.length - 1) ? nextChunkStartTime + HANDOVER_BUFFER : Infinity;
    const startTimeFilter = (i > 0) ? currentChunk.startTime + HANDOVER_BUFFER : 0;

    // Convert and Filter
    const processedItems = currentChunk.items
      .map(item => ({
        ...item,
        start: item.start + currentChunk.startTime, // Convert to absolute
        end: item.end + currentChunk.startTime
      }))
      .filter(item => {
        // Core Logic:
        // 1. Must start AFTER the "start filter" (which is the cutoff of previous chunk)
        // 2. Must start BEFORE the "end cutoff" (which is the start filter of next chunk)
        return item.start >= startTimeFilter && item.start < cutOffTime;
      });

    finalLyrics = finalLyrics.concat(processedItems);
  }
  
  return finalLyrics;
}

const allChunksResults: ChunkResult[] = [];

main();
