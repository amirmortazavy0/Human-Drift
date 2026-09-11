# Human Drift — Train Performance Study

A full-stack train commute tracking and performance study web application.
The laptop is a permanent server. The phone is the client accessing via local WiFi.
All data is stored in a single JSON file on disk at `backend/data/human_drift.json`.

## Requirements
- Python 3.12+
- Node.js 18+

## Run
```bash
chmod +x start.sh
./start.sh
```

## Access
- Laptop: `http://localhost:8000`
- Phone (same WiFi): `http://[your-laptop-ip]:8000`

## Data
All data saved to: `backend/data/human_drift.json`
Back up by copying that file.
Export from the app: Settings → Export Data

## Stop
`Ctrl+C` in the terminal
