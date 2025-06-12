// Основной JavaScript файл для функциональности сайта

// Глобальные переменные
let currentUser = null;
let calendarData = [];
let doorType = 'entrance'; // По умолчанию показываем календарь входных дверей

let calendarViewMode = 'month'; // 'month' или 'week'
let currentWeekIndex = 0; // для недельного режима
let calendarViewModeWasManuallyChanged = false;

function isMobileScreen() {
    return window.innerWidth <= 768;
}

// Определяем начальный тип дверей в зависимости от роли пользователя
// Эта логика будет применена после успешной авторизации
function initializeDoorType() {
    if (currentUser && currentUser.role === 'installer_interior') {
        doorType = 'interior';
    } else {
        doorType = 'entrance'; // Для всех остальных ролей (admin, manager, installer_entrance)
    }
}

// Функция для определения контрастного цвета текста
function getContrastColor(hexColor) {
    // Убираем символ # если он есть
    const color = hexColor.replace('#', '');
    
    // Конвертируем в RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // Вычисляем яркость
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Возвращаем черный или белый в зависимости от яркости
    return brightness > 128 ? '#000000' : '#ffffff';
}
// --- PATCH: определение мобильного режима ---
function isMobile() {
    return window.innerWidth <= 768;
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, авторизован ли пользователь
    checkAuth();
    
    // Обработчики событий для форм и кнопок
    setupEventListeners();
});

// Проверка авторизации
function checkAuth() {
    fetch('/api/current')
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                // Если пользователь не авторизован, показываем форму входа
                showLoginForm();
                throw new Error('Not authenticated');
            }
        })
        .then(data => {
            currentUser = data.user;
            initializeDoorType(); // Инициализируем doorType после получения данных о пользователе
            // Показываем основной интерфейс
            showMainInterface();
            // Загружаем календарь
            loadCalendar();
        })
        .catch(error => {
            console.error('Authentication check failed:', error);
        });
}

