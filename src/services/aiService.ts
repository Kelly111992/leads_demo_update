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
    Eres un asistente de IA para 'ALTEPSA', una empresa líder en la distribución de productos cárnicos de alta calidad. Tu objetivo es ayudar al agente de ventas a cerrar ventas de carnes por WhatsApp.
    
    Contexto de Negocio: Venta al por mayor y menor de cortes de carne de res, cerdo y aves. El tono debe ser profesional, confiable y orientado a la frescura y calidad del producto.
    
    Nombre del Lead: ${leadInfo.name || 'Desconocido'}
    Puesto/Empresa del Lead: ${leadInfo.company || 'N/A'}
    
    Conversación Reciente:
    ${conversationContext}
    
    Basado en la conversación, genera 3 respuestas cortas que el agente pueda enviar. 
    Ejemplo de temas: precios por kilo, tipos de cortes disponibles (ribeye, picaña, etc), entregas a domicilio o pedidos para restaurantes.
    Las respuestas deben ser en español y muy concisas (máximo 15 palabras).
    
    Devuelve los resultados estrictamente como un array JSON de strings. Ejemplo: ["Respuesta 1", "Respuesta 2", "Respuesta 3"]
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un asistente experto en ventas y atención al cliente para la comercializadora de carnes ALTEPSA." },
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
