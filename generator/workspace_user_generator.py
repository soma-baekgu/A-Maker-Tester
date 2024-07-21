import random
from datetime import datetime

from utils import random_datetime


def generate_workspace_users(num_workspace_users, workspaces, users):
    workspace_users = []
    workspace_roles = ['LEADER'] + ['MEMBER'] * 9
    statuses = ['ACTIVE', 'PENDING']
    for _ in range(num_workspace_users):
        created_at = random_datetime(datetime(2023, 1, 1), datetime(2023, 12, 31)).strftime('%Y-%m-%d %H:%M:%S')
        updated_at = created_at
        status = random.choice(statuses)
        user_id = random.choice(users)[0]
        workspace_id = random.choice(workspaces)[0]
        workspace_role = random.choice(workspace_roles)
        workspace_users.append((created_at, updated_at, status, user_id, workspace_id, workspace_role))
    return workspace_users
