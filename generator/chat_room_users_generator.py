import random
from datetime import datetime

from utils import random_datetime


def generate_chat_room_users(num_chat_room_users, chat_rooms, users, chats):
    chat_room_users = []
    for _ in range(num_chat_room_users):
        # TODO 시간순서 보장해주기
        created_at = random_datetime(datetime(2023, 1, 1), datetime(2023, 12, 31)).strftime('%Y-%m-%d %H:%M:%S')
        updated_at = created_at
        chat_room_id = random.choice(chat_rooms)[0]
        user_id = random.choice(users)[0]

        chat_ids_in_room = [chat[0] for chat in chats if chat[3] == chat_room_id]
        last_read_chat_id = random.choice(chat_ids_in_room) if chat_ids_in_room else None

        chat_room_users.append((created_at, updated_at, chat_room_id, last_read_chat_id, user_id))
    return chat_room_users
