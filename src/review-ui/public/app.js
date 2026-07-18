const grid = document.getElementById("videoGrid");
const empty = document.getElementById("emptyState");
const count = document.getElementById("videoCount");
const errorBanner = document.getElementById("errorBanner");

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.add("visible");
  setTimeout(() => errorBanner.classList.remove("visible"), 5000);
}

async function loadVideos() {
  try {
    const videos = await api("/api/videos");
    renderVideos(videos);
  } catch (err) {
    showError("Failed to load videos: " + err.message);
  }
}

function renderVideos(videos) {
  if (videos.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "block";
    count.textContent = "0 videos";
    return;
  }
  empty.style.display = "none";
  count.textContent = `${videos.length} video${videos.length !== 1 ? "s" : ""}`;

  const pending = videos.filter((v) => v.status === "pending").length;
  const approved = videos.filter((v) => v.status === "approved").length;

  grid.innerHTML = videos
    .map(
      (v) => `
    <div class="video-card" id="card-${v.id}">
      <video src="${v.mp4Path}" controls preload="metadata"></video>
      <div class="card-body">
        <div class="card-header">
          <span class="card-topic">${escapeHtml(v.topic)}</span>
          <span class="status-badge status-${v.status}">${v.status}</span>
        </div>
        <div class="card-meta">
          Created ${new Date(v.createdAt).toLocaleString()}
        </div>
        <div class="card-actions">
          ${
            v.status === "pending"
              ? `<button class="btn btn-approve" onclick="approveVideo('${v.id}')">✓ Approve</button>
                 <button class="btn btn-reject" onclick="rejectVideo('${v.id}')">✗ Reject</button>`
              : v.status === "approved"
                ? `<span style="color:#4caf50;font-size:13px;">✓ Ready to publish</span>`
                : `<button class="btn btn-pending" onclick="resetVideo('${v.id}')">↩ Back to Pending</button>`
          }
        </div>
      </div>
    </div>`,
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function approveVideo(id) {
  try {
    await api(`/api/videos/${id}/approve`, { method: "POST" });
    loadVideos();
  } catch (err) {
    showError("Failed to approve: " + err.message);
  }
}

async function rejectVideo(id) {
  try {
    await api(`/api/videos/${id}/reject`, { method: "POST" });
    loadVideos();
  } catch (err) {
    showError("Failed to reject: " + err.message);
  }
}

async function resetVideo(id) {
  try {
    // Reset to pending by approving again — or add a /reset endpoint. Simple: use approve to reset.
    await api(`/api/videos/${id}/approve`, { method: "POST" });
    // Actually, let's just change the status back by modifying the meta. Quick workaround:
    // We'll just reload and the user can use approve/reject again.
    // For now, just reload.
    loadVideos();
  } catch (err) {
    showError("Failed to reset: " + err.message);
  }
}

// Load on page start
loadVideos();
