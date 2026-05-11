const API = "https://valorant-api.com/v1";
const CURRENT_POOL = ["Haven", "Ascent", "Split", "Pearl", "Breeze", "Lotus", "Fracture"];
const STANDARD_MAPS = [
  "Abyss",
  "Ascent",
  "Bind",
  "Breeze",
  "Corrode",
  "Fracture",
  "Haven",
  "Icebox",
  "Lotus",
  "Pearl",
  "Split",
  "Sunset",
];
const PLAYER_COLORS = ["#ff4655", "#67e8f9", "#facc15", "#8bd17c", "#c084fc"];

const ROLE_ORDER = ["Duelist", "Initiator", "Controller", "Sentinel"];
const ROLE_COLORS = {
  Duelist: "#ff6b6b",
  Initiator: "#facc15",
  Controller: "#67e8f9",
  Sentinel: "#8bd17c",
  Agent: "#9aa3af",
};

const SITE_LABELS = {
  Haven: [
    { label: "A", x: 0.75, y: 0.35 },
    { label: "B", x: 0.5, y: 0.53 },
    { label: "C", x: 0.25, y: 0.62 },
  ],
  Ascent: [
    { label: "A", x: 0.68, y: 0.37 },
    { label: "B", x: 0.3, y: 0.62 },
  ],
  Split: [
    { label: "A", x: 0.66, y: 0.35 },
    { label: "B", x: 0.31, y: 0.62 },
  ],
  Pearl: [
    { label: "A", x: 0.69, y: 0.37 },
    { label: "B", x: 0.31, y: 0.62 },
  ],
  Breeze: [
    { label: "A", x: 0.68, y: 0.32 },
    { label: "B", x: 0.31, y: 0.66 },
  ],
  Lotus: [
    { label: "A", x: 0.73, y: 0.35 },
    { label: "B", x: 0.5, y: 0.53 },
    { label: "C", x: 0.27, y: 0.65 },
  ],
  Fracture: [
    { label: "A", x: 0.67, y: 0.37 },
    { label: "B", x: 0.32, y: 0.62 },
  ],
};

const fallbackAgents = [
  ["Jett", "Duelist", "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png"],
  ["Sova", "Initiator", "https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png"],
  ["Omen", "Controller", "https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png"],
  ["Killjoy", "Sentinel", "https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/displayicon.png"],
  ["Breach", "Initiator", "https://media.valorant-api.com/agents/5f8d3a7f-467b-97f3-062c-13acf203c006/displayicon.png"],
].map(([displayName, roleName, displayIcon], index) => ({
  uuid: `fallback-${index}`,
  displayName,
  displayIcon,
  role: { displayName: roleName, displayIcon: "" },
}));

const fallbackMaps = CURRENT_POOL.map((name) => ({
  uuid: `fallback-${name}`,
  displayName: name,
  splash: "",
  displayIcon: "",
  listViewIcon: "",
}));

const defaultState = {
  players: ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"],
  maps: {},
  activeMap: "Haven",
};

let state = loadState();
let agents = [];
let maps = [];
let dragAgent = null;
let draggedPinIndex = null;
let selectedAgent = null;
let selectedSiteIndex = null;
let roleFilter = "all";
let tool = "select";
let isDrawing = false;
let startPoint = null;
let snapshot = null;

let syncClientId = localStorage.getItem("valoranto-five-client-id");
if (!syncClientId) {
  syncClientId = crypto.randomUUID();
  localStorage.setItem("valoranto-five-client-id", syncClientId);
}
let applyingRemoteState = false;
let syncTimer = null;

