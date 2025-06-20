// Service Worker для обработки push-уведомлений
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  let notificationData = {};
  
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'Новое уведомление',
      message: event.data ? event.data.text() : 'Нет данных',
      url: '/'
    };
  }
  
  const title = notificationData.title || 'Напоминание о установке';
  const options = {
    body: notificationData.message || 'Завтра у вас запланирована установка.',
    icon: '/static/img/logo.png',
    badge: '/static/img/badge.png',
    data: {
      url: notificationData.url || '/'
    }
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');
  
  event.notification.close();
  
  // Открываем URL из данных уведомления или корневой URL по умолчанию
  const url = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(function(clientList) {
        // Если есть открытое окно, фокусируемся на нем
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Если нет открытого окна, открываем новое
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
