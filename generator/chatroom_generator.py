from datetime import datetime
import random

from utils import random_datetime, random_string


def generate_chat_rooms(num_chat_rooms, workspaces):
    chat_rooms = []
    chat_room_types = ['CUSTOM', 'DEFAULT']
    for i in range(num_chat_rooms):
        created_at = random_datetime(datetime(2023, 1, 1), datetime(2023, 12, 31)).strftime('%Y-%m-%d %H:%M:%S')
        updated_at = created_at
        name = random_string(15)
        chat_room_type = random.choice(chat_room_types)
        workspace_id = random.choice(workspaces)[0]
        chat_rooms.append((i + 1, created_at, updated_at, chat_room_type, None, name, workspace_id))
    return chat_rooms


def update_last_chat_ids(chat_rooms, chats):
    chat_room_last_chat = {}
    for chat in chats:
        chat_room_id = chat[3]
        chat_id = chat[0]
        if chat_room_id not in chat_room_last_chat:
            chat_room_last_chat[chat_room_id] = chat_id
        elif chat_id > chat_room_last_chat[chat_room_id]:
            chat_room_last_chat[chat_room_id] = chat_id

    updated_chat_rooms = []
    for chat_room in chat_rooms:
        chat_room_id = chat_room[0]
        last_chat_id = chat_room_last_chat.get(chat_room_id, None)
        updated_chat_rooms.append((last_chat_id, chat_room_id))
    return updated_chat_rooms
