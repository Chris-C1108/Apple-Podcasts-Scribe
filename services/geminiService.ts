import { GoogleGenAI } from "@google/genai";
import { Logger, LyricItem } from "../types";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const getAudioDuration = async (blob: Blob): Promise<number> => {
  return new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(blob));
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => resolve(0); 
  });
};

interface ChunkResult {
  chunkIndex: number;
  startTime: number;
  items: LyricItem[];
}

function mergeLyrics(chunks: ChunkResult[], overlapDuration: number): LyricItem[] {
  let finalLyrics: LyricItem[] = [];
  const HANDOVER_BUFFER = 5; 

  for (let i = 0; i < chunks.length; i++) {
    const currentChunk = chunks[i];
    const nextChunkStartTime = (i < chunks.length - 1) ? chunks[i + 1].startTime : Infinity;
    const cutOffTime = (i < chunks.length - 1) ? nextChunkStartTime + HANDOVER_BUFFER : Infinity;
    const startTimeFilter = (i > 0) ? currentChunk.startTime + HANDOVER_BUFFER : 0;

    const processedItems = currentChunk.items
      .map(item => ({
        ...item,
        start: item.start + currentChunk.startTime, 
        end: item.end + currentChunk.startTime
      }))
      .filter(item => {
        return item.start >= startTimeFilter && item.start < cutOffTime;
      });

    finalLyrics = finalLyrics.concat(processedItems);
  }
  return finalLyrics;
}

export const transcribeAudioStream = async (
  audioBlob: Blob, 
  onProgress: (lyrics: LyricItem[], fullText: string) => void,
  onLog?: Logger
): Promise<string> => {
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: { baseUrl: 'https://gemni.uni-kui.shop' }
  });

  const duration = await getAudioDuration(audioBlob);
  if (duration === 0) throw new Error("Could not determine audio duration.");

  const CHUNK_DURATION = 60; 
  const OVERLAP = 15;        
  const STEP = CHUNK_DURATION - OVERLAP;
  const avgByteRate = audioBlob.size / duration;

  const chunksResults: ChunkResult[] = [];
  let fullTranscriptText = "";
  let context = "";

  onLog?.(`Audio Duration: ${duration.toFixed(1)}s. Estimated Chunks: ${Math.ceil(duration/STEP)}`);

  let chunkIndex = 0;
  for (let startTime = 0; startTime < duration; startTime += STEP) {
    if (chunkIndex > 0 && startTime >= duration) break;

    const startByte = Math.floor(startTime * avgByteRate);
    const endByte = Math.floor((startTime + CHUNK_DURATION) * avgByteRate);
    const chunkBlob = audioBlob.slice(startByte, Math.min(endByte, audioBlob.size));
    
    onLog?.(`Processing Chunk ${chunkIndex + 1}: ${startTime}s - ${Math.min(startTime + CHUNK_DURATION, duration).toFixed(1)}s`);

    const base64 = await blobToBase64(chunkBlob);

    const prompt = `
    You are a professional transcription engine.
    TASK: Transcribe the provided audio chunk into a valid JSON Array.
    
    CONTEXT:
    - This is part ${chunkIndex + 1} of a podcast.
    - ${chunkIndex > 0 ? `The first ${OVERLAP} seconds overlap with the previous chunk.` : "Start of audio."}
    - PREVIOUS CONTEXT: "${context}"
    - INSTRUCTION: Maintain consistency with context (names, terms).
    
    OUTPUT FORMAT (Strict JSON):
    [{"start": 12.5, "end": 15.2, "text": "Hello", "speaker": "Host", "isMusic": false}]
    - Use relative time (seconds from start of THIS file).
    - Identify speakers. 
    - Output ONLY JSON. No Markdown.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'audio/mp3', data: base64 } },
            { text: prompt }
          ]
        },
        config: { temperature: 0.2 }
      });

      const rawText = response.text || "[]";
      const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      let chunkItems: LyricItem[] = [];
      
      try {
        chunkItems = JSON.parse(jsonStr);
      } catch (e) {
        onLog?.(`JSON Parse Error in Chunk ${chunkIndex}: ${e}`);
        console.warn("Raw Output:", rawText);
        const match = jsonStr.match(/\[.*\]/s);
        if (match) {
          try { chunkItems = JSON.parse(match[0]); } catch(e2) {}
        }
      }

      if (chunkItems.length > 0) {
        const lastFew = chunkItems.slice(-5).map(i => i.text).join(" ");
        context = lastFew.substring(0, 300); 
        
        const chunkText = chunkItems.map(i => i.text).join(" ");
        fullTranscriptText += (fullTranscriptText ? " " : "") + chunkText;
      }

      chunksResults.push({ chunkIndex, startTime, items: chunkItems });
      const mergedLyrics = mergeLyrics(chunksResults, OVERLAP);
      
      onProgress(mergedLyrics, fullTranscriptText);

    } catch (err: any) {
      onLog?.(`Error in Chunk ${chunkIndex}: ${err.message}`);
    }

    chunkIndex++;
  }

  return fullTranscriptText;
};

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/mpeg', onLog?: Logger): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");

  onLog?.("Initializing Gemini service...");

  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      baseUrl: 'https://gemni.uni-kui.shop',
    }
  });
  
  if (!apiKey.startsWith('AIza')) {
     const msg = "⚠️ API Key does not start with 'AIza'. It might be invalid or copied incorrectly.";
     console.warn(msg);
     onLog?.(msg);
  }

  try {
    onLog?.("Sending audio to Gemini-2.5-flash model...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: "Please provide a verbatim transcription of this podcast audio. If there are multiple speakers, try to distinguish them. Output the text in a clean, readable format."
          }
        ]
      },
      config: {
        temperature: 0.1, 
      }
    });

    onLog?.("Gemini response received.");
    return response.text || "No transcription generated.";
  } catch (error: any) {
    const errorMsg = `Gemini API Error: ${error.message || JSON.stringify(error)}`;
    console.error(errorMsg);
    onLog?.(errorMsg);
    
    if (error.message) {
      if (error.message.includes("API key") || error.message.includes("403")) {
        throw new Error("Invalid API Key. Please check your .env file.");
      }
      if (error.message.includes("NOT_FOUND") || error.message.includes("404")) {
         throw new Error(`Model 'gemini-2.5-flash' not found. This model might not exist or isn't available to your API key.`);
      }
      if (error.message.includes("400")) {
         throw new Error("Bad Request. The audio might be corrupted or the format is not supported.");
      }
    }
    throw error;
  }
};
