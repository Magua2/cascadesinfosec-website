// Mimi chat widget. Set data-endpoint on the <script> tag to the Cloudflare Worker URL.
(function () {
  var script = document.currentScript;
  var endpoint = script && script.getAttribute("data-endpoint");
  if (!endpoint) return;

  var GREETING = "Hi, I'm Mimi! Ask me about our security services, how an engagement works, or which option fits your business.";
  var history = [];
  var busy = false;

  var root = document.createElement("div");
  root.className = "mimi";
  root.innerHTML =
    '<button type="button" class="mimi-launch" aria-expanded="false" aria-controls="mimi-panel">' +
      '<span class="mimi-dot" aria-hidden="true"></span>Chat with Mimi' +
    '</button>' +
    '<section class="mimi-panel" id="mimi-panel" role="dialog" aria-label="Chat with Mimi" hidden>' +
      '<header class="mimi-head">' +
        '<div><strong>Mimi</strong><span>Cascades Infosec assistant</span></div>' +
        '<button type="button" class="mimi-close" aria-label="Close chat">&times;</button>' +
      '</header>' +
      '<div class="mimi-log" aria-live="polite"></div>' +
      '<form class="mimi-form">' +
        '<label for="mimi-input" class="mimi-sr">Your message</label>' +
        '<textarea id="mimi-input" rows="1" maxlength="1500" placeholder="Type your question…"></textarea>' +
        '<button type="submit" class="mimi-send">Send</button>' +
      '</form>' +
      '<p class="mimi-note">Mimi is an AI assistant and can make mistakes. Please don\'t share passwords or sensitive details here.</p>' +
    '</section>';
  document.body.appendChild(root);

  var launch = root.querySelector(".mimi-launch");
  var panel = root.querySelector(".mimi-panel");
  var log = root.querySelector(".mimi-log");
  var form = root.querySelector(".mimi-form");
  var input = root.querySelector("#mimi-input");
  var send = root.querySelector(".mimi-send");

  function addBubble(role, text) {
    var el = document.createElement("div");
    el.className = "mimi-msg mimi-" + role;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function open() {
    panel.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    if (!log.children.length) addBubble("assistant", GREETING);
    input.focus();
  }

  function close() {
    panel.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    launch.focus();
  }

  launch.addEventListener("click", function () { panel.hidden ? open() : close(); });
  root.querySelector(".mimi-close").addEventListener("click", close);
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    input.value = "";
    addBubble("user", text);
    history.push({ role: "user", content: text });
    var typing = addBubble("assistant", "Mimi is typing…");
    typing.classList.add("mimi-typing");

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.data && r.data.error === "limit") {
          history.pop();
          typing.classList.remove("mimi-typing");
          typing.textContent = "You've reached the chat limit for now. Please try again in an hour, or reach us through the contact form or info@cascadesinfosec.com.";
          return;
        }
        if (!r.ok || !r.data.reply) throw new Error("bad response");
        typing.classList.remove("mimi-typing");
        typing.textContent = r.data.reply;
        history.push({ role: "assistant", content: r.data.reply });
      })
      .catch(function () {
        history.pop();
        typing.classList.remove("mimi-typing");
        typing.textContent = "Sorry, I can't connect right now. Please use the contact form or email info@cascadesinfosec.com.";
      })
      .then(function () {
        busy = false;
        send.disabled = false;
        log.scrollTop = log.scrollHeight;
        input.focus();
      });
  });
})();
