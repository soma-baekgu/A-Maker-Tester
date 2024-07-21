import mysql.connector
from chat_generator import generate_chats
from chat_room_users_generator import generate_chat_room_users
from db_query import insert_data_to_mysql, update_data_to_mysql
from user_generator import generate_users
from workspace_generator import generate_workspaces
from chatroom_generator import generate_chat_rooms, update_last_chat_ids
from workspace_user_generator import generate_workspace_users

connection = mysql.connector.connect(
    host='localhost',
    user='root',
    password='1234',
    database='amakertest'
)

if __name__ == "__main__":
    num_users = 1_000
    num_workspaces = 100
    num_chat_rooms = 500
    num_chats = 10_000
    num_chat_room_users = 500
    num_workspace_users = 500

    users = generate_users(num_users)
    insert_data_to_mysql(users,
                         "INSERT INTO users (id, created_at, updated_at, email, name, picture, user_role) VALUES (%s, %s, %s, %s, %s, %s, %s)")

    workspaces = generate_workspaces(num_workspaces)
    insert_data_to_mysql(workspaces,
                         "INSERT INTO workspace (id, created_at, updated_at, name, thumbnail) VALUES (%s, %s, %s, %s, %s)")

    workspace_users = generate_workspace_users(num_workspace_users, workspaces, users)
    insert_data_to_mysql(workspace_users,
                         "INSERT INTO workspace_user (created_at, updated_at, status, user_id, workspace_id, workspace_role) VALUES (%s, %s, %s, %s, %s, %s)")

    chat_rooms = generate_chat_rooms(num_chat_rooms, workspaces)
    insert_data_to_mysql(chat_rooms,
                         "INSERT INTO chat_room (id, created_at, updated_at, chat_room_type, last_chat_id, name, workspace_id) VALUES (%s, %s, %s, %s, %s, %s, %s)")
    chats = generate_chats(num_chats, chat_rooms, users)
    insert_data_to_mysql(chats,
                         "INSERT INTO chat (id, created_at, updated_at, chat_room_id, chat_type, content, user_id) VALUES (%s, %s, %s, %s, %s, %s, %s)")
    updated_chat_rooms = update_last_chat_ids(chat_rooms, chats)
    update_data_to_mysql(updated_chat_rooms, "UPDATE chat_room SET last_chat_id = %s WHERE id = %s")

    chat_room_users = generate_chat_room_users(num_chat_room_users, chat_rooms, users, chats)
    insert_data_to_mysql(chat_room_users,
                         "INSERT INTO chat_room_user (created_at, updated_at, chat_room_id, last_read_chat_id, user_id) VALUES (%s, %s, %s, %s, %s)")
