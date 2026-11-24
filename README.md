# Delhi Metro Route Finder & Navigation Engine 🚇

> **Academic Project:** Data Structures and Algorithms Laboratory  
> **Institution:** Maharaja Surajmal Institute of Technology (MSIT), GGSIPU, New Delhi  
> **Author:** Palak Aggarwal  

An optimized Delhi-NCR Metro route planner and journey navigator built in **C**, utilizing **Dijkstra's Algorithm** with an **Adjacency List** graph representation, compiled directly to **WebAssembly (Wasm)** for high-performance in-browser routing.

---

## 📌 Project Overview

This project was developed as an end-to-end Data Structures assignment to model the entire Delhi-NCR mass transit rail network (over 275+ unique stations across 13 line corridors, including DMRC lines, Noida-Greater Noida Aqua Line, Rapid Metro Gurugram, and the Airport Express Line).

### Key Highlights:
- **Core Engine in C:** High-efficiency implementation using an Adjacency List of singly linked lists (`struct EdgeNode`).
- **Dijkstra Algorithm with Transfer Penalties:** Minimizes physical track distances while modeling real-world commuter friction during line interchanges.
- **Single-Interchange Walkway Modeling:** Accurately connects the Blue Line and Aqua Line via the 300-meter pedestrian walkway at Noida Sector 52 ⇄ Sector 51 without double-penalizing line switches.
- **Official Fare Matrix:** Exact multi-operator fare calculator accounting for standard DMRC distance slabs (₹11 to ₹64), NMRC Aqua Line station slabs (₹10 to ₹50), and Rapid Metro add-ons.
- **WebAssembly (Wasm) Integration:** Compiles C directly to WebAssembly (`metro.wasm` + `metro.js`) to run instantaneous sub-millisecond route calculations client-side in the browser.
- **Human-Centric Web UI:** Searchable input with station autocomplete, clear buttons, station swap, and dual-mode route comparison (Recommended Direct Route vs Alternative Shortest Route).

---

## 📊 Dataset & Graph Source

The routing engine operates on the track-calibrated Delhi-NCR metro network graph dataset:

| File Name | Format | Description | Direct Link / Download |
| :--- | :---: | :--- | :---: |
| **`delhi_metro_edges.csv`** | CSV (5 cols) | **Primary Graph Dataset:** 293 direct bidirectional track edges with station pairs, line colors, line names, and distances. Includes the Blue-Aqua walkway and Pink Line circular loop. | [Download delhi_metro_edges.csv](./delhi_metro_edges.csv) |

### Dataset Structure (`delhi_metro_edges.csv`):
```csv
from_station,to_station,line_color,line_name,distance_km
Rithala,Rohini West,Red,Red Line,1.0
Rohini West,Rohini East,Red,Red Line,1.2
Sector - 52 Noida,Noida Sector 51,Interchange Walkway,Blue-Aqua Walkway,0.3
Samaypur Badli,Rohini Sector 18-19,Yellow,Yellow Line,0.8
```

---

## 🛠️ Data Structures & Algorithms Utilized

1. **Adjacency List:**
   - Used as the primary graph representation to store metro stations and connecting track edges.
   - Stored as an array of head pointers (`adj[MAX_STATIONS]`) where each element points to a linked list of connected stations.
   - Provides an optimal space complexity of $\mathcal{O}(V + E)$ (using < 50 KB of RAM instead of an $\mathcal{O}(V^2)$ matrix).

2. **Linked List:**
   - Singly linked list (`struct EdgeNode`) used dynamically for each station in the adjacency list.
   - Each node contains the target station ID, track distance (in km), line name, line color, and a `*next` pointer.
   - Allows clean $\mathcal{O}(1)$ edge insertion when reading tracks from CSV.

3. **Array:**
   - **Station Lookup Array (`station_names[][]`):** 2D character array mapping unique integer station IDs to station names.
   - **Distance Array (`dist[]`):** Stores the shortest calculated path distance from the source station.
   - **Visited Array (`visited[]`):** Boolean flags to mark stations finalized during search.
   - **Predecessor Array (`previous[]`):** Stores parent indices to backtrack the exact station-by-station journey from destination to source in $\mathcal{O}(L)$ time.

4. **Dijkstra's Algorithm:**
   - Single-source shortest path algorithm implemented to find the optimal path across the metro network.
   - Adapted with transfer penalties to minimize train interchanges for a more commuter-friendly route.

---

## 🚀 Running the Project

### Option 1: Web Interface (WebAssembly)
To run the web application, start a local HTTP server in this directory (required for WebAssembly `.wasm` streaming):

```bash
# Using Python
python -m http.server 8080
```
Open **`http://localhost:8080`** in any web browser.

### Option 2: Native C CLI
You can also compile and run the engine directly from the command line using GCC:

```bash
gcc metro_route_finder.c -o metro_route_finder.exe
./metro_route_finder.exe
```

### Option 3: Recompiling to WebAssembly (Emscripten)
If you modify `metro_route_finder.c`, recompile using `emcc`:

```bash
emcc metro_route_finder.c -o metro.js \
  -s EXPORTED_FUNCTIONS="['_find_metro_route','_get_all_stations_json','_main']" \
  -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" \
  --preload-file delhi_metro_edges.csv \
  -O2
```
