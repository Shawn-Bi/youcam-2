"""Tests must never read a real .env or use a real key: a stray call would spend YouCam units."""
import os

os.environ['SKIP_DOTENV'] = '1'
for name in ('YOUCAM_API_KEY', 'RENDER_API_KEY', 'CATALOG_FILE', 'FRONTEND_PUBLIC_URL', 'FRONTEND_ORIGINS', 'FRONTEND_ORIGIN_REGEX', 'BAG_GENDER'):
    os.environ.pop(name, None)
