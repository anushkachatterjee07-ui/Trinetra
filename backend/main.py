import asyncio
import json
import random
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models.disaster import DisasterIncident
from models.resource import EmergencyResource
from engines.disaster_analyzer import DisasterAnalyzer
from engines.resource_allocator import ResourceAllocator
from engines.weather_provider import fetch_west_bengal_weather

# In-memory storage for demo purposes
INCIDENTS: Dict[str, DisasterIncident] = {}
RESOURCES: Dict[str, EmergencyResource] = {}
LATEST_TELEMETRY: Dict[str, Any] = {}

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

# Initialize Mock Resources
INITIAL_RESOURCES = [
    EmergencyResource(id="res-1", name="Kolkata Urban Search & Rescue", type="Search & Rescue", status="Available", location="Kolkata", latitude=22.5726, longitude=88.3639),
    EmergencyResource(id="res-2", name="Howrah River Rescue Unit", type="Search & Rescue", status="Available", location="Howrah", latitude=22.5958, longitude=88.2636),
    EmergencyResource(id="res-3", name="Digha Coastal Fire Team", type="Firefighting", status="Available", location="Digha", latitude=21.6229, longitude=87.5515),
    EmergencyResource(id="res-4", name="Siliguri Hills Support Unit", type="Firefighting", status="Available", location="Siliguri", latitude=26.7271, longitude=88.3953),
    EmergencyResource(id="res-5", name="Sundarbans Medical Relief", type="Medical", status="Available", location="Sundarbans", latitude=22.0410, longitude=88.7968),
    EmergencyResource(id="res-6", name="Kolkata Field Hospital Drone", type="Medical", status="Available", location="Kolkata", latitude=22.5610, longitude=88.3740),
    EmergencyResource(id="res-7", name="Hooghly Hazmat Response Unit", type="Hazmat", status="Available", location="Howrah", latitude=22.5880, longitude=88.2690),
    EmergencyResource(id="res-8", name="North Bengal Logistics Carrier", type="Logistics", status="Available", location="Siliguri", latitude=26.7150, longitude=88.4080),
]

for r in INITIAL_RESOURCES:
    RESOURCES[r.id] = r

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection is dead, will be pruned upon close
                pass

ws_manager = ConnectionManager()

def calculate_sensor_integrity(telemetry: Dict[str, Any]) -> float:
    required_metrics = [
        "temperature",
        "wind_speed",
        "humidity",
        "rainfall",
        "seismic_activity",
        "latitude",
        "longitude",
    ]
    valid_metrics = 0

    for metric in required_metrics:
        value = telemetry.get(metric)
        if isinstance(value, (int, float)) and value == value:
            valid_metrics += 1

    return round((valid_metrics / len(required_metrics)) * 100, 1)

