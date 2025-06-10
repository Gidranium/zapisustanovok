// Файл для реализации уведомлений в браузере
// Используем Service Worker для push-уведомлений

// Регистрация Service Worker
if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/static/js/service-worker.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        initializePushNotifications(registration);
      })
      .catch(function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

// Инициализация push-уведомлений
function initializePushNotifications(registration) {
  // Запрашиваем разрешение на отправку уведомлений
  Notification.requestPermission().then(function(permission) {
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      subscribeToPushNotifications(registration);
    } else {
      console.log('Unable to get permission to notify.');
      // Показываем пользователю сообщение о том, что уведомления отключены
      showNotificationDisabledMessage();
    }
  });
}

// Подписка на push-уведомления
function subscribeToPushNotifications(registration) {
  const applicationServerKey = urlB64ToUint8Array(
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
  );
  
  registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey
  })
  .then(function(subscription) {
    console.log('User is subscribed.');
    // Отправляем информацию о подписке на сервер
    updateSubscriptionOnServer(subscription);
  })
  .catch(function(err) {
    console.log('Failed to subscribe the user: ', err);
  });
}

// Преобразование base64 в Uint8Array для applicationServerKey
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Отправка информации о подписке на сервер
function updateSubscriptionOnServer(subscription) {
  const subscriptionJson = subscription.toJSON();
  
  fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(subscriptionJson)
  })
  .then(function(response) {
    if (!response.ok) {
      throw new Error('Bad status code from server.');
    }
    return response.json();
  })
  .then(function(responseData) {
    if (!(responseData && responseData.success)) {
      throw new Error('Bad response from server.');
    }
    console.log('Successfully subscribed to push notifications');
  })
  .catch(function(err) {
    console.log('Error subscribing to push notifications: ', err);
  });
}

// Показать сообщение о том, что уведомления отключены
function showNotificationDisabledMessage() {
  const notificationBanner = document.createElement('div');
  notificationBanner.className = 'notification-banner';
  notificationBanner.innerHTML = `
    <div class="notification-content">
      <p>Для получения уведомлений о предстоящих установках, пожалуйста, разрешите уведомления в настройках браузера.</p>
      <button id="notification-settings-btn">Настройки уведомлений</button>
      <button id="notification-close-btn">Закрыть</button>
    </div>
  `;
  
  document.body.appendChild(notificationBanner);
  
  document.getElementById('notification-settings-btn').addEventListener('click', function() {
    // Открываем настройки уведомлений браузера (может не работать во всех браузерах)
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'notifications' }).then(function(result) {
        if (result.state === 'denied') {
          alert('Пожалуйста, разрешите уведомления в настройках браузера');
        } else {
          Notification.requestPermission();
        }
      });
    } else {
      Notification.requestPermission();
    }
  });
  
  document.getElementById('notification-close-btn').addEventListener('click', function() {
    notificationBanner.remove();
  });
}

// Функция для проверки новых уведомлений (polling)
function checkForNotifications() {
  fetch('/api/notifications')
    .then(response => response.json())
    .then(data => {
      const unreadNotifications = data.notifications.filter(notification => !notification.is_read);
      
      if (unreadNotifications.length > 0) {
        showNotificationBadge(unreadNotifications.length);
        
        // Если разрешены уведомления браузера, показываем их
        if (Notification.permission === 'granted') {
          unreadNotifications.forEach(notification => {
            const notif = new Notification('Напоминание о установке', {
              body: notification.message,
              icon: '/static/img/logo.png'
            });
            
            notif.onclick = function() {
              window.focus();
              markNotificationAsRead(notification.id);
            };
          });
        }
      }
    })
    .catch(error => console.error('Error checking notifications:', error));
}

// Показать значок с количеством непрочитанных уведомлений
function showNotificationBadge(count) {
  const badge = document.getElementById('notification-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
  }
}

// Отметить уведомление как прочитанное
function markNotificationAsRead(notificationId) {
  fetch(`/api/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    console.log('Notification marked as read:', data);
    // Обновляем список уведомлений
    checkForNotifications();
  })
  .catch(error => console.error('Error marking notification as read:', error));
}

// Проверяем уведомления при загрузке страницы и затем каждые 5 минут
document.addEventListener('DOMContentLoaded', function() {
  checkForNotifications();
  setInterval(checkForNotifications, 5 * 60 * 1000); // Каждые 5 минут
});
