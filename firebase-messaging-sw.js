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

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Mensagem recebida:',
    payload
  );

  const notificationTitle = payload.notification.title;

  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png"
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});
