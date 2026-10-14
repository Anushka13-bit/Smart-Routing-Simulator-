# Smart Routing Simulator — Backend (FastAPI)

A high-performance Python FastAPI backend simulation engine for the **Smart Routing Simulator — Compare Routing Algorithms** college Computer Networks project.

The backend simulates dynamic routing protocols on a 5-node router topology (R1–R5) with configurable link metrics (bandwidth, delay, congestion) and supports link cuts/restorations in real time.

> **Disclaimer**: This backend is a custom software simulator designed for education and protocol comparison. It does not interface with or automate Cisco Packet Tracer, which is used separately for RIP and OSPF hardware demonstrations.

---

## 1. Prerequisites

- **Python 3.11+** (Python 3.11, 3.12, 3.13, or 3.14)
- **pip** package manager
- **Node.js 18+** & **npm** (for running the frontend)

---

## 2. Installation & Setup

### A. Windows Installation

Open Command Prompt or PowerShell:

```powershell
# Navigate to project backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On PowerShell:
.\venv\Scripts\Activate.ps1
# Or on CMD:
.\venv\Scripts\activate.bat

# Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Copy environment variables
copy .env.example .env
```

### B. macOS / Linux Installation

Open Terminal:

```bash
# Navigate to project backend
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
```

---

## 3. Running the Backend Server

With the virtual environment activated:

```bash
# From the backend directory:
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Backend Base URL**: `http://127.0.0.1:8000`
- **Interactive Swagger Documentation**: `http://127.0.0.1:8000/docs`
- **ReDoc Interactive Reference**: `http://127.0.0.1:8000/redoc`

---

## 4. Connecting the Existing Frontend

1. Ensure the backend is running on `http://127.0.0.1:8000`.
2. In a separate terminal, navigate to the project root:
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.
4. In the top navigation bar, toggle the mode switch from **Demo Mode** to **API Mode (FastAPI)**.
   - The indicator will turn green (`CONNECTED TO FASTAPI`).
   - The frontend will automatically pull live topology and dispatch all route computations, comparisons, link cuts, and metrics updates to the Python backend!

---

## 5. Running Automated Tests

Run the test suite using pytest:

```bash
# From the backend directory with venv activated:
pytest tests -v

# Or from the project root:
PYTHONPATH=backend ./backend/venv/bin/pytest backend/tests -v
```

---

## 6. Architecture & Directory Structure

```text
backend/
├── app/
│   ├── main.py                    # FastAPI application, CORS, router mounting
│   ├── api/
│   │   ├── routes.py              # POST /api/route, GET /api/health, GET /api/route/explain
│   │   ├── topology.py            # GET /api/topology, POST /api/reset, POST /api/topology/reset
│   │   ├── links.py               # Link fail/restore and metric updates
│   │   ├── comparison.py          # POST /api/compare (all 4 algorithms)
│   │   └── routing_tables.py      # GET /api/routers/{id}/routing-table
│   ├── algorithms/
│   │   ├── dijkstra.py            # Dijkstra SPF using priority queue (heapq)
│   │   ├── bellman_ford.py        # Bellman-Ford |V|-1 passes + negative cycle detection
│   │   ├── distance_vector.py     # Educational distributed DV (Bellman-Ford equation)
│   │   └── link_state.py          # OSPF simulation: Hello + LSA flooding + LSDB + SPF
│   ├── services/
│   │   ├── cost_service.py        # Weighted dimensionless composite cost formula
│   │   ├── topology_service.py    # Thread-safe in-memory topology state management
│   │   └── routing_service.py     # High-level routing orchestrator & explanations
│   ├── models/
│   │   └── schemas.py             # Pydantic v2 validation models matching TypeScript types
│   ├── utils/
│   │   └── graph_utils.py         # Adjacency builder, path reconstruction, path metrics
│   └── data/
│       └── default_topology.json  # Nominal 5-router 6-link default topology
├── tests/
│   ├── test_dijkstra.py           # Dijkstra unit tests
│   ├── test_bellman_ford.py       # Bellman-Ford unit tests
│   ├── test_distance_vector.py    # Distance Vector unit tests
│   ├── test_link_state.py         # Link State unit tests
│   ├── test_link_failures.py      # Failure, restore, and metric modification tests
│   └── test_api.py                # Full HTTP API integration test suite
├── requirements.txt               # Pinned dependencies
├── .env.example                   # Environment variable template
└── README.md                      # Backend documentation
```

---

## 7. Cost Calculation Formula

The cost service calculates a dimensionless composite metric in the range `[0, 1]` for each link:

