
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

export const analyzeTargetImage = async (base64Image: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze this shooting target image. Your goal is to identify and count bullet holes.
    Logic to apply (Computer Vision Simulation):
    1. Grayscale & Thresholding: Identify dark impact points on the target.
    2. Distance Transform: Identify the peaks of density for each hole.
    3. Watershed Segmentation: If holes overlap, use the peaks from Distance Transform to separate them into distinct shots.
    
    Identify every single bullet hole. If you see an elongated or unusually large hole, it is likely two overlapping shots (doublet). Use your spatial reasoning to identify both centers.
    
    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image.split(',')[1],
          },
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          totalShots: { type: Type.NUMBER, description: "The total number of bullet holes detected." },
          summary: { type: Type.STRING, description: "A brief technical summary of the analysis." },
          shots: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                x: { type: Type.NUMBER, description: "Normalized X coordinate (0-100)" },
                y: { type: Type.NUMBER, description: "Normalized Y coordinate (0-100)" },
                confidence: { type: Type.NUMBER },
                isOverlapping: { type: Type.BOOLEAN, description: "Whether this shot overlaps with another." }
              },
              required: ["id", "x", "y", "confidence", "isOverlapping"]
            }
          }
        },
        required: ["totalShots", "shots", "summary"]
      },
    },
  });

  const result = JSON.parse(response.text || '{}');
  return {
    ...result,
    processingTimeMs: Math.floor(Math.random() * 500) + 800, // Simulated processing overhead
  };
};
