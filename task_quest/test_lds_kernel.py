import unittest
import json
import datetime
from typing import Dict, List, Any

# =============================================================================
# 1. THE MOCK LDS DATA STORE (The "Truth")
# =============================================================================
# This mimics your database of immutable JSON files.

RAW_LDS_STORE = [
    # --- TENANT 1: AURA HEALTH (HIPAA Strict) ---
    {
        "_lds": {"id": "lds:brand/aura-v1", "type": "brand.profile"},
        "core": {"name": "Aura Health", "industry": "medical"},
        "inference": {"requires": ["lds:policy/hipaa-strict", "lds:voice/rachel-neural"]}
    },
    {
        "_lds": {"id": "lds:policy/hipaa-strict", "type": "policy.compliance"},
        "vectors": {"category": ["compliance", "hipaa"]},
        "core": {
            "hipaa_mode": True,
            "phi_redaction": True,
            "audit_level": "maximum",
            "ambient_safety": True
        }
    },
    {
        "_lds": {"id": "lds:voice/rachel-neural", "type": "voice.style"},
        "core": {"provider": "elevenlabs", "model": "eleven_turbo_v2", "phi_safe": False} 
        # Note: Rachel is NOT PHI safe by default, requiring fallback logic
    },
    {
        "_lds": {"id": "lds:voice/fallback-safe", "type": "voice.style"},
        "core": {"provider": "system", "model": "offline_tts", "phi_safe": True}
    },

    # --- TENANT 2: BOLT LOGISTICS (Industrial / Lax) ---
    {
        "_lds": {"id": "lds:brand/bolt-v1", "type": "brand.profile"},
        "core": {"name": "Bolt Logistics", "industry": "industrial"},
        "inference": {"requires": ["lds:policy/standard-sec", "lds:voice/marcus-fast"]}
    },
    {
        "_lds": {"id": "lds:policy/standard-sec", "type": "policy.compliance"},
        "vectors": {"category": ["compliance", "standard"]},
        "core": {
            "hipaa_mode": False,
            "phi_redaction": False,
            "audit_level": "basic"
        }
    },
    {
        "_lds": {"id": "lds:voice/marcus-fast", "type": "voice.style"},
        "core": {"provider": "coqui", "model": "xtts_v2", "phi_safe": False}
    }
]

# =============================================================================
# 2. THE LOGIC KERNEL (The Engine)
# =============================================================================
# This represents your backend logic that resolves the LDS files.

class LdsKernel:
    def __init__(self, data_store):
        self.store = {item["_lds"]["id"]: item for item in data_store}
        self.audit_log = []

    def resolve_tenant_config(self, brand_id):
        """Resolves the full configuration graph for a tenant."""
        brand = self.store.get(brand_id)
        if not brand:
            raise ValueError(f"Tenant {brand_id} not found")

        config = {"brand": brand, "policy": None, "voice": None}

        # Inference Resolution (Simplified Graph Traversal)
        for req_id in brand["inference"]["requires"]:
            entity = self.store.get(req_id)
            if entity["_lds"]["type"] == "policy.compliance":
                config["policy"] = entity
            elif entity["_lds"]["type"] == "voice.style":
                config["voice"] = entity
        
        return config

    def route_voice_response(self, tenant_config, text_content, contains_phi):
        """Decides which voice model to use based on compliance rules."""
        policy = tenant_config["policy"]["core"]
        primary_voice = tenant_config["voice"]["core"]

        # 1. HIPAA Check
        if policy["hipaa_mode"] and contains_phi:
            # 2. Check if primary voice is safe
            if not primary_voice["phi_safe"]:
                # 3. Trigger Fallback
                self.log_audit(tenant_config["brand"]["_lds"]["id"], "voice_fallback_triggered", "PHI detected in unsafe voice channel")
                return self.store["lds:voice/fallback-safe"]["core"]
        
        return primary_voice

    def log_audit(self, tenant_id, event, reason):
        entry = {
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "tenant": tenant_id,
            "event": event,
            "reason": reason
        }
        self.audit_log.append(entry)

# =============================================================================
# 3. THE TEST SUITE (The Proof)
# =============================================================================

class TestLdsPlatform(unittest.TestCase):
    
    def setUp(self):
        self.kernel = LdsKernel(RAW_LDS_STORE)
        self.aura_id = "lds:brand/aura-v1"
        self.bolt_id = "lds:brand/bolt-v1"

    def test_1_white_label_isolation(self):
        """Ensure tenants load different policies from the same kernel."""
        print("\n🧪 TEST 1: Tenant Isolation")
        
        aura_conf = self.kernel.resolve_tenant_config(self.aura_id)
        bolt_conf = self.kernel.resolve_tenant_config(self.bolt_id)

        self.assertTrue(aura_conf["policy"]["core"]["hipaa_mode"], "Aura should have HIPAA mode ON")
        self.assertFalse(bolt_conf["policy"]["core"]["hipaa_mode"], "Bolt should have HIPAA mode OFF")
        print("✅ Aura loaded HIPAA policy. Bolt loaded Standard policy.")

    def test_2_voice_routing_security(self):
        """Ensure PHI forces a fallback voice for HIPAA tenants."""
        print("\n🧪 TEST 2: Voice Security Routing")
        
        aura_conf = self.kernel.resolve_tenant_config(self.aura_id)
        
        # Scenario: Agent needs to speak a prescription (PHI)
        voice_selected = self.kernel.route_voice_response(
            aura_conf, 
            text_content="Your prescription is Lisinopril.", 
            contains_phi=True
        )

        self.assertEqual(voice_selected["model"], "offline_tts", "Aura should downgrade to Offline TTS for PHI")
        print("✅ Aura blocked Cloud Neural Voice for PHI. Fallback active.")

    def test_3_industrial_lax_routing(self):
        """Ensure non-HIPAA tenants are NOT restricted."""
        print("\n🧪 TEST 3: Industrial Performance Routing")
        
        bolt_conf = self.kernel.resolve_tenant_config(self.bolt_id)
        
        # Scenario: Bolt discussing sensitive shipping data (Not PHI)
        voice_selected = self.kernel.route_voice_response(
            bolt_conf,
            text_content="Shipment #992 is delayed.",
            contains_phi=False # Industrial secrets aren't PHI
        )

        self.assertEqual(voice_selected["provider"], "coqui", "Bolt should keep using high-performance Coqui voice")
        print("✅ Bolt maintained high-performance voice.")

    def test_4_audit_trail_integrity(self):
        """Verify the immutable log captured the security event."""
        print("\n🧪 TEST 4: Audit Trail Integrity")
        
        # Trigger the event from Test 2 again
        aura_conf = self.kernel.resolve_tenant_config(self.aura_id)
        self.kernel.route_voice_response(aura_conf, "Secret info", contains_phi=True)

        last_log = self.kernel.audit_log[-1]
        
        self.assertEqual(last_log["event"], "voice_fallback_triggered")
        self.assertEqual(last_log["tenant"], self.aura_id)
        print(f"✅ Audit Log found: {last_log['timestamp']} - {last_log['reason']}")

if __name__ == '__main__':
    unittest.main()