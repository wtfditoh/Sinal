exports.handler = async (event) => {
  // Permite chamadas do navegador
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Responde ao preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  // Só aceita POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        erro: "Método não permitido."
      })
    };
  }

  try {
    // ===== LOGS DE DEBUG =====
    console.log("🚀 Função ia chamada");
    console.log("Chave existe?", !!process.env.GROQ_API_KEY);
    console.log("Tamanho da chave:", process.env.GROQ_API_KEY?.length || 0);
    console.log("Primeiros 8 chars:", process.env.GROQ_API_KEY?.slice(0, 8) || "VAZIO");
    // =========================

    const { prompt } = JSON.parse(event.body);

    if (!prompt || !prompt.trim()) {
      console.log("❌ Prompt vazio");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ erro: "Prompt vazio" })
      };
    }

    console.log("📤 Enviando pra Groq...");

    const resposta = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.8,
          max_tokens: 1024,
          messages: [
            {
              role: "system",
              content:
                "Você é a IA oficial do SINAL Studio. Especialista em criar legendas para Instagram, convites, avisos de igreja, hashtags, descrições para Reels, correção de textos e ideias para mídia cristã."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      }
    );

    console.log("📥 Status da Groq:", resposta.status);

    const data = await resposta.json();

    console.log("📥 Dados recebidos:", JSON.stringify(data).slice(0, 500));

    if (!resposta.ok) {
      console.error("❌ Erro da Groq:", JSON.stringify(data));
      return {
        statusCode: resposta.status,
        headers,
        body: JSON.stringify(data)
      };
    }

    const textoResposta = data.choices?.[0]?.message?.content;

    if (!textoResposta) {
      console.error("❌ Resposta sem conteúdo:", JSON.stringify(data));
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ erro: "IA não retornou texto" })
      };
    }

    console.log("✅ Sucesso! Resposta gerada.");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        resposta: textoResposta
      })
    };

  } catch (erro) {
    console.error("💥 Erro na função:", erro);
    console.error("Stack:", erro.stack);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        erro: erro.message || "Erro interno"
      })
    };
  }
};
