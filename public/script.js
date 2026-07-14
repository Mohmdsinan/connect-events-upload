// =============================================================
//  Connect — Event Submission Script
//  Handles:
//    • Drop-zone interactivity (click, keyboard, drag-and-drop)
//    • Footer year
//    • Status message class toggling
//    • Full required-field validation (all 7 fields)
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
  } else if (txt.startsWith("Error") || txt.startsWith("Please")) {
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

  // Update hint text and visual state when a file is chosen.
  // Also clears any validation error as soon as the user picks a file.
  input.addEventListener("change", () => {
    if (input.files.length) {
      const name = input.files[0].name;
      hint.textContent = name.length > 30 ? name.slice(0, 28) + "…" : name;
      zone.classList.add("drop-zone--has-file");
      zone.classList.remove("drop-zone--error");   // clear error on fix
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

// ── Live "clear error on fix" for text / date inputs ─────────
// Removes the red error highlight as soon as the user starts typing.
["name", "date", "venue", "coordinator"].forEach(id => {
  document.getElementById(id).addEventListener("input", function () {
    if (this.value.trim()) this.classList.remove("input--error");
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

// ── Validation ────────────────────────────────────────────────
// Checks all 7 required fields. Applies red highlights to every
// invalid field and returns an array of human-readable field names
// that are missing. Returns an empty array when everything is valid.
function validateAll() {
  const missing = [];

  // Helper: validate a plain text / date input
  function checkInput(id, label) {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.classList.add("input--error");
      missing.push(label);
    } else {
      el.classList.remove("input--error");
    }
  }

  // Helper: validate a file drop-zone input
  function checkFile(inputId, zoneId, label) {
    const input = document.getElementById(inputId);
    const zone  = document.getElementById(zoneId);
    if (!input.files.length) {
      zone.classList.add("drop-zone--error");
      missing.push(label);
    } else {
      zone.classList.remove("drop-zone--error");
    }
  }

  // ── Text / date fields ──
  checkInput("name",        "Event Name");
  checkInput("date",        "Date");
  checkInput("venue",       "Venue");
  checkInput("coordinator", "Coordinator");

  // ── Required file fields ──
  checkFile("attendancePdf", "zone-attendancePdf", "Attendance PDF");
  checkFile("photo1",        "zone-photo1",        "Photo 1");
  checkFile("photo2",        "zone-photo2",        "Photo 2");

  return missing;
}

// ── Form submission ───────────────────────────────────────────
form.addEventListener("submit", async e => {
  e.preventDefault();

  // --- Run full validation before doing anything else ---
  const missing = validateAll();

  if (missing.length) {
    statusMsg.textContent =
      "Please fill in: " + missing.join(", ") + ".";
    return;                 // block submission entirely
  }

  // --- All required fields present — proceed ---
  submitBtn.disabled = true;
  statusMsg.textContent = "Submitting…";

  try {
    const photo1File        = document.getElementById("photo1").files[0];
    const photo2File        = document.getElementById("photo2").files[0];
    const attendancePdfFile = document.getElementById("attendancePdf").files[0];
    const eventPosterFile   = document.getElementById("eventPoster").files[0];
    const photo3File        = document.getElementById("photo3").files[0];

    // Convert all selected files to base64 in parallel
    const [attendancePdf, eventPoster, photo1, photo2, photo3] = await Promise.all([
      fileToPayload(attendancePdfFile),
      fileToPayload(eventPosterFile),
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
      eventPoster,
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

    console.log("Status: ", res.status);
    console.log("Response: ", result);

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

    // Clear any lingering text-input error highlights after reset
    ["name", "date", "venue", "coordinator"].forEach(id => {
      document.getElementById(id).classList.remove("input--error");
    });

  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Error: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});