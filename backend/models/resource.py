from pydantic import BaseModel
from typing import Optional

class EmergencyResource(BaseModel):
    id: str
    name: str
    type: str  # Search & Rescue, Firefighting, Medical, Logistics, Hazmat
    status: str  # Available, Dispatched, On-Scene, Maintenance
    location: str
    latitude: float
    longitude: float
    assigned_incident_id: Optional[str] = None
