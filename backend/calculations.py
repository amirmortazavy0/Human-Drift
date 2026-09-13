from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import math
from backend.models import AppData, Session, Stop, Correction

def parse_iso(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        # Handle ISO strings with Z or +00:00
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str)
    except Exception:
        return None

def parse_time_on_date(time_str: str, base_date_str: str) -> Optional[datetime]:
    # time_str is "HH:MM", base_date_str is "YYYY-MM-DD"
    try:
        dt_str = f"{base_date_str}T{time_str}:00+00:00"
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None

def get_effective_stop_timestamps(stop: Stop, corrections: List[Correction]) -> tuple[Optional[datetime], Optional[datetime]]:
    """Returns (arrived_at, departed_at) accounting for latest corrections."""
    stop_corrections = [c for c in corrections if c.stop_id == stop.id]
    # Sort by created_at ascending so latest is last
    stop_corrections.sort(key=lambda c: c.created_at)
    
    arrived_iso = stop.arrived_at
    departed_iso = stop.departed_at
    
    for c in stop_corrections:
        if c.field == "ARRIVED_AT":
            arrived_iso = c.corrected_value
        elif c.field == "DEPARTED_AT":
            departed_iso = c.corrected_value
            
    return parse_iso(arrived_iso), parse_iso(departed_iso)

def get_delay_seconds(actual_arrival: Optional[datetime], scheduled_time_str: Optional[str], session_date_str: str) -> Optional[float]:
    if not actual_arrival or not scheduled_time_str:
        return None
    sched_dt = parse_time_on_date(scheduled_time_str, session_date_str)
    if not sched_dt:
        return None
    # If actual arrival has timezone offset, align them
    if actual_arrival.tzinfo is not None and sched_dt.tzinfo is None:
        sched_dt = sched_dt.replace(tzinfo=timezone.utc)
    elif actual_arrival.tzinfo is None and sched_dt.tzinfo is not None:
        actual_arrival = actual_arrival.replace(tzinfo=timezone.utc)
    return (actual_arrival - sched_dt).total_seconds()

# Q1: Duration between two stations
def calculate_duration_between_stations(
    app_data: AppData,
    from_station_id: str,
    to_station_id: str,
    include_low_confidence: bool = False
) -> Dict[str, Any]:
    durations = []
    
    for session in app_data.sessions:
        if session.status == "CONFLICT":
            continue
        if not include_low_confidence and session.confidence == 1:
            continue
            
        stops_by_station = {s.station_id: s for s in session.stops if not s.is_skipped}
        if from_station_id not in stops_by_station or to_station_id not in stops_by_station:
            continue
            
        s1 = stops_by_station[from_station_id]
        s2 = stops_by_station[to_station_id]
        
        arr1, dep1 = get_effective_stop_timestamps(s1, app_data.corrections)
        arr2, dep2 = get_effective_stop_timestamps(s2, app_data.corrections)
        
        # Determine sequence order
        if s1.sequence < s2.sequence:
            start_time = dep1 or arr1
            end_time = arr2 or dep2
        else:
            start_time = dep2 or arr2
            end_time = arr1 or dep1
            
        if start_time and end_time and end_time >= start_time:
            durations.append((end_time - start_time).total_seconds())
            
    if not durations:
        return {
            "count": 0,
            "avg_minutes": None,
            "min_minutes": None,
            "max_minutes": None
        }
        
    return {
        "count": len(durations),
        "avg_minutes": round(sum(durations) / len(durations) / 60, 1),
        "min_minutes": round(min(durations) / 60, 1),
        "max_minutes": round(max(durations) / 60, 1)
    }

