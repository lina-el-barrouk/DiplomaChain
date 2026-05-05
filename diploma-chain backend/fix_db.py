import traceback
from sqlalchemy import create_engine, text
from app.core.config import settings
engine = create_engine(settings.DATABASE_URL)
conn = engine.connect()

try:
    conn.execute(text('ALTER TABLE students DROP COLUMN massar_code_enc'))
    conn.commit()
    print("Dropped massar_code_enc")
except Exception as e:
    print("Error dropping massar_code_enc:", e)

try:
    conn.execute(text('ALTER TABLE students DROP COLUMN massar_code_hash'))
    conn.commit()
    print("Dropped massar_code_hash")
except Exception as e:
    print("Error dropping massar_code_hash:", e)

conn.close()
