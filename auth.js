import { auth, db, AUTH_DOMAIN_SUFFIX } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Transforma "João Pedro" em "joao.pedro@sinal.app" (login por nome, sem espaço/acento)
function nomeParaEmail(nome) {
  const limpo = nome
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, ".");
  return `${limpo}${AUTH_DOMAIN_SUFFIX}`;
}

const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("active");
    loginBtn.textContent = "Entrando...";
    loginBtn.disabled = true;

    const nome = document.getElementById("nome").value;
    const senha = document.getElementById("senha").value;
    const email = nomeParaEmail(nome);

    try {
      await signInWithEmailAndPassword(auth, email, senha);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorBox.classList.add("active");
      loginBtn.textContent = "Entrar";
      loginBtn.disabled = false;
    }
  });
}

// Guarda de sessão: usada nas outras páginas pra checar se está logado
// e devolve os dados do usuário (nome, papel) já carregados do Firestore.
export function exigirLogin(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    const dadosUsuario = snap.exists()
      ? { uid: user.uid, ...snap.data() }
      : { uid: user.uid, nome: user.email.split("@")[0], papel: "membro" };
    callback(dadosUsuario);
  });
}

export async function sair() {
  await signOut(auth);
  window.location.href = "index.html";
}
