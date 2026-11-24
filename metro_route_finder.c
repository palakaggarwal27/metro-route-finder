#include "metro_route_finder.h"
#include <stdio.h>
#include <string.h>

char station_names[MAX_STATIONS][MAX_NAME_LEN];
int total_stations = 0;
struct EdgeNode *adj[MAX_STATIONS];
char result_json[JSON_BUFFER_SIZE];
struct RouteResult route_result;


int get_or_create_station_id(const char *name) {
    // Check if the station already exists
    for (int i = 0; i < total_stations; i++) {
        if (strcmp(station_names[i], name) == 0) {
            return i; // Return existing ID
        }
    }

    // If not found, create a new station entry
    if (total_stations < MAX_STATIONS) {
        strcpy(station_names[total_stations], name);
        return total_stations++; // Return new ID and increment total_stations
    } else {
        fprintf(stderr, "Error: Maximum number of stations reached.\n");
        return -1; // Indicate error
    }
}


int find_station_id(const char *name) {
    for (int i = 0; i < total_stations; i++) {
        if (strcmp(station_names[i], name) == 0) {
            return i; // Return the station ID if found
        }
    }
    return -1; // Return -1 if not found
}

const char* get_station_name(int station_id) {
    if (station_id >= 0 && station_id < total_stations) {
        return station_names[station_id];
    }
    return NULL; // Return NULL if the station ID is invalid
}



void add_directed_edge(int u, int v, float distance, const char *line_name, const char *line_color) {
    struct EdgeNode *new_node = (struct EdgeNode *)malloc(sizeof(struct EdgeNode));
    if (!new_node) {
        fprintf(stderr, "Memory allocation failed for edge node.\n");
        return;
    }
    new_node->dest_id = v;
    new_node->distance = distance;
    strcpy(new_node->line_name, line_name);
    strcpy(new_node->line_color, line_color);
    new_node->next = adj[u];
    adj[u] = new_node; // Insert at the head of the list
}

void add_edge(int u, int v, float distance, const char *line_name, const char *line_color) {
    //for birectional edges
    add_directed_edge(u, v, distance, line_name, line_color);
    add_directed_edge(v, u, distance, line_name, line_color); 

}

int load_metro_data(const char *csv_filepath) {
    FILE *file = fopen(csv_filepath, "r");
    if (!file) {
        fprintf(stderr, "Error opening file: %s\n", csv_filepath);
        return -1; // Indicate file error
    }

    char line[256];
    int edge_count = 0;
    fgets(line, sizeof(line), file);

    while (fgets(line, sizeof(line), file)) {
        char station1[MAX_NAME_LEN], station2[MAX_NAME_LEN], line_name[MAX_LINE_LEN], line_color[MAX_LINE_LEN];
        float distance;

        // Parse the CSV line
        if (sscanf(line, "%63[^,],%63[^,],%31[^,],%31[^,],%f",
                   station1, station2, line_color, line_name, &distance) == 5) {
            int id1 = get_or_create_station_id(station1);
            int id2 = get_or_create_station_id(station2);

            if (id1 != -1 && id2 != -1) {
                add_edge(id1, id2, distance, line_name, line_color);
                edge_count++;
            }
        }
    }

    fclose(file);
    return edge_count; // Return total edges loaded
}

int get_min_distance_station(const float distances[], const bool visited[]) {
    float min_distance = INF;
    int min_index = -1;

    for (int i = 0; i < total_stations; i++) {
        if (!visited[i] && distances[i] < min_distance) {
            min_distance = distances[i];
            min_index = i;
        }
    }

    return min_index;
}

