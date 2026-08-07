const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");


const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);


initializeApp({
  credential: cert(serviceAccount)
});


const db = getFirestore();
const auth = getAuth();



exports.handler = async (event) => {

  try {

    const { uid, acao } = JSON.parse(event.body);

    if (!uid || !acao) {
      return {
        statusCode: 400,
        body: JSON.stringify({ erro: "uid e acao são obrigatórios" })
      };
    }

    if (acao === "bloquear") {

      // disabled=true no Firebase Auth impede o login de verdade,
      // mesmo que a pessoa já esteja com a sessão aberta no celular
      await auth.updateUser(uid, { disabled: true });
      await db.collection("usuarios").doc(uid).set({ bloqueado: true }, { merge: true });

    } else if (acao === "desbloquear") {

      await auth.updateUser(uid, { disabled: false });
      await db.collection("usuarios").doc(uid).set({ bloqueado: false }, { merge: true });

    } else if (acao === "excluir") {

      // Apaga a conta de login E o perfil no Firestore - não tem volta
      await auth.deleteUser(uid);
      await db.collection("usuarios").doc(uid).delete();

    } else {

      return {
        statusCode: 400,
        body: JSON.stringify({ erro: "Ação inválida. Use bloquear, desbloquear ou excluir." })
      };

    }

    return {
      statusCode: 200,
      body: JSON.stringify({ sucesso: true })
    };

  } catch (erro) {

    console.error("Erro em gerenciar-usuario:", erro);

    return {
      statusCode: 500,
      body: JSON.stringify({ erro: erro.message })
    };

  }

};