const el = {
  playerList: document.querySelector("#playerList"),
  mapList: document.querySelector("#mapList"),
  currentMapTitle: document.querySelector("#currentMapTitle"),
  mapSplash: document.querySelector("#mapSplash"),
  mapRotator: document.querySelector("#mapRotator"),
  mapLayout: document.querySelector("#mapLayout"),
  compSlots: document.querySelector("#compSlots"),
  compCount: document.querySelector("#compCount"),
  comfortList: document.querySelector("#comfortList"),
  agentRoster: document.querySelector("#agentRoster"),
  agentSearch: document.querySelector("#agentSearch"),
  roleFilters: document.querySelector("#roleFilters"),
  selectedAgent: document.querySelector("#selectedAgent"),
  selectedThumb: document.querySelector("#selectedThumb"),
  selectedRole: document.querySelector("#selectedRole"),
  selectedHint: document.querySelector("#selectedHint"),
  siteLayer: document.querySelector("#siteLayer"),
  canvas: document.querySelector("#drawCanvas"),
  pinLayer: document.querySelector("#pinLayer"),
  inkColor: document.querySelector("#inkColor"),
};

function loadState() {
  const saved = localStorage.getItem("valoranto-five-planner");
  if (!saved) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem("valoranto-five-planner", JSON.stringify(state));
  syncState();
}

function normalizeState(nextState) {
  return { ...structuredClone(defaultState), ...(nextState || {}) };
}

function applyRemoteState(nextState) {
  applyingRemoteState = true;
  state = normalizeState(nextState);
  localStorage.setItem("valoranto-five-planner", JSON.stringify(state));
  maps.forEach((map) => getMapState(map.displayName));
  if (!maps.some((map) => map.displayName === state.activeMap)) state.activeMap = maps[0]?.displayName || "Haven";
  selectedSiteIndex = null;
  applyingRemoteState = false;
  renderAll();
}

function syncState() {
  if (applyingRemoteState) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch("/api/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: syncClientId, state }),
    }).catch(() => {});
  }, 80);
}

async function setupSync() {
  try {
    const response = await fetch("/api/state");
    const payload = await response.json();
    if (payload.state) {
      applyRemoteState(payload.state);
    } else {
      syncState();
    }

    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (!payload.state || payload.clientId === syncClientId) return;
      applyRemoteState(payload.state);
    };
  } catch {
    // Opening index.html directly still works as a single-device planner.
  }
}

function getMapState(mapName) {
  if (!state.maps[mapName]) {
    state.maps[mapName] = {
      inPool: CURRENT_POOL.includes(mapName),
      comp: Array(5).fill(null),
      comfort: Array.from({ length: 5 }, () => []),
      pins: [],
      drawing: "",
      rotation: 0,
      zoom: 1,
      sitesVisible: true,
      sites: structuredClone(SITE_LABELS[mapName] || []),
    };
  }
  state.maps[mapName].rotation ||= 0;
  state.maps[mapName].zoom ||= 1;
  if (!state.maps[mapName].comfort) state.maps[mapName].comfort = Array.from({ length: 5 }, () => []);
  if (state.maps[mapName].sitesVisible === undefined) state.maps[mapName].sitesVisible = true;
  if (!state.maps[mapName].sites) state.maps[mapName].sites = structuredClone(SITE_LABELS[mapName] || []);
  return state.maps[mapName];
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return res.json();
}

async function init() {
  try {
    const [agentData, mapData] = await Promise.all([
      fetchJson(`${API}/agents?isPlayableCharacter=true`),
      fetchJson(`${API}/maps`),
    ]);
    agents = agentData.data
      .filter((agent) => agent.displayIcon)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    maps = mapData.data
      .filter((map) => STANDARD_MAPS.includes(map.displayName))
      .sort(compareMaps);
  } catch {
    agents = fallbackAgents;
    maps = fallbackMaps;
  }

  maps.forEach((map) => getMapState(map.displayName));
  if (!maps.some((map) => map.displayName === state.activeMap)) state.activeMap = maps[0]?.displayName || "Haven";
  bindEvents();
  renderAll();
  setupSync();
}