# Q2: Ranked segments by average duration
def calculate_segments_analysis(
    app_data: AppData,
    direction: Optional[str] = None,
    include_low_confidence: bool = False
) -> List[Dict[str, Any]]:
    # Pair consecutive stations
    segments_data: Dict[str, Dict[str, Any]] = {}
    
    # Station map
    stations_map = {}
    for r in app_data.routes:
        for st in r.stations:
            stations_map[st.id] = st
            
    for session in app_data.sessions:
        if session.status == "CONFLICT":
            continue
        if not include_low_confidence and session.confidence == 1:
            continue
        if direction and session.direction != direction:
            continue
            
        # Ordered stops
        sorted_stops = sorted(session.stops, key=lambda s: s.sequence)
        for i in range(len(sorted_stops) - 1):
            s_curr = sorted_stops[i]
            s_next = sorted_stops[i+1]
            if s_curr.is_skipped or s_next.is_skipped:
                continue
                
            _, dep_curr = get_effective_stop_timestamps(s_curr, app_data.corrections)
            arr_next, _ = get_effective_stop_timestamps(s_next, app_data.corrections)
            
            if dep_curr and arr_next and arr_next >= dep_curr:
                dur_secs = (arr_next - dep_curr).total_seconds()
                key = f"{s_curr.station_id}-->{s_next.station_id}"
                if key not in segments_data:
                    from_name = stations_map.get(s_curr.station_id, {}).name if s_curr.station_id in stations_map else "Unknown"
                    to_name = stations_map.get(s_next.station_id, {}).name if s_next.station_id in stations_map else "Unknown"
                    segments_data[key] = {
                        "key": key,
                        "from_station_id": s_curr.station_id,
                        "to_station_id": s_next.station_id,
                        "from_station_name": from_name,
                        "to_station_name": to_name,
                        "durations": []
                    }
                segments_data[key]["durations"].append(dur_secs)
                
    result = []
    for item in segments_data.values():
        durs = item["durations"]
        n = len(durs)
        avg = sum(durs) / n
        variance = sum((x - avg) ** 2 for x in durs) / n if n > 1 else 0
        std_dev = math.sqrt(variance)
        result.append({
            "segment_key": item["key"],
            "from_station_id": item["from_station_id"],
            "to_station_id": item["to_station_id"],
            "from_station_name": item["from_station_name"],
            "to_station_name": item["to_station_name"],
            "count": n,
            "avg_duration_minutes": round(avg / 60, 1),
            "min_duration_minutes": round(min(durs) / 60, 1),
            "max_duration_minutes": round(max(durs) / 60, 1),
            "std_dev_minutes": round(std_dev / 60, 1)
        })
        
    result.sort(key=lambda x: x["avg_duration_minutes"], reverse=True)
    return result

# Q3: Reliability by scheduled departure
def calculate_departures_reliability(app_data: AppData) -> List[Dict[str, Any]]:
    # Map scheduled departures
    dep_map = {}
    for s in app_data.schedules:
        for d in s.departures:
            dep_map[d.id] = (d, s)
            
    grouped: Dict[str, List[float]] = {}
    
    for session in app_data.sessions:
        if session.status == "CONFLICT" or not session.scheduled_departure_id:
            continue
            
        dep_id = session.scheduled_departure_id
        if dep_id not in dep_map:
            continue
            
        departure, schedule = dep_map[dep_id]
        # Last stop arrival
        sorted_stops = sorted(session.stops, key=lambda s: s.sequence)
        if not sorted_stops:
            continue
        last_stop = sorted_stops[-1]
        arr_last, _ = get_effective_stop_timestamps(last_stop, app_data.corrections)
        
        delay_sec = get_delay_seconds(arr_last, departure.arrival_time, session.date)
        if delay_sec is not None:
            if dep_id not in grouped:
                grouped[dep_id] = []
            grouped[dep_id].append(delay_sec)
            
    result = []
    for dep_id, delays in grouped.items():
        departure, schedule = dep_map[dep_id]
        avg_delay_min = round((sum(delays) / len(delays)) / 60, 1)
        on_time_count = sum(1 for d in delays if d <= 180) # <= 3 mins
        reliability_pct = round((on_time_count / len(delays)) * 100, 1)
        result.append({
            "departure_id": dep_id,
            "label": departure.label or f"{departure.departure_time} - {departure.arrival_time}",
            "departure_time": departure.departure_time,
            "arrival_time": departure.arrival_time,
            "direction": schedule.direction,
            "session_count": len(delays),
            "avg_delay_minutes": avg_delay_min,
            "reliability_pct": reliability_pct
        })
        
    result.sort(key=lambda x: x["avg_delay_minutes"])
    return result

