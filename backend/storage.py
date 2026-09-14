import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from backend.models import AppData, EventLogEntry

DATA_DIR = Path(__file__).resolve().parent / "data"
STORAGE_FILE = DATA_DIR / "human_drift.json"
BACKUP_FILE = DATA_DIR / "human_drift.json.bak"

def get_current_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def ensure_storage_file() -> AppData:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not STORAGE_FILE.exists():
        initial_data = AppData(
            version="1.0",
            created_at=get_current_iso(),
            journeys=[],
            nodes=[],
            sessions=[],
            entries=[],
            corrections=[],
            conflicts=[],
            event_log=[],
        )
        write_app_data(initial_data)
        return initial_data
    
    try:
        with open(STORAGE_FILE, "r", encoding="utf-8") as f:
            data_dict = json.load(f)
            return AppData.model_validate(data_dict)
    except Exception as e:
        timestamp = int(datetime.now().timestamp())
        corrupt_backup = DATA_DIR / f"human_drift.corrupt.{timestamp}.json"
        try:
            if STORAGE_FILE.exists():
                shutil.copy(STORAGE_FILE, corrupt_backup)
        except Exception:
            pass

        # Try restoring from rolling backup if valid
        if BACKUP_FILE.exists():
            try:
                with open(BACKUP_FILE, "r", encoding="utf-8") as bf:
                    bak_dict = json.load(bf)
                    restored_data = AppData.model_validate(bak_dict)
                    append_audit_event(
                        restored_data,
                        "DATABASE_CORRUPTION_RECOVERED",
                        {"message": f"Restored from rolling backup: {str(e)}"}
                    )
                    write_app_data(restored_data)
                    return restored_data
            except Exception:
                pass

        # If backup also failed or missing, initialize fresh safe store
        fresh_data = AppData(
            version="1.0",
            created_at=get_current_iso(),
            journeys=[],
            nodes=[],
            sessions=[],
            entries=[],
            corrections=[],
            conflicts=[],
            event_log=[],
        )
        append_audit_event(
            fresh_data,
            "DATABASE_CORRUPTION_RECOVERED",
            {"message": f"Initialized fresh store, corrupt copy saved: {str(e)}"}
        )
        write_app_data(fresh_data)
        return fresh_data

def read_app_data() -> AppData:
    return ensure_storage_file()

def write_app_data(data: AppData) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp_file = STORAGE_FILE.with_suffix(f".tmp.{uuid4()}")
    data_dict = data.model_dump()
    
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data_dict, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        
        # Maintain a rolling valid backup
        if STORAGE_FILE.exists():
            try:
                shutil.copy(STORAGE_FILE, BACKUP_FILE)
            except Exception:
                pass
                
        os.replace(temp_file, STORAGE_FILE)
    except OSError as err:
        if temp_file.exists():
            try:
                temp_file.unlink()
            except Exception:
                pass
        raise RuntimeError(f"Storage write failed: {err}")

def append_audit_event(data: AppData, event_type: str, payload: dict) -> EventLogEntry:
    entry = EventLogEntry(
        id=f"evt-{uuid4()}",
        entity_type="System",
        entity_id="system",
        event_type=event_type,
        payload=payload,
        occurred_at=get_current_iso()
    )
    data.event_log.append(entry)
    return entry
