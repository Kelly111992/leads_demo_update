import OpenAI from "openai";
import { supabase } from "../supabase";

export async function generateSuggestedReplies(messages: any[], leadInfo: any) {
  let apiKey = '';

  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'openai_api')
      .single();
    if (data?.value?.apiKey) {
      apiKey = data.value.apiKey;
    }
  } catch (error) {
    console.error("No se pudo obtener la OpenAI API Key de Supabase:", error);
  }

  if (!apiKey) {
    console.warn("OPENAI_API_KEY no está configurada.");
    return ["Por favor, configura tu API Key de OpenAI en la sección de Configuración para usar esta función."];
  }

  const openai = new OpenAI({ 
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Solo si se llama desde el cliente
  });

  const conversationContext = messages.map(m => 
    `${m.sender_id === 'client' ? 'Cliente' : 'Agente'}: ${m.content}`
  ).join('\n');

  const prompt = `
    Eres un asistente de IA para una inmobiliaria. Tu objetivo es ayudar al agente de ventas a responder a un prospecto por WhatsApp.
    
    Contexto de Negocio: Venta y renta de propiedades inmobiliarias. El agente debe ser profesional, amable y persuasivo.
    
    Nombre del Lead: ${leadInfo.name || 'Desconocido'}
    Empresa: ${leadInfo.company || 'N/A'}
    Estado: ${leadInfo.status || 'nuevo'}
    
    Conversación Reciente:
    ${conversationContext}
    
    Basado en la conversación, genera 3 respuestas cortas, profesionales y útiles que el agente pueda enviar al lead.
    Las respuestas deben estar en el mismo idioma que los mensajes del lead (usualmente español).
    Mantenlas concisas (máximo 15 palabras por respuesta).
    
    Devuelve los resultados estrictamente como un array JSON de strings. Ejemplo: ["Respuesta 1", "Respuesta 2", "Respuesta 3"]
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Modelo económico y rápido
      messages: [
        { role: "system", content: "Eres un asistente experto en ventas inmobiliarias." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const text = response.choices[0].message.content;
    if (text) {
      const parsed = JSON.parse(text);
      // Si el objeto tiene una propiedad con el array (a veces OpenAI lo envuelve)
      if (Array.isArray(parsed)) return parsed;
      if (parsed.suggestions) return parsed.suggestions;
      if (parsed.replies) return parsed.replies;
      // Si devolvió algo plano como { "1": "...", "2": "..." }
      return Object.values(parsed).slice(0, 3) as string[];
    }
    return [];
  } catch (error) {
    console.error("Error generating AI suggestions with OpenAI:", error);
    return ["Debes confirmar que tu OpenAI API key es válida e intentar de nuevo."];
  }
}
