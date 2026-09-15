(function () {
  "use strict";

  var SUPABASE_URL = "https://mwjnoesjvajyiolxtxjj.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8TO0wT5Tu-AQTlRg0IY7CQ_rXGr4v5P";
  var SUBMIT_URL = SUPABASE_URL + "/functions/v1/contact-submit";
  var form = document.getElementById("contact-form");

  if (!form) return;

  var submitButton = form.querySelector('button[type="submit"]');
  var status = document.getElementById("form-status");
  var loadedAt = Date.now();

  function showStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
    status.hidden = false;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    status.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = "Sending…";

    var fields = new FormData(form);
    var payload = {
      name: fields.get("name"),
      email: fields.get("email"),
      topic: fields.get("topic"),
      message: fields.get("message"),
      website: fields.get("website"),
      startedAt: new Date(loadedAt).toISOString()
    };

    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 12000);

    try {
      var response = await fetch(SUBMIT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      var result = await response.json().catch(function () { return {}; });

      if (!response.ok) {
        throw new Error(result.error || "We couldn't send your message. Please try again.");
      }

      form.reset();
      loadedAt = Date.now();
      showStatus("Thanks! Your message was sent. We'll get back to you soon.", false);
    } catch (error) {
      var message = error.name === "AbortError"
        ? "The request took too long. Please check your connection and try again."
        : error.message;
      showStatus(message, true);
    } finally {
      window.clearTimeout(timeout);
      submitButton.disabled = false;
      submitButton.textContent = "Send Message →";
    }
  });
})();
