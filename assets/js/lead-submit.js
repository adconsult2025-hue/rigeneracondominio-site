(() => {
  const endpoint = "https://api.base44.app/api/apps/69ae818b1605821a8982244a/functions/submitLead";
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
      const nome = getFieldValue(form, ["nome"]);
      const email = getFieldValue(form, ["email"]);
      const telefono = getFieldValue(form, ["telefono", "cellulare"]);
      const comune = getFieldValue(form, ["comune", "citta", "citt\u00e0"]);
      const messaggio = getFieldValue(form, ["messaggio"]);
      const tipologia = getFieldValue(form, ["tipologia"]);

      if (!nome || !email || !comune || !messaggio) {
        responseEl.textContent = "Compila i campi obbligatori: Nome, Email, Citt\u00e0/Comune, Messaggio.";
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nome, email, telefono, comune, tipologia, messaggio }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }

      if (response.ok && data && data.success === true) {
        responseEl.textContent = "Richiesta inviata correttamente. Verrai ricontattato.";
        form.reset();
      } else {
        const msg = (data && (data.error || data.message)) || "Si \u00e8 verificato un errore durante l'invio. Riprova tra poco.";
        responseEl.textContent = msg;
      }
    } catch (error) {
      responseEl.textContent = "Si \u00e8 verificato un errore durante l'invio. Riprova tra poco.";
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
