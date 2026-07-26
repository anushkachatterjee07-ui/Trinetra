import json
import random
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, Optional

WEST_BENGAL_LOCATIONS = [
    {"name": "Kolkata", "district": "Kolkata", "latitude": 22.5726, "longitude": 88.3639},
    {"name": "Howrah", "district": "Howrah", "latitude": 22.5958, "longitude": 88.2636},
    {"name": "Digha", "district": "Purba Medinipur", "latitude": 21.6229, "longitude": 87.5515},
    {"name": "Siliguri", "district": "Darjeeling", "latitude": 26.7271, "longitude": 88.3953},
    {"name": "Sundarbans", "district": "South 24 Parganas", "latitude": 22.0410, "longitude": 88.7968},
]

WEST_BENGAL_BBOX = {
    "north": 27.2,
    "south": 21.5,
    "west": 85.7,
    "east": 89.8,
}


def fetch_west_bengal_weather(location_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch a live weather snapshot for West Bengal using Open-Meteo.
    Falls back to a West Bengal-specific heuristic model if the provider is unavailable.
    """
    location = next((entry for entry in WEST_BENGAL_LOCATIONS if entry["name"].lower() == (location_name or "").lower()), None)
    if location is None:
        location = random.choice(WEST_BENGAL_LOCATIONS)

    params = {
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
        "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }
    url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)

    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Trinetra/1.0"})
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.load(response)

        current = payload.get("current", {})
        temperature = current.get("temperature_2m")
        humidity = current.get("relative_humidity_2m")
        wind_speed = current.get("wind_speed_10m")
        rainfall = current.get("precipitation")
        weather_code = current.get("weather_code")

        return {
            "sector": f"{location['name']} ({location['district']})",
            "latitude": round(location["latitude"], 4),
            "longitude": round(location["longitude"], 4),
            "temperature": round(float(temperature), 1) if temperature is not None else 29.0,
            "humidity": round(float(humidity), 1) if humidity is not None else 72.0,
            "wind_speed": round(float(wind_speed), 1) if wind_speed is not None else 12.0,
            "rainfall": round(float(rainfall), 1) if rainfall is not None else 0.0,
            "seismic_activity": 0.0,
            "timestamp": datetime.now().isoformat(),
            "source": "open-meteo",
            "provider": "open-meteo",
            "weather_code": weather_code,
            "bbox": WEST_BENGAL_BBOX,
            "location": location,
        }
    except Exception as exc:
        return fallback_west_bengal_weather(location, str(exc))


def fallback_west_bengal_weather(location: Dict[str, Any], reason: Optional[str] = None) -> Dict[str, Any]:
    """Heuristic fallback tuned for West Bengal weather patterns and cyclone / monsoon behavior."""
    district_bias = location["district"].lower()
    if "coastal" in district_bias or location["name"].lower() == "digha" or location["name"].lower() == "sundarbans":
        temperature = 31.0
        humidity = 82.0
        wind_speed = 22.0
        rainfall = 58.0
    elif location["name"].lower() == "kolkata":
        temperature = 33.0
        humidity = 76.0
        wind_speed = 18.0
        rainfall = 42.0
    elif location["name"].lower() == "howrah":
        temperature = 34.0
        humidity = 74.0
        wind_speed = 20.0
        rainfall = 39.0
    else:
        temperature = 28.0
        humidity = 68.0
        wind_speed = 14.0
        rainfall = 8.0

    return {
        "sector": f"{location['name']} ({location['district']})",
        "latitude": round(location["latitude"], 4),
        "longitude": round(location["longitude"], 4),
        "temperature": round(temperature, 1),
        "humidity": round(humidity, 1),
        "wind_speed": round(wind_speed, 1),
        "rainfall": round(rainfall, 1),
        "seismic_activity": 0.0,
        "timestamp": datetime.now().isoformat(),
        "source": "fallback-simulation",
        "provider": "fallback-simulation",
        "weather_code": None,
        "bbox": WEST_BENGAL_BBOX,
        "location": location,
        "fallback_reason": reason,
    }
