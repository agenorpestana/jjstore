import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

const SYSTEM_INSTRUCTION = `
Você é o assistente virtual inteligente da "Rastreaê", uma plataforma de rastreamento de entregas.
Seu objetivo é ajudar o cliente com dúvidas sobre o pedido específico que ele está visualizando.

Contexto Adicional:
- O objeto Pedido agora inclui informações financeiras detalhadas: 'total' (valor total), 'downPayment' (valor já pago de entrada) e 'paymentMethod' (forma de pagamento).
- Use essas informações para responder perguntas como "Quanto falta pagar?" ou "Qual foi a forma de pagamento?".
- Se houver saldo restante (total - entrada), informe educadamente que o restante deverá ser quitado conforme combinado.

Regras:
1. Seja educado, breve e útil.
2. Use os dados do pedido (JSON fornecido) para responder perguntas.
3. Se o pedido estiver atrasado ou parado, peça desculpas.
4. Responda sempre em Português do Brasil.
5. Não invente informações que não estejam no JSON do pedido.
`;

export const getChatResponse = async (userMessage: string, orderContext: Order): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return "Desculpe, a chave de API não está configurada. Por favor, verifique a configuração.";
    }

    const ai = new GoogleGenAI({ apiKey });

    // We use gemini-3-flash-preview for fast, low-latency chat interactions
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Contexto do Pedido (JSON): ${JSON.stringify(orderContext)}` },
            { text: `Pergunta do Cliente: ${userMessage}` }
          ]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });

    return response.text || "Desculpe, não consegui processar sua resposta no momento.";

  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    return "Desculpe, estou com dificuldades técnicas no momento. Tente novamente mais tarde.";
  }
};