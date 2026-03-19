// public/firebase-messaging-sw.js

/** @type {ServiceWorkerGlobalScope} */
const sw = self

// public/firebase-messaging-sw.js
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCA_8ST1zZ38UmzUXv6woVn8Mv8BYXQhjg",
  authDomain: "majik-message.firebaseapp.com",
  projectId: "majik-message",
  storageBucket: "majik-message.firebasestorage.app",
  messagingSenderId: "1079068033867",
  appId: "1:1079068033867:web:65f974c1bef7007ed81ece",
  measurementId: "G-5QZBGDEVFN"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  sw.registration.showNotification(title ?? "New message", {
    body: body ?? "",
    icon: icon ?? "/icon-192x192.png",
    badge: "/badge.png",
    data: payload.data,
  });
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;
  const url = conversationId
    ? `/chats?conversationID=${encodeURIComponent(conversationId)}`
    : "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(sw.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        clients.openWindow(url);
      }),
  );
});
