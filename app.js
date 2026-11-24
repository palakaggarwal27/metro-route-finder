let allStations = [];
let activeDirectRoute = null;
let activeShortestRoute = null;

function getBadgeClass(color) {
  if (!color) return 'badge-Grey';
  if (color.includes('Red')) return 'badge-Red';
  if (color.includes('Yellow')) return 'badge-Yellow';
  if (color.includes('Blue')) return 'badge-Blue';
  if (color.includes('Green')) return 'badge-Green';
  if (color.includes('Violet')) return 'badge-Violet';
  if (color.includes('Pink')) return 'badge-Pink';
  if (color.includes('Magenta')) return 'badge-Magenta';
  if (color.includes('Airport') || color.includes('Orange')) return 'badge-Airport';
  if (color.includes('Rapid')) return 'badge-Rapid';
  if (color.includes('Aqua')) return 'badge-Aqua';
  if (color.includes('Walkway')) return 'badge-Walkway';
  return 'badge-Grey';
}

function calculateDmrcFare(distanceKm, stationsList = []) {
  const dmrcStations = [];
  const aquaStations = [];
  const rapidStations = [];
  let usesAirportExpress = false;

  stationsList.forEach(s => {
    const line = s.line || "";
    if (line.includes("Aqua")) {
      aquaStations.push(s);
    } else if (line.includes("Rapid")) {
      rapidStations.push(s);
    } else if (line.includes("Airport")) {
      usesAirportExpress = true;
    } else if (!line.includes("Walkway")) {
      dmrcStations.push(s);
    }
  });

  // 1. DMRC Regular Component (Official Slabs up to max ₹64)
  let dmrcToken = 0;
  let dmrcCard = 0;

  if (dmrcStations.length > 0) {
    if (distanceKm <= 2) { dmrcToken = 11; dmrcCard = 10; }
    else if (distanceKm <= 5) { dmrcToken = 21; dmrcCard = 19; }
    else if (distanceKm <= 12) { dmrcToken = 32; dmrcCard = 29; }
    else if (distanceKm <= 21) { dmrcToken = 43; dmrcCard = 39; }
    else if (distanceKm <= 32) { dmrcToken = 54; dmrcCard = 49; }
    else { dmrcToken = 64; dmrcCard = 58; }
  } else if (usesAirportExpress) {
    if (distanceKm <= 12) dmrcToken = 40;
    else if (distanceKm <= 24) dmrcToken = 60;
    else dmrcToken = 75;
    dmrcCard = Math.round(dmrcToken * 0.9);
  }

  // 2. NMRC Aqua Line Component (Official Station-count based slab)
  let nmrcToken = 0;
  let nmrcCard = 0;
  const aquaCount = aquaStations.length;
  if (aquaCount > 0) {
    if (aquaCount <= 1) nmrcToken = 10;
    else if (aquaCount === 2) nmrcToken = 15;
    else if (aquaCount <= 6) nmrcToken = 20;
    else if (aquaCount <= 9) nmrcToken = 30;
    else if (aquaCount <= 16) nmrcToken = 40;
    else nmrcToken = 50;
    nmrcCard = Math.round(nmrcToken * 0.9);
  }

  // 3. Rapid Metro Gurugram Component
  let rapidToken = 0;
  let rapidCard = 0;
  const rapidCount = rapidStations.length;
  if (rapidCount > 0) {
    rapidToken = rapidCount <= 5 ? 20 : 35;
    rapidCard = Math.round(rapidToken * 0.9);
  }

  const totalToken = dmrcToken + nmrcToken + rapidToken;
  const totalCard = dmrcCard + nmrcCard + rapidCard;

  let breakdown = "";
  if (aquaCount > 0 && dmrcStations.length > 0) {
    breakdown = `DMRC: ₹${dmrcToken} + NMRC: ₹${nmrcToken}`;
  } else if (rapidCount > 0 && dmrcStations.length > 0) {
    breakdown = `DMRC: ₹${dmrcToken} + Rapid: ₹${rapidToken}`;
  }

  return { token: totalToken, card: totalCard, breakdown: breakdown };
}

