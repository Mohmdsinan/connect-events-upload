const form = document.getElementById("eventForm");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");

// Converts a File object into { filename, contentType, base64 }
function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1]; // strip "data:...;base64,"
      resolve({
        filename: file.name,
        contentType: file.type,
        base64,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  statusMsg.textContent = "Submitting...";
  statusMsg.style.color = "#333";

  try {
    const attendancePdfFile = document.getElementById("attendancePdf").files[0];
    const photo1File = document.getElementById("photo1").files[0];
    const photo2File = document.getElementById("photo2").files[0];
    const photo3File = document.getElementById("photo3").files[0];

    // Convert all selected files to base64 in parallel
    const [attendancePdf, photo1, photo2, photo3] = await Promise.all([
      fileToPayload(attendancePdfFile),
      fileToPayload(photo1File),
      fileToPayload(photo2File),
      fileToPayload(photo3File),
    ]);

    const payload = {
      name: document.getElementById("name").value,
      date: document.getElementById("date").value,
      venue: document.getElementById("venue").value,
      coordinator: document.getElementById("coordinator").value,
      description: document.getElementById("description").value,
      photosLink: document.getElementById("photosLink").value,
      fundDetails: document.getElementById("fundDetails").value,
      attendancePdf,
      photo1,
      photo2,
      photo3,
    };

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Submission failed");
    }

    statusMsg.textContent = "Submitted successfully!";
    statusMsg.style.color = "green";
    form.reset();
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Error: " + err.message;
    statusMsg.style.color = "red";
  } finally {
    submitBtn.disabled = false;
  }
});