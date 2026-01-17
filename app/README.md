# VaultHealth - Local-First Health Data Dashboard

> "Own your health data. Understand it. Improve it."

VaultHealth is a privacy-first health data dashboard that runs entirely in your browser. Import your sleep and workout data from various sources, and gain insights without your data ever leaving your device.

## Features

### Phase 1 (Current)
- **Import Data**: Eight Sleep JSON, Orangetheory CSV, and generic CSV/JSON files
- **Sleep Dashboard**: Duration, quality, stages, HR/HRV trends with Chart.js
- **Data Quality**: Outlier detection, sensor glitch flagging, baseline calculations
- **Privacy First**: All data stored in browser IndexedDB, zero server calls

### Coming Soon
- Oura Ring integration
- Apple Health XML import
- Workout ↔ Sleep correlation analysis
- Experiment engine ("try this for 7 days, measure impact")
- Weekly AI-generated insights summary

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
cd app
npm install
npm run dev
```

Then open http://localhost:3000

### Building for Production

```bash
npm run build
```

The built files will be in `dist/`. You can serve these with any static file server.

## Data Sources

### Eight Sleep
1. Open the Eight Sleep app
2. Go to Profile → Data Export → Request Export
3. Download the JSON file when ready
4. Import into VaultHealth

### Orangetheory
1. Email privacy@orangetheory.com with a DSAR request
2. Wait for them to send your data (usually a CSV)
3. Import the CSV into VaultHealth

### Generic CSV
VaultHealth can import any CSV with columns for:
- Date (required)
- Sleep duration, stages, etc.
- Heart rate, HRV, etc.
- Workout type, duration, calories, etc.

You'll be prompted to map columns to our canonical schema.

## Architecture

```
app/
├── src/
│   ├── types/          # TypeScript type definitions
│   │   └── schema.ts   # Canonical data schema
│   ├── db/             # IndexedDB layer
│   │   └── database.ts # CRUD operations
│   ├── importers/      # Data import pipeline
│   │   ├── pipeline.ts # Main import orchestration
│   │   ├── eightSleep.ts
│   │   ├── orangetheory.ts
│   │   └── generic.ts
│   ├── insights/       # Analysis and quality
│   │   └── dataQuality.ts
│   ├── workers/        # Web Workers for heavy processing
│   │   └── fileProcessor.worker.ts
│   └── components/     # React components
│       ├── Dashboard.tsx
│       ├── ImportPage.tsx
│       ├── DataQualityPage.tsx
│       └── SettingsPage.tsx
└── public/
```

## Privacy & Security

- **100% Local**: All data stays in your browser's IndexedDB
- **No Server**: We don't have a backend. Nothing is transmitted.
- **No Tracking**: No analytics, no cookies, no telemetry
- **Your Control**: Export or delete all data anytime

## Disclaimer

VaultHealth provides **wellness insights only**. This is not medical advice.
Always consult healthcare professionals for medical decisions.

## License

MIT - Use freely for personal or commercial purposes.