function initApp() {
  console.log("WebAssembly engine initialized!");

  // 1. Fetch all station names from C
  const stationsJson = Module.ccall('get_all_stations_json', 'string', [], []);
  try {
    allStations = JSON.parse(stationsJson);
  } catch (e) {
    console.error("Failed to parse stations JSON:", e);
    return;
  }

  const sortedStations = [...allStations].sort((a, b) => a.localeCompare(b));

  // Populate datalist for both inputs
  const datalist = document.getElementById("stationsDatalist");
  datalist.innerHTML = "";
  sortedStations.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    datalist.appendChild(opt);
  });

  const srcInput = document.getElementById("srcInput");
  const destInput = document.getElementById("destInput");
  const clearSrc = document.getElementById("clearSrc");
  const clearDest = document.getElementById("clearDest");

  // Defaults
  if (allStations.includes("Rithala")) srcInput.value = "Rithala";
  if (allStations.includes("Janakpuri East")) destInput.value = "Janakpuri East";

  function setupInput(input, clearBtn) {
    function updateClearVisibility() {
      clearBtn.style.display = input.value.trim() ? "block" : "none";
    }

    input.addEventListener("input", updateClearVisibility);
    input.addEventListener("focus", () => {
      input.select();
      updateClearVisibility();
    });

    clearBtn.addEventListener("click", () => {
      input.value = "";
      input.focus();
      updateClearVisibility();
    });

    updateClearVisibility();
  }

  setupInput(srcInput, clearSrc);
  setupInput(destInput, clearDest);

  // Swap Action Button
  document.getElementById("swapBtn").addEventListener("click", () => {
    const temp = srcInput.value;
    srcInput.value = destInput.value;
    destInput.value = temp;
    clearSrc.style.display = srcInput.value ? "block" : "none";
    clearDest.style.display = destInput.value ? "block" : "none";
  });

  // Submit Route Calculation
  document.getElementById("findRouteBtn").addEventListener("click", calculateRoute);

  [srcInput, destInput].forEach(inp => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        calculateRoute();
      }
    });
  });
}

function normalizeStationName(inputName) {
  const trimmed = inputName.trim();
  const match = allStations.find(s => s.toLowerCase() === trimmed.toLowerCase());
  return match || trimmed;
}

function fetchRouteFromWasm(src, dest, penalty) {
  const resStr = Module.ccall(
    'find_metro_route',
    'string',
    ['string', 'string', 'number'],
    [src, dest, penalty]
  );
  try {
    return JSON.parse(resStr);
  } catch (err) {
    console.error("Error parsing route from wasm:", err, resStr);
    return null;
  }
}

function calculateRoute() {
  const rawSrc = document.getElementById("srcInput").value;
  const rawDest = document.getElementById("destInput").value;
  const resultsCard = document.getElementById("resultsCard");

  if (!rawSrc || !rawDest) {
    alert("Please enter both Origin and Destination stations.");
    return;
  }

  const src = normalizeStationName(rawSrc);
  const dest = normalizeStationName(rawDest);

  if (src === dest) {
    alert("Origin and Destination stations are the same.");
    return;
  }

  // 1. Calculate Default Direct Route (Least Transfers, penalty = 10.0)
  activeDirectRoute = fetchRouteFromWasm(src, dest, 10.0);

  // 2. Calculate Shortest Alternative Route (penalty = 2.5)
  activeShortestRoute = fetchRouteFromWasm(src, dest, 2.5);

  if (!activeDirectRoute || !activeDirectRoute.found || !activeDirectRoute.stations) {
    alert(activeDirectRoute ? (activeDirectRoute.message || activeDirectRoute.error) : "No route found.");
    resultsCard.style.display = "none";
    return;
  }

  // 3. Check if alternative route exists and differs in distance or interchanges
  const isDifferent = activeShortestRoute && activeShortestRoute.found && 
    (Math.abs(activeDirectRoute.total_distance_km - activeShortestRoute.total_distance_km) > 0.5 ||
     activeDirectRoute.num_interchanges !== activeShortestRoute.num_interchanges);

  const tabsContainer = document.getElementById("routeTabsContainer");

  if (isDifferent) {
    tabsContainer.style.display = "flex";
    tabsContainer.innerHTML = `
      <button class="route-tab-btn active" id="tabDirect"> Recommended Route (${activeDirectRoute.num_interchanges} transfer${activeDirectRoute.num_interchanges === 1 ? '' : 's'})
      </button>
      <button class="route-tab-btn" id="tabShortest">Alternative Route (${activeShortestRoute.total_distance_km.toFixed(1)} km, ${activeShortestRoute.num_interchanges} transfer${activeShortestRoute.num_interchanges === 1 ? '' : 's'})
      </button>
    `;

    document.getElementById("tabDirect").addEventListener("click", function() {
      this.classList.add("active");
      document.getElementById("tabShortest").classList.remove("active");
      renderRoute(activeDirectRoute);
    });

    document.getElementById("tabShortest").addEventListener("click", function() {
      this.classList.add("active");
      document.getElementById("tabDirect").classList.remove("active");
      renderRoute(activeShortestRoute);
    });
  } else {
    tabsContainer.style.display = "none";
  }

  // Render the recommended direct route as default on top
  renderRoute(activeDirectRoute);
  resultsCard.style.display = "block";
  resultsCard.scrollIntoView({ behavior: 'smooth' });
}

