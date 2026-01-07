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

  const getFullName = (form) => {
    const fullName = getFieldValue(form, [
      "nome_cognome",
      "full_name",
      "referente",
      "amministratore",
      "richiedente",
      "name",
      "nome",
      "cognome",
    ]);
    if (fullName) return fullName;

    const nome = getFieldValue(form, ["nome"]);
    const cognome = getFieldValue(form, ["cognome"]);
    if (nome && cognome) return `${nome} ${cognome}`.trim();

    return "";
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
    const fullName = getFullName(form);
    const orgName = getFieldValue(form, ["condominio", "condominio_nome", "condominioName"]);
    const role = getFieldValue(form, ["ruolo", "role", "tipologia"]);
    const email = getFieldValue(form, ["email"]);
    const phone = getFieldValue(form, ["telefono", "phone", "cellulare"]);
    const city = getFieldValue(form, [
      "citta",
      "città",
      "comune",
      "comune_immobile",
      "localita",
      "località",
      "provincia",
      "city",
    ]);
    const message = getFieldValue(form, [
      "messaggio",
      "message",
      "note",
      "richiesta",
      "testo",
      "descrizione",
    ]);

    return {
      source_site: sourceSite,
      lead_type: "contatto",
      org_type: "condominio",
      org_name: orgName || "Condominio non specificato",
      full_name: fullName || "Richiedente non indicato",
      role,
      email,
      phone,
      city: city || "Non indicato",
      message: message || "Richiesta da form sito Rigenera Condominio.",
      source_url: window.location.href,
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
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (response.ok && data && data.ok === true) {
        responseEl.textContent = "Richiesta inviata correttamente. Verrai ricontattato.";
        form.reset();
      } else {
        console.error("Lead submit error", response.status, data || response.statusText);
        const message =
          (data && (data.message || data.error)) ||
          "Si è verificato un errore durante l'invio. Riprova tra poco.";
        responseEl.textContent = message;
      }
    } catch (error) {
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