# Q4: Reliability by day of week
def calculate_days_reliability(app_data: AppData, direction: Optional[str] = None) -> List[Dict[str, Any]]:
    # Days 0 = Monday ... 6 = Sunday
    days_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    grouped: Dict[int, List[float]] = {i: [] for i in range(7)}
    
    dep_map = {}
    for s in app_data.schedules:
        for d in s.departures:
            dep_map[d.id] = d
            
    for session in app_data.sessions:
        if session.status == "CONFLICT":
            continue
        if direction and session.direction != direction:
            continue
        try:
            dt = datetime.strptime(session.date, "%Y-%m-%d")
            weekday = dt.weekday()
        except Exception:
            continue
            
        sorted_stops = sorted(session.stops, key=lambda s: s.sequence)
        if not sorted_stops:
            continue
        last_stop = sorted_stops[-1]
        arr_last, _ = get_effective_stop_timestamps(last_stop, app_data.corrections)
        
        # If scheduled departure exists, compare to scheduled arrival
        if session.scheduled_departure_id and session.scheduled_departure_id in dep_map:
            dep = dep_map[session.scheduled_departure_id]
            delay_sec = get_delay_seconds(arr_last, dep.arrival_time, session.date)
            if delay_sec is not None:
                grouped[weekday].append(delay_sec)
        else:
            # If no scheduled departure, we can calculate total duration vs overall average or 0 delay
            first_stop = sorted_stops[0]
            _, dep_first = get_effective_stop_timestamps(first_stop, app_data.corrections)
            if dep_first and arr_last and arr_last >= dep_first:
                # Store duration in seconds
                grouped[weekday].append((arr_last - dep_first).total_seconds())
                
    result = []
    for day_idx in range(7):
        delays = grouped[day_idx]
        result.append({
            "day_index": day_idx,
            "day_name": days_names[day_idx],
            "session_count": len(delays),
            "avg_delay_minutes": round((sum(delays) / len(delays)) / 60, 1) if delays else 0.0
        })
    return result

# Q5: Live travel time estimate from current station to destination
def calculate_estimate_remaining(
    app_data: AppData,
    current_station_id: str,
    direction: str,
    destination_station_id: Optional[str] = None
) -> Dict[str, Any]:
    # Find route that has current station
    matched_route = None
    curr_seq = None
    for r in app_data.routes:
        for st in r.stations:
            if st.id == current_station_id:
                matched_route = r
                curr_seq = st.sequence
                break
        if matched_route:
            break
            
    if not matched_route or curr_seq is None:
        return {"error": "Station or route not found"}
        
    # Order stations according to direction
    ordered_stations = sorted(matched_route.stations, key=lambda s: s.sequence)
    if direction == "B_TO_A":
        ordered_stations = list(reversed(ordered_stations))
        
    # Find index of current station in ordered list
    curr_idx = next((i for i, s in enumerate(ordered_stations) if s.id == current_station_id), None)
    if curr_idx is None:
        return {"error": "Current station not found on route"}

    # Find index of destination station (default to terminal station if not provided)
    if destination_station_id:
        dest_idx = next((i for i, s in enumerate(ordered_stations) if s.id == destination_station_id), None)
        if dest_idx is None:
            dest_idx = len(ordered_stations) - 1
    else:
        dest_idx = len(ordered_stations) - 1

    # Ensure destination is downstream of current station
    if dest_idx <= curr_idx:
        return {
            "current_station_id": current_station_id,
            "current_station_name": ordered_stations[curr_idx].name,
            "destination_station_id": ordered_stations[dest_idx].id,
            "destination_station_name": ordered_stations[dest_idx].name,
            "estimated_minutes": 0,
            "remaining_stations_count": 0,
            "segments_breakdown": []
        }
        
    remaining_segments = []
    total_est_seconds = 0
    
    # Calculate historical segment averages
    segment_averages = {
        seg["segment_key"]: seg["avg_duration_minutes"] * 60
        for seg in calculate_segments_analysis(app_data, direction=direction, include_low_confidence=True)
    }
    
    for i in range(curr_idx, dest_idx):
        s_from = ordered_stations[i]
        s_to = ordered_stations[i+1]
        key = f"{s_from.id}-->{s_to.id}"
        est_sec = segment_averages.get(key, 12 * 60) # default 12 mins if no data yet
        total_est_seconds += est_sec
        remaining_segments.append({
            "from_name": s_from.name,
            "to_name": s_to.name,
            "estimated_minutes": round(est_sec / 60, 1)
        })
        
    return {
        "current_station_id": current_station_id,
        "current_station_name": ordered_stations[curr_idx].name,
        "destination_station_id": ordered_stations[dest_idx].id,
        "destination_station_name": ordered_stations[dest_idx].name,
        "estimated_minutes": round(total_est_seconds / 60, 1),
        "remaining_stations_count": dest_idx - curr_idx,
        "segments_breakdown": remaining_segments
    }

