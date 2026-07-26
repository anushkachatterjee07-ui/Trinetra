from pydantic import BaseModel
from typing import Optional

class DisasterIncident(BaseModel):
    id: str
    type: str  # Wildfire, Flood, Earthquake, Hurricane, etc.
    severity: str  # Low, Medium, High, Critical
    location: str
    latitude: float
    longitude: float
    status: str  # Active, Contained, Resolved
    timestamp: str
    description: str
    impact_score: float  # 0.0 to 10.0 calculated by AI