// Показать форму входа
function showLoginForm() {
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = `
        <div class="login-container">
            <div class="card">
                <div class="card-header">
                    <div class="logo">
                        <img src="/static/img/logo.png" alt="ArtDoors">
                    </div>
                    <h2 class="card-title">Вход в систему</h2>
                </div>
                <div class="card-body">
                    <form id="login-form">
                        <div class="form-group">
                            <label for="username" class="form-label">Имя пользователя</label>
                            <input type="text" id="username" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="password" class="form-label">Пароль</label>
                            <input type="password" id="password" class="form-control" required>
                        </div>
                        <div id="login-error" class="error-message" style="display: none;"></div>
                        <button type="submit" class="btn btn-primary">Войти</button>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Обработчик отправки формы входа
    document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        login();
    });
}

// Функция входа
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Login failed');
        }
    })
    .then(data => {
        currentUser = data.user;
        initializeDoorType(); // Инициализируем doorType после логина
        showMainInterface();
        loadCalendar();
    })
    .catch(error => {
        errorElement.textContent = 'Неверное имя пользователя или пароль';
        errorElement.style.display = 'block';
        console.error('Login error:', error);
    });
}

// Показать основной интерфейс
function showMainInterface() {
    const appContainer = document.getElementById('app');
    
    // Определяем, какие вкладки показывать в зависимости от роли
    let tabsHtml = '';
    let adminButtonsHtml = '';
    
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        tabsHtml = `
            <div class="tabs">
                <div class="tab ${doorType === 'entrance' ? 'active' : ''}" data-door-type="entrance">Входные двери</div>
                <div class="tab ${doorType === 'interior' ? 'active' : ''}" data-door-type="interior">Межкомнатные двери</div>
            </div>
        `;
    }
    
    // Добавляем кнопку управления пользователями для администратора
    if (currentUser.role === 'admin') {
        adminButtonsHtml = `
            <div class="admin-controls">
                <button id="manage-users-btn" class="btn btn-primary">Управление пользователями</button>
            </div>
        `;
    }
    
    appContainer.innerHTML = `
        <header class="header">
            <div class="container">
                <div class="header-content">
                    <div class="logo">
                        <img src="/static/img/logo.png" alt="ArtDoors">
                    </div>
                    <div class="nav">
                        <div class="notification-badge">
                            <a href="#" class="nav-item" id="notifications-btn">
                                <i class="fas fa-bell"></i>
                                <span class="badge" id="notification-count" style="display: none;">0</span>
                            </a>
                        </div>
                        <span class="nav-item">Привет, ${currentUser.username}</span>
                        <a href="#" class="nav-item" id="logout-btn">Выйти</a>
                    </div>
                </div>
            </div>
        </header>
        
        <main class="container">
            <h1 class="page-title">Календарь установок</h1>
            
            ${adminButtonsHtml}
            
            ${tabsHtml}
            
            <div class="calendar-controls">
                <button id="prev-month" class="btn btn-outline"><i class="fas fa-chevron-left"></i> Предыдущий месяц</button>
                <h2 id="current-month">Загрузка...</h2>
                <button id="next-month" class="btn btn-outline">Следующий месяц <i class="fas fa-chevron-right"></i></button>
            </div>
            
            <div id="calendar-container">
                <div class="loading">Загрузка календаря...</div>
            </div>
        </main>
        
        <div id="modal-container"></div>
    `;
    
    // Настраиваем обработчики событий
    setupMainEventListeners();
    
    // Загружаем уведомления
    loadNotifications();
}

// Настройка обработчиков событий для основного интерфейса
function setupMainEventListeners() {
    // Обработчик выхода
    document.getElementById('logout-btn').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
    
    // Обработчик кнопки уведомлений
    document.getElementById('notifications-btn').addEventListener('click', function(e) {
        e.preventDefault();
        showNotificationsModal();
    });
    
    // Обработчики переключения месяцев
    document.getElementById('prev-month').addEventListener('click', function() {
        changeMonth(-1);
    });
    
    document.getElementById('next-month').addEventListener('click', function() {
        changeMonth(1);
    });
    
    // Обработчики вкладок (если они есть)
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Убираем активный класс со всех вкладок
            tabs.forEach(t => t.classList.remove('active'));
            // Добавляем активный класс на выбранную вкладку
            this.classList.add('active');
            // Меняем тип дверей и перезагружаем календарь
            doorType = this.dataset.doorType;
            loadCalendar();
        });
    });

    const manageUsersBtn = document.getElementById('manage-users-btn');
    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', function() {
            showUserManagementModal();
        });
    }
}

function showUserManagementModal() {
    // Загружаем список пользователей
    fetch('/api/users')
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to load users');
            }
        })
        .then(data => {
            const modalContainer = document.getElementById('modal-container');
            
            // Создаем HTML для списка пользователей
            let usersHtml = '';
            if (data.users && data.users.length > 0) {
                usersHtml = '<table class="users-table">';
                usersHtml += '<thead><tr><th>Имя пользователя</th><th>Email</th><th>Роль</th><th>Цвет</th><th>Действия</th></tr></thead>';
                usersHtml += '<tbody>';
                
                data.users.forEach(user => {
                    // Преобразуем роль для отображения
                    let roleDisplay = '';
                    switch(user.role) {
                        case 'admin':
                            roleDisplay = 'Администратор';
                            break;
                        case 'manager':
                            roleDisplay = 'Менеджер';
                            break;
                        case 'installer_entrance':
                            roleDisplay = 'Установщик (входные)';
                            break;
                        case 'installer_interior':
                            roleDisplay = 'Установщик (межкомнатные)';
                            break;
                        default:
                            roleDisplay = user.role;
                    }
                    
                    usersHtml += `
                        <tr>
                            <td>${user.username}</td>
                            <td>${user.email || '-'}</td>
                            <td>${roleDisplay}</td>
                            <td><div class="color-preview" style="background-color: ${user.user_color || '#3498db'}; width: 20px; height: 20px; border-radius: 3px; display: inline-block;"></div></td>
                            <td>
                                <button class="btn btn-sm btn-outline edit-user-btn" data-user-id="${user.id}">Изменить</button>
                                <button class="btn btn-sm btn-secondary delete-user-btn" data-user-id="${user.id}">Удалить</button>
                            </td>
                        </tr>
                    `;
                });
                
                usersHtml += '</tbody></table>';
            } else {
                usersHtml = '<div class="empty-state">Нет пользователей</div>';
            }
            
            modalContainer.innerHTML = `
                <div class="modal-backdrop">
                    <div class="modal modal-lg">
                        <div class="modal-header">
                            <h3 class="modal-title">Управление пользователями</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <button id="create-user-btn" class="btn btn-primary mb-3">Создать пользователя</button>
                            <div class="users-list">
                                ${usersHtml}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline modal-cancel">Закрыть</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Обработчик закрытия модального окна
            const closeModal = () => {
                modalContainer.innerHTML = '';
            };
            
            // Добавляем обработчики событий
            modalContainer.querySelector('.modal-close').addEventListener('click', closeModal);
            modalContainer.querySelector('.modal-cancel').addEventListener('click', closeModal);
            
            // Обработчик создания нового пользователя
            modalContainer.querySelector('#create-user-btn').addEventListener('click', function() {
                showCreateUserModal();
            });
            
            // Обработчики для кнопок редактирования и удаления
            const editButtons = modalContainer.querySelectorAll('.edit-user-btn');
            editButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const userId = this.dataset.userId;
                    showEditUserModal(userId);
                });
            });
            
            const deleteButtons = modalContainer.querySelectorAll('.delete-user-btn');
            deleteButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const userId = this.dataset.userId;
                    if (confirm('Вы уверены, что хотите удалить этого пользователя?')) {
                        deleteUser(userId);
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error loading users:', error);
            alert('Ошибка загрузки пользователей');
        });
}

// Показать модальное окно создания пользователя
function showCreateUserModal() {
    const modalContainer = document.getElementById('modal-container');
    
    modalContainer.innerHTML = `
        <div class="modal-backdrop">
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Создание пользователя</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="create-user-form">
                        <div class="form-group">
                            <label for="username" class="form-label">Имя пользователя</label>
                            <input type="text" id="username" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="password" class="form-label">Пароль</label>
                            <input type="password" id="password" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="email" class="form-label">Email</label>
                            <input type="email" id="email" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="role" class="form-label">Роль</label>
                            <select id="role" class="form-control" required>
                                <option value="admin">Администратор</option>
                                <option value="manager">Менеджер</option>
                                <option value="installer_entrance">Установщик (входные двери)</option>
                                <option value="installer_interior">Установщик (межкомнатные двери)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="user_color" class="form-label">Цвет пользователя</label>
                            <div class="color-picker-container">
                                <input type="color" id="user_color" class="form-control color-input" value="#3498db">
                                <div class="color-preview-container">
                                    <div class="color-preview-large" id="color-preview" style="background-color: #3498db;"></div>
                                    <div class="color-text-preview" id="color-text-preview" style="background-color: #3498db; color: #000000;">Пример текста</div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline modal-cancel">Отмена</button>
                    <button class="btn btn-primary" id="create-user-submit">Создать</button>
                </div>
            </div>
        </div>
    `;
    
    // Обработчик закрытия модального окна
    const closeModal = () => {
        modalContainer.innerHTML = '';
    };
    
    // Добавляем обработчики событий
    modalContainer.querySelector('.modal-close').addEventListener('click', closeModal);
    modalContainer.querySelector('.modal-cancel').addEventListener('click', closeModal);
    
    // Обработчик изменения цвета для превью
    const colorInput = modalContainer.querySelector('#user_color');
    const colorPreview = modalContainer.querySelector('#color-preview');
    const colorTextPreview = modalContainer.querySelector('#color-text-preview');
    
    colorInput.addEventListener('input', function() {
        const selectedColor = this.value;
        const textColor = getContrastColor(selectedColor);
        
        colorPreview.style.backgroundColor = selectedColor;
        colorTextPreview.style.backgroundColor = selectedColor;
        colorTextPreview.style.color = textColor;
    });
    
    // Обработчик отправки формы
    modalContainer.querySelector('#create-user-submit').addEventListener('click', function() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const email = document.getElementById('email').value;
        const role = document.getElementById('role').value;
        const userColor = document.getElementById('user_color').value;
        
        if (!username || !password || !role) {
            alert('Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        // Отправляем запрос на создание пользователя
        fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password,
                email: email || null,
                role: role,
                user_color: userColor
            })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return response.json().then(data => {
                    throw new Error(data.error || 'Failed to create user');
                });
            }
        })
        .then(data => {
            // Закрываем модальное окно
            closeModal();
            // Показываем модальное окно управления пользователями с обновленным списком
            showUserManagementModal();
            // Показываем сообщение об успехе
            showNotification('Пользователь успешно создан');
        })
        .catch(error => {
            alert(error.message);
            console.error('Create user error:', error);
        });
    });
}