function compareMaps(a, b) {
  const aIndex = CURRENT_POOL.indexOf(a.displayName);
  const bIndex = CURRENT_POOL.indexOf(b.displayName);
  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;
  return a.displayName.localeCompare(b.displayName);
}

function bindEvents() {
  document.querySelector("#resetPlayers").addEventListener("click", () => {
    state.players = structuredClone(defaultState.players);
    saveState();
    renderPlayers();
    renderComp();
  });

  document.querySelector("#poolOnly").addEventListener("click", () => {
    maps.forEach((map) => {
      getMapState(map.displayName).inPool = CURRENT_POOL.includes(map.displayName);
    });
    saveState();
    renderMaps();
  });

  document.querySelector("#rotateMap").addEventListener("click", rotateCurrentMap);
  document.querySelector("#zoomOut").addEventListener("click", () => zoomCurrentMap(-0.1));
  document.querySelector("#zoomIn").addEventListener("click", () => zoomCurrentMap(0.1));
  document.querySelector("#toggleSites").addEventListener("click", () => {
    const current = getMapState(state.activeMap);
    current.sitesVisible = !current.sitesVisible;
    saveState();
    renderSiteLabels();
  });

  document.querySelectorAll(".tool-button").forEach((button) => {
    button.addEventListener("click", () => {
      tool = button.dataset.tool;
      document.querySelectorAll(".tool-button").forEach((item) => item.classList.toggle("active", item === button));
    });
  });

  document.querySelectorAll("[data-collapse]").forEach((button) => {
    const panel = button.closest(".panel");
    button.addEventListener("click", () => {
      panel.classList.toggle("collapsed");
      button.textContent = panel.classList.contains("collapsed") ? "+" : "-";
    });
  });

  document.querySelector("#clearBoard").addEventListener("click", () => {
    const current = getMapState(state.activeMap);
    current.drawing = "";
    current.pins = [];
    saveState();
    fitCanvas();
    renderPins();
  });

  document.querySelector("#clearComp").addEventListener("click", () => {
    getMapState(state.activeMap).comp = Array(5).fill(null);
    saveState();
    renderComp();
  });
  document.querySelector("#clearComfort").addEventListener("click", () => {
    getMapState(state.activeMap).comfort = Array.from({ length: 5 }, () => []);
    saveState();
    renderComfort();
  });

  document.querySelector("#clearSelected").addEventListener("click", () => setSelectedAgent(null));
  document.querySelector("#exportData").addEventListener("click", exportPlanner);
  document.querySelector("#importData").addEventListener("change", importPlanner);
  el.agentSearch.addEventListener("input", renderAgents);
  window.addEventListener("resize", fitCanvas);

  el.canvas.addEventListener("pointerdown", startDraw);
  el.canvas.addEventListener("click", placeSelectedOnMap);
  el.canvas.addEventListener("pointermove", moveDraw);
  el.canvas.addEventListener("pointerup", endDraw);
  el.canvas.addEventListener("pointerleave", endDraw);

  [el.compSlots, document.querySelector(".map-visual")].forEach((target) => {
    target.addEventListener("dragover", (event) => event.preventDefault());
    target.addEventListener("drop", handleDrop);
  });
}

function renderAll() {
  renderPlayers();
  renderMaps();
  renderMapStage();
  renderComp();
  renderComfort();
  renderRoleFilters();
  renderAgents();
}

function renderPlayers() {
  el.playerList.innerHTML = "";
  state.players.forEach((name, index) => {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `<div class="player-color" style="background:${PLAYER_COLORS[index]}"></div>`;
    const input = document.createElement("input");
    input.className = "player-name";
    input.value = name;
    input.addEventListener("input", () => {
      state.players[index] = input.value || `Player ${index + 1}`;
      saveState();
      renderComp();
      renderComfort();
    });
    row.append(input);
    el.playerList.append(row);
  });
}

