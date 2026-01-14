import json
import datetime

# =============================================================================
# 1. THE SHARED DATA STORE (The "Truth" for both Apps)
# =============================================================================
# In a real app, these would be separate JSON files on a server.

LDS_DB = {
    "mission_log": [],
    "metrics": {"focus_minutes": 0, "missions_completed": 0},
    "visual_memory": []
}

# =============================================================================
# 2. THE LOGIC KERNEL (The Brain)
# =============================================================================

class TeamBridgeLink:
    def __init__(self):
        self.db = LDS_DB

    def process_mission_completion(self, mission_id, duration_minutes, photo_path=None):
        """
        Called when Armand clicks 'Complete' on his tablet.
        """
        print(f"\n🚀 INCOMING: Mission {mission_id} completed by Armand.")
        
        # 1. VALIDATION LOGIC (The Rules)
        # We assume 15 mins is the baseline. If he did it in 5, did he rush?
        quality_score = "high" if duration_minutes >= 10 else "needs_review"
        
        # 2. UPDATE SHARED LOG (The Truth)
        event_record = {
            "_lds": {
                "id": f"lds:event/{datetime.datetime.now().timestamp()}",
                "type": "lifecycle.event"
            },
            "core": {
                "mission_id": mission_id,
                "timestamp": datetime.datetime.now().isoformat(),
                "duration": duration_minutes,
                "quality": quality_score,
                "verified": False # Waiting for Dad
            }
        }
        self.db["mission_log"].append(event_record)
        print(f"✅ LOGGED: Event recorded in Team Bridge. Status: {quality_score}")

        # 3. UPDATE THERAPIST METRICS (The Chart Data)
        # This auto-updates the graph on the dashboard
        self.db["metrics"]["focus_minutes"] += duration_minutes
        self.db["metrics"]["missions_completed"] += 1
        print(f"📈 ANALYTICS: Focus Minutes updated to {self.db['metrics']['focus_minutes']}")

        # 4. GENERATE VISUAL MEMORY (If photo provided)
        if photo_path:
            self._create_visual_memory(photo_path, mission_id)

    def _create_visual_memory(self, path, context):
        """
        Creates the 'Visual Memory' entity for the dashboard timeline.
        """
        memory_entity = {
            "_lds": {
                "id": f"lds:memory/visual/{datetime.datetime.now().timestamp()}",
                "type": "memory.visual"
            },
            "core": {
                "image_uri": path,
                "context": f"Success in {context}",
                "tags": ["focus_win", "independent_work"]
            }
        }
        self.db["visual_memory"].append(memory_entity)
        print(f"📸 MEMORY SAVED: Added '{context}' photo to timeline.")

    def get_dashboard_data(self):
        """
        Called by the Team Bridge HTML to render the view.
        """
        return json.dumps(self.db, indent=2)

# =============================================================================
# 3. SIMULATION RUN
# =============================================================================

if __name__ == "__main__":
    link = TeamBridgeLink()

    # --- SCENARIO 1: Armand finishes his room ---
    # He spent 20 minutes (Great focus!) and took a picture.
    link.process_mission_completion(
        mission_id="clean_room", 
        duration_minutes=20, 
        photo_path="img://armand/clean_room_success.jpg"
    )

    print("\n--- 📡 SYNCING TO DASHBOARD ---")
    print(link.get_dashboard_data())