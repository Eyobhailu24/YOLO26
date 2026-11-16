"""Project-local SQLite history; no credentials or raw request bodies are stored."""
import json
import sqlite3
from pathlib import Path


class Store:
    def __init__(self, directory: Path):
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / "history.sqlite3"
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS predictions (id TEXT PRIMARY KEY, data TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, public_id TEXT NOT NULL, created INTEGER NOT NULL)")

    def connect(self):
        return sqlite3.connect(self.path, timeout=15)

    def save(self, result):
        with self.connect() as db:
            db.execute("INSERT INTO predictions VALUES (?, ?)", (result["id"], json.dumps(result)))

    def get(self, prediction_id):
        with self.connect() as db:
            row = db.execute("SELECT data FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def recent(self, limit=50):
        with self.connect() as db:
            rows = db.execute("SELECT data FROM predictions ORDER BY rowid DESC LIMIT ?", (limit,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def ticket(self, upload_id, public_id, timestamp):
        with self.connect() as db:
            db.execute("DELETE FROM uploads WHERE created < ?", (timestamp - 3600,))
            db.execute("INSERT INTO uploads VALUES (?, ?, ?)", (upload_id, public_id, timestamp))

    def get_ticket(self, upload_id):
        with self.connect() as db:
            return db.execute("SELECT public_id, created FROM uploads WHERE id = ?", (upload_id,)).fetchone()
