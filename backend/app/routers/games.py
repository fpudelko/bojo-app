import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.models import GameCreate, GameModel, GamesResponse

router = APIRouter()

# ---------------------------------------------------------------------------
# Mock data — replace with Supabase queries once database is seeded
# ---------------------------------------------------------------------------
MOCK_GAMES: list[GameModel] = [
    GameModel(
        id="a0000000-0001-0001-0001-000000000001",
        field_id="b1a2c3d4-0001-0001-0001-000000000001",
        field_name="Boisko Sportowe ul. Dąbrowskiego",
        sport="piłka nożna",
        date="2024-06-15",
        time="18:00",
        players_needed=10,
        players_joined=7,
        author="Marek K.",
        description="Gramy 5v5 na małym boisku. Poziom amatorski, dobra zabawa! Zapraszamy wszystkich chętnych.",
        created_at=datetime.now(tz=timezone.utc).isoformat(),
    ),
    GameModel(
        id="a0000000-0002-0002-0002-000000000002",
        field_id="b1a2c3d4-0002-0002-0002-000000000002",
        field_name="Hala Arena Poznań — Sale Boczne",
        sport="koszykówka",
        date="2024-06-16",
        time="19:30",
        players_needed=8,
        players_joined=5,
        author="Anna W.",
        description="Cotygodniowa gra 4v4 w poniedziałki. Mile widziani gracze każdego poziomu.",
        created_at=datetime.now(tz=timezone.utc).isoformat(),
    ),
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=GamesResponse, summary="List game announcements")
async def get_games(
    field_id: str | None = Query(default=None, description="Filter by field UUID"),
    sport: str | None = Query(default=None, description="Filter by sport type"),
    limit: int = Query(default=20, ge=1, le=100, description="Max results"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
) -> GamesResponse:
    """
    Return a list of game announcements ("szukam graczy").

    TODO: Replace with Supabase query:
    ```python
    supabase = get_supabase()
    query = supabase.table("games").select("*, fields(name)").eq("is_active", True)
    if field_id:
        query = query.eq("field_id", field_id)
    if sport:
        query = query.eq("sport", sport)
    result = query.order("game_date", desc=False).range(offset, offset + limit - 1).execute()
    ```
    """
    filtered = list(MOCK_GAMES)

    if field_id:
        filtered = [g for g in filtered if g.field_id == field_id]

    if sport:
        sport_lower = sport.lower()
        filtered = [g for g in filtered if g.sport.lower() == sport_lower]

    total = len(filtered)
    paginated = filtered[offset : offset + limit]

    return GamesResponse(games=paginated, total=total)


@router.post("", response_model=GameModel, status_code=201, summary="Create game announcement")
async def create_game(game: GameCreate) -> GameModel:
    """
    Create a new game announcement.

    TODO: Implement full flow:
    1. Validate that field_id references an existing field in Supabase
    2. Insert the game into the `games` table
    3. Return the created record

    ```python
    supabase = get_supabase()
    # Check field exists
    field_check = supabase.table("fields").select("id").eq("id", game.field_id).execute()
    if not field_check.data:
        raise HTTPException(status_code=404, detail=f"Field {game.field_id!r} not found")
    # Insert
    record = {
        "field_id": game.field_id,
        "sport": game.sport,
        "game_date": game.date,
        "game_time": game.time,
        "players_needed": game.players_needed,
        "author_name": game.author,
        "description": game.description,
    }
    result = supabase.table("games").insert(record).execute()
    return result.data[0]
    ```
    """
    raise HTTPException(
        status_code=501,
        detail="Not implemented yet — Supabase integration pending.",
    )