void run_dijkstra(int src_id, int dest_id, float interchange_penalty_km, struct RouteResult *result) {
    float distances[MAX_STATIONS];
    bool visited[MAX_STATIONS] = {false};
    int previous[MAX_STATIONS];
    char previous_line[MAX_STATIONS][MAX_LINE_LEN];

    for (int i = 0; i < total_stations; i++) {
        distances[i] = INF;
        previous[i] = -1;
        previous_line[i][0] = '\0'; // Initialize line name to empty
    }

    distances[src_id] = 0;

    for (int count = 0; count < total_stations - 1; count++) {
        int u = get_min_distance_station(distances, visited);
        if (u == -1) break; // All reachable stations have been visited
        visited[u] = true;

        struct EdgeNode *neighbor = adj[u];
        while (neighbor != NULL) {
            int v = neighbor->dest_id;
            float distance_via_u = distances[u] + neighbor->distance;

            // Check for line change and add interchange penalty if necessary
            if (previous_line[u][0] != '\0' && strcmp(previous_line[u], neighbor->line_name) != 0) {
                if (strstr(previous_line[u], "Walkway") == NULL) {
                    distance_via_u += interchange_penalty_km;
                }
            }

            if (!visited[v] && distance_via_u < distances[v]) {
                distances[v] = distance_via_u;
                previous[v] = u;
                strcpy(previous_line[v], neighbor->line_name);
            }
            neighbor = neighbor->next;
        }
    }

    // Build the result path
    result->total_interchanges = 0;
    result->path_len = 0;

    for (int v = dest_id; v != -1; v = previous[v]) {
        if (result->path_len >= MAX_PATH_NODES) {
            break;
        }
        result->path[result->path_len++] = v;
    }

    // Reverse the path to get it from source to destination
    for (int i = 0; i < result->path_len / 2; i++) {
        int temp = result->path[i];
        result->path[i] = result->path[result->path_len - 1 - i];
        result->path[result->path_len - 1 - i] = temp;
    }

    float actual_distance = 0.0f;
    result->lines_used[0][0] = '\0';
    result->line_colors_used[0][0] = '\0';
    for (int i = 0; i + 1 < result->path_len; i++) {
        const char *segment_line = NULL;
        const char *segment_color = NULL;
        struct EdgeNode *neighbor = adj[result->path[i]];
        while (neighbor != NULL) {
            if (neighbor->dest_id == result->path[i + 1]) {
                segment_line = neighbor->line_name;
                segment_color = neighbor->line_color;
                actual_distance += neighbor->distance;
                break;
            }
            neighbor = neighbor->next;
        }

        if (segment_line != NULL) {
            strcpy(result->lines_used[i], segment_line);
            strcpy(result->line_colors_used[i], segment_color ? segment_color : "Standard");
            if (i > 0 && strcmp(result->lines_used[i], result->lines_used[i - 1]) != 0) {
                if (strstr(result->lines_used[i - 1], "Walkway") == NULL) {
                    result->total_interchanges++;
                }
            }
        } else {
            result->lines_used[i][0] = '\0';
            result->line_colors_used[i][0] = '\0';
        }
    }

    result->total_distance = actual_distance;
    result->found = (distances[dest_id] != INF);
}

void route_to_json(const struct RouteResult *result, char *output_buffer, int max_size){
    if (!result->found) {
        snprintf(output_buffer, max_size, "{\n  \"found\": false,\n  \"message\": \"No path found between selected stations.\"\n}");
        return;
    }

    int offset = snprintf(output_buffer, max_size, 
        "{\n  \"found\": true,\n  \"total_distance_km\": %.2f,\n  \"num_interchanges\": %d,\n  \"stations\": [\n", 
        result->total_distance, result->total_interchanges);

    for (int i = 0; i < result->path_len; i++) {
        int st_id = result->path[i];
        const char *st_name = (st_id >= 0 && st_id < total_stations) ? station_names[st_id] : "Unknown";
        const char *line = (i < result->path_len - 1) ? result->lines_used[i] : (i > 0 ? result->lines_used[i - 1] : "");
        const char *color = (i < result->path_len - 1) ? result->line_colors_used[i] : (i > 0 ? result->line_colors_used[i - 1] : "");

        offset += snprintf(output_buffer + offset, max_size - offset,
            "    {\"id\": %d, \"name\": \"%s\", \"line\": \"%s\", \"color\": \"%s\"}%s\n",
            st_id, st_name, line, color, (i < result->path_len - 1) ? "," : "");
    }
    snprintf(output_buffer + offset, max_size - offset, "  ]\n}");
}

const char *find_metro_route(const char *src_name, const char *dest_name, float interchange_penalty){
    if (total_stations == 0) {
        init_graph();
        load_metro_data("delhi_metro_edges.csv");
    }

    int src_id = find_station_id(src_name);
    int dest_id = find_station_id(dest_name);
    if (src_id == -1 || dest_id == -1) {
        snprintf(result_json, sizeof(result_json), "{ \"found\": false, \"error\": \"Invalid station name(s)\" }");
        return result_json;
    }
    run_dijkstra(src_id, dest_id, interchange_penalty, &route_result);
    route_to_json(&route_result, result_json, sizeof(result_json));
    return result_json;
}

const char *get_all_stations_json(void){
    if (total_stations == 0) {
        init_graph();
        load_metro_data("delhi_metro_edges.csv");
    }

    char *ptr = result_json;
    ptr += sprintf(ptr, "[");
    for (int i = 0; i < total_stations; i++) {
        if (i > 0) {
            ptr += sprintf(ptr, ", ");
        }
        ptr += sprintf(ptr, "\"%s\"", station_names[i]);
    }
    sprintf(ptr, "]");
    return result_json;
}



void init_graph(void){ 
    
    for (int i = 0; i < MAX_STATIONS; i++) {
        adj[i] = NULL; // Initialize adjacency list heads to NULL
    }
    total_stations = 0; // Reset the total stations counter

}

int main(void) {
    init_graph();
    int edges = load_metro_data("delhi_metro_edges.csv");
    if (edges < 0) {
        return 1;
    }
    return 0;
}



