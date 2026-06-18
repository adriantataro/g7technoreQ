const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz11tCIOIZsbRxsuAZWCbF5NdEpvbIxdc3SbH4x0d2yADMy2_pShWti5DO2lhXeJ0zT4A/exec";

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
let isSubmitting = false; // guard against double submissions

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) return; // block any repeat clicks
  isSubmitting = true;

  const submitBtn = form.querySelector("button[type='submit']");
  const originalLabel = submitBtn ? submitBtn.textContent : "";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "⏳ Saving...";
  }

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

    // On success: keep submit button hidden, show "Register Another Patient" button
    if (submitBtn) {
      submitBtn.style.display = "none";
    }

    // Remove any existing reset button first (safety)
    const existingReset = document.getElementById("resetFormBtn");
    if (existingReset) existingReset.remove();

    const resetBtn = document.createElement("button");
    resetBtn.id = "resetFormBtn";
    resetBtn.type = "button";
    resetBtn.textContent = "➕ Register Another Patient";
    resetBtn.className = "btn btn-secondary";
    resetBtn.style.cssText = "width:100%;margin-top:.75rem;";

    resetBtn.addEventListener("click", () => {
      // Reset all form fields
      form.reset();

      // Hide all conditional panels and clear their fields
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

      // Clear result card
      patientIdText.textContent = "—";
      recordLink.textContent = "—";
      recordLink.removeAttribute("href");
      qrImage.style.display = "none";
      qrImage.src = "";
      statusBox.textContent = "";

      // Restore submit button
      if (submitBtn) {
        submitBtn.style.display = "";
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        submitBtn.style.opacity = "";
      }

      // Reset submission guard
      isSubmitting = false;

      // Remove reset button
      resetBtn.remove();

      // Scroll back to top of form
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    submitBtn.insertAdjacentElement("afterend", resetBtn);
  } catch (error) {
    statusBox.textContent = "Error: " + error.message;

    // On error: re-enable so they can try again
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      submitBtn.style.opacity = "";
    }
  }
});

/* ── EmailJS — auto-send QR code for free/digital orders ── */
emailjs.init("a8oRUOe5E8Lq_ay9o");

const EMAILJS_SERVICE  = "service_ovs336k";
const EMAILJS_TEMPLATE = "template_h17s0mg";

let isOrderSubmitting = false;

