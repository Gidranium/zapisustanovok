// Файл для реализации уведомлений в браузере
// Используем Service Worker для push-уведомлений

// Регистрация Service Worker
if (
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  // Проверяем, что пользователь авторизован, прежде чем регистрировать SW
  typeof currentUser !== 'undefined' && currentUser !== null
) {
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
    .then(response => {
      if (!response.ok) {
        // Если ответ не OK (например, 401 Unauthorized), выбрасываем ошибку
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Проверяем, что data.notifications существует и является массивом
      if (data && Array.isArray(data.notifications)) {
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
      } else {
        console.warn('Received data.notifications is not an array or is undefined:', data);
        showNotificationBadge(0); // Сбрасываем счетчик, если данные некорректны
      }
    })
    .catch(error => {
      console.error('Error checking notifications:', error);
      showNotificationBadge(0); // Сбрасываем счетчик при ошибке
    });
}

// Показать значок с количеством непрочитанных уведомлений
function showNotificationBadge(count) {
  const badge = document.getElementById('notification-count'); // Изменено с notification-badge на notification-count
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
  .then(response => {
    if (response.ok) {
      // Обновить UI: убрать кнопку 'Прочитать' и добавить класс 'read'
      const notificationItem = document.querySelector(`.notification-item[data-notification-id="${notificationId}"]`);
      if (notificationItem) {
        notificationItem.classList.add('read');
        const markReadBtn = notificationItem.querySelector('.mark-read-btn');
        if (markReadBtn) {
          markReadBtn.remove();
        }
      }
      updateNotificationCount();
    } else {
      throw new Error('Failed to mark notification as read');
    }
  })
  .catch(error => {
    console.error('Error marking notification as read:', error);
    alert('Ошибка при отметке уведомления как прочитанного: ' + error.message);
  });
}

// Обновить счетчик уведомлений
function updateNotificationCount() {
  fetch('/api/notifications/unread_count')
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Failed to get unread notification count');
      }
    })
    .then(data => {
      const notificationCountElement = document.getElementById('notification-count');
      if (notificationCountElement) {
        if (data.count > 0) {
          notificationCountElement.textContent = data.count;
          notificationCountElement.style.display = 'block';
        } else {
          notificationCountElement.style.display = 'none';
        }
      }
    })
    .catch(error => {
      console.error('Error updating notification count:', error);
    });
}

// Показать модальное окно уведомлений
function showNotificationsModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal-backdrop">
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Уведомления</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" id="notifications-list">
                    <div class="loading">Загрузка уведомлений...</div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline modal-cancel">Закрыть</button>
                </div>
            </div>
        </div>
    `;

    const closeModal = () => {
        modalContainer.innerHTML = '';
    };
    modalContainer.querySelector('.modal-close').addEventListener('click', closeModal);
    modalContainer.querySelector('.modal-cancel').addEventListener('click', closeModal);

    // Загружаем уведомления
    fetch('/api/notifications')
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to load notifications');
            }
        })
        .then(data => {
            const notificationsList = document.getElementById('notifications-list');
            if (data.notifications && data.notifications.length > 0) {
                let notificationsHtml = '<ul class="notifications-list">';
                data.notifications.forEach(notification => {
                    notificationsHtml += `
                        <li class="notification-item ${notification.read ? 'read' : ''}" data-notification-id="${notification.id}">
                            <div class="notification-content">
                                <strong>${notification.title}</strong>
                                <p>${notification.message}</p>
                                <span class="notification-date">${formatDateTime(notification.created_at)}</span>
                            </div>
                            ${!notification.read ? '<button class="btn btn-sm btn-outline mark-read-btn">Прочитать</button>' : ''}
                        </li>
                    `;
                });
                notificationsHtml += '</ul>';
                notificationsList.innerHTML = notificationsHtml;

                document.querySelectorAll('.mark-read-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const notificationId = this.closest('.notification-item').dataset.notificationId;
                        markNotificationAsRead(notificationId);
                    });
                });
            } else {
                notificationsList.innerHTML = '<div class="empty-state">Нет новых уведомлений</div>';
            }
            updateNotificationCount();
        })
        .catch(error => {
            console.error('Error loading notifications:', error);
            document.getElementById('notifications-list').innerHTML = '<div class="error">Ошибка загрузки уведомлений</div>';
        });
}


