from fastapi import APIRouter, HTTPException, Query

from app.models import FieldModel, FieldsResponse

router = APIRouter()

# ---------------------------------------------------------------------------
# Mock data — replace with Supabase queries once database is seeded
# ---------------------------------------------------------------------------
MOCK_FIELDS: list[FieldModel] = [
    FieldModel(
        id="b1a2c3d4-0001-0001-0001-000000000001",
        name="Boisko Sportowe ul. Dąbrowskiego",
        sport=["piłka nożna", "futsal"],
        address="ul. Józefa Dąbrowskiego 79A, 60-101 Poznań",
        lat=52.4234,
        lng=16.9012,
        available=True,
        surface="artificial",
        is_indoor=False,
        phone="+48 61 868 55 00",
        website=None,
    ),
    FieldModel(
        id="b1a2c3d4-0002-0002-0002-000000000002",
        name="Hala Arena Poznań — Sale Boczne",
        sport=["koszykówka", "siatkówka", "futsal"],
        address="ul. Wyspiańskiego 33, 60-750 Poznań",
        lat=52.3932,
        lng=16.9271,
        available=True,
        surface="hardcourt",
        is_indoor=True,
        phone="+48 61 833 20 00",
        website="https://www.arena.poznan.pl",
    ),
    FieldModel(
        id="b1a2c3d4-0003-0003-0003-000000000003",
        name="Korty Tenisowe Olimpia",
        sport=["tenis"],
        address="ul. Warmińska 1, 61-613 Poznań",
        lat=52.4512,
        lng=16.9445,
        available=False,
        surface="clay",
        is_indoor=False,
        phone="+48 61 822 49 80",
        website=None,
    ),
]

MOCK_FIELDS_INDEX: dict[str, FieldModel] = {f.id: f for f in MOCK_FIELDS}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=FieldsResponse, summary="List fields")
async def get_fields(
    sport: str | None = Query(default=None, description="Filter by sport type"),
    available: bool | None = Query(default=None, description="Filter by availability"),
    lat: float | None = Query(default=None, description="Latitude of search centre"),
    lng: float | None = Query(default=None, description="Longitude of search centre"),
    radius_km: float = Query(default=10.0, ge=0.1, le=50.0, description="Search radius in km"),
    limit: int = Query(default=50, ge=1, le=200, description="Max results to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
) -> FieldsResponse:
    """
    Return a list of sports fields in Poznań.

    Supports filtering by sport type, availability and geolocation radius.

    TODO: Replace mock data with a real Supabase query:
    ```python
    supabase = get_supabase()
    query = supabase.table("fields").select("*")
    if sport:
        query = query.contains("sport", [sport])
    if available is not None:
        query = query.eq("available", available)
    result = query.range(offset, offset + limit - 1).execute()
    return FieldsResponse(fields=result.data, total=len(result.data))
    ```
    """
    filtered = list(MOCK_FIELDS)

    if sport:
        sport_lower = sport.lower()
        filtered = [f for f in filtered if any(s.lower() == sport_lower for s in f.sport)]

    if available is not None:
        filtered = [f for f in filtered if f.available == available]

    # Simple bounding-box filter when lat/lng provided (no PostGIS needed for mock)
    if lat is not None and lng is not None:
        from math import asin, cos, radians, sin, sqrt

        def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
            R = 6371.0
            dlat = radians(lat2 - lat1)
            dlng = radians(lng2 - lng1)
            a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
            return R * 2 * asin(sqrt(a))

        filtered = [f for f in filtered if haversine(lat, lng, f.lat, f.lng) <= radius_km]

    total = len(filtered)
    paginated = filtered[offset : offset + limit]

    return FieldsResponse(fields=paginated, total=total)


@router.get("/{field_id}", response_model=FieldModel, summary="Get field by ID")
async def get_field(field_id: str) -> FieldModel:
    """
    Return a single sports field by its UUID.

    TODO: Replace with Supabase fetch:
    ```python
    supabase = get_supabase()
    result = supabase.table("fields").select("*").eq("id", field_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Field not found")
    return result.data
    ```
    """
    field = MOCK_FIELDS_INDEX.get(field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found")
    return field
