// =============================================================
//  Connect — Event Submission Script
//  Handles:
//    • Drop-zone interactivity (click, keyboard, drag-and-drop)
//    • Footer year
//    • Status message class toggling
//    • Photo 1 & 2 required validation
//    • Form submission to /api/submit
// =============================================================

// ── DOM refs ──────────────────────────────────────────────────
const form      = document.getElementById("eventForm");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");

// ── Footer year ───────────────────────────────────────────────
document.getElementById("footerYear").textContent = new Date().getFullYear();

// ── Status message class helper ───────────────────────────────
// Watches for textContent changes written by the submit handler
// and applies the correct CSS class for success / error / loading.
const statusObserver = new MutationObserver(() => {
  const txt = statusMsg.textContent.trim();
  if (!txt) { statusMsg.className = ""; return; }

  if (txt.startsWith("Submitted")) {
    statusMsg.className = "status-success";
  } else if (txt.startsWith("Error")) {
    statusMsg.className = "status-error";
  } else if (txt.startsWith("Submitting")) {
    statusMsg.className = "status-loading";
  }
});
statusObserver.observe(statusMsg, { childList: true, subtree: true, characterData: true });

// ── Drop-zone interactivity ───────────────────────────────────
document.querySelectorAll(".drop-zone").forEach(zone => {
  const targetId = zone.dataset.target;
  const input    = zone.querySelector('input[type="file"]');
  const hint     = document.getElementById("hint-" + targetId);

  // Make zone focusable and role=button
  zone.setAttribute("tabindex", "0");
  zone.setAttribute("role", "button");

  // Click anywhere in zone → open file picker
  zone.addEventListener("click", () => input.click());

  // Keyboard: Enter / Space → open file picker
  zone.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  // Update hint text and visual state when a file is chosen
  input.addEventListener("change", () => {
    if (input.files.length) {
      const name = input.files[0].name;
      hint.textContent = name.length > 30 ? name.slice(0, 28) + "…" : name;
      zone.classList.add("drop-zone--has-file");
      zone.classList.remove("drop-zone--error");
    } else {
      hint.textContent = zone.classList.contains("drop-zone--photo")
        ? "No file chosen"
        : zone.dataset.accept + " files only";
      zone.classList.remove("drop-zone--has-file");
    }
  });

  // Drag-over highlight
  zone.addEventListener("dragover", e => {
    e.preventDefault();
    zone.classList.add("drop-zone--drag");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drop-zone--drag"));

  // Drop files onto zone
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drop-zone--drag");
    const dt = e.dataTransfer;
    if (dt.files.length) {
      try {
        input.files = dt.files;           // works in most modern browsers
      } catch (_) {
        // DataTransfer assignment not supported — silently ignore
      }
      input.dispatchEvent(new Event("change"));
    }
  });
});

// ── File → base64 payload helper ─────────────────────────────
function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1]; // strip "data:...;base64,"
      resolve({
        filename:    file.name,
        contentType: file.type,
        base64,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Form submission ───────────────────────────────────────────
form.addEventListener("submit", async e => {
  e.preventDefault();

  // --- Photo 1 & 2 client-side validation ---
  const photo1File = document.getElementById("photo1").files[0];
  const photo2File = document.getElementById("photo2").files[0];
  const missing    = [];

  if (!photo1File) {
    missing.push("Photo 1");
    document.getElementById("zone-photo1").classList.add("drop-zone--error");
  } else {
    document.getElementById("zone-photo1").classList.remove("drop-zone--error");
  }

  if (!photo2File) {
    missing.push("Photo 2");
    document.getElementById("zone-photo2").classList.add("drop-zone--error");
  } else {
    document.getElementById("zone-photo2").classList.remove("drop-zone--error");
  }

  if (missing.length) {
    statusMsg.textContent = "Error: Please upload " + missing.join(" and ") + " before submitting.";
    submitBtn.disabled = false;
    return;
  }

  // --- Proceed with submission ---
  submitBtn.disabled = true;
  statusMsg.textContent = "Submitting…";

  try {
    const attendancePdfFile = document.getElementById("attendancePdf").files[0];
    const photo3File        = document.getElementById("photo3").files[0];

    // Convert all selected files to base64 in parallel
    const [attendancePdf, photo1, photo2, photo3] = await Promise.all([
      fileToPayload(attendancePdfFile),
      fileToPayload(photo1File),
      fileToPayload(photo2File),
      fileToPayload(photo3File),
    ]);

    const payload = {
      name:        document.getElementById("name").value,
      date:        document.getElementById("date").value,
      venue:       document.getElementById("venue").value,
      coordinator: document.getElementById("coordinator").value,
      description: document.getElementById("description").value,
      photosLink:  document.getElementById("photosLink").value,
      fundDetails: document.getElementById("fundDetails").value,
      attendancePdf,
      photo1,
      photo2,
      photo3,
    };

    const res = await fetch("/api/submit", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Submission failed");
    }

    statusMsg.textContent = "Submitted successfully!";
    form.reset();

    // Clear all drop-zone visual states after a successful reset
    document.querySelectorAll(".drop-zone").forEach(zone => {
      zone.classList.remove("drop-zone--has-file", "drop-zone--error");
      const hint = document.getElementById("hint-" + zone.dataset.target);
      if (hint) {
        hint.textContent = zone.classList.contains("drop-zone--photo")
          ? "No file chosen"
          : zone.dataset.accept + " files only";
      }
    });

  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Error: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});