// Показать модальное окно редактирования пользователя
function showEditUserModal(userId) {
    // Загружаем данные пользователя
    fetch(`/api/users/${userId}`)
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to load user details');
            }
        })
        .then(data => {
            const user = data.user;
            const modalContainer = document.getElementById('modal-container');
            
            modalContainer.innerHTML = `
                <div class="modal-backdrop">
                    <div class="modal">
                        <div class="modal-header">
                            <h3 class="modal-title">Редактирование пользователя</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-user-form">
                                <div class="form-group">
                                    <label for="username" class="form-label">Имя пользователя</label>
                                    <input type="text" id="username" class="form-control" value="${user.username}" required>
                                </div>
                                <div class="form-group">
                                    <label for="password" class="form-label">Новый пароль</label>
                                    <input type="password" id="password" class="form-control" placeholder="Оставьте пустым, чтобы не менять">
                                </div>
                                <div class="form-group">
                                    <label for="email" class="form-label">Email</label>
                                    <input type="email" id="email" class="form-control" value="${user.email || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="role" class="form-label">Роль</label>
                                    <select id="role" class="form-control" required>
                                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Менеджер</option>
                                        <option value="installer_entrance" ${user.role === 'installer_entrance' ? 'selected' : ''}>Установщик (входные двери)</option>
                                        <option value="installer_interior" ${user.role === 'installer_interior' ? 'selected' : ''}>Установщик (межкомнатные двери)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="user_color" class="form-label">Цвет пользователя</label>
                                    <div class="color-picker-container">
                                        <input type="color" id="user_color" class="form-control color-input" value="${user.user_color || '#3498db'}">
                                        <div class="color-preview-container">
                                            <div class="color-preview-large" id="color-preview" style="background-color: ${user.user_color || '#3498db'};"></div>
                                            <div class="color-text-preview" id="color-text-preview" style="background-color: ${user.user_color || '#3498db'}; color: ${getContrastColor(user.user_color || '#3498db')};">Пример текста</div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline modal-cancel">Отмена</button>
                            <button class="btn btn-primary" id="edit-user-submit">Сохранить</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Обработчик закрытия модального окна
            const closeModal = () => {
                modalContainer.innerHTML = '';
            };
            
            // Добавляем обработчики событий
            modalContainer.querySelector('.modal-close').addEventListener('click', closeModal);
            modalContainer.querySelector('.modal-cancel').addEventListener('click', closeModal);
            
            // Обработчик изменения цвета для превью
            const colorInput = modalContainer.querySelector('#user_color');
            const colorPreview = modalContainer.querySelector('#color-preview');
            const colorTextPreview = modalContainer.querySelector('#color-text-preview');
            
            colorInput.addEventListener('input', function() {
                const selectedColor = this.value;
                const textColor = getContrastColor(selectedColor);
                
                colorPreview.style.backgroundColor = selectedColor;
                colorTextPreview.style.backgroundColor = selectedColor;
                colorTextPreview.style.color = textColor;
            });
            
            // Обработчик отправки формы
            modalContainer.querySelector('#edit-user-submit').addEventListener('click', function() {
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const email = document.getElementById('email').value;
                const role = document.getElementById('role').value;
                const userColor = document.getElementById('user_color').value;
                
                if (!username || !role) {
                    alert('Пожалуйста, заполните все обязательные поля');
                    return;
                }
                
                // Подготавливаем данные для отправки
                const userData = {
                    username: username,
                    email: email || null,
                    role: role,
                    user_color: userColor
                };
                
                // Добавляем пароль только если он был введен
                if (password) {
                    userData.password = password;
                }
                
                // Отправляем запрос на обновление пользователя
                fetch(`/api/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(userData)
                })
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    } else {
                        return response.json().then(data => {
                            throw new Error(data.error || 'Failed to update user');
                        });
                    }
                })
                .then(data => {
                    // Закрываем модальное окно
                    closeModal();
                    // Показываем модальное окно управления пользователями с обновленным списком
                    showUserManagementModal();
                    // Показываем сообщение об успехе
                    showNotification('Пользователь успешно обновлен');
                })
                .catch(error => {
                    alert(error.message);
                    console.error('Update user error:', error);
                });
            });
        })
        .catch(error => {
            console.error('Error loading user details:', error);
            alert('Ошибка загрузки данных пользователя');
        });
}

