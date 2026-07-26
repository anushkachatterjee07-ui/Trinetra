import unittest

from engines.disaster_analyzer import DisasterAnalyzer


class DisasterAnalyzerTestCase(unittest.TestCase):
    def test_safety_protocol_query(self):
        result = DisasterAnalyzer.process_open_ended_question(
            "What safety protocols should I follow during a flood in Kolkata?"
        )
        self.assertEqual(result["category"], "safety_protocols")
        self.assertIn("higher ground", result["answer"].lower())
        self.assertTrue(result["safety_protocols"])

    def test_emergency_contact_query(self):
        result = DisasterAnalyzer.process_open_ended_question(
            "Which emergency numbers should I call in West Bengal?"
        )
        self.assertEqual(result["category"], "emergency_contacts")
        self.assertTrue(result["emergency_contacts"])
        self.assertIn("112", result["answer"])

    def test_shelter_query(self):
        result = DisasterAnalyzer.process_open_ended_question(
            "Where can I find shelter locations during a cyclone in Sundarbans?"
        )
        self.assertEqual(result["category"], "shelters")
        self.assertTrue(result["shelter_locations"])


if __name__ == "__main__":
    unittest.main()
