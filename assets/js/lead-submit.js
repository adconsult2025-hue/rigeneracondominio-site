(() => {
  const endpoint = "https://app.certouser.it/api/lead-submit";
  const sourceSite = "rigeneracondominio.it";

  const getFieldValue = (form, names) => {
    for (const name of names) {
      const field = form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);
      if (field && typeof field.value === "string") {
        const value = field.value.trim();
        if (value) return value;
      }
    }
    return "";
  };

  const detectLeadType = (form) => {
    const formName = (form.getAttribute("name") || "").toLowerCase();
    if (formName.includes("richiesta-accesso")) {
      return "richiesta_accesso";
    }
    return "contatto";
  };

  const ensureResponseEl = (form) => {
    let el = form.nextElementSibling;
    if (!el || !el.classList || !el.classList.contains("form-response")) {
      el = document.createElement("div");
      el.className = "form-response";
      el.setAttribute("role", "status");
      form.insertAdjacentElement("afterend", el);
    }
    return el;
  };

  const buildPayload = (form) => {
    const fullName = getFieldValue(form, ["nome"]);
    const email = getFieldValue(form, ["email"]);
    const phone = getFieldValue(form, ["telefono", "cellulare"]);
    const city = getFieldValue(form, ["citta", "città", "comune"]);
    const message = getFieldValue(form, ["messaggio"]);
    const orgNameValue = getFieldValue(form, ["condominio"]);
    const orgName = orgNameValue || `Contatto sito – ${city || "Comune non indicato"}`;
    const role = getFieldValue(form, ["tipologia"]);
    const attachmentField = form.querySelector("input[type='file'][name='allegato']");
    const attachments =
      attachmentField && attachmentField.files && attachmentField.files.length
        ? Array.from(attachmentField.files).map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
          }))
        : null;

    return {
      source_site: sourceSite,
      lead_type: detectLeadType(form),
      org_type: "condominio",
      org_name: orgName,
      full_name: fullName,
      role,
      email,
      phone,
      city,
      message,
      source_url: window.location.href,
      attachments,
    };
  };

  const submitForm = async (form, submitButton) => {
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add("is-loading");
    }

    const responseEl = ensureResponseEl(form);
    responseEl.textContent = "";

    try {
      const payload = buildPayload(form);
      if (!payload.full_name || !payload.email || !payload.city || !payload.message) {
        responseEl.textContent =
          "Compila i campi obbligatori: Nome, Email, Città/Comune, Messaggio.";
        return;
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data = null;
      let responseText = "";
      try {
        responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : null;
      } catch (error) {
        data = null;
      }

      if (response.ok && data && data.ok === true) {
        responseEl.textContent = "Richiesta inviata correttamente. Verrai ricontattato.";
        form.reset();
      } else {
        console.error("Lead submit error", response.status, responseText || response.statusText);
        const message =
          (data && (data.error || data.message)) ||
          "Si è verificato un errore durante l'invio. Riprova tra poco.";
        responseEl.textContent = message;
      }
    } catch (error) {
      console.error("Lead submit error", error);
      responseEl.textContent = "Si è verificato un errore durante l'invio. Riprova tra poco.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
      }
      form.dataset.submitting = "false";
    }
  };

  let forms = Array.from(document.querySelectorAll("form[data-lead-form='1']"));
  if (!forms.length) {
    forms = Array.from(document.querySelectorAll("form#contactForm, form.contact-form"));
  }
  if (!forms.length) return;

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const submitButton = form.querySelector("button[type='submit'], input[type='submit']");
      void submitForm(form, submitButton);
    });
  });
})();
