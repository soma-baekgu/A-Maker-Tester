import json
import os
import random
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv

import jwt

from generator.db_query import insert_data_to_mysql
from utils import random_datetime, random_email, random_string

load_dotenv()

SQL = "INSERT INTO users (id, created_at, updated_at, email, name, picture, user_role) VALUES (%s, %s, %s, %s, %s, %s, %s)"
SECRET_KEY = os.getenv('JWT_SECRET')


def generate_jwt(user_id, user_role="ROLE_USER"):
    time = datetime.utcnow()
    payload = {
        "roles": [
            user_role
        ],
        "iss": "a-maker",
        'id': user_id,
        "iat": time,
        'exp': time + timedelta(days=7)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return token


def generate_users(num_users):
    users = []
    jwt_dict = {}
    user_roles = ['ADMIN', 'MANAGER', 'USER']
    for _ in range(num_users):
        user_id = str(uuid.uuid4())
        created_at = random_datetime(datetime(2023, 1, 1), datetime(2023, 12, 31)).strftime('%Y-%m-%d %H:%M:%S')
        updated_at = created_at
        email = random_email()
        name = random_string(10)
        picture = f"https://example.com/{random_string(10)}.jpg"
        user_role = random.choice(user_roles)
        jwt_token = generate_jwt(user_id, user_role)
        users.append((user_id, created_at, updated_at, email, name, picture, user_role))
        jwt_dict[email] = jwt_token
    return users, jwt_dict


def save_jwt_to_json(jwt_dict, filename):
    with open(filename, 'w') as json_file:
        json.dump(jwt_dict, json_file, indent=4)


if __name__ == '__main__':
    num_users = 1000
    users, jwt_dict = generate_users(num_users)
    insert_data_to_mysql(users, SQL)
    save_jwt_to_json(jwt_dict, '../test_data/user_jwts.json')
