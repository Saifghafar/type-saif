/* Type Saif — TS.views.settings
 * Settings view: typing preferences (toggles + selects, persisted immediately
 * to ts_settings), data export / import (validated round-trip), full reset
 * (double-confirmed), and a note about local storage.
 */
(function () {
  "use strict";

  var TS = window.TypeSaif = window.TypeSaif || {};
  TS.views = TS.views || {};

  var DEFAULTS = {
    sound: true,
    keySound: true,
    keyboard: true,
    fingerGuide: true,
    highlight: "caret",       // "caret" | "block"
    difficulty: "normal",     // "easy" | "normal" | "hard"
    backspace: "allow",       // "allow" | "block"
    reducedMotion: false,
    layout: "qwerty"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getStore(key, fb) {
    try { if (TS.store && typeof TS.store.get === "function") return TS.store.get(key, fb); } catch (e) {}
    return fb;
  }
  function setStore(key, val) {
    try { if (TS.store && typeof TS.store.set === "function") TS.store.set(key, val); } catch (e) {}
  }

  function getSettings() {
    var s = getStore("ts_settings", {}) || {};
    var out = {};
    for (var k in DEFAULTS) out[k] = (s[k] !== undefined) ? s[k] : DEFAULTS[k];
    return out;
  }

  function toast(msg) {
    try { if (TS.ui && typeof TS.ui.toast === "function") { TS.ui.toast(msg); return; } } catch (e) {}
    var d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0F172A;color:#fff;padding:10px 16px;border-radius:8px;z-index:9999;font-size:14px;";
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2400);
  }

  function confirmDlg(message) {
    try {
      if (TS.ui && typeof TS.ui.confirmDialog === "function") {
        return Promise.resolve(TS.ui.confirmDialog(message));
      }
    } catch (e) {}
    return Promise.resolve(window.confirm(message));
  }

  function saveSettings(s) {
    setStore("ts_settings", s);
    try {
      document.body.classList.toggle("reduced-motion", !!s.reducedMotion);
    } catch (e) {}
    toast("Saved");
  }

  function toggleRow(key, title, desc, checked) {
    return '<div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--border,#E2E8F0);">' +
      '<div><div style="font-weight:600;">' + esc(title) + '</div>' +
      (desc ? '<div class="text-2" style="font-size:13px;">' + esc(desc) + "</div>" : "") + "</div>" +
      '<label class="switch"><input type="checkbox" data-setting="' + key + '"' + (checked ? " checked" : "") +
      ' aria-label="' + esc(title) + '"><span class="slider"></span></label></div>';
  }

  function selectRow(key, title, desc, options, value) {
    var opts = options.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (value === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("");
    return '<div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--border,#E2E8F0);">' +
      '<div><div style="font-weight:600;">' + esc(title) + '</div>' +
      (desc ? '<div class="text-2" style="font-size:13px;">' + esc(desc) + "</div>" : "") + "</div>" +
      '<select class="input" data-setting="' + key + '" aria-label="' + esc(title) + '">' + opts + "</select></div>";
  }

  TS.views.settings = {
    render: function (el) {
      var s = getSettings();

      var html = '<div class="page-head"><h1>Settings</h1>' +
        '<p class="text-2">Changes save immediately.</p></div>';

      // ---- Typing preferences ----
      html += '<div class="card" style="margin-bottom:16px;"><h3>Typing preferences</h3>';
      html += toggleRow("sound", "Sound effects", "Play sounds for lesson events and achievements.", s.sound);
      html += toggleRow("keySound", "Typing key sounds", "Subtle click on each keystroke.", s.keySound);
      html += toggleRow("keyboard", "Show virtual keyboard", "Display the on-screen keyboard during lessons.", s.keyboard);
      html += toggleRow("fingerGuide", "Finger guidance", "Show which finger to use for each key.", s.fingerGuide);
      html += toggleRow("reducedMotion", "Reduced motion", "Disable animations and transitions.", s.reducedMotion);
      html += selectRow("highlight", "Current-character highlight", "How the next character is marked.",
        [["caret", "Caret (blinking line)"], ["block", "Block (highlighted box)"]], s.highlight);
      html += selectRow("difficulty", "Default difficulty", "Used for practice mode and games.",
        [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], s.difficulty);
      html += selectRow("backspace", "Backspace behavior", "Whether you can erase mistakes while typing.",
        [["allow", "Allow backspace"], ["block", "Block backspace"]], s.backspace);
      html += selectRow("layout", "Keyboard layout", "More layouts coming soon.",
        [["qwerty", "QWERTY"]], s.layout);
      html += "</div>";

      // ---- Data ----
      html += '<div class="card" style="margin-bottom:16px;"><h3>Your data</h3>' +
        '<p class="text-2">Back up your progress, restore it on this device, or start over.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">' +
        '<button type="button" class="btn btn-primary" id="set-export">Export backup</button>' +
        '<label class="btn btn-ghost" for="set-import" style="cursor:pointer;">Import backup</label>' +
        '<input type="file" id="set-import" accept="application/json,.json" style="display:none;">' +
        '<button type="button" class="btn btn-ghost" id="set-reset" style="color:#DC2626;">Reset all progress</button>' +
        "</div></div>";

      // ---- Storage note ----
      html += '<div class="card"><h3>Where your data lives</h3>' +
        "<p>All of your progress is stored locally in this browser on this device (browser local storage). " +
        "There is no account and no cross-device sync — your data does not leave this device unless you export a backup yourself.</p>" +
        "<p class=\"text-2\">Clearing your browser's site data will permanently delete your progress. " +
        "Export a backup regularly if you want to keep it safe.</p></div>";

      el.innerHTML = html;

      // Apply reduced-motion class immediately for current value
      try { document.body.classList.toggle("reduced-motion", !!s.reducedMotion); } catch (e) {}

      // Bind toggles + selects
      var inputs = el.querySelectorAll("[data-setting]");
      for (var i = 0; i < inputs.length; i++) {
        (function (inp) {
          inp.addEventListener("change", function () {
            var key = inp.getAttribute("data-setting");
            var cur = getSettings();
            if (inp.type === "checkbox") {
              cur[key] = !!inp.checked;
            } else {
              cur[key] = inp.value;
            }
            saveSettings(cur);
          });
        })(inputs[i]);
      }

      // Export
      el.querySelector("#set-export").addEventListener("click", function () {
        var data = null;
        try {
          if (TS.store && typeof TS.store.exportJSON === "function") {
            data = TS.store.exportJSON();
          }
        } catch (e) { data = null; }
        if (!data) {
          // Fallback: gather known keys manually
          data = {};
          ["ts_settings", "ts_progress", "ts_attempts", "ts_bests", "ts_xp",
           "ts_achievements", "ts_streak", "ts_daily", "ts_games", "ts_practiceSec"
          ].forEach(function (k) { data[k] = getStore(k, null); });
        }
        try {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          var d = new Date();
          var stamp = d.getFullYear() + "-" +
            (d.getMonth() + 1 < 10 ? "0" : "") + (d.getMonth() + 1) + "-" +
            (d.getDate() < 10 ? "0" : "") + d.getDate();
          a.href = url;
          a.download = "type-saif-backup-" + stamp + ".json";
          document.body.appendChild(a);
          a.click();
          setTimeout(function () {
            if (a.parentNode) a.parentNode.removeChild(a);
            URL.revokeObjectURL(url);
          }, 500);
          toast("Backup downloaded");
        } catch (e) {
          toast("Export failed: " + (e && e.message ? e.message : "unknown error"));
        }
      });

      // Import
      el.querySelector("#set-import").addEventListener("change", function (ev) {
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var obj;
          try {
            obj = JSON.parse(reader.result);
          } catch (e) {
            toast("Import failed: file is not valid JSON.");
            ev.target.value = "";
            return;
          }
          var ok = false, err = "";
          try {
            if (TS.store && typeof TS.store.importJSON === "function") {
              var res = TS.store.importJSON(obj);
              if (res && typeof res === "object") { ok = !!res.ok; err = res.error || ""; }
              else { ok = res !== false; }
            } else {
              // Minimal fallback validation: must be a plain object with at least one known key
              var known = ["ts_settings", "ts_progress", "ts_attempts", "ts_bests", "ts_xp",
                "ts_achievements", "ts_streak", "ts_daily", "ts_games", "ts_practiceSec"];
              if (obj && typeof obj === "object" && !Array.isArray(obj) &&
                  known.some(function (k) { return obj[k] !== undefined; })) {
                known.forEach(function (k) { if (obj[k] !== undefined) setStore(k, obj[k]); });
                ok = true;
              } else {
                err = "not a Type Saif backup";
              }
            }
          } catch (e) {
            ok = false;
            err = e && e.message ? e.message : "validation failed";
          }
          ev.target.value = "";
          if (ok) {
            toast("Backup imported — reloading…");
            setTimeout(function () { window.location.reload(); }, 800);
          } else {
            toast("Import failed: " + (err || "invalid backup file"));
          }
        };
        reader.onerror = function () {
          toast("Import failed: could not read file.");
          ev.target.value = "";
        };
        reader.readAsText(file);
      });

      // Reset (double confirm)
      el.querySelector("#set-reset").addEventListener("click", function () {
        confirmDlg("This will permanently delete ALL of your Type Saif progress, settings, XP, and history on this device. Continue?")
          .then(function (first) {
            if (!first) return false;
            return confirmDlg("Last chance: are you absolutely sure you want to erase everything?");
          })
          .then(function (second) {
            if (!second) return;
            try {
              if (TS.store && typeof TS.store.resetAll === "function") TS.store.resetAll();
              else {
                // Fallback: clear known keys manually
                ["ts_settings", "ts_progress", "ts_attempts", "ts_bests", "ts_xp",
                 "ts_achievements", "ts_streak", "ts_daily", "ts_games", "ts_practiceSec"
                ].forEach(function (k) {
                  try { window.localStorage.removeItem(k); } catch (e) {}
                });
              }
            } catch (e) { /* continue to reload regardless */ }
            toast("Progress reset — reloading…");
            setTimeout(function () { window.location.reload(); }, 800);
          });
      });
    },
    destroy: function () { /* no timers/listeners to clean up */ }
  };
})();
