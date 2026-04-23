import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "crypto_pro.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tables for license keys
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        email TEXT,
        fingerprint TEXT, -- Bound to browser/device
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
    )
    ''')
    
    # Table for macro data snapshots
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS macro_data (
        symbol TEXT PRIMARY KEY,
        price REAL,
        change_pct REAL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
