#!/usr/bin/env python3
"""
Human Drift — Obsidian & AI-Compatible Markdown Exporter
Adheres strictly to the Master Build Prompt export specification:
/export/
  /[Journey Name]/
    index.md          <- journey overview, stats
    /[Node Name]/
      index.md        <- node overview, time totals
      /sessions/
        YYYY-MM-DD.md <- one file per session, full entry log
"""

import os
import sys
import json
import re
from pathlib import Path
from datetime import datetime

def sanitize_filename(name: str) -> str:
    """Sanitize strings for filesystem directory / file names."""
    if not name or not name.strip():
        return "Untitled"
    # Replace illegal filesystem chars
    clean = re.sub(r'[\\/*?:"<>|]', '_', name.strip())
    # Collapse multiple spaces or underscores
    clean = re.sub(r'[\s_]+', ' ', clean)
    return clean[:80].strip()

def load_data(base_dir: Path) -> dict:
    paths_to_check = [
        base_dir / "backend" / "data" / "human_drift.json",
        base_dir / "data" / "human_drift.json",
        base_dir / "human_drift.json"
    ]
    for p in paths_to_check:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error reading {p}: {e}", file=sys.stderr)
    return {"journeys": [], "nodes": [], "sessions": [], "session_entries": [], "audit_log": []}

def format_yaml(data: dict) -> str:
    lines = ["---"]
    for k, v in data.items():
        if v is None:
            lines.append(f"{k}: null")
        elif isinstance(v, (int, float, bool)):
            lines.append(f"{k}: {v}")
        elif isinstance(v, list):
            if not v:
                lines.append(f"{k}: []")
            elif all(isinstance(item, (str, int, float)) for item in v):
                items_str = ", ".join(json.dumps(item) for item in v)
                lines.append(f"{k}: [{items_str}]")
            else:
                lines.append(f"{k}:")
                for item in v:
                    lines.append(f"  - {json.dumps(item)}")
        elif isinstance(v, dict):
            lines.append(f"{k}:")
            for subk, subv in v.items():
                lines.append(f"  {subk}: {json.dumps(subv)}")
        else:
            lines.append(f"{k}: {json.dumps(str(v))}")
    lines.append("---")
    return "\n".join(lines)

