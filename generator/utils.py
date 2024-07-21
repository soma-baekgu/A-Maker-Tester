import string
from datetime import timedelta
import random

import lorem


def random_string(length=10):
    return lorem.text().split()[:length][0]


def random_email():
    return f"{''.join(random.choices(string.ascii_lowercase, k=10))}@example.com"


def random_datetime(start, end):
    return start + timedelta(
        seconds=random.randint(0, int((end - start).total_seconds())),
    )
