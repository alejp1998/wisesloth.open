"""Create a private .env with random local secrets. Never overwrite existing config."""

import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parent.parent
target = root / ".env"
values = {
    "SESSION_SECRET": secrets.token_hex(32),
    "KEY_ENCRYPTION_SECRET": secrets.token_hex(32),
    "DB_PASSWORD": secrets.token_hex(24),
    "MYSQL_ROOT_PASSWORD": secrets.token_hex(24),
    "ADMIN_PASSWORD": secrets.token_urlsafe(24),
}
text = (root / ".env.example").read_text()
for name, value in values.items():
    text = text.replace(f"{name}=\n", f"{name}={value}\n")
try:
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    raise SystemExit(".env already exists; no changes made.") from None
with os.fdopen(descriptor, "w") as file:
    file.write(text)
print("Created .env (mode 600). Set your API key and APP_URL, then run docker compose up --build -d.")
print("The initial admin password is in .env; it is not printed here.")
