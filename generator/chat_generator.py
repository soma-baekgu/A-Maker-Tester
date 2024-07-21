import random
from datetime import datetime

from utils import random_datetime, random_string


def generate_chats(num_chats, chat_rooms, users):
    chats = []
    chat_types = ['GENERAL'] * 8 + ['REACTION', 'REPLY', 'TASK']
    for i in range(num_chats):
        created_at = random_datetime(datetime(2023, 1, 1), datetime(2023, 12, 31)).strftime('%Y-%m-%d %H:%M:%S')
        updated_at = created_at
        chat_room_id = random.choice(chat_rooms)[0]
        chat_type = random.choice(chat_types)
        content = random_string(50)
        user_id = random.choice(users)[0]
        chats.append((i + 1, created_at, updated_at, chat_room_id, chat_type, content, user_id))
    return chats
