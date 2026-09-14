import { db } from "./firebase-config.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// VAPID_KEY do Firebase Cloud Messaging
const VAPID_KEY = "BOzCn5u88Zhzx1OFPlnQTnqSEibrXIiD165lqc2S643Gx1m62yh8Ed-LPuSf41PAAgijGuTQPjIBBuMJ20uLtFU";

let messaging = null;

function suportaNotificacao() {
  return "Notification" in window && "serviceWorker" in navigator;
}

function initMessaging() {
  if (messaging) return messaging;
  if (!suportaNotificacao()) return null;
  try {
    messaging = getMessaging();
    return messaging;
  } catch (e) {
    console.warn("FCM não disponível:", e);
    return null;
  }
}

// Pega o token e salva no Firestore
export async function registrarTokenNotificacao(usuario) {
  if (!usuario || !usuario.uid) {
    console.warn("Usuário inválido pra registrar token");
    return;
  }

  if (!suportaNotificacao()) {
    console.warn("Navegador não suporta notificações");
    return;
  }

  if (Notification.permission !== "granted") {
    console.log("Permissão ainda não concedida");
    return;
  }

  const msg = initMessaging();
  if (!msg) return;

  try {
    const token = await getToken(msg, { vapidKey: VAPID_KEY });

    if (!token) {
      console.warn("Não foi possível obter o token FCM");
      return;
    }

    await updateDoc(doc(db, "usuarios", usuario.uid), {
      push: {
        token: token,
        plataforma: "web",
        atualizadoEm: serverTimestamp()
      }
    });

    console.log("✅ Token registrado com sucesso!");
    return token;
  } catch (erro) {
    console.error("Erro ao registrar token:", erro);
  }
}

// Escuta notificações quando o app tá aberto (primeiro plano)
export function escutarNotificacoes() {
  const msg = initMessaging();
  if (!msg) return;

  onMessage(msg, (payload) => {
    console.log("📬 Notificação em primeiro plano:", payload);

    const titulo = payload.notification?.title || "SINAL";
    const corpo = payload.notification?.body || "";

    if (Notification.permission === "granted") {
      new Notification(titulo, {
        body: corpo,
        icon: "/icon-192.png",
        badge: "/icon-192.png"
      });
    }
  });
}
