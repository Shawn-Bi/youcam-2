"""Environment settings. A local backend/.env fills in values the shell did not set."""
import os
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent / '.env'


def load_env(path=ENV_FILE):
    """Copy KEY=value lines from `path` into os.environ without overriding anything already set."""
    if os.getenv('SKIP_DOTENV'):
        return
    try:
        text = path.read_text(encoding='utf-8-sig')
    except OSError:
        return
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        name, value = line.split('=', 1)
        name, value = name.strip(), value.strip().strip('"\'')
        if name and value:
            os.environ.setdefault(name, value)


def int_env(name, default):
    try:
        return int(os.getenv(name, ''))
    except ValueError:
        return default


load_env()

# Where browsers and YouCam reach this server. Render sets RENDER_EXTERNAL_URL itself.
PUBLIC_BASE_URL = (os.getenv('PUBLIC_BASE_URL') or os.getenv('RENDER_EXTERNAL_URL') or 'http://localhost:8000').rstrip('/')
FRONTEND_ORIGINS = [x.strip().rstrip('/') for x in os.getenv('FRONTEND_ORIGINS', 'http://localhost:3000').split(',') if x.strip()]
FRONTEND_ORIGIN_REGEX = os.getenv('FRONTEND_ORIGIN_REGEX') or None
