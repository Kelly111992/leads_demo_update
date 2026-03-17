import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateSuggestedReplies(messages: any[], leadInfo: any) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set");
    return [];
  }

  const model = "gemini-3-flash-preview";
  
  const conversationContext = messages.map(m => 
    `${m.senderId === 'client' ? 'Client' : 'Agent'}: ${m.content}`
  ).join('\n');

  const prompt = `
    You are an AI assistant for ALTEPSA, a company specializing in the sale of food products, specifically meat products (alimentos cárnicos).
    Your goal is to help the sales agent respond to a lead on WhatsApp.
    
    Business Context: ALTEPSA sells high-quality meat products. The agent should be professional, helpful, and knowledgeable about meat products.
    
    Lead Name: ${leadInfo.name || 'Unknown'}
    Lead Company: ${leadInfo.company || 'Unknown'}
    Lead Status: ${leadInfo.status || 'new'}
    
    Recent Conversation:
    ${conversationContext}
    
    Based on the conversation, generate 3 short, professional, and helpful suggested replies that the agent can send to the lead.
    The replies should be in the same language as the lead's messages (usually Spanish or English).
    Keep them concise (max 15 words each).
    
    Return the suggestions as a JSON array of strings.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    return [];
  } catch (error) {
    console.error("Error generating AI suggestions:", error);
    return [];
  }
}
