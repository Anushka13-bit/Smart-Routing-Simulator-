# Smart Routing Simulator – Compare Routing Algorithms
**Computer Networks Laboratory Project • Interactive Visual Operations Center & FastAPI Engine**

An end-to-end computer networking simulation project that compares **Dijkstra's Shortest Path First**, **Bellman-Ford**, **Distributed Distance Vector (RIP)**, and **OSPF Link-State Protocol** on a 5-node router topology (R1–R5).

---

## 📁 Repository Structure

```text
Smart-Routing-Simulator-/
├── frontend/                      # React 19 + TypeScript + Vite UI
│   ├── src/                       # Components, topology canvas, hooks, types
│   ├── public/                    # Static assets and icons
│   ├── package.json               # Frontend dependencies & scripts
│   ├── vite.config.ts             # Vite bundler configuration
│   └── tailwind.config.js         # Cyber NOC Tailwind styling
├── backend/                       # Python 3.11+ FastAPI backend
│   ├── app/
│   │   ├── main.py                # FastAPI entrypoint, CORS, router mounting
│   │   ├── api/                   # REST endpoints (/route, /topology, /links, etc.)
│   │   ├── algorithms/            # Explicit Dijkstra, Bellman-Ford, DV, Link-State
│   │   ├── services/              # Topology state, cost formula, routing tables
│   │   ├── models/                # Pydantic schemas (aligned with frontend types)
│   │   ├── utils/                 # Graph utilities
│   │   └── data/                  # Default 5-router network topology
│   ├── tests/                     # Automated pytest suite (27 unit & API tests)
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Configurable environment variables
│   └── README.md                  # Detailed backend manual
└── README.md                      # Root project guide
```

---

## 🚀 Quick Start: Running the Entire Pipeline

### Step 1: Start the Backend (Terminal 1)

```bash
# Navigate to backend directory
cd backend

# Create & activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate       # On Windows PowerShell: .\venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Backend Base URL**: `http://127.0.0.1:8000`
- **Interactive Swagger Documentation**: `http://127.0.0.1:8000/docs`
- **Health Check**: `http://127.0.0.1:8000/api/health`

---

### Step 2: Start the Frontend (Terminal 2)

```bash
# Navigate to frontend directory
cd frontend

# Install frontend dependencies
npm install

# Start the Vite development server
npm run dev
```

- **Frontend URL**: `http://localhost:5173`

---

### Step 3: Connect Frontend to Backend

1. Open `http://localhost:5173` in your browser.
2. In the top navigation bar, toggle the switch from **Demo Mode** to **API Mode (FastAPI)**.
3. The status indicator turns green (`CONNECTED TO FASTAPI`).
4. All route computations, 4-way comparisons, link cuts, and QoS modifications will now execute through the FastAPI backend REST API.

---

## 🧪 Testing the Entire Pipeline

### 1. Automated Backend Tests (Pytest)

The backend includes 27 comprehensive tests covering all 4 routing algorithms, unreachable states, link failures, restorations, metric modifications, and REST API endpoints:

```bash
# From the backend directory with venv activated:
pytest tests -v

# Or from the project root:
PYTHONPATH=backend ./backend/venv/bin/pytest backend/tests -v
```

All 27 tests run in under 1 second.

---

### 2. End-to-End Pipeline Verification Steps

1. **Verify Backend Health**:
   ```bash
   curl http://127.0.0.1:8000/api/health
   # Response: {"online":true,"message":"Backend API is connected and healthy.","version":"1.0.0"}
   ```

2. **Verify Route Calculation**:
   ```bash
   curl -X POST http://127.0.0.1:8000/api/route \
     -H "Content-Type: application/json" \
     -d '{"source":"R1","destination":"R5","algorithm":"dijkstra"}'
   ```

3. **Verify 4-Way Algorithm Comparison**:
   ```bash
   curl -X POST http://127.0.0.1:8000/api/compare \
     -H "Content-Type: application/json" \
     -d '{"source":"R1","destination":"R5"}'
   ```

4. **Verify Dynamic Link Failure & Recalculation**:
   ```bash
   # Break link R4-R5
   curl -X POST http://127.0.0.1:8000/api/links/R4-R5/fail
   # Recompute route - R4-R5 will be avoided
   curl -X POST http://127.0.0.1:8000/api/route \
     -H "Content-Type: application/json" \
     -d '{"source":"R1","destination":"R5","algorithm":"dijkstra"}'
   # Restore link R4-R5
   curl -X POST http://127.0.0.1:8000/api/links/R4-R5/restore
   ```

5. **Verify Interactive UI in Browser**:
   - Navigate to the **Route Explorer** tab to trace step-by-step relaxation and view router forwarding tables.
   - Navigate to the **Algorithm Comparison** tab to view side-by-side execution time, hop count, and latency charts.
   - Navigate to the **Failure Simulation** tab to sever links and observe automatic traffic rerouting.
   - Navigate to the **Link Metrics** tab to tweak bandwidth, delay, and congestion values and view updated route costs in real time.
