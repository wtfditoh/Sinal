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

    const { titulo, mensagem, link, imagem } = JSON.parse(event.body);



    const usuarios = await db
      .collection("usuarios")
      .get();



    const tokens = [];


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




    const resultado = await messaging.sendEachForMulticast({

      tokens,

      notification: {
  title: titulo,
  body: mensagem,
},
webpush: {
  notification: {
    icon: "https://sinalpv.netlify.app/icon-192.png",
    badge: "https://sinalpv.netlify.app/icon-192.png",
    // Imagem grande dentro da notificação (só aparece se foi informada)
    ...(imagem ? { image: imagem } : {})
  },
  fcmOptions: {
    // Pra qual página do app abre ao clicar - vem do painel Admin,
    // cai em dashboard.html se não vier nada
    link: link || "https://sinalpv.netlify.app/dashboard.html"
  }
}
    });





    return {

      statusCode: 200,

      body: JSON.stringify({

        enviados: resultado.successCount,

        falhas: resultado.failureCount

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
