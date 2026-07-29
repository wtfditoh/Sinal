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
    const { prompt } = JSON.parse(event.body);

    const resposta = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.8,
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

    const data = await resposta.json();

    if (!resposta.ok) {
      return {
        statusCode: resposta.status,
        headers,
        body: JSON.stringify(data)
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        resposta: data.choices[0].message.content
      })
    };

  } catch (erro) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        erro: erro.message
      })
    };
  }
};
