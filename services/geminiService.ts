
import { GoogleGenAI } from "@google/genai";

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/mpeg'): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");

  // Initializing GoogleGenAI with the API key from named parameter
  const ai = new GoogleGenAI({ apiKey });
  
  // Validation logging
  if (!apiKey.startsWith('AIza')) {
     console.warn("⚠️ API Key does not start with 'AIza'. It might be invalid or copied incorrectly.");
  }

  try {
    // Using ai.models.generateContent with model name and prompt/data in a single call
    // Updated to gemini-2.5-flash as per user request
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
        temperature: 0.1, // Low temperature for higher accuracy in transcription
      }
    });

    // Accessing the .text property directly as it is a getter (not a method) on GenerateContentResponse
    return response.text || "No transcription generated.";
  } catch (error: any) {
    console.error("Gemini API Error Details:", JSON.stringify(error, null, 2));
    
    // Enhanced error handling
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