# Q7: Dwell time at stations
def calculate_dwell_times(app_data: AppData, direction: Optional[str] = None) -> List[Dict[str, Any]]:
    stations_map = {}
    for r in app_data.routes:
        for st in r.stations:
            stations_map[st.id] = st
            
    dwell_by_station: Dict[str, List[float]] = {}
    
    for session in app_data.sessions:
        if session.status == "CONFLICT":
            continue
        if direction and session.direction != direction:
            continue
        for stop in session.stops:
            if stop.is_skipped:
                continue
            arr, dep = get_effective_stop_timestamps(stop, app_data.corrections)
            if arr and dep and dep >= arr:
                dwell_sec = (dep - arr).total_seconds()
                if stop.station_id not in dwell_by_station:
                    dwell_by_station[stop.station_id] = []
                dwell_by_station[stop.station_id].append(dwell_sec)
                
    result = []
    for st_id, dwells in dwell_by_station.items():
        st_name = stations_map.get(st_id).name if st_id in stations_map else "Unknown"
        result.append({
            "station_id": st_id,
            "station_name": st_name,
            "count": len(dwells),
            "avg_dwell_seconds": round(sum(dwells) / len(dwells), 0),
            "min_dwell_seconds": round(min(dwells), 0),
            "max_dwell_seconds": round(max(dwells), 0)
        })
    result.sort(key=lambda x: x["avg_dwell_seconds"], reverse=True)
    return result

