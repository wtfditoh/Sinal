import { auth, db, AUTH_DOMAIN_SUFFIX } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Mesma conversão nome -> email interno usada no login (auth.js)
function nomeParaEmail(nome) {
  const limpo = nome
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".");
  return `${limpo}${AUTH_DOMAIN_SUFFIX}`;
}

const ehVisitante = new URLSearchParams(window.location.search).get("papel") === "visitante";
if (ehVisitante) {
  document.querySelector(".login-sub").textContent = "Acesso de visitante — só visualização, sem poder editar nada";
}

const form = document.getElementById("cadastroForm");
const errorBox = document.getElementById("cadastroError");
const btn = document.getElementById("cadastroBtn");
const sucesso = document.getElementById("sucesso");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.remove("active");

  const nome = document.getElementById("nome").value.trim();
  const senha = document.getElementById("senha").value;
  const senhaConfirma = document.getElementById("senhaConfirma").value;

  if (senha !== senhaConfirma) {
    errorBox.textContent = "As senhas não são iguais.";
    errorBox.classList.add("active");
    return;
  }

  btn.textContent = "Criando conta...";
  btn.disabled = true;

  const email = nomeParaEmail(nome);
  const papel = new URLSearchParams(window.location.search).get("papel") === "visitante" ? "visitante" : "membro";

  try {
    const credencial = await createUserWithEmailAndPassword(auth, email, senha);
    await setDoc(doc(db, "usuarios", credencial.user.uid), {
      nome,
      papel,
      criadoEm: serverTimestamp()
    });

    form.style.display = "none";
    sucesso.style.display = "block";
  } catch (erro) {
    console.error("Erro ao criar conta:", erro);
    if (erro.code === "auth/email-already-in-use") {
      errorBox.textContent = "Já existe uma conta com esse nome. Tenta outro, ou peça pra equipe redefinir sua senha.";
    } else if (erro.code === "auth/weak-password") {
      errorBox.textContent = "Senha muito fraca — use pelo menos 6 caracteres.";
    } else {
      errorBox.textContent = "Não foi possível criar a conta. Tenta de novo.";
    }
    errorBox.classList.add("active");
    btn.textContent = "Criar conta";
    btn.disabled = false;
  }
});