function renderMaps() {
  el.mapList.innerHTML = "";
  maps.forEach((map) => {
    const mapState = getMapState(map.displayName);
    const button = document.createElement("button");
    button.className = `map-button ${state.activeMap === map.displayName ? "active" : ""} ${mapState.inPool ? "in-pool" : ""}`;
    button.innerHTML = `
      <img src="${map.splash || map.displayIcon || ""}" alt="">
      <span class="map-name">${map.displayName}</span>
      <span class="map-toggle" title="Competitive pool"></span>
    `;
    button.addEventListener("click", (event) => {
      if (event.target.classList.contains("map-toggle")) {
        mapState.inPool = !mapState.inPool;
      } else {
        persistDrawing();
        state.activeMap = map.displayName;
        renderMapStage();
        renderComp();
        renderComfort();
        renderPins();
      }
      saveState();
      renderMaps();
    });
    el.mapList.append(button);
  });
}

function renderMapStage() {
  const map = maps.find((item) => item.displayName === state.activeMap) || maps[0];
  if (!map) return;
  const current = getMapState(map.displayName);
  el.currentMapTitle.textContent = map.displayName;
  el.mapSplash.src = map.splash || "";
  el.mapLayout.src = map.displayIcon || map.listViewIcon || map.splash || "";
  el.mapLayout.classList.remove("custom-map");
  updateMapTransform();
  renderSiteLabels();
  requestAnimationFrame(() => {
    fitCanvas();
    renderPins();
  });
}

function renderSiteLabels() {
  const current = getMapState(state.activeMap);
  el.siteLayer.innerHTML = "";
  document.querySelector("#toggleSites").classList.toggle("active", current.sitesVisible);
  if (!current.sitesVisible) return;
  current.sites.forEach((site, index) => {
    const marker = document.createElement("button");
    marker.className = `site-label ${selectedSiteIndex === index ? "selected" : ""}`;
    marker.style.left = `${site.x * 100}%`;
    marker.style.top = `${site.y * 100}%`;
    marker.textContent = site.label;
    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedSiteIndex = selectedSiteIndex === index ? null : index;
      setSelectedAgent(null);
      renderSiteLabels();
    });
    el.siteLayer.append(marker);
  });
}

function renderComp() {
  const current = getMapState(state.activeMap);
  el.compSlots.innerHTML = "";
  current.comp.forEach((agentId, index) => {
    const agent = agents.find((item) => item.uuid === agentId);
    const role = getAgentRole(agent);
    const slot = document.createElement("div");
    slot.className = `slot ${agent ? "filled" : ""}`;
    slot.dataset.slot = index;
    slot.style.setProperty("--role", ROLE_COLORS[role]);
    slot.innerHTML = `
      ${agent ? `<img src="${agent.displayIcon}" alt="">` : `<div class="empty-avatar"></div>`}
      <div>
        <small>${state.players[index]}</small>
        <strong>${agent ? agent.displayName : "No agent"}</strong>
        ${agent ? `<span class="role-icon tiny">${roleIconMarkup(role, agent)}</span>` : ""}
      </div>
      ${agent ? `<button class="slot-clear" title="Remove">x</button>` : ""}
    `;
    const clear = slot.querySelector(".slot-clear");
    if (clear) {
      clear.addEventListener("click", (event) => {
        event.stopPropagation();
        current.comp[index] = null;
        saveState();
        renderComp();
      });
    }
    slot.addEventListener("dblclick", () => {
      current.comp[index] = null;
      saveState();
      renderComp();
    });
    slot.addEventListener("click", () => {
      if (!selectedAgent) return;
      current.comp[index] = selectedAgent;
      saveState();
      renderComp();
    });
    el.compSlots.append(slot);
  });
  el.compCount.textContent = `${current.comp.filter(Boolean).length} / 5`;
}

