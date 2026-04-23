import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "crypto_pro.db")


def validate_license(key: str, fingerprint: str):
    """
    Validates a license key and binds it to a fingerprint if it's the first use.
    Returns (is_valid, message)
    """
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT fingerprint, is_active FROM licenses WHERE key = ?", (key,))
        row = cursor.fetchone()

        if not row:
            return False, "Licencia no válida"

        saved_fp, is_active = row

        if not is_active:
            return False, "Licencia desactivada"

        if saved_fp is None:
            cursor.execute("UPDATE licenses SET fingerprint = ? WHERE key = ?", (fingerprint, key))
            conn.commit()
            return True, "Licencia activada con éxito en este dispositivo"

        if saved_fp == fingerprint:
            return True, "Acceso concedido"
        else:
            return False, "Esta licencia ya está vinculada a otro dispositivo"


def create_license(key: str, email: str = None):
    """Admin tool to create keys"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO licenses (key, email) VALUES (?, ?)", (key, email))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