// Удаление пользователя
function deleteUser(userId) {
    fetch(`/api/users/${userId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to delete user');
            });
        }
    })
    .then(data => {
        // Показываем модальное окно управления пользователями с обновленным списком
        showUserManagementModal();
        // Показываем сообщение об успехе
        showNotification('Пользователь успешно удален');
    })
    .catch(error => {
        alert(error.message);
        console.error('Delete user error:', error);
    });
}

// Загрузка календаря
function loadCalendar() {
    const calendarContainer = document.getElementById('calendar-container');
    calendarContainer.innerHTML = '<div class="loading">Загрузка календаря...</div>';
    
    // Получаем текущую дату
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Формируем даты начала и конца месяца
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    // Форматируем даты для API
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    // Загружаем данные календаря
    fetch(`/api/calendar?start_date=${startDateStr}&end_date=${endDateStr}&door_type=${doorType}`)
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to load calendar');
            }
        })
        .then(data => {
            calendarData = data.calendar;
            if (!calendarViewModeWasManuallyChanged) {
        calendarViewMode = isMobileScreen() ? 'week' : 'month';
            }
            renderCalendar(year, month);
        })
        .catch(error => {
            calendarContainer.innerHTML = '<div class="error">Ошибка загрузки календаря</div>';
            console.error('Calendar loading error:', error);
        });
}

// Отрисовка календаря
// --- PATCH START: Модифицированный renderCalendar с поддержкой вертикального вида ---
function renderCalendar(year, month) {
    const calendarContainer = document.getElementById('calendar-container');
    const currentMonthElement = document.getElementById('current-month');
    const calendarControls = document.querySelector('.calendar-controls');
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    currentMonthElement.textContent = `${monthNames[month]} ${year}`;

    // --- Добавим кнопку-переключатель вида ---
    let switchBtn = document.getElementById('switch-calendar-view');
    if (!switchBtn) {
        let btn = document.createElement('button');
        btn.className = 'btn btn-outline';
        btn.id = 'switch-calendar-view';
        btn.style.marginLeft = "10px";
        btn.textContent = calendarViewMode === 'month' ? 'Неделя' : 'Месяц';
        btn.onclick = function() {
    calendarViewModeWasManuallyChanged = true; // <--- добавить первой строкой!
    if (calendarViewMode === 'month') {
        calendarViewMode = 'week';
        currentWeekIndex = 0;
    } else {
        calendarViewMode = 'month';
    }
    renderCalendar(year, month);
};
        calendarControls.appendChild(btn);
    } else {
        switchBtn.textContent = calendarViewMode === 'month' ? 'Неделя' : 'Месяц';
    }

    // --- Считаем недели месяца ---
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const totalDays = lastDay.getDate();
    const totalCells = Math.ceil((totalDays + firstDayOfWeek) / 7) * 7;
    // массив недель месяца
    let weeks = [];
    let date = 1 - firstDayOfWeek;
    for (let w = 0; w < totalCells / 7; w++) {
        let week = [];
        for (let j = 0; j < 7; j++) {
            if (date < 1 || date > totalDays) {
                week.push(null);
            } else {
                week.push(new Date(year, month, date));
            }
            date++;
        }
        weeks.push(week);
    }

    // --- Месячный режим (обычная таблица) ---
    if (calendarViewMode === 'month') {
        let calendarHtml = '<table class="calendar">';
        calendarHtml += '<thead><tr>';
        for (let i = 0; i < 7; i++) {
            calendarHtml += `<th>${dayNames[i]}</th>`;
        }
        calendarHtml += '</tr></thead>';
        calendarHtml += '<tbody>';
        date = 1;
        for (let i = 0; i < totalCells / 7; i++) {
            calendarHtml += '<tr>';
            for (let j = 0; j < 7; j++) {
                if ((i === 0 && j < firstDayOfWeek) || date > totalDays) {
                    calendarHtml += '<td></td>';
                } else {
                    const currentDate = new Date(year, month, date);
                    const dateStr = formatDate(currentDate);
                    const dayData = calendarData.find(day => day.date === dateStr);
                    let cellContent = `<div class="calendar-day">${date}</div>`;
                    // ... стандартная логика morning/afternoon ...
                    if (dayData && dayData.morning) {
                        const userColor = dayData.morning.user.user_color || '#3498db';
                        const textColor = getContrastColor(userColor);
                        if (dayData.morning.is_weekend) {
                            cellContent += `
                                <div class="calendar-event morning weekend" data-appointment-id="${dayData.morning.id}" 
                                     style="background-color: #4caf50; color: #000000;">
                                    <strong>ВЫХОДНОЙ</strong>
                                </div>
                            `;
                        } else {
                            cellContent += `
                                <div class="calendar-event morning" data-appointment-id="${dayData.morning.id}" 
                                     style="background-color: ${userColor}; color: ${textColor};">
                                    <strong>Утро: ${dayData.morning.user.username}</strong>
                                    ${dayData.morning.invoice_number ? `<br>Накладная: ${dayData.morning.invoice_number}` : ''}
                                    ${dayData.morning.address ? `<br>Адрес: ${dayData.morning.address}` : ''}
                                </div>
                            `;
                        }
                    } else {
                        cellContent += `
                            <button class="btn btn-sm btn-outline book-btn" 
                                    data-date="${dateStr}" 
                                    data-time-slot="morning">
                                Забронировать утро
                            </button>
                        `;
                    }
                    if (dayData && dayData.afternoon) {
                        const userColor = dayData.afternoon.user.user_color || '#3498db';
                        const textColor = getContrastColor(userColor);
                        if (dayData.afternoon.is_weekend) {
                            cellContent += `
                                <div class="calendar-event afternoon weekend" data-appointment-id="${dayData.afternoon.id}" 
                                     style="background-color: #4caf50; color: #000000;">
                                    <strong>ВЫХОДНОЙ</strong>
                                </div>
                            `;
                        } else {
                            cellContent += `
                                <div class="calendar-event afternoon" data-appointment-id="${dayData.afternoon.id}" 
                                     style="background-color: ${userColor}; color: ${textColor};">
                                    <strong>Вечер: ${dayData.afternoon.user.username}</strong>
                                    ${dayData.afternoon.invoice_number ? `<br>Накладная: ${dayData.afternoon.invoice_number}` : ''}
                                    ${dayData.afternoon.address ? `<br>Адрес: ${dayData.afternoon.address}` : ''}
                                </div>
                            `;
                        }
                    } else {
                        cellContent += `
                            <button class="btn btn-sm btn-outline book-btn" 
                                    data-date="${dateStr}" 
                                    data-time-slot="afternoon">
                                Забронировать вечер
                            </button>
                        `;
                    }
                    calendarHtml += `<td>${cellContent}</td>`;
                    date++;
                }
            }
            calendarHtml += '</tr>';
            if (date > totalDays) break;
        }
        calendarHtml += '</tbody></table>';
        calendarContainer.innerHTML = calendarHtml;

        // Кнопки переключения месяцев
        document.getElementById('prev-month').style.display = '';
        document.getElementById('next-month').style.display = '';
        if (document.getElementById('prev-week')) document.getElementById('prev-week').style.display = 'none';
        if (document.getElementById('next-week')) document.getElementById('next-week').style.display = 'none';
    }

    // --- Недельный режим (одна неделя, вертикально) ---
    if (calendarViewMode === 'week') {
        // Показываем только одну неделю
        let week = weeks[currentWeekIndex];
        let calendarHtml = '<div class="calendar-week-vertical">';
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            let day = week[dayIdx];
            if (!day) continue; // <--- пропуск пустых дней!
        calendarHtml += `<div class="calendar-day-vertical">`;
        const dateStr = formatDate(day);
        const dayData = calendarData.find(dayObj => dayObj.date === dateStr);
        calendarHtml += `<div class="week-day-title">${dayNames[dayIdx]}, ${day.getDate()}.${String(day.getMonth()+1).padStart(2,'0')}</div>`;
            calendarHtml += `<div class="calendar-day-vertical">`;
            if (day) {
                const dateStr = formatDate(day);
                const dayData = calendarData.find(dayObj => dayObj.date === dateStr);
                calendarHtml += `<div class="week-day-title">${dayNames[dayIdx]}, ${day.getDate()}.${String(day.getMonth()+1).padStart(2,'0')}</div>`;
                if (dayData && dayData.morning) {
                    const userColor = dayData.morning.user.user_color || '#3498db';
                    const textColor = getContrastColor(userColor);
                    if (dayData.morning.is_weekend) {
                        calendarHtml += `
                            <div class="calendar-event morning weekend" data-appointment-id="${dayData.morning.id}" 
                                 style="background-color: #4caf50; color: #000000;">
                                <strong>ВЫХОДНОЙ</strong>
                            </div>
                        `;
                    } else {
                        calendarHtml += `
                            <div class="calendar-event morning" data-appointment-id="${dayData.morning.id}" 
                                 style="background-color: ${userColor}; color: ${textColor};">
                                <strong>Утро: ${dayData.morning.user.username}</strong>
                                ${dayData.morning.invoice_number ? `<br>Накладная: ${dayData.morning.invoice_number}` : ''}
                                ${dayData.morning.address ? `<br>Адрес: ${dayData.morning.address}` : ''}
                            </div>
                        `;
                    }
                } else {
                    calendarHtml += `
                        <button class="btn btn-sm btn-outline book-btn" 
                                data-date="${dateStr}" 
                                data-time-slot="morning">
                            Забронировать утро
                        </button>
                    `;
                }
                if (dayData && dayData.afternoon) {
                    const userColor = dayData.afternoon.user.user_color || '#3498db';
                    const textColor = getContrastColor(userColor);
                    if (dayData.afternoon.is_weekend) {
                        calendarHtml += `
                            <div class="calendar-event afternoon weekend" data-appointment-id="${dayData.afternoon.id}" 
                                 style="background-color: #4caf50; color: #000000;">
                                <strong>ВЫХОДНОЙ</strong>
                            </div>
                        `;
                    } else {
                        calendarHtml += `
                            <div class="calendar-event afternoon" data-appointment-id="${dayData.afternoon.id}" 
                                 style="background-color: ${userColor}; color: ${textColor};">
                                <strong>Вечер: ${dayData.afternoon.user.username}</strong>
                                ${dayData.afternoon.invoice_number ? `<br>Накладная: ${dayData.afternoon.invoice_number}` : ''}
                                ${dayData.afternoon.address ? `<br>Адрес: ${dayData.afternoon.address}` : ''}
                            </div>
                        `;
                    }
                } else {
                    calendarHtml += `
                        <button class="btn btn-sm btn-outline book-btn" 
                                data-date="${dateStr}" 
                                data-time-slot="afternoon">
                            Забронировать вечер
                        </button>
                    `;
                }
            }
            calendarHtml += `</div>`;
        }
        calendarHtml += '</div>';

        // Кнопки недели
        let weekBtns = '';
    weekBtns += `<button id="prev-week" class="btn btn-outline" style="margin-right:8px;">←</button>`;
    weekBtns += `<span style="font-weight:600;">Неделя ${currentWeekIndex+1} из ${weeks.length}</span>`;
    weekBtns += `<button id="next-week" class="btn btn-outline" style="margin-left:8px;">→</button>`;
    calendarContainer.innerHTML = `<div class="week-switch-row" style="display:flex;align-items:center;justify-content:center;margin-bottom:1em;">${weekBtns}</div>${calendarHtml}`;

        // Прячем кнопки для месяца, показываем для недели
        document.getElementById('prev-month').style.display = 'none';
        document.getElementById('next-month').style.display = 'none';
        document.getElementById('prev-week').style.display = '';
        document.getElementById('next-week').style.display = '';

        // Навигация по неделям
        document.getElementById('prev-week').onclick = () => {
            if (currentWeekIndex > 0) {
                currentWeekIndex--;
                renderCalendar(year, month);
            }
        };
        document.getElementById('next-week').onclick = () => {
            if (currentWeekIndex < weeks.length - 1) {
                currentWeekIndex++;
                renderCalendar(year, month);
            }
        };
    }

    // Обработчики событий для обеих версий
    const bookButtons = document.querySelectorAll('.book-btn');
    bookButtons.forEach(button => {
        button.addEventListener('click', function() {
            const date = this.dataset.date;
            const timeSlot = this.dataset.timeSlot;
            showBookingModal(date, timeSlot);
        });
    });

    const calendarEvents = document.querySelectorAll('.calendar-event');
    calendarEvents.forEach(event => {
        event.addEventListener('click', function() {
            const appointmentId = this.dataset.appointmentId;
            showAppointmentDetailsModal(appointmentId);
        });
    });
}
// --- PATCH END ---
// --- PATCH: Автоматическая перестройка календаря при ресайзе ---
window.addEventListener('resize', () => {
    if (!calendarViewModeWasManuallyChanged) {
    calendarViewMode = isMobileScreen() ? 'week' : 'month';
}
    const currentMonthElement = document.getElementById('current-month');
    if (!currentMonthElement) return;
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    const [monthName, yearStr] = currentMonthElement.textContent.split(' ');
    const month = monthNames.indexOf(monthName);
    const year = parseInt(yearStr);
    if (!isNaN(month) && !isNaN(year)) {
        renderCalendar(year, month);
    }
});
// --- PATCH END ---
// Показать модальное окно для бронирования
function showBookingModal(date, timeSlot) {
    const modalContainer = document.getElementById('modal-container');
    
    // Форматируем дату для отображения
    const formattedDate = formatDateForDisplay(date);
    
    // Определяем текст временного слота
    const timeSlotText = timeSlot === 'morning' ? 'Утро (9:00 - 13:00)' : 'Вечер (15:00 - 18:00)';
    
    // Определяем, нужно ли поле для номера накладной (обязательно для менеджеров)
    const invoiceRequired = currentUser.role === 'manager';
    
    modalContainer.innerHTML = `
        <div class="modal-backdrop">
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Бронирование установки</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="booking-form">
                        <div class="form-group">
                            <label class="form-label">Дата</label>
                            <input type="text" class="form-control" value="${formattedDate}" readonly>
                            <input type="hidden" id="booking-date" value="${date}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Время</label>
                            <input type="text" class="form-control" value="${timeSlotText}" readonly>
                            <input type="hidden" id="booking-time-slot" value="${timeSlot}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Тип дверей</label>
                            <input type="text" class="form-control" value="${doorType === 'entrance' ? 'Входные' : 'Межкомнатные'}" readonly>
                            <input type="hidden" id="booking-door-type" value="${doorType}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" id="booking-is-weekend"> ВЫХОДНОЙ
                            </label>
                        </div>
                        <div class="form-group" id="address-group">
                            <label class="form-label" for="booking-address">Адрес</label>
                            <input type="text" id="booking-address" class="form-control" placeholder="Введите адрес установки">
                        </div>
                        <div class="form-group" id="invoice-group">
                            <label class="form-label" for="booking-invoice">Номер накладной</label>
                            <input type="text" id="booking-invoice" class="form-control" placeholder="Введите номер накладной" ${invoiceRequired ? 'required' : ''}>
                            ${invoiceRequired ? '<div class="form-hint">Обязательное поле для менеджеров</div>' : ''}
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="booking-comment">Комментарий</label>
                            <textarea id="booking-comment" class="form-control" rows="3" placeholder="Дополнительная информация"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline modal-cancel">Отмена</button>
                    <button class="btn btn-primary" id="booking-submit">Забронировать</button>
                </div>
            </div>
        </div>
    `;
    
    // Обработчик изменения чекбокса "ВЫХОДНОЙ"
    const weekendCheckbox = document.getElementById('booking-is-weekend');
    const addressGroup = document.getElementById('address-group');
    const invoiceGroup = document.getElementById('invoice-group');
    
    weekendCheckbox.addEventListener('change', function() {
        if (this.checked) {
            addressGroup.style.display = 'none';
            invoiceGroup.style.display = 'none';
        } else {
            addressGroup.style.display = 'block';
            invoiceGroup.style.display = 'block';
        }
    });
    
    // Обработчик закрытия модального окна
    const closeModal = () => {
        modalContainer.innerHTML = '';
    };
    
    // Добавляем обработчики событий
    modalContainer.querySelector('.modal-close').addEventListener('click', closeModal);
    modalContainer.querySelector('.modal-cancel').addEventListener('click', closeModal);
    
    // Обработчик отправки формы
    modalContainer.querySelector('#booking-submit').addEventListener('click', function() {
        const bookingDate = document.getElementById('booking-date').value;
        const bookingTimeSlot = document.getElementById('booking-time-slot').value;
        const bookingDoorType = document.getElementById('booking-door-type').value;
        const bookingAddress = document.getElementById('booking-address').value;
        const bookingInvoice = document.getElementById('booking-invoice').value;
        const bookingComment = document.getElementById('booking-comment').value;
        const isWeekend = document.getElementById('booking-is-weekend').checked;
        
        // Проверяем, заполнен ли номер накладной для менеджеров (если не выходной)
        if (!isWeekend && invoiceRequired && !bookingInvoice) {
            alert('Номер накладной обязателен для менеджеров');
            return;
        }
        
        // Отправляем запрос на создание записи
        fetch('/api/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: bookingDate,
                time_slot: bookingTimeSlot,
                door_type: bookingDoorType,
                address: isWeekend ? null : bookingAddress,
                invoice_number: isWeekend ? null : bookingInvoice,
                comment: bookingComment,
                is_weekend: isWeekend
            })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return response.json().then(data => {
                    throw new Error(data.error || 'Failed to create appointment');
                });
            }
        })
        .then(data => {
            // Закрываем модальное окно
            closeModal();
            // Перезагружаем календарь
            loadCalendar();
            // Показываем сообщение об успехе
            showNotification('Запись успешно создана');
        })
        .catch(error => {
            alert(error.message);
            console.error('Booking error:', error);
        });
    });
}

// Показать модальное окно с деталями записи
function showAppointmentDetailsModal(appointmentId) {
    // Загружаем данные о записи
    fetch(`/api/appointments/${appointmentId}`)
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to load appointment details');
            }
        })
        .then(data => {
            const appointment = data.appointment;
            const modalContainer = document.getElementById('modal-container');
            
            // Форматируем дату для отображения
            const formattedDate = formatDateForDisplay(appointment.date);
            
            // Определяем текст временного слота
            const timeSlotText = appointment.time_slot === 'morning' ? 'Утро (9:00 - 13:00)' : 'Вечер (15:00 - 18:00)';
            
            // Определяем, может ли пользователь редактировать запись
            const canEdit = currentUser.role === 'admin' || currentUser.id === appointment.user_id;
            
            modalContainer.innerHTML = `
                <div class="modal-backdrop">
                    <div class="modal">
                        <div class="modal-header">
                            <h3 class="modal-title">Детали установки</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label class="form-label">Дата</label>
                                <input type="text" class="form-control" value="${formattedDate}" readonly>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Время</label>
                                <input type="text" class="form-control" value="${timeSlotText}" readonly>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Тип дверей</label>
                                <input type="text" class="form-control" value="${appointment.door_type === 'entrance' ? 'Входные' : 'Межкомнатные'}" readonly>
                            </div>
                            <div class="form-group">
                                <label class="form-label">
                                    <input type="checkbox" id="edit-is-weekend" ${appointment.is_weekend ? 'checked' : ''} ${canEdit ? '' : 'disabled'}> ВЫХОДНОЙ
                                </label>
                            </div>
                            <div class="form-group" id="edit-address-group" style="${appointment.is_weekend ? 'display: none;' : ''}">
                                <label class="form-label">Адрес</label>
                                <input type="text" id="edit-address" class="form-control" value="${appointment.address || ''}" ${canEdit ? '' : 'readonly'}>
                            </div>
                            <div class="form-group" id="edit-invoice-group" style="${appointment.is_weekend ? 'display: none;' : ''}">
                                <label class="form-label">Номер накладной</label>
                                <input type="text" id="edit-invoice" class="form-control" value="${appointment.invoice_number || ''}" ${canEdit ? '' : 'readonly'}>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Комментарий</label>
                                <textarea id="edit-comment" class="form-control" rows="3" ${canEdit ? '' : 'readonly'}>${appointment.comment || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Последнее обновление</label>
                                <input type="text" class="form-control" value="${formatDateTimeForDisplay(appointment.updated_at)}" readonly>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline modal-cancel">Закрыть</button>
                            ${canEdit ? `
                                <button class="btn btn-secondary" id="delete-appointment">Удалить</button>
                                <button class="btn btn-primary" id="update-appointment">Сохранить изменения</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            // Обработчик изменения чекбокса "ВЫХОДНОЙ"
            if (canEdit) {
                const weekendCheckbox = document.getElementById('edit-is-weekend');
                const addressGroup = document.getElementById('edit-address-group');
                const invoiceGroup = document.getElementById('edit-invoice-group');
                
                weekendCheckbox.addEventListener('change', function() {
                    if (this.checked) {
                        addressGroup.style.display = 'none';
                        invoiceGroup.style.display = 'none';
                    } else {
                        addressGroup.style.display = 'block';
                        invoiceGroup.style.display = 'block';
                    }
                });
            }
            
            // Обработчик закрытия модального окна
            const closeModal = () => {
                modalContainer.innerHTML = '';
            };
            
            // Добавляем обработчики событий
            modalContainer.querySelector('.modal-close').addEventListener('click', closeModal);
            modalContainer.querySelector('.modal-cancel').addEventListener('click', closeModal);
            
            if (canEdit) {
                // Обработчик удаления записи
                modalContainer.querySelector('#delete-appointment').addEventListener('click', function() {
                    if (confirm('Вы уверены, что хотите удалить эту запись?')) {
                        deleteAppointment(appointmentId, closeModal);
                    }
                });
                
                // Обработчик обновления записи
                modalContainer.querySelector('#update-appointment').addEventListener('click', function() {
                    updateAppointment(appointmentId, closeModal);
                });
            }
        })
        .catch(error => {
            console.error('Error loading appointment details:', error);
            alert('Ошибка загрузки данных');
        });
}

// Обновление записи
function updateAppointment(appointmentId, closeModalCallback) {
    const address = document.getElementById('edit-address').value;
    const invoice = document.getElementById('edit-invoice').value;
    const comment = document.getElementById('edit-comment').value;
    const isWeekend = document.getElementById('edit-is-weekend').checked;
    
    fetch(`/api/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            address: isWeekend ? null : address,
            invoice_number: isWeekend ? null : invoice,
            comment: comment,
            is_weekend: isWeekend
        })
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to update appointment');
            });
        }
    })
    .then(data => {
        // Закрываем модальное окно
        closeModalCallback();
        // Перезагружаем календарь
        loadCalendar();
        // Показываем сообщение об успехе
        showNotification('Запись успешно обновлена');
    })
    .catch(error => {
        alert(error.message);
        console.error('Update error:', error);
    });
}