document.getElementById("orderForm").addEventListener("submit", async function (e) {
  e.preventDefault(); // always prevent default — we use fetch for everything

  if (isOrderSubmitting) return;
  isOrderSubmitting = true;

  const productSelect = document.getElementById("order_product");
  const selected      = productSelect.options[productSelect.selectedIndex];
  const isFree        = selected && selected.dataset.price === "0";

  const submitBtn   = this.querySelector(".order-submit");
  const statusEl    = document.getElementById("orderStatus");
  const originalLabel = submitBtn.textContent;

  submitBtn.disabled    = true;
  submitBtn.textContent = isFree ? "⏳ Sending your QR code..." : "⏳ Submitting order...";
  statusEl.textContent  = "";
  statusEl.style.color  = "";

  const toEmail   = document.getElementById("order_email").value.trim();
  const toName    = document.getElementById("order_name").value.trim();
  const patientId = document.getElementById("order_patient_id").value.trim();

  try {
    /* ── Free/digital: validate QR code exists before submitting ── */
    if (isFree) {
      const qrUrl = document.getElementById("qrImage").src || "";

      if (!qrUrl || qrUrl.endsWith("#") || qrUrl === window.location.href) {
        statusEl.textContent = "⚠️ No QR code found. Please complete and submit the Patient Intake Form above first.";
        statusEl.style.color = "#c0392b";
        submitBtn.disabled    = false;
        submitBtn.textContent = originalLabel;
        isOrderSubmitting     = false;
        return;
      }
    }

    /* ── Always: send order record to Apps Script (stays on page) ── */
    const orderPayload = {
      form_type:      "order",
      name:           toName,
      patient_id:     patientId,
      email:          toEmail,
      phone:          document.getElementById("order_phone")?.value.trim() || "",
      product:        selected?.text || "",
      quantity:       document.getElementById("order_quantity")?.value || "1",
      unit_price:     document.getElementById("hidden_unit_price")?.value || "",
      shipping_fee:   document.getElementById("hidden_shipping")?.value || "",
      order_total:    document.getElementById("hidden_total")?.value || "",
      payment_method: (document.querySelector("input[name='payment_method']:checked")?.value) || "",
      address:        document.getElementById("order_address")?.value.trim() || "",
      city:           document.getElementById("order_city")?.value.trim() || "",
      province:       document.getElementById("order_province")?.value.trim() || "",
      zip:            document.getElementById("order_zip")?.value.trim() || "",
      order_notes:    document.getElementById("order_notes")?.value.trim() || "",
    };

    const res  = await fetch(APPS_SCRIPT_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body:    JSON.stringify(orderPayload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Order submission failed.");

    /* ── Success UI ── */
    submitBtn.textContent      = isFree ? "✅ QR Code Sent!" : "✅ Order Received!";
    submitBtn.style.background = "#27ae60";
    submitBtn.style.opacity    = "1";

    statusEl.style.color  = "#27ae60";
    statusEl.textContent  = isFree
      ? `📧 Your QR code has been emailed to ${toEmail}. Check your inbox (and spam folder just in case)!`
      : `📦 Order received! Payment instructions will be sent to ${toEmail} shortly.`;

  } catch (err) {
    console.error("Order submit error:", err);
    statusEl.textContent  = "❌ " + (err.text || err.message || "Something went wrong. Please try again.");
    statusEl.style.color  = "#c0392b";
    submitBtn.disabled    = false;
    submitBtn.textContent = originalLabel;
    submitBtn.style.background = "";
    isOrderSubmitting     = false;
  }
});

/* ── Order Form: dynamic price summary & shipping toggle ── */
(function () {
  const productSelect  = document.getElementById("order_product");
  const qtyInput       = document.getElementById("order_quantity");
  const summary        = document.getElementById("orderSummary");
  const sumUnit        = document.getElementById("summaryUnitPrice");
  const sumQty         = document.getElementById("summaryQty");
  const sumShipping    = document.getElementById("summaryShipping");
  const sumTotal       = document.getElementById("summaryTotal");
  const shippingFields = document.getElementById("shippingFields");
  const productCards   = document.querySelectorAll(".order-product-card");

  const SHIPPING_FEE = 60; // ₱60 flat shipping for physical items

  // Hidden fields for email
  const hiddenUnit     = document.getElementById("hidden_unit_price");
  const hiddenQty      = document.getElementById("hidden_quantity");
  const hiddenShipping = document.getElementById("hidden_shipping");
  const hiddenTotal    = document.getElementById("hidden_total");

  function updateSummary() {
    const selected = productSelect.options[productSelect.selectedIndex];
    if (!selected || !selected.dataset.price && selected.dataset.price !== "0") {
      summary.classList.remove("is-visible");
      return;
    }

    const unitPrice = parseInt(selected.dataset.price, 10);
    const qty       = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const isFree    = unitPrice === 0;
    const shipping  = isFree ? 0 : SHIPPING_FEE;
    const total     = unitPrice * qty + shipping;

    sumUnit.textContent     = isFree ? "FREE" : `₱${unitPrice.toLocaleString()}`;
    sumQty.textContent      = qty;
    sumShipping.textContent = isFree ? "None (Digital)" : `₱${shipping}`;
    sumTotal.textContent    = isFree ? "FREE" : `₱${total.toLocaleString()}`;

    // Keep hidden fields in sync so the email includes the summary
    if (hiddenUnit)     hiddenUnit.value     = isFree ? "FREE" : `PHP ${unitPrice}`;
    if (hiddenQty)      hiddenQty.value      = qty;
    if (hiddenShipping) hiddenShipping.value = isFree ? "None (Digital)" : `PHP ${shipping}`;
    if (hiddenTotal)    hiddenTotal.value    = isFree ? "FREE" : `PHP ${total}`;

    summary.classList.add("is-visible");

    // Show/hide shipping address fields
    const addressInputs = shippingFields.querySelectorAll("input");
    if (isFree) {
      shippingFields.style.display = "none";
      addressInputs.forEach(el => { el.required = false; });
    } else {
      shippingFields.style.display = "";
      document.getElementById("order_address").required = true;
      document.getElementById("order_city").required    = true;
      document.getElementById("order_zip").required     = true;
    }
  }

  // Click on product card → auto-select in dropdown
  productCards.forEach((card) => {
    card.addEventListener("click", () => {
      const val = card.dataset.value;
      for (let i = 0; i < productSelect.options.length; i++) {
        if (productSelect.options[i].value === val) {
          productSelect.selectedIndex = i;
          break;
        }
      }
      updateSummary();
      productSelect.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  productSelect.addEventListener("change", updateSummary);
  qtyInput.addEventListener("input", updateSummary);

  // Initialize
  updateSummary();
})();

/* ── Auto-fill Patient ID from result card ── */
(function () {
  const patientIdText  = document.getElementById("patientIdText");
  const orderPatientId = document.getElementById("order_patient_id");
  if (!patientIdText || !orderPatientId) return;

  const observer = new MutationObserver(() => {
    const val = patientIdText.textContent.trim();
    if (val && val !== "—") orderPatientId.value = val;
  });
  observer.observe(patientIdText, { childList: true, subtree: true, characterData: true });
})();

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
/* ── Contact Form submit ── */
(function () {
  const contactForm   = document.getElementById("contactForm");
  const contactStatus = document.getElementById("contactStatus");
  if (!contactForm || !contactStatus) return;

  let sending = false;

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    sending = true;

    const btn = contactForm.querySelector(".contact-submit");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Sending...";
    contactStatus.textContent = "";
    contactStatus.style.color = "";

    try {
      const contactPayload = {
        form_type: "contact",
        name:      document.getElementById("contact_name").value.trim(),
        email:     document.getElementById("contact_email").value.trim(),
        subject:   document.getElementById("contact_subject").value.trim(),
        message:   document.getElementById("contact_message").value.trim(),
      };

      const res  = await fetch(APPS_SCRIPT_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body:    JSON.stringify(contactPayload),
      });
      const data = await res.json();

      if (data.success) {
        contactStatus.textContent = "✅ Message sent! We'll get back to you within 24 hours.";
        contactStatus.style.color = "#27ae60";
        contactForm.reset();
        btn.textContent = "✅ Sent!";
        btn.style.opacity = "0.7";
      } else {
        throw new Error(data.message || "Submission failed.");
      }
    } catch (err) {
      contactStatus.textContent = "❌ Failed to send: " + err.message;
      contactStatus.style.color = "#c0392b";
      btn.disabled = false;
      btn.textContent = originalLabel;
      sending = false;
    }
  });
})();
/* ── Retrieve QR Code Form ── */
(function () {
  const retrieveForm   = document.getElementById("retrieveForm");
  const retrieveStatus = document.getElementById("retrieveStatus");
  if (!retrieveForm || !retrieveStatus) return;

  let isSending = false;

  retrieveForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSending) return;
    isSending = true;

    const btn         = retrieveForm.querySelector(".retrieve-submit");
    const originalLabel = btn.textContent;
    const patientId   = document.getElementById("retrieve_patient_id").value.trim();
    const email       = document.getElementById("retrieve_email").value.trim();

    btn.disabled      = true;
    btn.textContent   = "⏳ Searching...";
    retrieveStatus.textContent = "";
    retrieveStatus.style.color = "";

    try {
      const res  = await fetch(APPS_SCRIPT_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body:    JSON.stringify({
          form_type:  "retrieve",
          patient_id: patientId,
          email:      email,
        }),
      });

      const data = await res.json();

      if (data.success) {
        retrieveStatus.style.color = "#27ae60";
        retrieveStatus.textContent = `✅ Found! Your QR code has been sent to ${email}. Check your inbox (and spam folder).`;
        btn.textContent = "✅ QR Code Sent!";
        btn.style.background = "#27ae60";
        retrieveForm.reset();
      } else {
        throw new Error(data.error || "No matching record found.");
      }

    } catch (err) {
      retrieveStatus.style.color = "#c0392b";
      retrieveStatus.textContent = "❌ " + (err.message || "Something went wrong. Please try again.");
      btn.disabled    = false;
      btn.textContent = originalLabel;
      isSending       = false;
    }
  });
})();