function renderRoute(data) {
  const dist = data.total_distance_km;
  const stops = data.stations.length;
  const ichg = data.num_interchanges;
  const estTimeMin = Math.round((dist / 32) * 60 + ichg * 5);
  const fare = calculateDmrcFare(dist, data.stations);

  document.getElementById("statDistance").textContent = `${dist.toFixed(1)} km`;
  document.getElementById("statStops").textContent = `${stops}`;
  document.getElementById("statInterchanges").textContent = `${ichg}`;
  document.getElementById("statTime").textContent = `~${estTimeMin} min`;

  if (fare.breakdown) {
    document.getElementById("statFare").innerHTML = `₹${fare.token} <span style="font-size: 0.72rem; color: #9aa0a6; font-weight: normal; display: block;">${fare.breakdown}</span>`;
  } else {
    document.getElementById("statFare").innerHTML = `₹${fare.token} <span style="font-size: 0.72rem; color: #9aa0a6; font-weight: normal; display: block;">Card: ₹${fare.card}</span>`;
  }

  // Render Station Timeline
  const timeline = document.getElementById("routeTimeline");
  timeline.innerHTML = "";

  let previousLine = null;
  let previousColor = null;

  for (let idx = 0; idx < data.stations.length; idx++) {
    const st = data.stations[idx];

    // Check if this station transition is a Walkway
    const isWalkway = (st.line && st.line.includes("Walkway")) || (previousLine && previousLine.includes("Walkway"));

    if (st.line && st.line.includes("Walkway")) {
      // 1. Show the exit from previous train station
      const stepArrive = document.createElement("div");
      stepArrive.className = "timeline-step";
      const arriveBadge = getBadgeClass(previousColor);
      stepArrive.innerHTML = `
        <div class="step-marker" style="background-color: ${getMarkerColor(arriveBadge)}"></div>
        <div class="step-content">
          <span class="station-title">${st.name} <span style="font-size: 0.8rem; color: #94a3b8;">(Exit to Walkway)</span></span>
          <span class="line-badge ${arriveBadge}">${previousLine || 'Metro'}</span>
        </div>
      `;
      timeline.appendChild(stepArrive);

      // 2. Show dedicated single Walkway Banner (No duplicate interchanges!)
      const nextSt = data.stations[idx + 1];
      const nextName = nextSt ? nextSt.name : "Next Station";
      const nextLine = nextSt ? nextSt.line : "Connecting Line";

      const walkwayBanner = document.createElement("div");
      walkwayBanner.className = "walkway-banner";
      walkwayBanner.innerHTML = `
        <span class="walk-icon">🚶</span>
        <div>
          <strong>Pedestrian Walkway (~300m)</strong>
          <div style="font-size: 0.8rem; color: #9aa0a6; margin-top: 2px;">
            Walk across the dedicated walkway from <strong>${st.name}</strong> to <strong>${nextName}</strong> (${nextLine})
          </div>
        </div>
      `;
      timeline.appendChild(walkwayBanner);

      previousLine = st.line;
      previousColor = st.color;
      continue;
    }

    if (previousLine && previousLine.includes("Walkway")) {
      // Entering the station after walkway
      const stepDepart = document.createElement("div");
      stepDepart.className = "timeline-step";
      const departBadge = getBadgeClass(st.color);
      stepDepart.innerHTML = `
        <div class="step-marker" style="background-color: ${getMarkerColor(departBadge)}"></div>
        <div class="step-content">
          <span class="station-title">${st.name} <span style="font-size: 0.8rem; color: #38bdf8;">(Board Train)</span></span>
          <span class="line-badge ${departBadge}">${st.line}</span>
        </div>
      `;
      timeline.appendChild(stepDepart);

      previousLine = st.line;
      previousColor = st.color;
      continue;
    }

    // Standard Metro Line Change (Normal Platform Interchange)
    if (idx > 0 && previousLine && st.line && st.line !== previousLine) {
      // Arrive at interchange station
      const stepArrive = document.createElement("div");
      stepArrive.className = "timeline-step";
      const arriveBadge = getBadgeClass(previousColor);
      stepArrive.innerHTML = `
        <div class="step-marker" style="background-color: ${getMarkerColor(arriveBadge)}"></div>
        <div class="step-content">
          <span class="station-title">${st.name} <span style="font-size: 0.8rem; color: #ca8a04;">(Platform transfer)</span></span>
          <span class="line-badge ${arriveBadge}">${previousLine}</span>
        </div>
      `;
      timeline.appendChild(stepArrive);

      // Directions Banner
      const banner = document.createElement("div");
      banner.className = "interchange-banner";
      banner.innerHTML = `<span>🔄</span> Change train from <strong>${previousLine}</strong> to <strong>${st.line}</strong>`;
      timeline.appendChild(banner);

      // Depart on new line
      const stepDepart = document.createElement("div");
      stepDepart.className = "timeline-step";
      const departBadge = getBadgeClass(st.color);
      stepDepart.innerHTML = `
        <div class="step-marker" style="background-color: ${getMarkerColor(departBadge)}"></div>
        <div class="step-content">
          <span class="station-title">${st.name} <span style="font-size: 0.8rem; color: #38bdf8;">(Board Train)</span></span>
          <span class="line-badge ${departBadge}">${st.line}</span>
        </div>
      `;
      timeline.appendChild(stepDepart);
    } else {
      // Regular station stop
      const step = document.createElement("div");
      step.className = "timeline-step";
      const badgeClass = getBadgeClass(st.color);
      step.innerHTML = `
        <div class="step-marker" style="background-color: ${getMarkerColor(badgeClass)}"></div>
        <div class="step-content">
          <span class="station-title">${st.name}</span>
          <span class="line-badge ${badgeClass}">${st.line || 'Metro'}</span>
        </div>
      `;
      timeline.appendChild(step);
    }

    if (st.line) {
      previousLine = st.line;
      previousColor = st.color;
    }
  }
}

function getMarkerColor(badgeClass) {
  switch (badgeClass) {
    case 'badge-Red': return '#b91c1c';
    case 'badge-Yellow': return '#ca8a04';
    case 'badge-Blue': return '#1d4ed8';
    case 'badge-Green': return '#15803d';
    case 'badge-Violet': return '#7e22ce';
    case 'badge-Pink': return '#be185d';
    case 'badge-Magenta': return '#9d174d';
    case 'badge-Grey': return '#475569';
    case 'badge-Airport': return '#c2410c';
    case 'badge-Rapid': return '#0e7490';
    case 'badge-Aqua': return '#0369a1';
    default: return '#64748b';
  }
}

// Runtime check
if (typeof Module !== 'undefined') {
  if (Module.calledRun) {
    initApp();
  } else {
    Module.onRuntimeInitialized = initApp;
  }
}