# Background telemetry simulation
async def telemetry_simulation():
    global LATEST_TELEMETRY
    incident_counter = 1
    log_counter = 1
    
    wb_locations = ["Kolkata", "Howrah", "Digha", "Siliguri", "Sundarbans"]

    await asyncio.sleep(2)  # Wait for startup
    
    while True:
        try:
            location_name = random.choice(wb_locations)
            weather_snapshot = fetch_west_bengal_weather(location_name)

            temp = weather_snapshot["temperature"]
            wind = weather_snapshot["wind_speed"]
            humidity = weather_snapshot["humidity"]
            rainfall = weather_snapshot["rainfall"]
            seismic = weather_snapshot["seismic_activity"]

            # 8% chance of simulating a critical threat readout tuned to West Bengal monsoon/cyclone risk
            is_threat = random.random() < 0.08
            if is_threat:
                threat_type = random.choice(["heat", "rain", "tremor"])
                if threat_type == "heat":
                    temp = random.uniform(39.0, 45.0)
                    wind = random.uniform(24.0, 35.0)
                    humidity = random.uniform(18.0, 28.0)
                    rainfall = 0.0
                    seismic = 0.1
                elif threat_type == "rain":
                    temp = random.uniform(26.0, 32.0)
                    wind = random.uniform(45.0, 78.0)
                    humidity = 92.0
                    rainfall = random.uniform(70.0, 110.0)
                    seismic = 0.1
                else:
                    temp = random.uniform(24.0, 30.0)
                    wind = random.uniform(8.0, 18.0)
                    humidity = 55.0
                    rainfall = 0.0
                    seismic = random.uniform(4.8, 7.2)

            telemetry = {
                "sector": weather_snapshot["sector"],
                "temperature": round(temp, 1),
                "wind_speed": round(wind, 1),
                "humidity": round(humidity, 1),
                "rainfall": round(rainfall, 1),
                "seismic_activity": round(seismic, 2),
                "timestamp": utc_now_iso(),
                "provider": weather_snapshot.get("provider", "fallback-simulation"),
                "bbox": weather_snapshot.get("bbox"),
                "latitude": weather_snapshot.get("latitude"),
                "longitude": weather_snapshot.get("longitude"),
            }
            telemetry["sensor_integrity"] = calculate_sensor_integrity(telemetry)
            LATEST_TELEMETRY = telemetry
            
            # Analyze telemetry
            analysis = DisasterAnalyzer.analyze_sensor_telemetry(telemetry)
            
            # Broadcast telemetry update
            await ws_manager.broadcast({
                "type": "TELEMETRY",
                "data": {
                    "telemetry": telemetry,
                    "analysis": analysis
                }
            })
            
            # 2. If threat detected and not already tracked, spawn a new incident
            if analysis["detected"] and analysis["severity"] in ["High", "Critical"] and random.random() < 0.4:
                incident_id = f"inc-{incident_counter}"
                incident_counter += 1

                already_active = any(inc.location == weather_snapshot["sector"] and inc.type == analysis["type"] and inc.status == "Active" for inc in INCIDENTS.values())
                
                if not already_active:
                    incident = DisasterIncident(
                        id=incident_id,
                        type=analysis["type"],
                        severity=analysis["severity"],
                        location=weather_snapshot["sector"],
                        latitude=weather_snapshot.get("latitude", 22.5726) + random.uniform(-0.01, 0.01),
                        longitude=weather_snapshot.get("longitude", 88.3639) + random.uniform(-0.01, 0.01),
                        status="Active",
                        timestamp=utc_now_iso(),
                        description=analysis["description"],
                        impact_score=analysis["impact_score"]
                    )
                    
                    INCIDENTS[incident_id] = incident
                    
                    await ws_manager.broadcast({
                        "type": "INCIDENT_NEW",
                        "data": incident.model_dump()
                    })
                    
                    await ws_manager.broadcast({
                        "type": "SYSTEM_LOG",
                        "data": {
                            "id": f"log-{log_counter}",
                            "timestamp": utc_now_iso(),
                            "level": "ERROR" if incident.severity in ["High", "Critical"] else "WARNING",
                            "message": f"AI Engine generated alert {incident.id}: {incident.type} ({incident.severity}) in {incident.location}!"
                        }
                    })
                    log_counter += 1

            # 3. Simulate resource status updates
            # If resources are dispatched, periodically progress them to On-Scene, then complete them
            dispatched_res = [r for r in RESOURCES.values() if r.status == "Dispatched"]
            if dispatched_res and random.random() < 0.15:
                res_to_update = random.choice(dispatched_res)
                res_to_update.status = "On-Scene"
                await ws_manager.broadcast({
                    "type": "RESOURCE_UPDATE",
                    "data": res_to_update.model_dump()
                })
                await ws_manager.broadcast({
                    "type": "SYSTEM_LOG",
                    "data": {
                        "id": f"log-{log_counter}",
                        "timestamp": utc_now_iso(),
                        "level": "INFO",
                        "message": f"Resource {res_to_update.name} ({res_to_update.type}) arrived on-scene at incident {res_to_update.assigned_incident_id}."
                    }
                })
                log_counter += 1

            # If resources are On-Scene and their incident is Resolved/Contained (or just randomly with 10% chance), free them up
            on_scene_res = [r for r in RESOURCES.values() if r.status == "On-Scene"]
            if on_scene_res and random.random() < 0.08:
                res_to_free = random.choice(on_scene_res)
                associated_inc_id = res_to_free.assigned_incident_id
                
                # Check if associated incident is resolved
                if associated_inc_id in INCIDENTS:
                    incident = INCIDENTS[associated_inc_id]
                    # 50% chance we resolve the incident, otherwise just free the resource
                    if random.random() < 0.5:
                        incident.status = "Resolved"
                        await ws_manager.broadcast({
                            "type": "INCIDENT_UPDATE",
                            "data": incident.model_dump()
                        })
                        await ws_manager.broadcast({
                            "type": "SYSTEM_LOG",
                            "data": {
                                "id": f"log-{log_counter}",
                                "timestamp": utc_now_iso(),
                                "level": "SUCCESS",
                                "message": f"Incident {incident.id} ({incident.type}) in {incident.location} has been RESOLVED."
                            }
                        })
                        log_counter += 1

                res_to_free.status = "Available"
                res_to_free.assigned_incident_id = None
                await ws_manager.broadcast({
                    "type": "RESOURCE_UPDATE",
                    "data": res_to_free.model_dump()
                })
                await ws_manager.broadcast({
                    "type": "SYSTEM_LOG",
                    "data": {
                        "id": f"log-{log_counter}",
                        "timestamp": utc_now_iso(),
                        "level": "INFO",
                        "message": f"Resource {res_to_free.name} has completed operations and is now AVAILABLE."
                    }
                })
                log_counter += 1

            # Sleep interval
            await asyncio.sleep(3)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in simulation loop: {e}")
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch the simulated telemetry loop
    bg_task = asyncio.create_task(telemetry_simulation())
    yield
    # Shutdown: Clean up background tasks
    bg_task.cancel()
    try:
        await bg_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="AI Disaster Command Center API",
    description="Backend API streaming telemetry and managing responders during crisis scenarios",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production to frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Schemas
