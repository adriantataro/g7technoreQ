const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx-6b1yjrDO-Cs088Yh8y5QnfvH5Y5_-X6iu7SBhn4zlE2VbihTNPxJTyHm3TFs96rtLQ/exec";

const form       = document.getElementById("patientForm");
const photoInput = document.getElementById("photo");
const statusBox  = document.getElementById("statusBox");
const patientIdText = document.getElementById("patientIdText");
const recordLink = document.getElementById("recordLink");
const qrImage    = document.getElementById("qrImage");
const themeToggle = document.getElementById("themeToggle");
const navToggle  = document.getElementById("navToggle");
const mainNav    = document.querySelector(".main-nav");
const previewImages   = document.querySelectorAll(".product-preview-image");
const imageModal      = document.getElementById("imageModal");
const imageModalPreview = document.getElementById("imageModalPreview");
const imageModalClose = document.getElementById("imageModalClose");

/* ── Theme ── */
let currentTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
document.documentElement.setAttribute("data-theme", currentTheme);

themeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
});

/* ── Mobile nav ── */
if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.addEventListener("click", (e) => {
    if (!mainNav.contains(e.target) && !navToggle.contains(e.target)) {
      if (mainNav.classList.contains("is-open")) {
        mainNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mainNav.classList.contains("is-open")) {
      mainNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (mainNav.classList.contains("is-open")) {
        mainNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  });
}

/* ── Conditional Yes/No reveal ──
   Maps: radio group name → id of the conditional panel to show/hide */
const conditionalMap = {
  allergies_yn:  "allergies_detail",
  medications_yn: "medications_detail",
  chronic_yn:    "chronic_detail",
  history_yn:    "history_detail",
  insurance_yn:  "insurance_detail",
  pcp_yn:        "pcp_detail",
};

Object.entries(conditionalMap).forEach(([radioName, panelId]) => {
  const radios = document.querySelectorAll(`input[name="${radioName}"]`);
  const panel  = document.getElementById(panelId);
  if (!radios.length || !panel) return;

  function updatePanel() {
    const checked = Array.from(radios).find((r) => r.checked);
    const show = checked && checked.value === "Yes";
    panel.classList.toggle("is-visible", show);

    /* When showing, mark inner inputs as required; when hiding, clear and unset required */
    panel.querySelectorAll("input, textarea").forEach((el) => {
      if (show) {
        el.required = true;
      } else {
        el.required = false;
        el.value = "";
      }
    });
  }

  radios.forEach((radio) => radio.addEventListener("change", updatePanel));

  // Initialize panel visibility based on any pre-selected values
  updatePanel();
});

/* Clear conditional fields on form reset */
form.addEventListener("reset", () => {
  Object.values(conditionalMap).forEach((panelId) => {
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.remove("is-visible");
      panel.querySelectorAll("input, textarea").forEach((el) => {
        el.required = false;
        el.value = "";
      });
    }
  });
});

/* ── Product image modal ── */
previewImages.forEach((image) => {
  image.addEventListener("click", () => openImageModal(image));
});

imageModal.addEventListener("click", (event) => {
  if (event.target === imageModal) closeImageModal();
});

imageModalClose.addEventListener("click", closeImageModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeImageModal();
});

/* ── Form submit ── */
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  statusBox.textContent = "Saving patient record...";
  patientIdText.textContent = "—";
  recordLink.textContent = "—";
  recordLink.removeAttribute("href");
  qrImage.style.display = "none";

  try {
    const formData = new FormData(form);

    /* Build a clean payload: include explicit Yes/No flags and only include details when Yes */
    const get = (key) => formData.get(key) || "";

    const payload = {
      full_name: get("full_name"),
      sex: get("sex") || "",
      dob: get("dob") || "",
      address: get("address") || "",
      phone: get("phone") || "",
      email: get("email") || "",
      emergency_name: get("emergency_name") || "",
      emergency_relationship: get("emergency_relationship") || "",
      emergency_phone: get("emergency_phone") || "",
      history: get("history") || "",
      /* Conditional groups: default to "No" when not selected */
      allergies_yn: get("allergies_yn") || "No",
      medications_yn: get("medications_yn") || "No",
      chronic_yn: get("chronic_yn") || "No",
      history_yn: get("history_yn") || "No",
      insurance_yn: get("insurance_yn") || "No",
      pcp_yn: get("pcp_yn") || "No",
    };

    /* Only include detail fields when corresponding flag is Yes */
    if (payload.allergies_yn === "Yes") payload.allergies = get("allergies");
    if (payload.medications_yn === "Yes") payload.medications = get("medications");
    if (payload.chronic_yn === "Yes") payload.chronic_conditions = get("chronic_conditions");
    if (payload.history_yn === "Yes") payload.history = get("history");
    if (payload.insurance_yn === "Yes") {
      payload.insurance_provider = get("insurance_provider");
      payload.insurance_policy = get("insurance_policy");
    }
    if (payload.pcp_yn === "Yes") {
      payload.pcp_name = get("pcp_name");
      payload.pcp_contact = get("pcp_contact");
    }

    /* Convert photo to base64 */
    payload.photo_base64 = await fileToBase64(photoInput.files[0] || null);

    /* Flatten Yes/No toggles: store a clean value
       e.g. allergies_yn = "Yes" → keep; allergies textarea already captured */
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!result.success) throw new Error(result.error || "Save failed.");

    patientIdText.textContent = result.patient_id;
    recordLink.href = result.record_url;
    recordLink.textContent = result.record_url;
    qrImage.src = result.qr_url;
    qrImage.style.display = "block";

    // Show concise summary of key choices in the status box
    const lines = [
      "Patient saved successfully. QR code generated.",
      
    ];

    statusBox.textContent = lines.join('\n');
  } catch (error) {
    statusBox.textContent = "Error: " + error.message;
  }
});

/* ── Helpers ── */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(""); return; }
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function openImageModal(image) {
  imageModalPreview.src = image.src;
  imageModalPreview.alt = image.alt;
  imageModal.classList.add("is-open");
  imageModal.setAttribute("aria-hidden", "false");
}

function closeImageModal() {
  imageModal.classList.remove("is-open");
  imageModal.setAttribute("aria-hidden", "true");
  imageModalPreview.removeAttribute("src");
}