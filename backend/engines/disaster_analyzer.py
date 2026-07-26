import random
import re
from datetime import datetime
from typing import Dict, Any

from engines.weather_provider import WEST_BENGAL_BBOX

class DisasterAnalyzer:
    """
    Simulates an AI engine analyzing raw environmental telemetry to detect 
    and evaluate disaster events.
    """

    WEST_BENGAL_CONTACTS = {
        "police": "112",
        "fire": "101",
        "ambulance": "102",
        "disaster_management": "1070",
        "women_helpline": "1091",
    }

    WEST_BENGAL_SHELTERS = [
        {"name": "Kolkata Municipal Relief Centre", "district": "Kolkata", "type": "community shelter"},
        {"name": "Howrah Flood Shelter", "district": "Howrah", "type": "flood shelter"},
        {"name": "Digha Cyclone Shelter", "district": "Purba Medinipur", "type": "cyclone shelter"},
        {"name": "Siliguri Relief Point", "district": "Darjeeling", "type": "highland shelter"},
        {"name": "Sundarbans Emergency Camp", "district": "South 24 Parganas", "type": "coastal shelter"},
    ]

    WEST_BENGAL_PROTOCOLS = [
        "Move to higher ground immediately if water is rising or roads are becoming submerged.",
        "Keep emergency supplies, medicines, waterproof bags, and identity documents ready.",
        "Avoid walking through flooded streets or touching loose electrical lines.",
        "Follow local warning sirens, district administration advisories, and river-level alerts.",
        "If a cyclone is expected, secure shutters, move valuables to upper floors, and leave early if instructed.",
    ]

    WEST_BENGAL_EVACUATION_GUIDANCE = [
        "Evacuate early when the district administration issues a cyclone or flood warning.",
        "Use the nearest official shelter, school, or community hall listed by the local administration.",
        "Prefer the main arterial roads first; avoid low-lying bridges and embankment breaches.",
        "Keep family contacts updated and travel with essential medicines, water, and flashlights.",
    ]

    WEST_BENGAL_FLOOD_SURVIVAL = [
        "Do not attempt to cross flowing water by foot, vehicle, or motorcycle.",
        "Switch off gas and electricity if the area is flooding.",
        "Move to the highest safe point in the building or head to an official shelter.",
        "Call emergency services if you are trapped or need urgent medical help.",
    ]

    @staticmethod
    def analyze_sensor_telemetry(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes raw sensor metrics (temperature, humidity, wind, rainfall, seismic)
        to determine the probability and severity of a disaster event.
        """
        temp = sensor_data.get("temperature", 25.0)
        wind_speed = sensor_data.get("wind_speed", 10.0)
        rainfall = sensor_data.get("rainfall", 0.0)
        seismic = sensor_data.get("seismic_activity", 0.0)
        humidity = sensor_data.get("humidity", 50.0)
        
        # Simple heuristic rule engine simulating AI classification
        threats = []
        max_score = 0.0
        
        # 1. Wildfire check
        if temp > 40.0 and humidity < 20.0 and wind_speed > 30.0:
            score = min(10.0, (temp - 30.0) * 0.4 + (wind_speed * 0.1))
            threats.append(("Wildfire", score))
            
        # 2. Flood check
        if rainfall > 50.0:
            score = min(10.0, (rainfall - 40.0) * 0.15)
            threats.append(("Flood", score))
            
        # 3. Earthquake check
        if seismic > 4.5:
            score = min(10.0, (seismic - 4.0) * 2.0)
            threats.append(("Earthquake", score))
            
        # 4. Hurricane/Windstorm check
        if wind_speed > 80.0:
            score = min(10.0, (wind_speed - 70.0) * 0.15)
            threats.append(("Hurricane", score))

        if not threats:
            return {
                "detected": False,
                "type": "Normal",
                "severity": "None",
                "impact_score": 0.0,
                "description": "All telemetry metrics within standard operational limits.",
                "bbox": WEST_BENGAL_BBOX,
            }

        threat_type, impact_score = max(threats, key=lambda x: x[1])

        if impact_score >= 8.5:
            severity = "Critical"
        elif impact_score >= 6.0:
            severity = "High"
        elif impact_score >= 3.5:
            severity = "Medium"
        else:
            severity = "Low"

        return {
            "detected": True,
            "type": threat_type,
            "severity": severity,
            "impact_score": round(impact_score, 1),
            "description": f"AI model detected anomalous {threat_type.lower()} indicators. Telemetry matches historical disaster patterns.",
            "bbox": WEST_BENGAL_BBOX,
        }

    @classmethod
    def process_open_ended_question(cls, question: str) -> Dict[str, Any]:
        """
        Rule-based interpretation for open-ended safety and preparedness questions.
        Returns a structured answer tailored to West Bengal conditions.
        """
        text = (question or "").strip().lower()

        if any(token in text for token in ["safety protocol", "safety protocols", "protocol", "follow"]):
            category = "safety_protocols"
            answer = "For West Bengal, follow these safety protocols: " + " ".join(cls.WEST_BENGAL_PROTOCOLS[:3])
            return {
                "category": category,
                "answer": answer,
                "safety_protocols": cls.WEST_BENGAL_PROTOCOLS,
                "emergency_contacts": cls.WEST_BENGAL_CONTACTS,
                "shelter_locations": cls.WEST_BENGAL_SHELTERS,
            }

        if any(token in text for token in ["emergency number", "emergency numbers", "contact", "call", "police", "ambulance", "fire"]):
            category = "emergency_contacts"
            answer = (
                "In West Bengal, call 112 for police assistance, 101 for fire, 102 for ambulance, "
                "1070 for disaster management, and 1091 for women helpline."
            )
            return {
                "category": category,
                "answer": answer,
                "emergency_contacts": cls.WEST_BENGAL_CONTACTS,
                "safety_protocols": cls.WEST_BENGAL_PROTOCOLS,
                "shelter_locations": cls.WEST_BENGAL_SHELTERS,
            }

        if any(token in text for token in ["shelter", "safe place", "camp", "relief centre", "relief center"]):
            category = "shelters"
            locations = [
                f"{entry['name']} ({entry['district']}) - {entry['type']}"
                for entry in cls.WEST_BENGAL_SHELTERS
            ]
            answer = "West Bengal shelter options include: " + "; ".join(locations)
            return {
                "category": category,
                "answer": answer,
                "shelter_locations": cls.WEST_BENGAL_SHELTERS,
                "emergency_contacts": cls.WEST_BENGAL_CONTACTS,
            }

        if any(token in text for token in ["survive", "survival", "flood", "water", "trapped"]):
            category = "flood_survival"
            answer = "Flood survival guidance for West Bengal: " + " ".join(cls.WEST_BENGAL_FLOOD_SURVIVAL)
            return {
                "category": category,
                "answer": answer,
                "flood_survival": cls.WEST_BENGAL_FLOOD_SURVIVAL,
                "emergency_contacts": cls.WEST_BENGAL_CONTACTS,
            }

        if any(token in text for token in ["evacuat", "leave", "move out", "cyclone", "warning"]):
            category = "evacuation"
            answer = "Evacuation guidance for West Bengal: " + " ".join(cls.WEST_BENGAL_EVACUATION_GUIDANCE)
            return {
                "category": category,
                "answer": answer,
                "evacuation_guidance": cls.WEST_BENGAL_EVACUATION_GUIDANCE,
                "shelter_locations": cls.WEST_BENGAL_SHELTERS,
            }

        category = "general"
        answer = (
            "For West Bengal emergencies, use 112/101/102 and move to the nearest official shelter if warned. "
            "If you are in flood or cyclone risk, prioritize safety and follow local administration alerts."
        )
        return {
            "category": category,
            "answer": answer,
            "emergency_contacts": cls.WEST_BENGAL_CONTACTS,
            "shelter_locations": cls.WEST_BENGAL_SHELTERS,
        }

    @staticmethod
    def generate_random_incident(incident_id: str) -> Dict[str, Any]:
        """
        Helper to generate a mock active incident.
        """
        types = ["Wildfire", "Flood", "Earthquake", "Hurricane"]
        severities = ["Low", "Medium", "High", "Critical"]
        locations = ["Kolkata Metro", "Howrah Dockyard", "Digha Coast", "Siliguri Hills", "Sundarbans Embankment", "North Bengal Corridor"]
        
        # Coordinates aligned to West Bengal
        lat = 22.5726 + random.uniform(-0.15, 0.15)
        lng = 88.3639 + random.uniform(-0.15, 0.15)
        
        t = random.choice(types)
        sev = random.choice(severities)
        
        descriptions = {
            "Wildfire": "A rapidly spreading wildfire is threatening the tea-garden belt and access corridors near Siliguri.",
            "Flood": "Water levels are rising along the Hooghly and coastal corridors, threatening critical road links.",
            "Earthquake": "A low-intensity tremor has disrupted road surfaces and utility lines across the affected district.",
            "Hurricane": "Cyclonic winds are damaging power lines and coastal infrastructure in the Sundarbans and adjoining districts."
        }
        
        impact_bases = {"Low": 2.0, "Medium": 5.0, "High": 7.5, "Critical": 9.2}
        impact = min(10.0, max(1.0, impact_bases[sev] + random.uniform(-0.8, 0.8)))
        
        return {
            "id": incident_id,
            "type": t,
            "severity": sev,
            "location": random.choice(locations),
            "latitude": round(lat, 5),
            "longitude": round(lng, 5),
            "status": "Active",
            "timestamp": datetime.now().isoformat(),
            "description": descriptions[t],
            "impact_score": round(impact, 1)
        }