# Q8: Trend over 30 days (Weekly breakdown)
def calculate_trend_analysis(app_data: AppData, direction: Optional[str] = None) -> Dict[str, Any]:
    dep_map = {}
    for s in app_data.schedules:
        for d in s.departures:
            dep_map[d.id] = d
            
    # Group sessions by week
    # Let's sort sessions by date
    valid_sessions = [s for s in app_data.sessions if s.status != "CONFLICT"]
    if direction:
        valid_sessions = [s for s in valid_sessions if s.direction == direction]
    valid_sessions.sort(key=lambda s: s.date)
    
    if not valid_sessions:
        return {
            "trend": "NO_DATA",
            "description": "No sessions recorded yet.",
            "weeks": []
        }
        
    try:
        first_date = datetime.strptime(valid_sessions[0].date, "%Y-%m-%d")
    except Exception:
        first_date = datetime.now()
        
    weeks_data: Dict[int, List[float]] = {}
    
    for s in valid_sessions:
        try:
            s_date = datetime.strptime(s.date, "%Y-%m-%d")
            diff_days = (s_date - first_date).days
            week_idx = max(0, diff_days // 7) + 1
        except Exception:
            continue
            
        sorted_stops = sorted(s.stops, key=lambda stop: stop.sequence)
        if not sorted_stops:
            continue
        last_stop = sorted_stops[-1]
        arr_last, _ = get_effective_stop_timestamps(last_stop, app_data.corrections)
        
        delay_sec = None
        if s.scheduled_departure_id and s.scheduled_departure_id in dep_map:
            dep = dep_map[s.scheduled_departure_id]
            delay_sec = get_delay_seconds(arr_last, dep.arrival_time, s.date)
        elif arr_last and sorted_stops[0].departed_at:
            # Fallback duration
            dep_first = parse_iso(sorted_stops[0].departed_at)
            if dep_first and arr_last >= dep_first:
                delay_sec = (arr_last - dep_first).total_seconds() - (60 * 60) # relative
                
        if delay_sec is not None:
            if week_idx not in weeks_data:
                weeks_data[week_idx] = []
            weeks_data[week_idx].append(delay_sec / 60.0)
            
    weeks_list = []
    for w in sorted(weeks_data.keys()):
        avg_w = round(sum(weeks_data[w]) / len(weeks_data[w]), 1)
        weeks_list.append({
            "week": w,
            "session_count": len(weeks_data[w]),
            "avg_delay_minutes": avg_w
        })
        
    trend = "STABLE"
    description = "Performance has remained stable across recorded weeks."
    if len(weeks_list) >= 2:
        diff = weeks_list[-1]["avg_delay_minutes"] - weeks_list[0]["avg_delay_minutes"]
        if diff <= -2.0:
            trend = "IMPROVING"
            description = f"Delays decreased by {abs(round(diff, 1))} minutes on average."
        elif diff >= 2.0:
            trend = "DEGRADING"
            description = f"Delays increased by {round(diff, 1)} minutes on average."
            
    return {
        "trend": trend,
        "description": description,
        "weeks": weeks_list
    }

# Q10 & Q6: Full Session Segment Details with Dwell & Segment Durations + Delay Accumulation
def calculate_session_details(app_data: AppData, session_id: str) -> Dict[str, Any]:
    session = next((s for s in app_data.sessions if s.id == session_id), None)
    if not session:
        return {"error": "Session not found"}
        
    route = next((r for r in app_data.routes if r.id == session.route_id), None)
    stations_map = {st.id: st for st in (route.stations if route else [])}
    
    # Calculate historical segment averages for this direction
    historical_segments = calculate_segments_analysis(app_data, direction=session.direction, include_low_confidence=True)
    hist_avg_map = {seg["segment_key"]: seg["avg_duration_minutes"] * 60 for seg in historical_segments}
    
    sorted_stops = sorted(session.stops, key=lambda s: s.sequence)
    stop_details = []
    cumulative_delay_seconds = 0.0
    
    prev_dep: Optional[datetime] = None
    prev_station_id: Optional[str] = None
    
    for i, stop in enumerate(sorted_stops):
        arr, dep = get_effective_stop_timestamps(stop, app_data.corrections)
        st_name = stations_map.get(stop.station_id).name if stop.station_id in stations_map else f"Station #{stop.sequence}"
        
        dwell_seconds = None
        dwell_formatted = None
        if arr and dep and dep >= arr:
            dwell_seconds = round((dep - arr).total_seconds(), 0)
            mins = int(dwell_seconds // 60)
            secs = int(dwell_seconds % 60)
            dwell_formatted = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
            
        segment_duration_seconds = None
        segment_duration_formatted = None
        segment_delay_seconds = None
        
        if prev_dep and arr and arr >= prev_dep and not stop.is_skipped:
            seg_sec = round((arr - prev_dep).total_seconds(), 0)
            segment_duration_seconds = seg_sec
            mins = int(seg_sec // 60)
            secs = int(seg_sec % 60)
            segment_duration_formatted = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
            
            # Delay vs historical segment average (Q6)
            if prev_station_id:
                seg_key = f"{prev_station_id}-->{stop.station_id}"
                hist_avg_sec = hist_avg_map.get(seg_key)
                if hist_avg_sec:
                    seg_delay = seg_sec - hist_avg_sec
                    segment_delay_seconds = round(seg_delay, 0)
                    cumulative_delay_seconds += seg_delay
                    
        stop_details.append({
            "stop_id": stop.id,
            "station_id": stop.station_id,
            "station_name": st_name,
            "sequence": stop.sequence,
            "is_skipped": stop.is_skipped,
            "arrived_at": stop.arrived_at,
            "departed_at": stop.departed_at,
            "effective_arrived_at": arr.isoformat() if arr else None,
            "effective_departed_at": dep.isoformat() if dep else None,
            "dwell_seconds": dwell_seconds,
            "dwell_formatted": dwell_formatted,
            "segment_duration_seconds": segment_duration_seconds,
            "segment_duration_formatted": segment_duration_formatted,
            "segment_delay_seconds": segment_delay_seconds,
            "notes": stop.notes,
        })
        
        if not stop.is_skipped and dep:
            prev_dep = dep
            prev_station_id = stop.station_id
            
    # Total actual duration
    total_duration_seconds = None
    if sorted_stops and not sorted_stops[0].is_skipped and not sorted_stops[-1].is_skipped:
        first_arr, first_dep = get_effective_stop_timestamps(sorted_stops[0], app_data.corrections)
        last_arr, last_dep = get_effective_stop_timestamps(sorted_stops[-1], app_data.corrections)
        start = first_dep or first_arr
        end = last_arr or last_dep
        if start and end and end >= start:
            total_duration_seconds = round((end - start).total_seconds(), 0)
            
    # Scheduled delay comparison
    scheduled_departure = None
    sched_delay_seconds = None
    if session.scheduled_departure_id:
        for sch in app_data.schedules:
            for dep in sch.departures:
                if dep.id == session.scheduled_departure_id:
                    scheduled_departure = dep
                    break
        if scheduled_departure and sorted_stops:
            last_arr, _ = get_effective_stop_timestamps(sorted_stops[-1], app_data.corrections)
            sched_delay_seconds = get_delay_seconds(last_arr, scheduled_departure.arrival_time, session.date)
            
    return {
        "session_id": session.id,
        "stops": stop_details,
        "total_duration_seconds": total_duration_seconds,
        "scheduled_departure": {
            "departure_time": scheduled_departure.departure_time if scheduled_departure else None,
            "arrival_time": scheduled_departure.arrival_time if scheduled_departure else None,
            "label": scheduled_departure.label if scheduled_departure else None
        } if scheduled_departure else None,
        "scheduled_delay_seconds": sched_delay_seconds,
        "cumulative_delay_seconds": round(cumulative_delay_seconds, 0)
    }

# Q9: Program Progress
def calculate_program_progress(app_data: AppData) -> Dict[str, Any]:
    total_sessions = len(app_data.sessions)
    complete_sessions = sum(1 for s in app_data.sessions if s.status == "COMPLETE")
    incomplete_sessions = sum(1 for s in app_data.sessions if s.status == "INCOMPLETE")
    conflict_sessions = sum(1 for s in app_data.sessions if s.status == "CONFLICT")
    
    target_days = app_data.target_program_days or 30
    
    # Calculate days elapsed since earliest session date or rest day
    dates_with_activity = set()
    for s in app_data.sessions:
        dates_with_activity.add(s.date)
    for r in app_data.rest_days:
        dates_with_activity.add(r.date)
        
    sorted_dates = sorted(list(dates_with_activity))
    
    if sorted_dates:
        try:
            earliest = datetime.strptime(sorted_dates[0], "%Y-%m-%d")
            today = datetime.now()
            days_elapsed = max(1, (today - earliest).days + 1)
        except Exception:
            days_elapsed = len(sorted_dates)
    else:
        days_elapsed = 0
        
    days_remaining = max(0, target_days - complete_sessions)
    completion_pct = min(100.0, round((complete_sessions / target_days) * 100, 1)) if target_days > 0 else 0
    
    # Calculate streak (consecutive calendar days with complete session)
    complete_dates = sorted(list({s.date for s in app_data.sessions if s.status == "COMPLETE"}))
    streak = 0
    if complete_dates:
        # Check from most recent backwards
        try:
            date_objs = [datetime.strptime(d, "%Y-%m-%d").date() for d in complete_dates]
            today_date = datetime.now(timezone.utc).date()
            # If latest is today or yesterday
            if date_objs[-1] >= today_date - timedelta(days=1):
                streak = 1
                curr = date_objs[-1]
                for d in reversed(date_objs[:-1]):
                    if d == curr - timedelta(days=1):
                        streak += 1
                        curr = d
                    else:
                        break
        except Exception:
            streak = len(complete_dates)
            
    return {
        "target_days": target_days,
        "total_sessions": total_sessions,
        "complete_sessions": complete_sessions,
        "incomplete_sessions": incomplete_sessions,
        "conflict_sessions": conflict_sessions,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "completion_pct": completion_pct,
        "streak": streak
    }
