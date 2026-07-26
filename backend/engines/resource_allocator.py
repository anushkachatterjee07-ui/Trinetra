import math
from typing import List, Dict, Any

class ResourceAllocator:
    """
    Simulates an AI engine that optimizes resource dispatch by calculating 
    proximity and matching specialized skills/roles.
    """
    
    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates Haversine distance in kilometers between two lat/lon coordinates.
        """
        r = 6371.0  # Earth radius in km
        
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_phi / 2.0) ** 2 + 
             math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        
        return r * c

    @classmethod
    def recommend_allocations(cls, incident: Dict[str, Any], resources: List[Dict[str, Any]], limit: int = 3) -> List[Dict[str, Any]]:
        """
        Scans all available resources, filters by specialization matching the incident type,
        and ranks them by proximity (distance in km).
        """
        # Match type mappings
        type_mapping = {
            "Wildfire": ["Firefighting", "Logistics"],
            "Flood": ["Search & Rescue", "Logistics", "Medical"],
            "Earthquake": ["Search & Rescue", "Medical", "Hazmat"],
            "Hurricane": ["Search & Rescue", "Logistics", "Medical"]
        }
        
        incident_type = incident.get("type", "")
        required_types = type_mapping.get(incident_type, ["Search & Rescue"])
        
        matched_resources = []
        
        for res in resources:
            # Only consider Available or Dispatched to other (priority shifts) resources
            if res.get("status") != "Available":
                continue
                
            res_type = res.get("type", "")
            
            # Match check
            type_match = res_type in required_types
            
            dist = cls.calculate_distance(
                incident.get("latitude", 0.0), incident.get("longitude", 0.0),
                res.get("latitude", 0.0), res.get("longitude", 0.0)
            )
            
            # Recommendation score calculation (higher is better)
            # base score out of 100, deducting for distance
            distance_penalty = min(50.0, dist * 2.0)  # -2 points per km, max penalty -50
            match_bonus = 30.0 if type_match else 0.0
            score = 70.0 + match_bonus - distance_penalty
            
            matched_resources.append({
                "resource": res,
                "distance_km": round(dist, 2),
                "match_score": round(max(0.0, min(100.0, score)), 1),
                "is_specialized": type_match
            })
            
        # Sort by match score descending
        matched_resources.sort(key=lambda x: x["match_score"], reverse=True)
        return matched_resources[:limit]
