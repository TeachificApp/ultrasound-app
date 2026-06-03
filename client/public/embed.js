/**
 * Teachific / All About Ultrasound — Form Embed Widget Loader
 * Usage:
 * <script src="https://platformdomain.com/embed.js" data-form-id="123" data-widget-id="WIDGET_KEY" async></script>
 */
(function () {
  "use strict";

  var SCRIPT = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  if (!SCRIPT) return;

  var formId = SCRIPT.getAttribute("data-form-id");
  var widgetId = SCRIPT.getAttribute("data-widget-id") || SCRIPT.getAttribute("data-widget-key");
  if (!formId || !widgetId) {
    console.warn("[FormEmbed] Missing data-form-id or data-widget-id");
    return;
  }

  var scriptSrc = SCRIPT.src || "";
  var apiBase = scriptSrc.replace(/\/embed\.js(\?.*)?$/, "");
  var sessionKey = (function () {
    try {
      var k = "tf_embed_sess_" + widgetId;
      var v = sessionStorage.getItem(k);
      if (!v) {
        v = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return "anon";
    }
  })();

  var hostDomain = window.location.hostname;
  var state = {
    config: null,
    opened: false,
    root: null,
    shadow: null,
    iframe: null,
    triggersBound: false,
  };

  function deviceType() {
    var w = window.innerWidth;
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  }

  function track(eventType, triggerSource, metadata) {
    if (!state.config) return;
    var settings = state.config.settings && state.config.settings.analytics;
    if (settings) {
      if (eventType === "widget_loaded" && !settings.trackLoads) return;
      if (eventType === "widget_viewed" && !settings.trackViews) return;
      if (eventType === "widget_opened" && !settings.trackOpens) return;
      if (eventType === "widget_closed" && !settings.trackCloses) return;
      if (eventType === "form_started" && !settings.trackFormStarted) return;
      if (eventType === "form_submitted" && !settings.trackConversions) return;
    }
    fetch(apiBase + "/api/form-embed/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formId: Number(formId),
        widgetKey: widgetId,
        eventType: eventType,
        triggerSource: triggerSource || null,
        sessionKey: sessionKey,
        host: hostDomain,
        metadata: metadata || null,
      }),
      keepalive: true,
    }).catch(function () {});
  }

  function frequencyAllowsOpen(triggers) {
    var freq = (triggers && triggers.openFrequency) || "once_per_session";
    var storageKey = "tf_embed_open_" + widgetId;
    try {
      if (freq === "once_per_session") {
        if (sessionStorage.getItem(storageKey)) return false;
      }
      if (freq === "once_per_user") {
        if (localStorage.getItem(storageKey)) return false;
      }
    } catch (e) {}
    return true;
  }

  function markOpened(triggers) {
    var freq = (triggers && triggers.openFrequency) || "once_per_session";
    var storageKey = "tf_embed_open_" + widgetId;
    try {
      if (freq === "once_per_session") sessionStorage.setItem(storageKey, "1");
      if (freq === "once_per_user") localStorage.setItem(storageKey, "1");
    } catch (e) {}
  }

  function createShadowRoot() {
    if (state.root) return state.root;
    var host = document.createElement("div");
    host.id = "tf-form-embed-" + widgetId;
    host.style.cssText = "all:initial;font-family:system-ui,sans-serif;";
    document.body.appendChild(host);
    state.root = host;
    state.shadow = host.attachShadow({ mode: "open" });
    return state.shadow;
  }

  function buildIframe(embedUrl, style) {
    var iframe = document.createElement("iframe");
    iframe.src = embedUrl + (embedUrl.indexOf("?") >= 0 ? "&" : "?") + "widget=" + encodeURIComponent(widgetId);
    iframe.title = "Embedded Form";
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allow", "payment *; clipboard-write");
    iframe.style.cssText = style || "width:100%;height:600px;border:none;display:block;background:#fff;";
    iframe.loading = "lazy";
    return iframe;
  }

  function renderInline(cfg) {
    var inline = cfg.settings.inline || {};
    var container = document.createElement("div");
    container.className = "tf-embed-inline";
    container.style.cssText =
      "width:" + (inline.width || "100%") + ";" +
      "max-width:" + (inline.maxWidth || "720px") + ";" +
      "margin:0 auto;padding:" + (inline.containerPadding || "0") + ";" +
      "border-radius:" + (inline.borderRadius || "12px") + ";" +
      "overflow:hidden;" +
      (inline.responsive ? "box-sizing:border-box;" : "");

    var iframe = buildIframe(cfg.embedUrl, "width:100%;height:" + (inline.autoHeight ? "800" : "600") + "px;border:none;display:block;border-radius:" + (inline.borderRadius || "12px") + ";");
    state.iframe = iframe;
    container.appendChild(iframe);

    var mount = SCRIPT.parentNode;
    if (mount && mount !== document.body) {
      mount.insertBefore(container, SCRIPT.nextSibling);
    } else {
      document.body.appendChild(container);
    }
    track("widget_viewed", "inline");
  }

  function openOverlay(cfg, triggerSource) {
    if (state.opened) return;
    var displayType = cfg.displayType;
    var triggers = displayType === "popup"
      ? (cfg.settings.popup && cfg.settings.popup.triggers)
      : (cfg.settings.slideIn && cfg.settings.slideIn.triggers);
    if (!frequencyAllowsOpen(triggers)) return;

    state.opened = true;
    markOpened(triggers);
    track("widget_opened", triggerSource);

    var shadow = createShadowRoot();
    shadow.innerHTML = "";

    var popup = cfg.settings.popup || {};
    var slide = cfg.settings.slideIn || {};
    var isPopup = displayType === "popup";

    var overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;display:flex;" +
      (isPopup ? "align-items:center;justify-content:center;" : "") +
      "background:" + (popup.overlayColor || "#000") + ";" +
      "opacity:" + (popup.overlayOpacity != null ? popup.overlayOpacity : 0.55) + ";";

    if (isPopup && popup.clickOutsideToClose !== false) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeOverlay("click_outside");
      });
    }

    var panel = document.createElement("div");
    panel.style.cssText = "position:fixed;z-index:2147483647;background:#fff;display:flex;flex-direction:column;overflow:hidden;";

    if (isPopup) {
      panel.style.width = popup.width || "640px";
      panel.style.height = popup.height || "80vh";
      panel.style.maxWidth = "95vw";
      panel.style.maxHeight = "95vh";
      panel.style.borderRadius = popup.borderRadius || "16px";
      if (popup.shadow !== false) panel.style.boxShadow = "0 25px 50px rgba(0,0,0,0.25)";
      panel.style.left = "50%";
      panel.style.top = "50%";
      panel.style.transform = "translate(-50%,-50%)";
    } else {
      var pos = slide.position || "right";
      panel.style.height = slide.panelHeight || "100vh";
      panel.style.width = slide.panelWidth || "420px";
      panel.style.maxWidth = "100vw";
      panel.style.borderRadius = slide.borderRadius || "12px 0 0 12px";
      if (slide.shadow !== false) panel.style.boxShadow = "-4px 0 24px rgba(0,0,0,0.15)";
      if (pos === "right") {
        panel.style.top = "0";
        panel.style.right = "0";
      } else if (pos === "left") {
        panel.style.top = "0";
        panel.style.left = "0";
        panel.style.borderRadius = "0 12px 12px 0";
      } else {
        panel.style.bottom = "0";
        panel.style.left = "0";
        panel.style.right = "0";
        panel.style.width = "100%";
        panel.style.height = "70vh";
        panel.style.borderRadius = "12px 12px 0 0";
      }
    }

    if (isPopup && popup.showCloseButton !== false) {
      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.textContent = "×";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.style.cssText = "position:absolute;top:8px;right:12px;z-index:2;border:none;background:rgba(0,0,0,0.06);width:32px;height:32px;border-radius:50%;font-size:22px;cursor:pointer;line-height:1;";
      closeBtn.onclick = function () { closeOverlay("close_button"); };
      panel.appendChild(closeBtn);
    }

    var iframe = buildIframe(cfg.embedUrl, "flex:1;width:100%;height:100%;border:none;");
    state.iframe = iframe;
    panel.appendChild(iframe);

    shadow.appendChild(overlay);
    shadow.appendChild(panel);
    state._closeOverlay = closeOverlay;
    track("widget_viewed", triggerSource);
  }

  function closeOverlay(source) {
    if (!state.opened) return;
    state.opened = false;
    track("widget_closed", source);
    if (state.root && state.root.parentNode) {
      state.root.parentNode.removeChild(state.root);
    }
    state.root = null;
    state.shadow = null;
  }

  function bindTriggers(cfg) {
    if (state.triggersBound) return;
    state.triggersBound = true;

    var displayType = cfg.displayType;
    if (displayType === "inline") return;

    var triggers = displayType === "popup"
      ? (cfg.settings.popup && cfg.settings.popup.triggers) || {}
      : (cfg.settings.slideIn && cfg.settings.slideIn.triggers) || {};

    if (triggers.openImmediately) {
      openOverlay(cfg, "immediate");
      return;
    }

    if (triggers.delaySeconds > 0) {
      setTimeout(function () { openOverlay(cfg, "delay"); }, triggers.delaySeconds * 1000);
    }

    if (triggers.scrollPercent > 0) {
      var scrollHandler = function () {
        var doc = document.documentElement;
        var scrollTop = window.scrollY || doc.scrollTop;
        var max = (doc.scrollHeight - window.innerHeight) || 1;
        if ((scrollTop / max) * 100 >= triggers.scrollPercent) {
          openOverlay(cfg, "scroll");
          window.removeEventListener("scroll", scrollHandler);
        }
      };
      window.addEventListener("scroll", scrollHandler, { passive: true });
    }

    if (triggers.exitIntent) {
      document.addEventListener("mouseout", function (e) {
        if (e.clientY <= 0) openOverlay(cfg, "exit_intent");
      });
    }

    if (triggers.inactivitySeconds > 0) {
      var idleTimer;
      var resetIdle = function () {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () { openOverlay(cfg, "inactivity"); }, triggers.inactivitySeconds * 1000);
      };
      ["mousemove", "keydown", "scroll", "touchstart"].forEach(function (ev) {
        document.addEventListener(ev, resetIdle, { passive: true });
      });
      resetIdle();
    }

    if (triggers.buttonClick) {
      var btnSel = triggers.buttonSelector || "[data-tf-form-trigger='" + widgetId + "']";
      document.addEventListener("click", function (e) {
        var t = e.target;
        if (t && t.closest && t.closest(btnSel)) openOverlay(cfg, "button_click");
      });
    }

    if (triggers.linkClick && triggers.linkSelector) {
      document.addEventListener("click", function (e) {
        var t = e.target;
        if (t && t.closest && t.closest(triggers.linkSelector)) openOverlay(cfg, "link_click");
      });
    }

    if (triggers.customElementSelector) {
      document.addEventListener("click", function (e) {
        var t = e.target;
        if (t && t.closest && t.closest(triggers.customElementSelector)) openOverlay(cfg, "custom_element");
      });
    }

    if (displayType === "slide_in" && (cfg.settings.slideIn || {}).minimizedState) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.textContent = (cfg.settings.slideIn && cfg.settings.slideIn.floatingTabLabel) || "Form";
      tab.style.cssText = "position:fixed;z-index:2147483645;right:0;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;padding:12px 8px;border:none;border-radius:8px 0 0 8px;background:#0e7490;color:#fff;font:600 13px system-ui;cursor:pointer;box-shadow:-2px 0 8px rgba(0,0,0,0.15);";
      tab.onclick = function () { openOverlay(cfg, "tab_click"); };
      document.body.appendChild(tab);
    }

    if (displayType === "popup" && (cfg.settings.popup || {}).triggerButtonLabel) {
      var exists = document.querySelector("[data-tf-form-trigger='" + widgetId + "']");
      if (!exists) {
        var floater = document.createElement("button");
        floater.type = "button";
        floater.setAttribute("data-tf-form-trigger", widgetId);
        floater.textContent = cfg.settings.popup.triggerButtonLabel || "Open Form";
        floater.style.cssText = "position:fixed;z-index:2147483644;bottom:24px;right:24px;padding:12px 20px;border:none;border-radius:999px;background:#0e7490;color:#fff;font:600 14px system-ui;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.2);";
        floater.onclick = function () { openOverlay(cfg, "floating_button"); };
        document.body.appendChild(floater);
      }
    }
  }

  window.addEventListener("message", function (e) {
    var data = e.data;
    if (!data || data.type !== "teachific-form-embed") return;
    if (String(data.widgetKey) !== String(widgetId)) return;
    if (data.event === "form_started") track("form_started", data.triggerSource || "iframe");
    if (data.event === "form_submitted") {
      track("form_submitted", data.triggerSource || "iframe");
      var cfg = state.config;
      if (!cfg || cfg.displayType === "inline") return;
      var onSubmit = cfg.displayType === "popup"
        ? (cfg.settings.popup && cfg.settings.popup.onSubmit)
        : (cfg.settings.slideIn && cfg.settings.slideIn.onSubmit);
      if (onSubmit === "close" || onSubmit === "replace_confirmation") {
        closeOverlay("submit");
      }
    }
  });

  fetch(apiBase + "/api/form-embed/config?formId=" + encodeURIComponent(formId) +
    "&widgetId=" + encodeURIComponent(widgetId) +
    "&host=" + encodeURIComponent(hostDomain) +
    "&sessionKey=" + encodeURIComponent(sessionKey))
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (!cfg || !cfg.allowed) return;
      state.config = cfg;
      track("widget_loaded", "script");

      if (cfg.displayType === "inline") {
        renderInline(cfg);
      } else {
        bindTriggers(cfg);
      }
    })
    .catch(function (err) {
      console.warn("[FormEmbed] Failed to load config", err);
    });
})();
