const admin = require("firebase-admin");


const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const db = admin.firestore();


exports.handler = async (event) => {

  try {

    const { titulo, mensagem } = JSON.parse(event.body);


    const usuarios = await db.collection("usuarios").get();


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


    const resultado = await admin.messaging()
      .sendEachForMulticast({

        tokens,

        notification: {
          title: titulo,
          body: mensagem
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


    return {

      statusCode: 500,

      body: JSON.stringify({

        erro: erro.message

      })

    };


  }

};