function renderComfort() {
  const current = getMapState(state.activeMap);
  el.comfortList.innerHTML = "";
  state.players.forEach((player, playerIndex) => {
    const row = document.createElement("div");
    row.className = "comfort-row";
    row.innerHTML = `
      <div class="comfort-name">${player}</div>
      <div class="comfort-picks"></div>
    `;
    const pickBox = row.querySelector(".comfort-picks");
    (current.comfort[playerIndex] || []).forEach((agentId) => {
      const agent = agents.find((item) => item.uuid === agentId);
      if (!agent) return;
      const role = getAgentRole(agent);
      const pick = document.createElement("button");
      pick.className = "comfort-pick";
      pick.title = `Set ${player} to ${agent.displayName}`;
      pick.style.setProperty("--role", ROLE_COLORS[role]);
      pick.innerHTML = `<img src="${agent.displayIcon}" alt=""><span>${roleIconMarkup(role, agent)}</span><b>x</b>`;
      pick.addEventListener("click", () => {
        current.comp[playerIndex] = agentId;
        saveState();
        renderComp();
      });
      pick.querySelector("b").addEventListener("click", (event) => {
        event.stopPropagation();
        current.comfort[playerIndex] = current.comfort[playerIndex].filter((id) => id !== agentId);
        saveState();
        renderComfort();
      });
      pickBox.append(pick);
    });
    const add = document.createElement("button");
    add.className = "comfort-add";
    add.textContent = selectedAgent ? "+ selected" : "+";
    add.title = selectedAgent ? "Add selected agent as a comfort pick" : "Select an agent first";
    add.addEventListener("click", () => {
      if (!selectedAgent) return;
      const picks = current.comfort[playerIndex] || [];
      if (!picks.includes(selectedAgent)) picks.push(selectedAgent);
      current.comfort[playerIndex] = picks;
      saveState();
      renderComfort();
    });
    pickBox.append(add);
    el.comfortList.append(row);
  });
}

function renderRoleFilters() {
  const filters = [["all", "All"], ...ROLE_ORDER.map((role) => [role, role])];
  el.roleFilters.innerHTML = "";
  filters.forEach(([value, label]) => {
    const button = document.createElement("button");
    const sampleAgent = agents.find((agent) => getAgentRole(agent) === value);
    button.className = `role-filter ${roleFilter === value ? "active" : ""}`;
    button.title = label;
    button.innerHTML = value === "all" ? `<span class="all-mark">All</span>` : roleIconMarkup(value, sampleAgent);
    button.addEventListener("click", () => {
      roleFilter = value;
      renderRoleFilters();
      renderAgents();
    });
    el.roleFilters.append(button);
  });
}

function renderAgents() {
  const query = el.agentSearch.value.trim().toLowerCase();
  el.agentRoster.innerHTML = "";
  agents
    .filter((agent) => roleFilter === "all" || getAgentRole(agent) === roleFilter)
    .filter((agent) => `${agent.displayName} ${getAgentRole(agent)}`.toLowerCase().includes(query))
    .forEach((agent) => {
      const template = document.querySelector("#agentCardTemplate").content.cloneNode(true);
      const button = template.querySelector("button");
      const role = getAgentRole(agent);
      button.dataset.agentId = agent.uuid;
      button.style.setProperty("--role", ROLE_COLORS[role]);
      button.classList.toggle("selected", selectedAgent === agent.uuid);
      button.querySelector("img").src = agent.displayIcon;
      button.querySelector("span").textContent = agent.displayName;
      button.querySelector("small").innerHTML = roleIconMarkup(role, agent);
      button.addEventListener("dragstart", () => {
        dragAgent = agent.uuid;
        draggedPinIndex = null;
        setSelectedAgent(agent.uuid);
      });
      button.addEventListener("click", () => selectAgent(agent.uuid));
      el.agentRoster.append(template);
    });
}

function selectAgent(agentId) {
  setSelectedAgent(selectedAgent === agentId ? null : agentId);
}

