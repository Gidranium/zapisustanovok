from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db, User

class Appointment(db.Model):
    __tablename__ = 'appointments'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    time_slot = db.Column(db.String(20), nullable=False)  # 'morning' or 'afternoon'
    door_type = db.Column(db.String(20), nullable=False)  # 'entrance' or 'interior'
    comment = db.Column(db.Text, nullable=True)
    invoice_number = db.Column(db.String(50), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_weekend = db.Column(db.Boolean, default=False) # Переименовано с is_holiday на is_weekend

    # Добавьте эту строку:
    user = db.relationship('User', backref='appointments', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'date': self.date.isoformat() if self.date else None,
            'time_slot': self.time_slot,
            'door_type': self.door_type,
            'comment': self.comment,
            'invoice_number': self.invoice_number,
            'address': self.address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_weekend': self.is_weekend # Переименовано
        }


class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    appointment = db.relationship('Appointment', backref='notifications')
    user = db.relationship('User', backref='notifications')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'appointment_id': self.appointment_id,
            'message': self.message,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