class DispatchRequest(BaseModel):
    incident_id: str

class StatusUpdateRequest(BaseModel):
    status: str

def calculate_evacuation_heatmap(telemetry: Optional[Dict[str, Any]] = None, active_incidents: int = 0, available_assets: int = 0):
    weather = telemetry or {}
    rainfall = float(weather.get("rainfall", 0) or 0)
    wind_speed = float(weather.get("wind_speed", 0) or 0)
    congestion = max(0, active_incidents - available_assets) * 6

    fast_zone = {
        "id": "fast",
        "label": "Fast clearance",
        "clearance_time": round(max(7, 12 - rainfall / 18 + wind_speed / 40), 1),
        "x": 10,
        "y": 12,
        "width": 28,
        "height": 18,
    }

    medium_zone = {
        "id": "medium",
        "label": "Moderate clearance",
        "clearance_time": round(max(16, 20 + congestion / 2 + rainfall / 16 + wind_speed / 30), 1),
        "x": 40,
        "y": 24,
        "width": 24,
        "height": 18,
    }

    slow_zone = {
        "id": "slow",
        "label": "Slow clearance",
        "clearance_time": round(max(60, 62 + congestion + rainfall / 8 + wind_speed / 12), 1),
        "x": 66,
        "y": 42,
        "width": 22,
        "height": 16,
    }

    return [fast_zone, medium_zone, slow_zone]


# HTTP REST Routes
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "trinetra-command-center"}

@app.get("/api/incidents", response_model=List[DisasterIncident])
def get_incidents():
    return list(INCIDENTS.values())

