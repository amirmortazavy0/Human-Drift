# Human Drift — R&D Work Logger

An R&D prototype investigating plan-execution drift by preserving intention, logging reality, and maintaining continuity of meaning across flexible work hierarchies.

## Architecture
- **Server**: Node.js & Express (`server.ts`), serving REST APIs and Vite single-page application on port 3000.
- **Client**: React 18 with TypeScript and Tailwind CSS.
- **Persistence**: Single JSON file storage with atomic temp-file writes, automated rolling backups, and append-only event log audit trail at `backend/data/human_drift.json`.

## Quick Start

### Windows
```cmd
start.bat
```

### Linux / macOS
```bash
chmod +x start.sh
./start.sh
```

### Development
```bash
npm run dev
```

The application is accessible in your browser at `http://localhost:3000`.

## Architectural Decisions
- **Decision 1**: Gap-time between session entries defaults to first-class `Unclassified Context Pause` intervals rather than speculative "overhead" or "slack".
- **Decision 2**: A Session belongs to exactly one Journey. Crossing journeys creates linked predecessor/successor sessions preserving structural integrity.