def run_export(base_dir: Path = None, output_dir: Path = None) -> Path:
    if base_dir is None:
        base_dir = Path.cwd()
    if output_dir is None:
        output_dir = base_dir / "export"

    data = load_data(base_dir)
    journeys = data.get("journeys", [])
    nodes = data.get("nodes", [])
    sessions = data.get("sessions", [])
    entries = data.get("session_entries", data.get("entries", []))

    os.makedirs(output_dir, exist_ok=True)

    # 1. Export each Journey
    for j in journeys:
        j_id = j.get("id")
        j_name = sanitize_filename(j.get("name", "Untitled Journey"))
        j_dir = output_dir / j_name
        os.makedirs(j_dir, exist_ok=True)

        # Calculate stats for this journey
        j_sessions = [s for s in sessions if s.get("journey_id") == j_id]
        j_nodes = [n for n in nodes if n.get("journey_id") == j_id]

        total_minutes = 0
        for s in j_sessions:
            st = s.get("started_at")
            et = s.get("ended_at")
            if st and et:
                try:
                    dt1 = datetime.fromisoformat(st.replace("Z", "+00:00"))
                    dt2 = datetime.fromisoformat(et.replace("Z", "+00:00"))
                    total_minutes += max(0, int((dt2 - dt1).total_seconds() / 60))
                except Exception:
                    pass

        # Write Journey index.md
        j_frontmatter = {
            "id": j_id,
            "name": j.get("name"),
            "status": j.get("status", "ACTIVE"),
            "visibility": j.get("visibility", "PRIVATE"),
            "created_at": j.get("created_at"),
            "completed_at": j.get("completed_at"),
            "total_sessions": len(j_sessions),
            "total_minutes": total_minutes,
            "nodes_count": len(j_nodes),
        }

        j_content = f"""{format_yaml(j_frontmatter)}

# Journey: {j.get('name', 'Untitled')}

> {j.get('description') or 'No description provided.'}

## Overview & Metrics
- **Status**: `{j.get('status', 'ACTIVE')}`
- **Total Working Time**: {total_minutes} minutes ({round(total_minutes / 60, 1)} hours)
- **Sessions Count**: {len(j_sessions)}
- **Hierarchy Nodes**: {len(j_nodes)}

## Direct Units of Work (Nodes)
"""
        for n in j_nodes:
            if not n.get("parent_id"):
                j_content += f"- **[{n.get('node_type', 'TASK')}]** {n.get('name')} (`{n.get('status', 'PLANNED')}`)\n"

        with open(j_dir / "index.md", "w", encoding="utf-8") as f:
            f.write(j_content)

        # 2. Export Nodes under this Journey
        for n in j_nodes:
            n_id = n.get("id")
            n_name = sanitize_filename(n.get("name", "Untitled Node"))
            n_dir = j_dir / n_name
            os.makedirs(n_dir, exist_ok=True)
            sessions_dir = n_dir / "sessions"
            os.makedirs(sessions_dir, exist_ok=True)

            # Node entries & sessions
            n_entries = [e for e in entries if e.get("node_id") == n_id]
            n_session_ids = set(e.get("session_id") for e in n_entries)
            n_sessions = [s for s in sessions if s.get("id") in n_session_ids]

            n_actual_minutes = 0
            for s in n_sessions:
                st = s.get("started_at")
                et = s.get("ended_at")
                if st and et:
                    try:
                        dt1 = datetime.fromisoformat(st.replace("Z", "+00:00"))
                        dt2 = datetime.fromisoformat(et.replace("Z", "+00:00"))
                        n_actual_minutes += max(0, int((dt2 - dt1).total_seconds() / 60))
                    except Exception:
                        pass

            est_minutes = n.get("estimated_minutes")
            drift_minutes = (n_actual_minutes - est_minutes) if est_minutes is not None else None

            n_frontmatter = {
                "id": n_id,
                "journey_id": j_id,
                "parent_id": n.get("parent_id"),
                "name": n.get("name"),
                "node_type": n.get("node_type", "TASK"),
                "status": n.get("status", "PLANNED"),
                "estimated_minutes": est_minutes,
                "actual_minutes": n_actual_minutes,
                "drift_minutes": drift_minutes,
                "created_at": n.get("created_at"),
            }

            n_content = f"""{format_yaml(n_frontmatter)}

# {n.get('node_type', 'TASK')}: {n.get('name')}

> {n.get('description') or 'No description provided.'}

## Time Totals & Drift
- **Status**: `{n.get('status', 'PLANNED')}`
- **Estimated**: {f"{est_minutes} min" if est_minutes is not None else "Not estimated"}
- **Actual Logged**: {n_actual_minutes} min
- **Drift (Actual - Est)**: {f"{drift_minutes:+d} min" if drift_minutes is not None else "N/A"}
- **Linked Sessions**: {len(n_sessions)}
"""
            with open(n_dir / "index.md", "w", encoding="utf-8") as f:
                f.write(n_content)

            # 3. Export Session files: YYYY-MM-DD.md
            for s in n_sessions:
                s_id = s.get("id")
                st = s.get("started_at", datetime.utcnow().isoformat())
                date_str = st[:10]
                s_file_path = sessions_dir / f"{date_str}.md"

                # Calculate duration
                dur = 0
                et = s.get("ended_at")
                if st and et:
                    try:
                        dt1 = datetime.fromisoformat(st.replace("Z", "+00:00"))
                        dt2 = datetime.fromisoformat(et.replace("Z", "+00:00"))
                        dur = max(0, int((dt2 - dt1).total_seconds() / 60))
                    except Exception:
                        pass

                s_entries = [e for e in n_entries if e.get("session_id") == s_id]
                s_entries.sort(key=lambda x: x.get("logged_at", ""))

                s_frontmatter = {
                    "session_id": s_id,
                    "journey_id": j_id,
                    "node_id": n_id,
                    "date": date_str,
                    "intention": s.get("intention"),
                    "started_at": st,
                    "ended_at": et,
                    "duration_minutes": dur,
                    "status": s.get("status", "COMPLETE"),
                    "quality": s.get("quality"),
                    "reflection": s.get("reflection"),
                    "entries_count": len(s_entries),
                }

                s_content = f"""{format_yaml(s_frontmatter)}

# Session: {date_str}

## Locked Intention
> **"{s.get('intention', 'No intention declared')}"**
*(Declared at session start, immutable)*

## Logged Reality & Events
"""
                if s_entries:
                    for e in s_entries:
                        time_part = e.get("logged_at", "")[11:16] or "--:--"
                        cond = e.get("condition", {})
                        cond_desc = f"Energy: {cond.get('energy', 'NORMAL')}, Focus: {cond.get('focus', 'NORMAL')}, Loc: {cond.get('location', 'OFFICE')}, Env: {cond.get('environment', 'QUIET')}"
                        s_content += f"- **[{time_part}] {e.get('entry_type')}**: {e.get('note') or '(No note)'}\n  *{cond_desc}*\n"
                else:
                    s_content += "- *No granular entries recorded for this session.*\n"

                if s.get("reflection"):
                    s_content += f"\n## Reflection\n> {s.get('reflection')}\n"

                with open(s_file_path, "w", encoding="utf-8") as f:
                    f.write(s_content)

    # Also build a single zip archive for one-click browser download
    try:
        import zipfile
        zip_path = output_dir / "human_drift_export.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(output_dir):
                for file in files:
                    if file != "human_drift_export.zip":
                        full_path = Path(root) / file
                        rel_path = full_path.relative_to(output_dir)
                        zipf.write(full_path, rel_path)
        print(f"Zip archive created at {zip_path}")
    except Exception as e:
        print(f"Zip creation warning: {e}", file=sys.stderr)

    print(f"Export completed successfully to {output_dir}")
    return output_dir

if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    run_export(output_dir=out)