@app.post("/api/incidents", response_model=DisasterIncident, status_code=status.HTTP_201_CREATED)
async def create_incident(incident: DisasterIncident):
    if incident.id in INCIDENTS:
        raise HTTPException(status_code=400, detail="Incident ID already exists")
    INCIDENTS[incident.id] = incident
    
    # Broadcast to sockets
    await ws_manager.broadcast({
        "type": "INCIDENT_NEW",
        "data": incident.model_dump()
    })
    return incident

@app.get("/api/resources", response_model=List[EmergencyResource])
def get_resources():
    return list(RESOURCES.values())

@app.get("/api/resources/{resource_id}/recommendations")
def get_resource_recommendations(resource_id: str):
    # This is slightly backward; we typically recommend resources for a specific incident.
    # Let's write an endpoint that recommends resources for a specific incident ID instead.
    pass

@app.get("/api/incidents/{incident_id}/recommendations")
def get_incident_recommendations(incident_id: str):
    if incident_id not in INCIDENTS:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident = INCIDENTS[incident_id]
    resources_list = [r.model_dump() for r in RESOURCES.values()]
    recommendations = ResourceAllocator.recommend_allocations(incident.model_dump(), resources_list)
    return recommendations

@app.get("/api/ops/routing-analysis")
def get_routing_analysis(prompt: Optional[str] = None):
    telemetry = LATEST_TELEMETRY or {
        "sector": "Kolkata Metropolitan Corridor",
        "rainfall": 42,
        "temperature": 31.4,
        "wind_speed": 20.2,
        "humidity": 76,
        "seismic_activity": 0.12,
    }

    active_incidents = [incident for incident in INCIDENTS.values() if incident.status != "Resolved"]
    available_assets = [resource for resource in RESOURCES.values() if resource.status == "Available"]

    is_flood = bool(prompt and re.search(r"flood|storm|rain", prompt, flags=re.IGNORECASE))
    if is_flood:
        corridors = [
            {"road": "NH-12 Kolkata–Howrah", "capacity": "High", "status": "Open"},
            {"road": "NH-16 Kolkata–Digha", "capacity": "Medium", "status": "Open"},
            {"road": "NH-10 Siliguri–Bagdogra", "capacity": "High", "status": "Open"},
        ]
        blocked = ["Hooghly Connector", "Digha Sea-Wall Segment", "Mahananda River Crossing"]
    else:
        corridors = [
            {"road": "NH-12 Kolkata–Howrah", "capacity": "High", "status": "Open"},
            {"road": "NH-16 Kolkata–Digha", "capacity": "Medium", "status": "Open"},
            {"road": "Sundarbans Embankment Link", "capacity": "Medium", "status": "Open"},
        ]
        blocked = ["Mahananda River Crossing"]

    return {
        "query": prompt or "Operational routing assessment",
        "sector": telemetry.get("sector", "Kolkata Metropolitan Corridor"),
        "scenario": "Flooding" if is_flood else "General Operations",
        "rainfall_mm": telemetry.get("rainfall", 42),
        "active_lifeline_corridors": corridors,
        "road_capacities": {
            "NH-12 Kolkata–Howrah": "High",
            "NH-16 Kolkata–Digha": "Medium",
            "NH-10 Siliguri–Bagdogra": "High",
            "Sundarbans Embankment Link": "Medium",
        },
        "blocked_segments": blocked,
        "active_incidents": len(active_incidents),
        "available_assets": len(available_assets),
        "summary": {
            "guidance": "Keep arterial routes open for evacuation and reserve alternate corridors for medical support." if is_flood else "Preserve main access corridors and maintain reserve capacity near staging areas.",
            "status": "Operational",
        },
        "timestamp": utc_now_iso(),
    }

