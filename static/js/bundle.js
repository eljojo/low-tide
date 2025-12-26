"use strict";
(() => {
  // node_modules/zustand/esm/vanilla.mjs
  var createStoreImpl = (createState) => {
    let state;
    const listeners = /* @__PURE__ */ new Set();
    const setState = (partial, replace) => {
      const nextState = typeof partial === "function" ? partial(state) : partial;
      if (!Object.is(nextState, state)) {
        const previousState = state;
        state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
        listeners.forEach((listener) => listener(state, previousState));
      }
    };
    const getState = () => state;
    const getInitialState = () => initialState;
    const subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const api = { setState, getState, getInitialState, subscribe };
    const initialState = state = createState(setState, getState, api);
    return api;
  };
  var createStore = ((createState) => createState ? createStoreImpl(createState) : createStoreImpl);

  // frontend/src/main.ts
  var useStore = createStore((set) => ({
    jobs: {},
    selectedJobId: null,
    showArchived: false,
    consoleCollapsed: true,
    setJobs: (jobs) => set((state) => {
      const newJobs = {};
      jobs.forEach((j) => {
        newJobs[j.id] = { ...state.jobs[j.id], ...j };
      });
      return { jobs: newJobs };
    }),
    updateJob: (job) => set((state) => ({
      jobs: {
        ...state.jobs,
        [job.id]: { ...state.jobs[job.id], ...job }
      }
    })),
    appendLog: (jobId, line) => set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      const currentLogs = job.logs || "";
      const newLogs = currentLogs + (currentLogs !== "" ? String.fromCharCode(10) : "") + line;
      return {
        jobs: {
          ...state.jobs,
          [jobId]: { ...job, logs: newLogs }
        }
      };
    }),
    selectJob: (id) => set((state) => {
      const job = state.jobs[id];
      let consoleCollapsed = state.consoleCollapsed;
      if (job) {
        consoleCollapsed = job.status === "success";
      }
      return { selectedJobId: id, consoleCollapsed };
    }),
    deleteJob: (id) => set((state) => {
      const newJobs = { ...state.jobs };
      delete newJobs[id];
      return {
        jobs: newJobs,
        selectedJobId: state.selectedJobId === id ? null : state.selectedJobId
      };
    }),
    toggleArchived: () => set((state) => ({ showArchived: !state.showArchived })),
    toggleConsole: () => set((state) => ({ consoleCollapsed: !state.consoleCollapsed })),
    setConsoleCollapsed: (collapsed) => set({ consoleCollapsed: collapsed })
  }));
  var stateSocket = null;
  function render() {
    renderJobsLists();
    renderSelectedJobPane();
  }
  function renderJobsLists() {
    const state = useStore.getState();
    const activeList = document.getElementById("jobs-list");
    const archivedList = document.getElementById("archived-list");
    if (!activeList || !archivedList) return;
    const allJobs = Object.values(state.jobs).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    activeList.innerHTML = "";
    archivedList.innerHTML = "";
    allJobs.forEach((job) => {
      const el = createJobItem(job);
      if (job.archived) {
        archivedList.appendChild(el);
      } else {
        activeList.appendChild(el);
      }
    });
    const archivedSec = document.getElementById("archived-section");
    const toggleBtn = document.getElementById("toggle-archived");
    if (archivedSec && toggleBtn) {
      if (state.showArchived) {
        archivedSec.style.display = "block";
        toggleBtn.textContent = "\u25BE";
      } else {
        archivedSec.style.display = "none";
        toggleBtn.textContent = "\u25B8";
      }
    }
    const isAnyJobRunning = allJobs.some((job) => job.status === "running");
    const globalIndicator = document.getElementById("global-indicator");
    if (globalIndicator) {
      globalIndicator.style.display = isAnyJobRunning ? "block" : "none";
    }
  }
  function createJobItem(job) {
    const state = useStore.getState();
    const div = document.createElement("div");
    div.className = "job-item";
    if (state.selectedJobId === job.id) div.classList.add("selected");
    const header = document.createElement("div");
    header.className = "job-header";
    const left = document.createElement("div");
    const title = job.title && job.title !== "" ? job.title : job.url || job.original_url || "Job #" + job.id;
    left.innerText = title;
    const status = document.createElement("div");
    status.className = "status-pill status-" + job.status;
    if (job.status === "running") {
      const indicator = document.createElement("span");
      indicator.className = "indicator";
      status.appendChild(indicator);
    }
    status.appendChild(document.createTextNode(job.status.toUpperCase()));
    header.appendChild(left);
    header.appendChild(status);
    div.appendChild(header);
    div.onclick = () => selectJob(job.id);
    return div;
  }
  function renderSelectedJobPane() {
    const state = useStore.getState();
    const pane = document.getElementById("files-pane");
    if (!pane) return;
    if (!state.selectedJobId) {
      pane.style.display = "none";
      return;
    }
    const job = state.jobs[state.selectedJobId];
    if (!job) {
      pane.style.display = "none";
      return;
    }
    pane.style.display = "";
    const title = job.title && job.title !== "" ? job.title : job.url || job.original_url || "#" + job.id;
    const titleEl = document.getElementById("files-job-title");
    if (titleEl) titleEl.textContent = title;
    updateJobActions(job);
    renderFilesList(job);
    renderLogs(job);
    const consoleInner = document.getElementById("console-inner");
    const toggleBtn = document.getElementById("toggle-console");
    if (consoleInner && toggleBtn) {
      if (state.consoleCollapsed) {
        consoleInner.classList.remove("expanded");
        toggleBtn.textContent = "Expand";
      } else {
        consoleInner.classList.add("expanded");
        toggleBtn.textContent = "Collapse";
      }
    }
  }
  function renderFilesList(job) {
    const el = document.getElementById("files-list");
    const filesAreaInner = document.getElementById("files-area-inner");
    if (!el || !filesAreaInner) return;
    const files = job.files || [];
    if (files.length === 0) {
      el.innerHTML = "<em>No files recorded for this job.</em>";
      if (job.status === "running") {
        filesAreaInner.classList.remove("expanded");
      } else {
        filesAreaInner.classList.add("expanded");
      }
      return;
    }
    filesAreaInner.classList.add("expanded");
    el.innerHTML = "";
    if (files.length === 1) {
      const f = files[0];
      const row = document.createElement("div");
      row.className = "file-item";
      const left = document.createElement("div");
      left.className = "file-name";
      const basename = f.path.split("/").pop();
      left.innerHTML = `<a href='/api/jobs/${job.id}/files/${f.id}'>${basename}</a> <span style='color:var(--muted)'>(${humanSize(f.size_bytes)})</span>`;
      row.appendChild(left);
      el.appendChild(row);
      return;
    }
    const paths = files.map((f) => f.path.split("/").slice(0, -1).join("/"));
    const firstDir = paths[0];
    const allSameDir = paths.every((p) => p === firstDir);
    let commonPrefix = "";
    if (allSameDir) {
      commonPrefix = firstDir;
    } else {
      const splitPaths = files.map((f) => f.path.split("/").filter((x) => x));
      if (splitPaths.length > 0) {
        let prefix = splitPaths[0].slice(0, -1);
        for (let i = 1; i < splitPaths.length; i++) {
          const current = splitPaths[i];
          let j = 0;
          while (j < prefix.length && j < current.length - 1 && prefix[j] === current[j]) {
            j++;
          }
          prefix = prefix.slice(0, j);
        }
        if (prefix.length > 0) commonPrefix = "/" + prefix.join("/");
      }
    }
    let displayPrefix = commonPrefix;
    if (displayPrefix === "/") displayPrefix = "";
    if (displayPrefix) {
      const hdr = document.createElement("div");
      hdr.style.fontWeight = "600";
      hdr.style.margin = "0.4rem 0 0.2rem 0";
      hdr.textContent = displayPrefix.replace(/^\//, "");
      el.appendChild(hdr);
    }
    files.forEach((f) => {
      const row = document.createElement("div");
      row.className = "file-item";
      if (displayPrefix) {
        row.style.paddingLeft = "1rem";
      }
      const left = document.createElement("div");
      left.className = "file-name";
      let displayName = f.path.split("/").pop();
      left.innerHTML = `<a href='/api/jobs/${job.id}/files/${f.id}'>${displayName}</a> <span style='color:var(--muted)'>(${humanSize(f.size_bytes)})</span>`;
      row.appendChild(left);
      el.appendChild(row);
    });
  }
  function renderLogs(job) {
    const pre = document.getElementById("log-pre");
    const logView = document.getElementById("log-view");
    if (!pre || !logView) return;
    if (!job.logs || job.logs === "") {
      pre.textContent = "No logs.";
    } else {
      pre.textContent = job.logs;
    }
    if (job.status === "running") {
      logView.scrollTop = logView.scrollHeight;
    }
  }
  function updateJobActions(job) {
    const actionDownload = document.getElementById("action-download");
    const actionRetry = document.getElementById("action-retry");
    const actionArchive = document.getElementById("action-archive");
    const openSource = document.getElementById("job-open-source");
    if (!actionDownload || !actionRetry || !actionArchive || !openSource) return;
    const fileCount = (job.files || []).length;
    if (fileCount === 0) {
      actionDownload.style.display = "none";
    } else if (fileCount === 1) {
      actionDownload.style.display = "";
      actionDownload.textContent = "Download";
      const f = job.files[0];
      actionDownload.onclick = () => {
        window.location.href = "/api/jobs/" + job.id + "/files/" + f.id;
      };
    } else {
      actionDownload.style.display = "";
      actionDownload.textContent = "Download ZIP";
      actionDownload.onclick = () => {
        window.location.href = "/api/jobs/" + job.id + "/zip";
      };
    }
    if (job.status === "failed") actionRetry.style.display = "";
    else actionRetry.style.display = "none";
    if (job.archived) actionArchive.style.display = "none";
    else actionArchive.style.display = "";
    if (job.original_url) {
      openSource.onclick = () => window.open(job.original_url, "_blank");
      openSource.style.display = "";
    } else {
      openSource.style.display = "none";
    }
  }
  async function loadInitialData() {
    try {
      const res = await fetch("/api/jobs");
      const jobs = await res.json();
      useStore.getState().setJobs(jobs);
      const runningJob = jobs.find((j) => j.status === "running");
      if (runningJob) {
        selectJob(runningJob.id);
      }
      connectWebSocket();
    } catch (e) {
      console.error("Initial load failed", e);
    }
  }
  async function selectJob(id) {
    useStore.getState().selectJob(id);
    await fetchJobDetails(id);
  }
  async function fetchJobDetails(id) {
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (res.ok) {
        const job = await res.json();
        if (job) {
          useStore.getState().updateJob(job);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  function connectWebSocket() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    stateSocket = new WebSocket(proto + "//" + location.host + "/ws/state");
    stateSocket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        handleWSMessage(msg);
      } catch (e) {
        console.error(e);
      }
    };
    stateSocket.onclose = () => setTimeout(connectWebSocket, 2e3);
  }
  function handleWSMessage(msg) {
    const { getState } = useStore;
    if (msg.type === "job_snapshot") {
      if (msg.job) {
        const oldStatus = getState().jobs[msg.job.id]?.status;
        getState().updateJob(msg.job);
        if (msg.job.id === getState().selectedJobId) {
          if (oldStatus === "running" && msg.job.status === "success") {
            getState().setConsoleCollapsed(true);
          }
        } else if (msg.job.status === "running") {
          selectJob(msg.job.id);
        }
      }
    } else if (msg.type === "job_log") {
      getState().appendLog(msg.job_id, msg.line);
    } else if (msg.type === "jobs_archived") {
      loadInitialData();
    }
  }
  var newJobForm = document.getElementById("new-job-form");
  if (newJobForm) {
    newJobForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const target = ev.target;
      const fd = new FormData(target);
      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      if (res.ok) {
        target.reset();
      }
    });
  }
  document.getElementById("toggle-archived")?.addEventListener("click", () => {
    useStore.getState().toggleArchived();
  });
  document.getElementById("toggle-console")?.addEventListener("click", () => {
    useStore.getState().toggleConsole();
  });
  document.getElementById("action-retry")?.addEventListener("click", async () => {
    const { selectedJobId } = useStore.getState();
    if (!selectedJobId) return;
    await fetch(`/api/jobs/${selectedJobId}/retry`, { method: "POST" });
  });
  document.getElementById("action-archive")?.addEventListener("click", async () => {
    const { selectedJobId } = useStore.getState();
    if (!selectedJobId) return;
    await fetch(`/api/jobs/${selectedJobId}/archive`, { method: "POST" });
  });
  document.getElementById("action-delete")?.addEventListener("click", async () => {
    const { selectedJobId } = useStore.getState();
    if (!selectedJobId) return;
    if (!confirm("Delete job? \u26A0\uFE0F this will also delete the files")) return;
    await fetch(`/api/jobs/${selectedJobId}/delete`, { method: "POST" });
    useStore.getState().deleteJob(selectedJobId);
  });
  function humanSize(bytes) {
    if (bytes === void 0) return "";
    const b = Number(bytes);
    if (b < 1024) return b + " B";
    const kb = b / 1024;
    if (kb < 1024) return Math.round(kb) + " KB";
    const mb = kb / 1024;
    if (mb < 1024) return Math.round(mb) + " MB";
    const gb = mb / 1024;
    return Math.round(gb) + " GB";
  }
  useStore.subscribe(() => {
    render();
  });
  loadInitialData();
  render();
})();
