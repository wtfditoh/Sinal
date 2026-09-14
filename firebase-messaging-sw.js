// firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDe7wqIfMB0BVFzs1yXPrSXK0Iq98BPDb0",
  authDomain: "sinall.firebaseapp.com",
  projectId: "sinall",
  storageBucket: "sinall.firebasestorage.app",
  messagingSenderId: "811815756526",
  appId: "1:811815756526:web:baabfe914a5af625ee09ff"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// ⚡ ESSENCIAL: processa notificações em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log("📬 Notificação em background recebida:", payload);
});

  const titulo = payload.notification?.title || "SINAL";
  const opcoes = {
    body: payload.notification?.body || "",
    icon: payload.notification?.icon || "https://sinalpv.netlify.app/icon-192.png",
    badge: payload.notification?.badge || "https://sinalpv.netlify.app/icon-192.png",
    data: {
      url: payload.fcmOptions?.link || payload.data?.link || "https://sinalpv.netlify.app/dashboard.html"
    }
  };

  if (payload.notification?.image) {
    opcoes.image = payload.notification.image;
  }

  self.registration.showNotification(titulo, opcoes);
});

// Quando clicar na notificação
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlDestino = event.notification.data?.url || "https://sinalpv.netlify.app/dashboard.html";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {
      // Se o app já estiver aberto, foca nele
      for (const client of clientList) {
        if (client.url.includes("sinalpv.netlify.app") && "focus" in client) {
          return client.focus();
        }
      }
      // Se estiver fechado, abre
      return clients.openWindow(urlDestino);
    })
  );
});