// Удаление записи
function deleteAppointment(appointmentId, closeModalCallback) {
    fetch(`/api/appointments/${appointmentId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to delete appointment');
            });
        }
    })
    .then(data => {
        // Закрываем модальное окно
        closeModalCallback();
        // Перезагружаем календарь
        loadCalendar();
        // Показываем сообщение об успехе
        showNotification('Запись успешно удалена');
    })
    .catch(error => {
        alert(error.message);
        console.error('Delete error:', error);
    });
}

// Загрузка уведомлений
function loadNotifications() {
    fetch('/api/notifications')
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to load notifications');
            }
        })
        .then(data => {
            const unreadCount = data.notifications.filter(n => !n.is_read).length;
            const badgeElement = document.getElementById('notification-count');
            
            if (unreadCount > 0) {
                badgeElement.textContent = unreadCount;
                badgeElement.style.display = 'block';
            } else {
                badgeElement.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error loading notifications:', error);
        });
}

// Показать модальное окно с уведомлениями
function showNotificationsModal() {
    fetch('/api/notifications')
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to load notifications');
            }
        })
        .then(data => {
            const modalContainer = document.getElementById('modal-container');
            
            let notificationsHtml = '';
            if (data.notifications.length === 0) {
                notificationsHtml = '<div class="empty-state">У вас нет уведомлений</div>';
            } else {
                notificationsHtml = '<div class="notification-list">';
                data.notifications.forEach(notification => {
                    notificationsHtml += `
                        <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.id}">
                            <div class="notification-content">${notification.message}</div>
                            <div class="notification-date">${formatDateTimeForDisplay(notification.created_at)}</div>
                            ${notification.is_read ? '' : '<button class="btn btn-sm btn-outline mark-read-btn">Отметить как прочитанное</button>'}
                        </div>
                    `;
                });
                notificationsHtml += '</div>';
            }
            
            modalContainer.innerHTML = `
                <div class="modal-backdrop">
                    <div class="modal">
                        <div class="modal-header">
                            <h3 class="modal-title">Уведомления</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            ${notificationsHtml}
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline modal-cancel">Закрыть</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Обработчик закрытия модального окна
            const closeModal = () => {
                modalContainer.innerHTML = '';
                // Перезагружаем счетчик уведомлений
                loadNotifications();
            };
            
            // Добавляем обработчики событий
            modalContainer.querySelector('.modal-close').addEventListener('click', closeModal);
            modalContainer.querySelector('.modal-cancel').addEventListener('click', closeModal);
            
            // Добавляем обработчики для кнопок "Отметить как прочитанное"
            const markReadButtons = modalContainer.querySelectorAll('.mark-read-btn');
            markReadButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const notificationItem = this.closest('.notification-item');
                    const notificationId = notificationItem.dataset.id;
                    markNotificationAsRead(notificationId, notificationItem);
                });
            });
        })
        .catch(error => {
            console.error('Error loading notifications:', error);
            alert('Ошибка загрузки уведомлений');
        });
}

