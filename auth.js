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
      
      // Verifica se o app está em manutenção
      const cfgSnap = await getDoc(doc(db, "configuracoes", "app"));
      if (cfgSnap.exists() && cfgSnap.data().modoManutencao === "on") {
        // Verifica se é admin
        const usuarioSnap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
        const papel = usuarioSnap.data()?.papel;
        if (papel !== "admin") {
          window.location.href = "manutencao.html";
          return;
        }
      }
      
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

    // Checa manutenção PRIMEIRO, antes de qualquer outra coisa.
    // Admin (papel=admin) passa mesmo durante manutenção.
    try {
      const cfgSnap = await getDoc(doc(db, "configuracoes", "app"));
      if (cfgSnap.exists() && cfgSnap.data().modoManutencao === "on") {
        // Se for admin logado, deixa passar — admin nunca trava
        if (user) {
          const usuarioSnap = await getDoc(doc(db, "usuarios", user.uid));
          const papel = usuarioSnap.data()?.papel;
          if (papel === "admin") {
            // Admin passa, continua o fluxo normal abaixo
          } else {
            window.location.href = "manutencao.html";
            return;
          }
        } else {
          window.location.href = "manutencao.html";
          return;
        }
      }
    } catch (e) {
      // Se der erro ao checar, deixa passar (fail-open — melhor mostrar o app do que travar)
      console.warn("Não foi possível verificar manutenção:", e);
    }

    if (!user) {
      window.location.href = "index.html";
      return;
    }
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    const dadosUsuario = snap.exists()
      ? { uid: user.uid, ...snap.data() }
      : { uid: user.uid, nome: user.email.split("@")[0], papel: "membro" };

    if (dadosUsuario.bloqueado) {
      await signOut(auth);
      window.location.href = "index.html?bloqueado=1";
      return;
    }

    callback(dadosUsuario);
  });
}

export async function sair() {
  await signOut(auth);
  window.location.href = "index.html";
}

// ==========================================
// Verifica permissão de notificação e mostra
// o botão de ativar caso esteja bloqueada
// ==========================================
function verificarPermissaoNotificacao() {
  if (!("Notification" in window)) return;

  const btn = document.getElementById("btnAtivarNotif");
  if (!btn) return;

  if (Notification.permission === "default") {
    // Nunca perguntou — mostra o botão pra ativar
    btn.style.display = "flex";
    btn.addEventListener("click", async () => {
      const resultado = await Notification.requestPermission();
      if (resultado === "granted") {
        btn.style.display = "none";
        // Recarrega pra registrar o token FCM corretamente
        window.location.reload();
      }
    });
  } else if (Notification.permission === "denied") {
    // Bloqueado — mostra botão que explica como desbloquear
    btn.style.display = "flex";
    btn.addEventListener("click", () => {
      alert(
        "As notificações estão bloqueadas.\\n\\n" +
        "Pra liberar:\\n" +
        "1. Abre o Chrome\\n" +
        "2. Vai em Configurações do site\\n" +
        "3. Ativa Notificações pra sinalpv.netlify.app\\n" +
        "4. Recarrega o app"
      );
    });
  } else {
    // Já permitido
    btn.style.display = "none";
  }
}

// Chama a verificação quando a página carrega
// (usa setTimeout pra garantir que o DOM já montou o botão)
setTimeout(verificarPermissaoNotificacao, 500);