```text
bandwidth_penalty  = 1 - (bandwidth_mbps / MAX_BW)
delay_penalty      = delay_ms / MAX_DELAY
congestion_penalty = congestion_percent / 100

link_cost = (0.4 * bandwidth_penalty) + (0.3 * delay_penalty) + (0.3 * congestion_penalty)
```

- **Bandwidth**: Measured in Mbps (`> 0`). Default maximum normalizer: `1000 Mbps`. Higher bandwidth decreases cost.
- **Delay**: Measured in milliseconds (`>= 0`). Default maximum normalizer: `100 ms`. Lower delay decreases cost.
- **Congestion**: Measured in percentage (`0% – 100%`). Lower congestion decreases cost.
- **Consistency**: Normalization is deterministic and applied universally across all routing algorithms.

---

## 8. Routing Algorithms Explained

### 1. Dijkstra's Algorithm
- **Category**: Link-State / Single-Source Shortest Path.
- **Protocol Analogy**: OSPF, IS-IS.
- **Complexity**: $O((V + E) \log V)$ time, $O(V)$ space.
- **Logic**: Uses a min-priority queue (`heapq`) to greedily expand the closest unvisited router, relaxing adjacent edges until the destination is reached. Guaranteed optimal for non-negative weights.

### 2. Bellman-Ford Algorithm
- **Category**: Dynamic Programming / Edge Relaxation.
- **Protocol Analogy**: RIP theoretical foundation.
- **Complexity**: $O(V \times E)$ time, $O(V)$ space.
- **Logic**: Systematically relaxes every active edge in the network $|V| - 1$ times. Employs early termination when no distances change during a pass and includes a final verification pass for negative-weight cycle detection.

### 3. Distance Vector Protocol Simulation
- **Category**: Decentralized Neighbor Exchange.
- **Protocol Analogy**: RIP v1/v2, IGRP.
- **Complexity**: $O(\text{Iterations} \times E)$ time, $O(V \times \text{Neighbors})$ space.
- **Logic**: Each router initializes its distance vector with direct neighbors. Routers iteratively broadcast their vectors to immediate peers, applying the Bellman-Ford equation:
  $$D_x(y) = \min_v \{ c(x, v) + D_v(y) \}$$
  Includes hop tracking, loop avoidance, message counters, and a convergence round ceiling.

### 4. Link State Protocol (OSPF Simulation)
- **Category**: Synchronized Topology Map + Local SPF.
- **Protocol Analogy**: OSPF RFC 2328.
- **Complexity**: Flooding $O(E)$ + Local SPF $O((V + E) \log V)$.
- **Logic**: Distinct from raw Dijkstra. Emulates neighbor discovery (OSPF Hello) and reliable Link State Advertisement (LSA) flooding. Each router constructs an identical Link State Database (LSDB) representing the global map, then executes SPF independently.

---

## 9. REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend status check (`online: true`, `version`) |
| `GET` | `/api/topology` | Current routers, links, parameters, and costs |
| `POST` | `/api/route` | Compute single route (`dijkstra`, `bellman-ford`, `distance-vector`, `link-state`) |
| `POST` | `/api/compare` | Run all 4 algorithms on current snapshot and compare metrics |
| `POST` | `/api/links/{id}/fail` | Break a network link (status -> `failed`) |
| `POST` | `/api/links/{id}/restore` | Restore a broken link (status -> `active`) |
| `PUT` | `/api/links/{id}/metrics` | Update bandwidth, delay, congestion; recalculates cost |
| `PATCH`| `/api/links/{id}` | Update link metrics (spec alias) |
| `GET` | `/api/routers/{id}/routing-table` | Inspect forwarding table for router (interfaces & next hops) |
| `GET` | `/api/routing-table/{id}` | Routing table (spec alias) |
| `POST` | `/api/reset` | Restore initial 5-router default topology (frontend alias) |
| `POST` | `/api/topology/reset` | Restore initial default topology (spec alias) |
| `GET` | `/api/route/explain` | Detailed educational route selection explanation |

---

## 10. Known Limitations

- **In-Memory Topology State**: Graph mutations and link cuts are stored in-memory per server process; restarting the server restores default topology. Persistent database storage (e.g. SQLite/PostgreSQL) can be added by implementing a persistent storage backend in `topology_service.py`.
- **High-Resolution Timer Resolution**: Execution times for small 5-node graphs are measured in sub-milliseconds ($< 0.5\text{ ms}$). Measurements may exhibit small CPU-scheduling jitter on different machines.