// Отметить уведомление как прочитанное
function markNotificationAsRead(notificationId, notificationElement) {
    fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Failed to mark notification as read');
        }
    })
    .then(data => {
        // Обновляем внешний вид уведомления
        notificationElement.classList.remove('unread');
        const markReadBtn = notificationElement.querySelector('.mark-read-btn');
        if (markReadBtn) {
            markReadBtn.remove();
        }
        
        // Обновляем счетчик непрочитанных уведомлений
        loadNotifications();
    })
    .catch(error => {
        console.error('Error marking notification as read:', error);
    });
}

// Изменение месяца в календаре
function changeMonth(delta) {
    // Получаем текущий месяц из заголовка
    const currentMonthElement = document.getElementById('current-month');
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    
    // Парсим текущий месяц и год
    const [monthName, yearStr] = currentMonthElement.textContent.split(' ');
    const month = monthNames.indexOf(monthName);
    const year = parseInt(yearStr);
    
    // Вычисляем новый месяц и год
    let newMonth = month + delta;
    let newYear = year;
    
    if (newMonth < 0) {
        newMonth = 11;
        newYear--;
    } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
    }
    
    // Формируем даты начала и конца месяца
    const startDate = new Date(newYear, newMonth, 1);
    const endDate = new Date(newYear, newMonth + 1, 0);
    
    // Форматируем даты для API
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    // Загружаем данные календаря для нового месяца
    fetch(`/api/calendar?start_date=${startDateStr}&end_date=${endDateStr}&door_type=${doorType}`)
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to load calendar');
            }
        })
        .then(data => {
            calendarData = data.calendar;
            renderCalendar(newYear, newMonth);
        })
        .catch(error => {
            console.error('Calendar loading error:', error);
            alert('Ошибка загрузки календаря');
        });
}

// Выход из системы
function logout() {
    fetch('/api/logout', {
        method: 'POST'
    })
    .then(() => {
        // Перезагружаем страницу
        window.location.reload();
    })
    .catch(error => {
        console.error('Logout error:', error);
    });
}

// Показать уведомление
function showNotification(message) {
    const notificationElement = document.createElement('div');
    notificationElement.className = 'notification-toast';
    notificationElement.textContent = message;
    
    document.body.appendChild(notificationElement);
    
    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        notificationElement.classList.add('fade-out');
        setTimeout(() => {
            notificationElement.remove();
        }, 300);
    }, 3000);
}

// Форматирование даты для API (YYYY-MM-DD)
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Форматирование даты для отображения (DD.MM.YYYY)
function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Форматирование даты и времени для отображения
function formatDateTimeForDisplay(dateTimeStr) {
    const date = new Date(dateTimeStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Обработчики будут добавлены после загрузки DOM
}
