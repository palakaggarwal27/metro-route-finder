#ifndef METRO_ROUTE_H
#define METRO_ROUTE_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <limits.h>

/* ===========================
   1. CONSTANTS & LIMITS
   ============================= */
#define MAX_STATIONS        350     // Safe capacity for ~260 unique Delhi metro stations
#define MAX_NAME_LEN        64      // Max length of a station name (e.g. "Netaji Subhash Place")
#define MAX_LINE_LEN        32      // Max length of a line name (e.g. "Pink Line")
#define MAX_PATH_NODES      100     // A route will never exceed 100 stations
#define INF                 1e9f    // Large number representing infinity for Dijkstra
#define JSON_BUFFER_SIZE    16384   // 16 KB buffer for the output JSON string to JS


/* =======================
   2. DATA STRUCTURES
   ======================= */

// Represents one connected neighbor in the Adjacency List
struct EdgeNode {
    int dest_id;                         // Target station ID (0 to total_stations - 1)
    float distance;                      // Track distance in km
    char line_name[MAX_LINE_LEN];        // e.g. "Red Line"
    char line_color[MAX_LINE_LEN];       // e.g. "Red"
    struct EdgeNode *next;               // link to neigbour
};

// Represents the output of Dijkstra pathfinding
struct RouteResult {
    bool found;                          // true if a path exists, false otherwise
    int path[MAX_PATH_NODES];            // Ordered list of station IDs from src to dest
    char lines_used[MAX_PATH_NODES][MAX_LINE_LEN]; // Which line was used between stations
    char line_colors_used[MAX_PATH_NODES][MAX_LINE_LEN]; // Line colors used
    int path_len;                        // Number of stations in the route
    float total_distance;                // Total track distance in km
    int total_interchanges;              // Count of line switches (e.g. Red -> Pink)
};


/* ============================================
   3. GLOBAL STATE / GRAPH STORAGE
   ===========================================*/
extern char station_names[MAX_STATIONS][MAX_NAME_LEN]; // Station ID -> Station Name lookup
extern int total_stations;                             // Counter of unique registered stations
extern struct EdgeNode *adj[MAX_STATIONS];             // Adjacency List (Array of Linked Lists)
extern char result_json[JSON_BUFFER_SIZE];             // Buffer returned across Wasm to JS


/* ============================================== 
   4. FUNCTION PROTOTYPES
   ============================================== */

/* --- Category A: Station ID Management --- */

/**
 * Looks up a station name. If already present, returns its existing ID.
 * If not present, registers it in `station_names` and returns the new ID.
 */
int get_or_create_station_id(const char *name);

/**
 * Looks up a station name. Returns its ID if found, or -1 if not found.
 */
int find_station_id(const char *name);

/**
 * Returns the station name for a given ID.
 */
const char* get_station_name(int station_id);


/* --- Category B: Graph Initialization & Construction --- */

/*Sets all head pointers in `adj[]` to NULL and resets `total_stations = 0`.
 */
void init_graph(void);

/**
 * Adds a one-way edge from station `u` to station `v`.
 */
void add_directed_edge(int u, int v, float distance, const char *line_name, const char *line_color);

/**
 * Adds a bidirectional track connection (calls add_directed_edge for both u->v and v->u).
 */
void add_edge(int u, int v, float distance, const char *line_name, const char *line_color);

/**
 * Reads the CSV file line by line, registers stations, and calls add_edge().
 * Returns total edges loaded, or -1 on file error.
 */
int load_metro_data(const char *csv_filepath);


/* --- Category C: Dijkstra Algorithm & Pathfinding --- */

/**
 * Helper: Finds the unvisited station with the smallest tentative distance.
 */
int get_min_distance_station(const float dist[], const bool visited[]);

/**
 * Runs Dijkstra's algorithm from `src_id` to `dest_id`.
 * Adds `interchange_penalty_km` whenever the line changes between segments.
 * fills the `result` struct with the path, distance, and interchanges.
 */
void run_dijkstra(int src_id, int dest_id, float interchange_penalty_km, struct RouteResult *result);


/* --- Category D: JSON Formatting & WebAssembly (Wasm) Export --- */

/**
 * Formats a `struct RouteResult` into a JSON string and writes it to `output_buffer`.
 */
void route_to_json(const struct RouteResult *result, char *output_buffer, int max_size);

/**
 * Main WebAssembly Entry Point:
 * Called directly from JavaScript via `Module.ccall()`
 * Takes station names as strings, runs Dijkstra, and returns a JSON string.
 */
const char* find_metro_route(const char *src_name, const char *dest_name, float interchange_penalty);

/**
 * Helper for WebAssembly:
 * Returns a JSON array of all station names (e.g. ["Rithala", "Rohini West", ...])
 * so JavaScript can automatically fill `<select>` dropdowns or autocomplete!
 */
const char* get_all_stations_json(void);

#endif // METRO_ROUTE_H