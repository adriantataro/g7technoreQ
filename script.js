const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyzu3dKs7-HInQtLMW5-qQ3pqmWZOV9wyMEH4-f9nkxmoSR6f2-yC8oUi4b2ElAc4H_/exec";

const form = document.getElementById("patientForm");
const photoInput = document.getElementById("photo");
const statusBox = document.getElementById("statusBox");
const patientIdText = document.getElementById("patientIdText");
const recordLink = document.getElementById("recordLink");
const qrImage = document.getElementById("qrImage");
const themeToggle = document.getElementById("themeToggle");

let currentTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
document.documentElement.setAttribute("data-theme", currentTheme);

themeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  statusBox.textContent = "Saving patient record...";
  patientIdText.textContent = "—";
  recordLink.textContent = "—";
  recordLink.removeAttribute("href");
  qrImage.style.display = "none";

  try {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    payload.photo_base64 = await fileToBase64(photoInput.files[0] || null);
    delete payload.photo;

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Save failed.");
    }

    patientIdText.textContent = result.patient_id;
    recordLink.href = result.record_url;
    recordLink.textContent = result.record_url;

    qrImage.src = result.qr_url;
    qrImage.style.display = "block";

    statusBox.textContent = "Patient saved successfully. QR code created.";
  } catch (error) {
    statusBox.textContent = "Error: " + error.message;
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}