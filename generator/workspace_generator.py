from datetime import datetime

from utils import random_datetime, random_string


def generate_workspaces(num_workspaces):
    workspaces = []
    for i in range(1, num_workspaces + 1):
        created_at = random_datetime(datetime(2023, 1, 1), datetime(2023, 12, 31)).strftime('%Y-%m-%d %H:%M:%S')
        updated_at = created_at
        name = random_string(15)
        thumbnail = f"https://example.com/{random_string(10)}.jpg"
        workspaces.append((i, created_at, updated_at, name, thumbnail))
    return workspaces
