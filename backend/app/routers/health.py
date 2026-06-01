from fastapi import APIRouter

router = APIRouter()


@router.get("/health", summary="Health check")
async def health_check() -> dict:
    """
    Returns service status. Used by Docker healthcheck and load balancers.
    """
    return {
        "status": "ok",
        "service": "boiska-poznan-api",
        "version": "0.1.0",
    }
