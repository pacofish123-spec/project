// Web Push service worker. Deliberately minimal — its main job is to
// show a notification for whatever payload the server sent (see
// src/lib/push/send.ts) and route a tap back into the app.

// No real offline/caching strategy on purpose — this is a live
// marketplace (prices, availability, messages), and caching that
// wrong is worse than not caching at all. This handler exists only so
// installability tooling (Chrome's install criteria, PWABuilder's
// Android packaging) sees a registered fetch listener; not calling
// respondWith() just lets every request fall through to the network
// exactly as if there were no service worker in the way.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let payload = { title: "yoRento", body: "" };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "yoRento", body: event.data.text() };
    }
  }

  const title = payload.title || "yoRento";
  const options = {
    body: payload.body || "",
    icon: "/yorento-mark.svg",
    badge: "/yorento-mark.svg",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
