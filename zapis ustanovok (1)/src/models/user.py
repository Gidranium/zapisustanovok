from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    role = db.Column(db.String(20), nullable=False)  # 'admin', 'manager', 'installer_entrance', 'installer_interior'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    user_color = db.Column(db.String(7), nullable=True, default='#3498db') # Default color

    def __init__(self, username, password, role, email=None, user_color=None):
        self.username = username
        self.set_password(password)
        self.role = role
        self.email = email
        self.user_color = user_color if user_color else '#3498db' # Set default if not provided

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def is_admin(self):
        return self.role == 'admin'
    
    def is_manager(self):
        return self.role == 'manager'
    
    def is_installer(self):
        return self.role in ['installer_entrance', 'installer_interior']
    
    def is_entrance_installer(self):
        return self.role == 'installer_entrance'
    
    def is_interior_installer(self):
        return self.role == 'installer_interior'
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'user_color': self.user_color # Добавлено
        }

