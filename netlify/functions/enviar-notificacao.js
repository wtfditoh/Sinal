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

    const { titulo, mensagem } = JSON.parse(event.body);



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


    console.error(erro);


    return {

      statusCode: 500,

      body: JSON.stringify({

        erro: erro.message

      })

    };


  }

};
