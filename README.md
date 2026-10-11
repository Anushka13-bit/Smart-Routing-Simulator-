# Smart Routing Simulator – Compare Routing Algorithms
**Computer Networks Laboratory Project • Interactive Visual Operations Center**

A modern, presentation-grade web application built to simulate, visualize, and compare routing algorithms (**Dijkstra's Shortest Path First**, **Bellman-Ford**, **Distributed Distance Vector (RIP)**, and **OSPF Link-State Protocol**) on a 5-node autonomous mesh network.

---

## 🚀 Key Highlights & Architecture

- **5-Node Mesh Topology**: Routers **R1, R2, R3, R4, R5** with 6 physical links:
  - `R1 – R2` (Metric: 4, 1000 Mbps, 5ms)
  - `R2 – R3` (Metric: 2, 1000 Mbps, 3ms)
  - `R1 – R3` (Metric: 3, 1000 Mbps, 4ms)
  - `R1 – R4` (Metric: 7, 500 Mbps, 10ms)
  - `R4 – R5` (Metric: 2, 500 Mbps, 6ms)
  - `R3 – R5` (Metric: 5, 1000 Mbps, 8ms)
  - *Default Source*: **R1** • *Default Destination*: **R5**
- **Dual-Mode Architecture**:
  1. **Client Simulation Mode (Demo)**: Instant, zero-latency local execution of all 4 algorithms with live step-by-step traces, FIB routing table computation, and link failure rerouting.
  2. **FastAPI Real API Mode**: Centralized Axios client (`NetworkApiService`) communicating with a FastAPI backend at `http://127.0.0.1:8000` with live health monitoring and graceful failover.
- **Cyber NOC Design System**: Dark navy operations theme (`#070B14`), neon cyan/blue/violet glows, red dashed link failure states, animated SVG packet flow, and Recharts metric benchmarks.

---

## 🛠️ Technology Stack

- **Framework**: React 19 + TypeScript + Vite
- **Topology Graph**: `@xyflow/react` (React Flow 12) with custom interactive nodes and edges
- **Styling**: Tailwind CSS + Custom Cyber NOC theme (`shadow-glow-*`, radar pings, flow dashes)
- **Charts**: Recharts (Latency, Complexity, Message Exchange, Convergence passes)
- **Icons**: Lucide React
- **HTTP Client**: Axios

---

## 🖥️ Application Modules & Pages

1. **Dashboard**: High-level Network Operations Center overview, active links, route cost, latency, interactive endpoint switcher, and quick link cut toggles.
2. **Network Topology**: Interactive canvas with 5 router nodes (R1–R5), animated packet flow along the computed path, speed slider, zoom/pan controls, minimap, and click-to-inspect drawers for routers and links.
3. **Route Explorer**: Calculate routes between any router pair using any of the 4 algorithms. Inspect step-by-step relaxation/flooding traces and per-router Forwarding Information Bases (FIB routing tables).
4. **Algorithm Comparison**: Multi-algorithm side-by-side benchmark with execution time, metric cost, hop count, time/space complexity, protocol basis, and comparison bar charts.
5. **Failure Simulation**: Simulate fiber cuts, test failover resilience, inject pre-configured failure scenarios (e.g., Backbone Cut, Gateway Cut, Network Partition), and compare baseline vs degraded paths.
6. **Link Metrics (QoS Tuning)**: Adjust link weights (cost), latency (ms), bandwidth (Mbps), and congestion (%). Test QoS presets such as 10G fiber upgrades, satellite delay, and congestion spikes.
7. **Simulation History & Logs**: Complete session audit trail with export to JSON/CSV and one-click simulation replay.
8. **Theory & Complexity Modal**: Comprehensive educational documentation explaining algorithm pseudocode, Bellman-Ford equations, OSPF flooding, and Big-O complexities.

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm installed.

### 2. Installation
```bash
# Clone or navigate to the repository
cd cn-backend

# Install dependencies
npm install
```

### 3. Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 4. Production Build & Validation
```bash
npm run build
```
Creates an optimized, minified bundle in `dist/`.

---

## 🔌 FastAPI Backend Integration Reference

The frontend interacts with the backend using the endpoints below. When in **API Mode**, the application connects to `http://127.0.0.1:8000` (configurable via `VITE_API_BASE_URL` in `.env`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check (`{ online: true, version: "1.0.0" }`) |
| `GET` | `/api/topology` | Fetch current routers and link statuses |
| `POST` | `/api/route` | Compute route: `{ source: "R1", destination: "R5", algorithm: "dijkstra" }` |
| `POST` | `/api/compare` | Compare all 4 algorithms for a source and destination |
| `POST` | `/api/links/{link_id}/fail` | Mark link as failed |
| `POST` | `/api/links/{link_id}/restore` | Mark link as active |
| `PUT` | `/api/links/{link_id}/metrics` | Update link parameters (`cost`, `delayMs`, `bandwidthMbps`, `congestionPercent`) |
| `GET` | `/api/routers/{router_id}/routing-table` | Fetch FIB table for a specific router |
| `POST` | `/api/reset` | Reset network topology to factory defaults |

---

## 👥 Project Team & Notes
- **Frontend / UI & Simulation**: React + TypeScript + React Flow + Tailwind CSS.
- **Backend**: FastAPI (Python) REST services.
- **Validation**: Cisco Packet Tracer is maintained separately for network simulation validation.
