// Netlify Function: criar-usuario
// Cria conta de usuário sem derrubar a sessão do admin logado

const admin = require("firebase-admin");

let app = null;

function initAdmin() {
  if (app) return app;
  
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  return app;
}

function nomeParaEmail(nome) {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".") + "@sinal.app";
}

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    };
  }

  try {
    initAdmin();
    
    const { nome, senha, papel } = JSON.parse(event.body);

    if (!nome || !senha) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ erro: "Nome e senha são obrigatórios" })
      };
    }

    if (senha.length < 6) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ erro: "Senha deve ter pelo menos 6 caracteres" })
      };
    }

    const email = nomeParaEmail(nome);
    const papelFinal = papel || "membro";

    // Cria a conta no Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password: senha,
      displayName: nome,
      disabled: false
    });

    // Cria o documento no Firestore
    await admin.firestore().collection("usuarios").doc(userRecord.uid).set({
      nome,
      papel: papelFinal,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      criadoPor: "admin"
    });

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        sucesso: true,
        uid: userRecord.uid,
        email: email
      })
    };

  } catch (erro) {
    console.error("Erro ao criar usuário:", erro);
    
    let mensagem = "Erro interno ao criar usuário";
    
    if (erro.code === "auth/email-already-exists") {
      mensagem = "Já existe uma conta com esse nome";
    } else if (erro.code === "auth/invalid-password") {
      mensagem = "Senha muito fraca (mínimo 6 caracteres)";
    }
    
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ erro: mensagem })
    };
  }
};
