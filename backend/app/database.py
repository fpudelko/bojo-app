from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """
    Return a cached Supabase client (service role key for backend operations).
    Uses the service role key which bypasses Row Level Security — NEVER expose this
    to the frontend.
    """
    url = settings.supabase_url
    key = settings.supabase_service_role_key or settings.supabase_anon_key

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) "
            "must be set in environment variables."
        )

    return create_client(url, key)


def get_supabase_anon() -> Client:
    """
    Return a Supabase client using the anon key (respects RLS).
    Use this for public reads where RLS should apply.
    """
    url = settings.supabase_url
    key = settings.supabase_anon_key

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables."
        )

    return create_client(url, key)