function setSelectedAgent(agentId) {
  selectedAgent = agentId;
  if (agentId) selectedSiteIndex = null;
  const agent = agents.find((item) => item.uuid === selectedAgent);
  const role = getAgentRole(agent);
  el.selectedAgent.textContent = agent ? agent.displayName : "None";
  el.selectedThumb.innerHTML = agent ? `<img src="${agent.displayIcon}" alt="">` : "+";
  el.selectedRole.innerHTML = agent ? roleIconMarkup(role, agent) : "No role";
  el.selectedRole.style.setProperty("--role", ROLE_COLORS[role]);
  el.selectedHint.textContent = agent ? "Click a slot or the map to place." : "Pick an agent, then click a slot or the map.";
  renderAgents();
  renderComfort();
}

function roleIconMarkup(role, agent) {
  const icon = agent?.role?.displayIcon || agents.find((item) => getAgentRole(item) === role)?.role?.displayIcon || "";
  if (icon) return `<img class="role-img" src="${icon}" alt="${role}">`;
  return `<span class="role-letter">${role.slice(0, 1)}</span>`;
}

function getAgentRole(agent) {
  return agent?.role?.displayName || "Agent";
}

function handleDrop(event) {
  event.preventDefault();
  const current = getMapState(state.activeMap);
  const slot = event.target.closest(".slot");
  if (slot && dragAgent) {
    current.comp[Number(slot.dataset.slot)] = dragAgent;
    dragAgent = null;
    draggedPinIndex = null;
    saveState();
    renderComp();
    return;
  }

  if (!dragAgent && draggedPinIndex === null) return;
  const placed = mapPointFromEvent(event);
  if (draggedPinIndex !== null) {
    current.pins[draggedPinIndex] = { ...current.pins[draggedPinIndex], x: placed.x, y: placed.y };
  } else {
    current.pins.push({
      agent: dragAgent,
      x: placed.x,
      y: placed.y,
    });
  }
  dragAgent = null;
  draggedPinIndex = null;
  saveState();
  renderPins();
}

function placeSelectedOnMap(event) {
  if (suppressNextMapClick) return;
  if (selectedSiteIndex !== null) {
    const current = getMapState(state.activeMap);
    const placed = mapPointFromEvent(event);
    current.sites[selectedSiteIndex] = { ...current.sites[selectedSiteIndex], x: placed.x, y: placed.y };
    selectedSiteIndex = null;
    saveState();
    renderSiteLabels();
    return;
  }
  if (tool !== "select" || !selectedAgent) return;
  const placed = mapPointFromEvent(event);
  getMapState(state.activeMap).pins.push({
    agent: selectedAgent,
    x: placed.x,
    y: placed.y,
  });
  saveState();
  renderPins();
}

function renderPins() {
  const current = getMapState(state.activeMap);
  el.pinLayer.innerHTML = "";
  current.pins.forEach((pin, index) => {
    const agent = agents.find((item) => item.uuid === pin.agent);
    if (!agent) return;
    const button = document.createElement("button");
    button.className = "agent-pin";
    button.style.left = `${pin.x * 100}%`;
    button.style.top = `${pin.y * 100}%`;
    button.style.transform = `translate(-50%, -50%) rotate(${-current.rotation}deg)`;
    button.innerHTML = `<img src="${agent.displayIcon}" alt="${agent.displayName}">`;
    button.draggable = true;
    button.addEventListener("dragstart", () => {
      dragAgent = agent.uuid;
      draggedPinIndex = index;
      setSelectedAgent(agent.uuid);
    });
    button.addEventListener("dblclick", () => {
      current.pins.splice(index, 1);
      saveState();
      renderPins();
    });
    el.pinLayer.append(button);
  });
}

function rotateCurrentMap() {
  persistDrawing();
  const current = getMapState(state.activeMap);
  current.rotation = (current.rotation + 90) % 360;
  saveState();
  renderMapStage();
}

function zoomCurrentMap(delta) {
  persistDrawing();
  const current = getMapState(state.activeMap);
  current.zoom = Math.round(clamp(current.zoom + delta, 0.7, 1.6) * 10) / 10;
  saveState();
  renderMapStage();
}

