import unittest

from main import calculate_evacuation_heatmap


class EvacuationHeatmapTestCase(unittest.TestCase):
    def test_heavy_rain_increases_clearance_times(self):
        zones = calculate_evacuation_heatmap(
            telemetry={"rainfall": 90, "wind_speed": 32},
            active_incidents=2,
            available_assets=2,
        )

        fast_zone = next(zone for zone in zones if zone["id"] == "fast")
        slow_zone = next(zone for zone in zones if zone["id"] == "slow")

        self.assertLess(fast_zone["clearance_time"], 15)
        self.assertGreater(slow_zone["clearance_time"], 60)
        self.assertGreater(slow_zone["clearance_time"], fast_zone["clearance_time"])


if __name__ == "__main__":
    unittest.main()
