""" placeholder """

import os
import sys
from datetime import datetime, timedelta

from flask import Flask, send_from_directory, request
from src.models.user import db, User
from src.models.appointment import Appointment, Notification
from src.routes.user import user_bp
from src.routes.appointment import appointment_bp


sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

application = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
application.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

# Включаем поддержку базы данных
application.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://u1258856_root:simbaChel52!@localhost/u1258856_door_installing"
application.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(application)

# Регистрируем маршруты
application.register_blueprint(user_bp, url_prefix='/api')
application.register_blueprint(appointment_bp, url_prefix='/api')

# Создаем таблицы при запуске
with application.app_context():
    db.create_all()
    
    # Проверяем, есть ли администратор, и создаем его, если нет
    admin = User.query.filter_by(role='admin').first()
    if not admin:
        admin = User(username='admin', password='admin123', role='admin')
        db.session.add(admin)
        db.session.commit()

# Задача для создания уведомлений о предстоящих установках
@application.before_request
def check_upcoming_appointments():
    # Пропускаем для статических файлов и API-запросов
    if request.path.startswith('/static') or request.path.startswith('/api'):
        return
    
    with application.app_context():
        # Получаем дату на завтра
        tomorrow = datetime.utcnow().date() + timedelta(days=1)
        
        # Находим все записи на завтра
        appointments = Appointment.query.filter_by(date=tomorrow).all()
        
        for appointment in appointments:
            # Проверяем, есть ли уже уведомление для этой записи
            existing_notification = Notification.query.filter_by(
                appointment_id=appointment.id,
                user_id=appointment.user_id
            ).first()
            
            if not existing_notification:
                # Создаем текст уведомления
                time_slot_text = "утро (9:00-13:00)" if appointment.time_slot == "morning" else "вечер (15:00-18:00)"
                door_type_text = "входных дверей" if appointment.door_type == "entrance" else "межкомнатных дверей"
                
                message = f"Напоминание: завтра ({tomorrow.strftime('%d.%m.%Y')}) у вас запланирована установка {door_type_text}, {time_slot_text}"
                if appointment.address:
                    message += f", по адресу: {appointment.address}"
                if appointment.invoice_number:
                    message += f", накладная №{appointment.invoice_number}"
                
                # Создаем уведомление
                notification = Notification(
                    user_id=appointment.user_id,
                    appointment_id=appointment.id,
                    message=message,
                    is_read=False
                )
                
                db.session.add(notification)
                db.session.commit()

@application.route('/', defaults={'path': ''})
@application.route('/<path:path>')
def serve(path):
    static_folder_path = application.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

if __name__ == '__main__':
    application.run(host='0.0.0.0', port=5000, debug=True)