function updateMapTransform() {
  const current = getMapState(state.activeMap);
  el.mapRotator.style.transform = `rotate(${current.rotation}deg) scale(${current.zoom})`;
  document.querySelector("#zoomLevel").textContent = `${Math.round(current.zoom * 100)}%`;
}

function startPinchZoom(event) {
  activePointers.set(event.pointerId, event);
  if (activePointers.size !== 2) return;
  persistDrawing();
  isPinching = true;
  suppressNextMapClick = true;
  pinchStartDistance = pointerDistance();
  pinchStartZoom = getMapState(state.activeMap).zoom;
}

function movePinchZoom(event) {
  if (!activePointers.has(event.pointerId)) return;
  activePointers.set(event.pointerId, event);
  if (!isPinching || activePointers.size !== 2 || !pinchStartDistance) return;
  event.preventDefault();
  const current = getMapState(state.activeMap);
  current.zoom = Math.round(clamp(pinchStartZoom * (pointerDistance() / pinchStartDistance), 0.7, 1.6) * 100) / 100;
  updateMapTransform();
}

function endPinchZoom(event) {
  activePointers.delete(event.pointerId);
  if (!isPinching || activePointers.size > 0) return;
  isPinching = false;
  const current = getMapState(state.activeMap);
  current.zoom = Math.round(current.zoom * 10) / 10;
  saveState();
  updateMapTransform();
  setTimeout(() => {
    suppressNextMapClick = false;
  }, 120);
}

function pointerDistance() {
  const [first, second] = [...activePointers.values()];
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function mapPointFromEvent(event) {
  const rect = el.mapRotator.getBoundingClientRect();
  const visual = {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
  return rotatePoint(visual, 360 - getMapState(state.activeMap).rotation);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rotatePoint(point, degrees) {
  const turns = ((degrees % 360) + 360) % 360 / 90;
  let x = point.x;
  let y = point.y;
  for (let i = 0; i < turns; i += 1) {
    [x, y] = [1 - y, x];
  }
  return { x, y };
}

function fitCanvas() {
  const rect = el.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const saved = getMapState(state.activeMap).drawing;
  el.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  el.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = el.canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (saved) {
    const image = new Image();
    image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);
    image.src = saved;
  }
}

function point(event) {
  const rect = el.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function startDraw(event) {
  if (tool === "select" || activePointers.size > 1) return;
  isDrawing = true;
  startPoint = point(event);
  snapshot = el.canvas.toDataURL();
  const ctx = el.canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = tool === "erase" ? "rgba(0,0,0,1)" : el.inkColor.value;
  ctx.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over";
  ctx.lineWidth = tool === "erase" ? 22 : 4;
  ctx.beginPath();
  ctx.moveTo(startPoint.x, startPoint.y);
}

function moveDraw(event) {
  if (!isDrawing) return;
  const ctx = el.canvas.getContext("2d");
  const current = point(event);
  if (tool === "line") {
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      ctx.drawImage(image, 0, 0, el.canvas.getBoundingClientRect().width, el.canvas.getBoundingClientRect().height);
      ctx.lineCap = "round";
      ctx.strokeStyle = el.inkColor.value;
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
    };
    image.src = snapshot;
    return;
  }
  ctx.lineTo(current.x, current.y);
  ctx.stroke();
}

function endDraw() {
  if (!isDrawing) return;
  isDrawing = false;
  persistDrawing();
}

function persistDrawing() {
  getMapState(state.activeMap).drawing = el.canvas.toDataURL("image/png");
  saveState();
}

function exportPlanner() {
  persistDrawing();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "valoranto-five-planner.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function importPlanner(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = { ...structuredClone(defaultState), ...JSON.parse(reader.result) };
      saveState();
      renderAll();
    } catch {
      alert("Import failed");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

init();
