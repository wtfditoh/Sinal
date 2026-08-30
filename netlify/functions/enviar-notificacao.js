const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const messaging = getMessaging();

exports.handler = async (event) => {

  try {

    const { titulo, mensagem, link, imagem, id } = JSON.parse(event.body);

    // Busca usuários com token de notificação
    const usuarios = await db.collection("usuarios").get();

    const tokens = [];
    const tokensInvalidos = [];

    usuarios.forEach((doc) => {
      const dados = doc.data();
      if (dados.push?.token) {
        tokens.push(dados.push.token);
      }
    });

    if (tokens.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          erro: "Nenhum token encontrado"
        })
      };
    }

    // Envia em lotes de 500 (limite do FCM)
    const resultados = [];
    const LOTES = 500;

    for (let i = 0; i < tokens.length; i += LOTES) {
      const lote = tokens.slice(i, i + LOTES);
      
      const resultado = await messaging.sendEachForMulticast({
        tokens: lote,
        notification: {
          title: titulo,
          body: mensagem,
        },
        webpush: {
          notification: {
            icon: "https://sinalpv.netlify.app/icon-192.png",
            badge: "https://sinalpv.netlify.app/icon-192.png",
            ...(imagem ? { image: imagem } : {})
          },
          fcmOptions: {
            link: link || "https://sinalpv.netlify.app/dashboard.html"
          }
        }
      });

      resultados.push(resultado);

      // Identifica tokens inválidos
      resultado.responses.forEach((resp, index) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (errorCode === "messaging/registration-token-not-registered" ||
              errorCode === "messaging/invalid-registration-token") {
            tokensInvalidos.push(lote[index]);
          }
        }
      });
    }

    // Remove tokens inválidos do Firestore (limpeza automática)
    if (tokensInvalidos.length > 0) {
      const usuariosSnapshot = await db.collection("usuarios").get();
      const batch = db.batch();
      
      usuariosSnapshot.forEach((doc) => {
        const dados = doc.data();
        if (dados.push?.token && tokensInvalidos.includes(dados.push.token)) {
          batch.update(doc.ref, {
            "push.token": null,
            "push.tokenInvalidoEm": new Date()
          });
        }
      });

      await batch.commit();
    }

    // Soma os resultados de todos os lotes
    const totalEnviados = resultados.reduce((acc, r) => acc + r.successCount, 0);
    const totalFalhas = resultados.reduce((acc, r) => acc + r.failureCount, 0);

    return {
      statusCode: 200,
      body: JSON.stringify({
        enviados: totalEnviados,
        falhas: totalFalhas,
        tokensRemovidos: tokensInvalidos.length
      })
    };

  } catch (erro) {

    console.error(erro);

    return {
      statusCode: 500,
      body: JSON.stringify({
        erro: erro.message
      })
    };

  }

};