@app.get("/api/ops/evacuation-heatmap")
def get_evacuation_heatmap():
    telemetry = LATEST_TELEMETRY or {
        "sector": "Kolkata Metropolitan Corridor",
        "rainfall": 42,
        "wind_speed": 20.2,
    }

    active_incidents = len([incident for incident in INCIDENTS.values() if incident.status != "Resolved"])
    available_assets = len([resource for resource in RESOURCES.values() if resource.status == "Available"])

    return {
        "sector": telemetry.get("sector", "Kolkata Metropolitan Corridor"),
        "rainfall_mm": telemetry.get("rainfall", 42),
        "wind_speed_kmh": telemetry.get("wind_speed", 20.2),
        "active_incidents": active_incidents,
        "available_assets": available_assets,
        "zones": calculate_evacuation_heatmap(
            telemetry=telemetry,
            active_incidents=active_incidents,
            available_assets=available_assets,
        ),
        "timestamp": utc_now_iso(),
    }

@app.post("/api/resources/{resource_id}/dispatch")
async def dispatch_resource(resource_id: str, request: DispatchRequest):
    if resource_id not in RESOURCES:
        raise HTTPException(status_code=404, detail="Resource not found")
    if request.incident_id not in INCIDENTS:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    resource = RESOURCES[resource_id]
    incident = INCIDENTS[request.incident_id]
    
    if resource.status != "Available":
        raise HTTPException(status_code=400, detail=f"Resource status is '{resource.status}'. Must be Available to dispatch.")
        
    resource.status = "Dispatched"
    resource.assigned_incident_id = request.incident_id
    
    # Broadcast updates
    await ws_manager.broadcast({
        "type": "RESOURCE_UPDATE",
        "data": resource.model_dump()
    })
    
    await ws_manager.broadcast({
        "type": "SYSTEM_LOG",
        "data": {
            "id": f"dispatch-log-{random.randint(1000, 9999)}",
            "timestamp": utc_now_iso(),
            "level": "WARNING",
            "message": f"DISPATCH COMMAND: {resource.name} is heading to Incident {incident.id} ({incident.type}) in {incident.location}."
        }
    })
    
    return resource

@app.post("/api/resources/{resource_id}/status")
async def update_resource_status(resource_id: str, request: StatusUpdateRequest):
    if resource_id not in RESOURCES:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    resource = RESOURCES[resource_id]
    allowed_statuses = ["Available", "Dispatched", "On-Scene", "Maintenance"]
    if request.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {allowed_statuses}")
        
    resource.status = request.status
    if request.status in ["Available", "Maintenance"]:
        resource.assigned_incident_id = None
        
    await ws_manager.broadcast({
        "type": "RESOURCE_UPDATE",
        "data": resource.model_dump()
    })
    
    return resource

# WebSocket Endpoint
@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send current state immediately on connection
        await websocket.send_json({
            "type": "INIT_STATE",
            "data": {
                "incidents": [i.model_dump() for i in INCIDENTS.values()],
                "resources": [r.model_dump() for r in RESOURCES.values()]
            }
        })
        
        while True:
            # Handle incoming WebSocket client commands (bi-directional flow)
            data = await websocket.receive_text()
            payload = json.loads(data)
            cmd_type = payload.get("type")
            
            if cmd_type == "RESOLVE_INCIDENT":
                inc_id = payload.get("data", {}).get("incident_id")
                if inc_id in INCIDENTS:
                    INCIDENTS[inc_id].status = "Resolved"
                    # Free up resources assigned to it
                    for res in RESOURCES.values():
                        if res.assigned_incident_id == inc_id:
                            res.status = "Available"
                            res.assigned_incident_id = None
                            await ws_manager.broadcast({
                                "type": "RESOURCE_UPDATE",
                                "data": res.model_dump()
                            })
                            
                    await ws_manager.broadcast({
                        "type": "INCIDENT_UPDATE",
                        "data": INCIDENTS[inc_id].model_dump()
                    })
                    
                    await ws_manager.broadcast({
                        "type": "SYSTEM_LOG",
                        "data": {
                            "id": f"manual-log-{random.randint(1000, 9999)}",
                            "timestamp": utc_now_iso(),
                            "level": "SUCCESS",
                            "message": f"Incident {inc_id} manually RESOLVED by operator."
                        }
                    })

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"WS error: {e}")
        ws_manager.disconnect(websocket)
