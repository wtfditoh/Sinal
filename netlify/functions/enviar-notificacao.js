const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();
const db = getFirestore();

function nomeParaEmail(nome) {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".") + "@sinal.app";
}

exports.handler = async (event) => {

  try {

    const { nome, senha, papel } = JSON.parse(event.body);

    if (!nome || !senha) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          erro: "Nome e senha são obrigatórios"
        })
      };
    }

    if (senha.length < 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          erro: "Senha deve ter pelo menos 6 caracteres"
        })
      };
    }

    const email = nomeParaEmail(nome);
    const papelFinal = papel || "membro";

    const userRecord = await auth.createUser({
      email,
      password: senha,
      displayName: nome,
      disabled: false
    });

    await db.collection("usuarios").doc(userRecord.uid).set({
      nome,
      papel: papelFinal,
      criadoEm: FieldValue.serverTimestamp(),
      criadoPor: "admin"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        sucesso: true,
        uid: userRecord.uid,
        email: email
      })
    };

  } catch (erro) {

    console.error(erro);

    let mensagem = "Erro interno ao criar usuário";

    if (erro.code === "auth/email-already-exists") {
      mensagem = "Já existe uma conta com esse nome";
    } else if (erro.code === "auth/invalid-password") {
      mensagem = "Senha muito fraca (mínimo 6 caracteres)";
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        erro: mensagem
      })
    };

  }

};
