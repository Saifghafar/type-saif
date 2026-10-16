/* Type Saif — js/05-keyboard.js — TS.keyboard
 *
 * Visual QWERTY keyboard (3 letter rows + space row). Purely a display aid:
 * typing always goes through the engine's keydown / input path.
 *
 *   TS.keyboard.render(el, {
 *     layout:     "qwerty",   // only layout supported (reserved for future)
 *     showFingers: true,      // color-code keys by touch-typing finger
 *     targetChar:  "a",       // char to highlight with .vk-target
 *     fingerMap:   null       // optional {char:fingerId} override
 *   });
 *   TS.keyboard.updateTarget("s"); // move .vk-target without re-render
 *   TS.keyboard.fingerFor("d");    // → "left-middle"
 *
 * Finger ids: left-pinky, left-ring, left-middle, left-index,
 *             right-index, right-middle, right-ring, right-pinky,
 *             right-thumb (space).
 *
 * Uses contract CSS classes: .vk-key, .vk-target, .vk-finger-*.
 */
(function () {
  "use strict";

  var TS = (window.TS = window.TS || {});

  /* Default QWERTY touch-typing map (home-row based, incl. upper/lower
   * reach). Uppercase is normalized to lowercase by fingerFor(). */
  var FINGERS = {
    q: "left-pinky",  a: "left-pinky",  z: "left-pinky",
    w: "left-ring",   s: "left-ring",   x: "left-ring",
    e: "left-middle", d: "left-middle", c: "left-middle",
    r: "left-index",  f: "left-index",  v: "left-index",
    t: "left-index",  g: "left-index",  b: "left-index",
    y: "right-index", h: "right-index", n: "right-index",
    u: "right-index", j: "right-index", m: "right-index",
    i: "right-middle", k: "right-middle",
    o: "right-ring",   l: "right-ring",
    p: "right-pinky",
    " ": "right-thumb"
  };

  var FINGER_LABELS = {
    "left-pinky": "Left pinky",
    "left-ring": "Left ring",
    "left-middle": "Left middle",
    "left-index": "Left index",
    "right-index": "Right index",
    "right-middle": "Right middle",
    "right-ring": "Right ring",
    "right-pinky": "Right pinky",
    "right-thumb": "Thumb (space)"
  };

  var LEGEND_ORDER = [
    "left-pinky", "left-ring", "left-middle", "left-index",
    "right-index", "right-middle", "right-ring", "right-pinky"
  ];

  var ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

  // Last rendered board — updateTarget() operates on it.
  var current = null; // {el, keys:{char:node}, map}

  function fingerFor(ch) {
    if (ch === null || ch === undefined) return null;
    var c = String(ch).toLowerCase();
    return FINGERS[c] || null;
  }

  function fingerClass(finger) {
    return finger ? "vk-finger-" + finger : "";
  }

  function makeKey(ch, label, extraClass, map, showFingers) {
    var k = document.createElement("div");
    k.className = "vk-key" + (extraClass ? " " + extraClass : "");
    k.setAttribute("data-char", ch);
    k.textContent = label;
    if (showFingers) {
      var f = map[ch.toLowerCase()] || fingerFor(ch);
      if (f) {
        k.classList.add(fingerClass(f));
        k.title = (FINGER_LABELS[f] || f) + " — " + label;
      }
    } else {
      k.title = label;
    }
    return k;
  }

  function render(el, opts) {
    opts = opts || {};
    var map = opts.fingerMap || FINGERS; // custom override for key coloring
    var showFingers = !!opts.showFingers;

    el.innerHTML = "";
    el.classList.add("vk-board");

    var keys = {};

    for (var r = 0; r < ROWS.length; r++) {
      var rowEl = document.createElement("div");
      rowEl.className = "vk-row";
      var row = ROWS[r];
      for (var i = 0; i < row.length; i++) {
        var ch = row.charAt(i);
        var k = makeKey(ch, ch.toUpperCase(), "", map, showFingers);
        rowEl.appendChild(k);
        keys[ch] = k;
      }
      el.appendChild(rowEl);
    }

    // Space row
    var spRow = document.createElement("div");
    spRow.className = "vk-row";
    var sp = makeKey(" ", "space", "vk-space", map, showFingers);
    spRow.appendChild(sp);
    el.appendChild(spRow);
    keys[" "] = sp;

    // Beginner finger legend (only when finger hints are shown)
    if (showFingers) {
      var legend = document.createElement("div");
      legend.className = "vk-legend";
      for (var l = 0; l < LEGEND_ORDER.length; l++) {
        var f = LEGEND_ORDER[l];
        var item = document.createElement("span");
        item.className = "vk-legend-item";
        var dot = document.createElement("span");
        dot.className = "vk-key vk-legend-dot " + fingerClass(f);
        dot.setAttribute("aria-hidden", "true");
        var lab = document.createElement("span");
        lab.textContent = FINGER_LABELS[f];
        item.appendChild(dot);
        item.appendChild(lab);
        legend.appendChild(item);
      }
      el.appendChild(legend);
    }

    current = { el: el, keys: keys, map: map };

    if (opts.targetChar !== null && opts.targetChar !== undefined) {
      updateTarget(opts.targetChar);
    }
  }

  /* Move the .vk-target highlight without a full re-render. */
  function updateTarget(ch) {
    if (!current) return;
    var olds = current.el.querySelectorAll(".vk-target");
    for (var i = 0; i < olds.length; i++) {
      olds[i].classList.remove("vk-target");
    }
    var key = String(ch === null || ch === undefined ? "" : ch).toLowerCase();
    var node = current.keys[key];
    if (node) node.classList.add("vk-target");
  }

  TS.keyboard = {
    render: render,
    updateTarget: updateTarget,
    fingerFor: fingerFor
  };
})();
