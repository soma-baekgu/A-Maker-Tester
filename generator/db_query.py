import os

from mysql import connector
from dotenv import load_dotenv

load_dotenv()

db_host = os.getenv('DB_HOST')
db_user = os.getenv('DB_USER')
db_password = os.getenv('DB_PASSWORD')
db_name = os.getenv('DB_NAME')

connection = connector.connect(
    host=db_host,
    user=db_user,
    password=db_password,
    database=db_name
)


def insert_data_to_mysql(data, insert_query):
    try:
        if connection.is_connected():
            cursor = connection.cursor()
            cursor.executemany(insert_query, data)
            connection.commit()
            print(f"{cursor.rowcount} records inserted successfully.")

    except connector.Error as error:
        print(f"Failed to insert record into MySQL table {error}")


def update_data_to_mysql(data, update_query):
    try:
        if connection.is_connected():
            cursor = connection.cursor()
            cursor.executemany(update_query, data)
            connection.commit()
            print(f"{cursor.rowcount} records updated successfully.")

    except connector.Error as error:
        print(f"Failed to update record in MySQL table {error}")
