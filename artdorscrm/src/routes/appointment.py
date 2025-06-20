from flask import Blueprint, request, jsonify, session
from src.models.appointment import Appointment, Notification, db
from src.models.user import User
from src.routes.user import login_required
from datetime import datetime, timedelta

appointment_bp = Blueprint('appointment', __name__)

# Helper function to check if user can access appointment
def can_access_appointment(user, appointment):
    # Admins and managers can access all appointments
    if user.is_admin() or user.is_manager():
        return True
    
    # Installers can only access their own appointments or appointments of their type
    if user.is_installer():
        if appointment.user_id == user.id:
            return True
        
        # Entrance installers can see entrance door appointments
        if user.is_entrance_installer() and appointment.door_type == 'entrance':
            return True
        
        # Interior installers can see interior door appointments
        if user.is_interior_installer() and appointment.door_type == 'interior':
            return True
    
    return False

# Get all appointments (filtered by role and door type)
@appointment_bp.route('/appointments', methods=['GET'])
@login_required
def get_appointments():
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get query parameters
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    door_type = request.args.get('door_type')
    
    # Build query
    query = Appointment.query
    
    # Filter by date range if provided
    if start_date:
        try:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Appointment.date >= start_date)
        except ValueError:
            return jsonify({'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400
    
    if end_date:
        try:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Appointment.date <= end_date)
        except ValueError:
            return jsonify({'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400
    
    # Filter by door type if provided
    if door_type:
        if door_type not in ['entrance', 'interior']:
            return jsonify({'error': 'Invalid door_type. Must be "entrance" or "interior"'}), 400
        query = query.filter(Appointment.door_type == door_type)
    
    # Filter by user role
    if not user.is_admin() and not user.is_manager():
        if user.is_entrance_installer():
            query = query.filter(Appointment.door_type == 'entrance')
        elif user.is_interior_installer():
            query = query.filter(Appointment.door_type == 'interior')
    
    # Execute query
    appointments = query.order_by(Appointment.date).all()
    
    # Return results
    return jsonify({
        'appointments': [appointment.to_dict() for appointment in appointments]
    }), 200

# Create a new appointment
@appointment_bp.route('/appointments', methods=['POST'])
@login_required
def create_appointment():
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['date', 'time_slot', 'door_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Validate date format
    try:
        appointment_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    # Validate time slot
    if data['time_slot'] not in ['morning', 'afternoon']:
        return jsonify({'error': 'Invalid time_slot. Must be "morning" or "afternoon"'}), 400
    
    # Validate door type
    if data['door_type'] not in ['entrance', 'interior']:
        return jsonify({'error': 'Invalid door_type. Must be "entrance" or "interior"'}), 400
    
    # Check if user has permission for this door type
    if user.is_installer():
        if user.is_entrance_installer() and data['door_type'] != 'entrance':
            return jsonify({'error': 'You can only create entrance door appointments'}), 403
        if user.is_interior_installer() and data['door_type'] != 'interior':
            return jsonify({'error': 'You can only create interior door appointments'}), 403
    
    # Check if invoice number is provided for managers
    if user.is_manager() and 'invoice_number' not in data:
        return jsonify({'error': 'Invoice number is required for managers'}), 400
    
    # Check if the time slot is available
    existing_appointment = Appointment.query.filter_by(
        date=appointment_date,
        time_slot=data['time_slot'],
        door_type=data['door_type']
    ).first()
    
    if existing_appointment:
        return jsonify({'error': 'This time slot is already booked'}), 400
    
    # Create new appointment
    appointment = Appointment(
        user_id=user.id,
        date=appointment_date,
        time_slot=data['time_slot'],
        door_type=data['door_type'],
        comment=data.get('comment'),
        invoice_number=data.get('invoice_number'),
        address=data.get('address'),
        is_weekend=data.get('is_weekend', False)  # Добавлено поле is_weekend
    )
    
    db.session.add(appointment)
    db.session.commit()
    
    return jsonify({
        'message': 'Appointment created successfully',
        'appointment': appointment.to_dict()
    }), 201

# Get a specific appointment
@appointment_bp.route('/appointments/<int:appointment_id>', methods=['GET'])
@login_required
def get_appointment(appointment_id):
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({'error': 'Appointment not found'}), 404
    
    # Check if user has permission to view this appointment
    if not can_access_appointment(user, appointment):
        return jsonify({'error': 'You do not have permission to view this appointment'}), 403
    
    return jsonify({
        'appointment': appointment.to_dict()
    }), 200

# Update an appointment
@appointment_bp.route('/appointments/<int:appointment_id>', methods=['PUT'])
@login_required
def update_appointment(appointment_id):
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({'error': 'Appointment not found'}), 404
    
    # Администраторы могут редактировать любые записи, включая прошедшие
    # Обычные пользователи могут редактировать только свои записи
    if not user.is_admin() and appointment.user_id != user.id:
        return jsonify({'error': 'You do not have permission to update this appointment'}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Update fields if provided
    if 'date' in data:
        try:
            appointment_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            appointment.date = appointment_date
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    if 'time_slot' in data:
        if data['time_slot'] not in ['morning', 'afternoon']:
            return jsonify({'error': 'Invalid time_slot. Must be "morning" or "afternoon"'}), 400
        appointment.time_slot = data['time_slot']
    
    if 'door_type' in data:
        if data['door_type'] not in ['entrance', 'interior']:
            return jsonify({'error': 'Invalid door_type. Must be "entrance" or "interior"'}), 400
        
        # Check if user has permission for this door type
        if user.is_installer():
            if user.is_entrance_installer() and data['door_type'] != 'entrance':
                return jsonify({'error': 'You can only update to entrance door type'}), 403
            if user.is_interior_installer() and data['door_type'] != 'interior':
                return jsonify({'error': 'You can only update to interior door type'}), 403
        
        appointment.door_type = data['door_type']
    
    # Update other fields
    if 'comment' in data:
        appointment.comment = data['comment']
    
    if 'invoice_number' in data:
        appointment.invoice_number = data['invoice_number']
    
    if 'address' in data:
        appointment.address = data['address']
    
    if 'is_weekend' in data:
        appointment.is_weekend = data['is_weekend']
    
    # Check if the time slot is available (if date or time_slot changed)
    if 'date' in data or 'time_slot' in data:
        existing_appointment = Appointment.query.filter_by(
            date=appointment.date,
            time_slot=appointment.time_slot,
            door_type=appointment.door_type
        ).filter(Appointment.id != appointment_id).first()
        
        if existing_appointment:
            return jsonify({'error': 'This time slot is already booked'}), 400
    
    db.session.commit()
    
    return jsonify({
        'message': 'Appointment updated successfully',
        'appointment': appointment.to_dict()
    }), 200

# Delete an appointment
@appointment_bp.route('/appointments/<int:appointment_id>', methods=['DELETE'])
@login_required
def delete_appointment(appointment_id):
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({'error': 'Appointment not found'}), 404
    
    # Check if user has permission to delete this appointment
    if not user.is_admin() and appointment.user_id != user.id:
        return jsonify({'error': 'You do not have permission to delete this appointment'}), 403
    
    db.session.delete(appointment)
    db.session.commit()
    
    return jsonify({
        'message': 'Appointment deleted successfully'
    }), 200

# Get calendar data (appointments grouped by date)
@appointment_bp.route('/calendar', methods=['GET'])
@login_required
def get_calendar():
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get query parameters
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    door_type = request.args.get('door_type')
    
    # Default to current month if not specified
    if not start_date:
        today = datetime.utcnow().date()
        start_date = datetime(today.year, today.month, 1).date()
    else:
        try:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400
    
    if not end_date:
        # Default to end of month
        next_month = start_date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
    else:
        try:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400
    
    # Build query
    query = Appointment.query.filter(
        Appointment.date >= start_date,
        Appointment.date <= end_date
    )
    
    # Filter by door type
    if door_type:
        if door_type not in ['entrance', 'interior']:
            return jsonify({'error': 'Invalid door_type. Must be "entrance" or "interior"'}), 400
        query = query.filter(Appointment.door_type == door_type)
    elif not user.is_admin() and not user.is_manager():
        # Filter by user role
        if user.is_entrance_installer():
            query = query.filter(Appointment.door_type == 'entrance')
        elif user.is_interior_installer():
            query = query.filter(Appointment.door_type == 'interior')
    
    # Execute query
    appointments = query.order_by(Appointment.date, Appointment.time_slot).all()
    
    # Group appointments by date
    calendar_data = {}
    for appointment in appointments:
        date_str = appointment.date.isoformat()
        
        if date_str not in calendar_data:
            calendar_data[date_str] = {
                'date': date_str,
                'morning': None,
                'afternoon': None
            }
        
        # Add user info to appointment data
        appointment_data = appointment.to_dict()
        appointment_user = User.query.get(appointment.user_id)
        if appointment_user:
            appointment_data['user'] = {
                'id': appointment_user.id,
                'username': appointment_user.username,
                'role': appointment_user.role,
                'user_color': appointment_user.user_color  # Добавлено поле цвета пользователя
            }
        
        calendar_data[date_str][appointment.time_slot] = appointment_data
    
    return jsonify({
        'calendar': list(calendar_data.values())
    }), 200

# Get notifications for current user
@appointment_bp.route('/notifications', methods=['GET'])
@login_required
def get_notifications():
    user_id = session['user_id']
    
    notifications = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
    
    return jsonify({
        'notifications': [notification.to_dict() for notification in notifications]
    }), 200

# Mark notification as read
@appointment_bp.route('/notifications/<int:notification_id>/read', methods=['POST'])
@login_required
def mark_notification_read(notification_id):
    user_id = session['user_id']
    
    notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
    if not notification:
        return jsonify({'error': 'Notification not found'}), 404
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({
        'message': 'Notification marked as read',
        'notification': notification.to_dict()
    }), 200

