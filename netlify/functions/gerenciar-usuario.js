const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();
const db = getFirestore();

exports.handler = async (event) => {

  try {

    const { uid, acao } = JSON.parse(event.body);

    if (!uid || !acao) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          erro: "UID e ação são obrigatórios"
        })
      };
    }

    if (acao === "bloquear") {
      await auth.updateUser(uid, { disabled: true });
      await db.collection("usuarios").doc(uid).update({
        bloqueado: true,
        bloqueadoEm: new Date()
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({ sucesso: true, mensagem: "Usuário bloqueado" })
      };
    }

    if (acao === "desbloquear") {
      await auth.updateUser(uid, { disabled: false });
      await db.collection("usuarios").doc(uid).update({
        bloqueado: false,
        desbloqueadoEm: new Date()
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({ sucesso: true, mensagem: "Usuário desbloqueado" })
      };
    }

    if (acao === "excluir") {
      await auth.deleteUser(uid);
      await db.collection("usuarios").doc(uid).delete();
      
      return {
        statusCode: 200,
        body: JSON.stringify({ sucesso: true, mensagem: "Usuário excluído" })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        erro: "Ação inválida. Use: bloquear, desbloquear ou excluir"
      })
    };

  } catch (erro) {

    console.error(erro);

    let mensagem = "Erro ao gerenciar usuário";

    if (erro.code === "auth/user-not-found") {
      mensagem = "Usuário não encontrado";
    } else if (erro.code === "auth/uid-already-exists") {
      mensagem = "UID já existe";
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        erro: mensagem
      })
    };

  }

};
