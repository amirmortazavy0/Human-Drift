import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from backend.models import AppData, AuditLogEntry

DATA_DIR = Path(__file__).resolve().parent / "data"
STORAGE_FILE = DATA_DIR / "human_drift.json"

def get_current_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def ensure_storage_file() -> AppData:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not STORAGE_FILE.exists():
        initial_data = AppData(
            version="1.0",
            created_at=get_current_iso(),
            routes=[],
            schedules=[],
            sessions=[],
            corrections=[],
            conflicts=[],
            audit_log=[],
            rest_days=[],
            target_program_days=30,
        )
        write_app_data(initial_data)
        return initial_data
    
    with open(STORAGE_FILE, "r", encoding="utf-8") as f:
        data_dict = json.load(f)
        return AppData.model_validate(data_dict)

def read_app_data() -> AppData:
    return ensure_storage_file()

def write_app_data(data: AppData) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Write cleanly and atomically
    temp_file = STORAGE_FILE.with_suffix(".tmp")
    data_dict = data.model_dump()
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data_dict, f, indent=2)
    os.replace(temp_file, STORAGE_FILE)

def append_audit_log(data: AppData, action: str, details: str) -> AuditLogEntry:
    entry = AuditLogEntry(
        id=f"aud-{uuid4()}",
        timestamp=get_current_iso(),
        action=action,
        details=details
    )
    data.audit_log.append(entry)
    return entry
