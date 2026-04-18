import os
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mock.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "mock_key")

def get_supabase_client() -> Client:
    # If using mock, this will fail if actually called, but will pass initialization.
    # We wrap in try except so it doesn't crash if mock URL is bad.
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except:
        return None

db = get_supabase_client()

def verify_user_subscription(user_id: str) -> bool:
    """Verifica si el usuario tiene un plan Pro en la bd"""
    if db:
        try:
            res = db.table("profiles").select("is_pro").eq("id", user_id).execute()
            return len(res.data) > 0 and res.data[0].get("is_pro", False)
        except:
            return False
    return False
