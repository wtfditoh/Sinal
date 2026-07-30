import { app, db } from "./firebase-config.js";

import {
  getMessaging,
  getToken,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

import {
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const VAPID_KEY = "BOzCn5u88Zhzx1OFPlnQTnqSEibrXIiD165lqc2S643Gx1m62yh8Ed-LPuSf41PAAgijGuTQPjIBBuMJ20uLtFU";

export async function iniciarPush(usuario) {
  if (!(await isSupported())) {
    console.log("Push não suportado neste navegador.");
    return;
  }

  if (!("Notification" in window)) {
    console.log("Notificações não suportadas.");
    return;
  }

  const permissao = await Notification.requestPermission();

  if (permissao !== "granted") {
    console.log("Usuário recusou notificações.");
    return;
  }

  const messaging = getMessaging(app);

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY
    });

    if (!token) {
      console.log("Nenhum token recebido.");
      return;
    }

    console.log("Push Token:", token);

    await updateDoc(doc(db, "usuarios", usuario.uid), {
      push: {
        token,
        plataforma: "web",
        atualizadoEm: serverTimestamp()
      }
    });

    console.log("Token salvo com sucesso.");
  } catch (erro) {
    console.error("Erro ao gerar token:", erro);
  }
}
