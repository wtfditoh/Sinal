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


// Quando clicar na notificação
self.addEventListener("notificationclick", (event) => {

  event.notification.close();

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

      // Se estiver fechado, abre o app
      return clients.openWindow(
        "https://sinalpv.netlify.app/dashboard.html"
      );

    })
  );

});
