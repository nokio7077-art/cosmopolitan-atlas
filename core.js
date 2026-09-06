/* Cosmopolitan — общий слой: данные прогресса, рейтинг, карта, шапка и подвал. */
(function () {
  "use strict";

  var STORE_KEY = "geomaster_v3";
  var REGION_ORDER = ["europe", "asia", "africa", "namerica", "samerica", "oceania"];
  var REGION_META = {
    europe: { name: "Европа" }, asia: { name: "Азия" }, africa: { name: "Африка" },
    namerica: { name: "Северная Америка" }, samerica: { name: "Южная Америка" },
    oceania: { name: "Австралия и Океания" }
  };
  var FREE = ["europe", "asia"];
  var SIZE_TOL = { S: 0.022, M: 0.038, L: 0.065 };
  var PERSONAS = ["Капитан", "Штурман", "Юнга", "Боцман", "Шкипер", "Матрос", "Картограф", "Навигатор", "Мореход", "Путешественник", "Первопроходец", "Странник", "Кочевник", "Исследователь", "Следопыт", "Скиталец", "Флибустьер", "Пилигрим", "Землепроходец", "Открыватель"];

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
    });
    return n;
  }
  function qs(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }
  function kicker(text, cls) { return el("div", { class: "kicker" + (cls ? " " + cls : "") }, [text]); }
  function bar(pct) { return el("div", { class: "bar" }, [el("i", { style: "width:" + pct + "%" })]); }
  function flagUrl(f, size) { return "https://flagcdn.com/" + (size || "w160") + "/" + f + ".png"; }
  function stars(n) { return new Array(n + 1).join("★") + new Array(4 - n).join("☆"); }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function norm(s) { return (s || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, ""); }
  function lev(a, b) {
    var m = a.length, n = b.length, i, j;
    if (!m) return n; if (!n) return m;
    var prev = []; for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      var cur = [i];
      for (j = 1; j <= n; j++) {
        var c = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      }
      prev = cur;
    }
    return prev[n];
  }
  function fuzzy(typed, correct) {
    var a = norm(typed), b = norm(correct);
    var tol = b.length <= 5 ? 0 : (b.length <= 9 ? 1 : 2);
    return a.length > 0 && lev(a, b) <= tol;
  }

  /* --- прогресс --- */
  function loadProgress() {
    try { var raw = localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return { perCountry: {}, highScore: 0, totalRounds: 0, premium: false, hints: 0, welcomed: false };
  }
  var progress = loadProgress();
  function saveProgress() { try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) {} }

  function entry(iso) { return progress.perCountry[iso]; }
  function isStudied(iso) { var e = entry(iso); return !!e && e.attempts > 0 && (e.sumScore / e.attempts) >= 42; }
  function byIso(iso) { for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].f === iso) return COUNTRIES[i]; return null; }
  function regionCountries(key) {
    return key === "world" ? COUNTRIES.slice() : COUNTRIES.filter(function (c) { return c.r === key; });
  }
  function regionName(key) { return key === "world" ? "Весь мир" : (REGION_META[key] ? REGION_META[key].name : "Мир"); }
  function studiedCount(key) { return regionCountries(key).filter(function (c) { return isStudied(c.f); }).length; }
  function unlocked(key) { return !!progress.premium || FREE.indexOf(key) >= 0; }

  /* --- сессия между страницами --- */
  var SESSION = "cosmopolitan_session";
  function saveSession(obj) { try { sessionStorage.setItem(SESSION, JSON.stringify(obj)); } catch (e) {} }
  function loadSession() { try { var r = sessionStorage.getItem(SESSION); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function clearSession() { try { sessionStorage.removeItem(SESSION); } catch (e) {} }

  /* --- карта --- */
  function project(lng, lat) { return { x: (lng + 180) / 360 * 1000, y: (90 - lat) / 180 * 500 }; }
  function ringCross(r, x, y) {
    var c = 0;
    for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
      var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c++;
    }
    return c;
  }
  function insideCountry(iso, lng, lat) {
    var g = window.GEO_DATA[iso];
    if (!g) return null;
    var blocks = g.t === 0 ? [g.c] : g.c;
    for (var b = 0; b < blocks.length; b++) {
      var rings = blocks[b], total = 0;
      for (var r = 0; r < rings.length; r++) total += ringCross(rings[r], lng, lat);
      if (total % 2 === 1) return true;
    }
    return false;
  }
  var PATHS = null;
  function buildPaths() {
    PATHS = {};
    for (var iso in window.GEO_DATA) {
      var g = window.GEO_DATA[iso], blocks = g.t === 0 ? [g.c] : g.c, d = "";
      for (var b = 0; b < blocks.length; b++) {
        var rings = blocks[b];
        for (var r = 0; r < rings.length; r++) {
          var ring = rings[r];
          for (var k = 0; k < ring.length; k++) {
            var p = project(ring[k][0], ring[k][1]);
            d += (k === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1) + " ";
          }
          d += "Z ";
        }
      }
      PATHS[iso] = d;
    }
  }
  function mapSvg(opts) {
    opts = opts || {};
    if (!PATHS) buildPaths();
    var svg = '<svg viewBox="0 0 1000 500" preserveAspectRatio="none" role="img" aria-label="Карта мира"><rect width="1000" height="500" fill="#f3f2f2"/>';
    for (var iso in PATHS) {
      var fill = opts.highlight === iso ? (opts.highlightFill || "#99e0ff") : "#eae7e7";
      svg += '<path d="' + PATHS[iso] + '" fill="' + fill + '" stroke="#7d7979" stroke-width="0.5"/>';
    }
    (opts.pins || []).forEach(function (p) {
      svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (p.r || 6) + '" fill="' + p.fill + '"/>';
    });
    svg += "</svg>";
    var box = el("div", { class: "mapbox" + (opts.onClick ? " play" : ""), html: svg });
    if (opts.onClick) box.addEventListener("click", opts.onClick);
    return box;
  }

  /* --- рейтинг --- */
  var sb = null;
  try {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_URL.indexOf("ВСТАВЬ") === -1) {
      sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
  } catch (e) {}

  function currentDisplayName() {
    return (progress.playerTitle && progress.playerNumber) ? (progress.playerTitle + " №" + progress.playerNumber) : null;
  }
  function pickPersona(title, cb) {
    if (progress.playerNumber) { progress.playerTitle = title; saveProgress(); cb && cb(true); return; }
    if (!sb) { cb && cb(false, "Рейтинг ещё не подключён"); return; }
    sb.from("players").insert({ title: title }).select().single().then(function (res) {
      if (res.error) { cb && cb(false, res.error.message); return; }
      progress.playerTitle = title; progress.playerNumber = res.data.id; saveProgress();
      cb && cb(true);
    });
  }
  function submitToLeaderboard(regionKey, countries, points, onDone) {
    if (!sb) { onDone && onDone(false, "Рейтинг ещё не подключён"); return; }
    var dn = currentDisplayName();
    if (!dn) { onDone && onDone(false, "Сначала выбери титул в настройках"); return; }
    sb.from("leaderboard").insert({ name: dn, region: regionName(regionKey), countries: countries, points: points })
      .then(function (res) { onDone && onDone(!res.error, res.error ? res.error.message : null); });
  }
  function fetchLeaderboard(cb) {
    if (!sb) { cb([], "Рейтинг ещё не подключён"); return; }
    var weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    sb.from("leaderboard").select("*").gte("created_at", weekAgo).order("points", { ascending: false }).limit(100)
      .then(function (res) {
        if (res.error) { cb([], res.error.message); return; }
        var seen = {}, out = [];
        (res.data || []).forEach(function (row) {
          var key = String(row.name).toLowerCase();
          if (!seen[key]) { seen[key] = true; out.push(row); }
        });
        cb(out, null);
      });
  }

  /* --- шапка, подвал, куки --- */
  var NAV = [
    ["index.html", "Дом"], ["play.html", "Играть"], ["flags.html", "Флаги"],
    ["learn.html", "Карточки"], ["board.html", "Рейтинг"], ["stats.html", "Статистика"], ["settings.html", "Настройки"]
  ];
  function chrome() {
    var here = (location.pathname.split("/").pop() || "index.html");
    var links = el("nav", { class: "navlinks" }, NAV.map(function (item) {
      return el("a", { href: item[0], class: here === item[0] ? "on" : "" }, [item[1]]);
    }));
    var header = el("header", { class: "nav" }, [
      el("div", { class: "wrap" }, [el("a", { class: "nav-brand", href: "index.html" }, ["Cosmopolitan"]), links])
    ]);
    document.body.insertBefore(header, document.body.firstChild);

    var footer = el("footer", { class: "site-footer" }, [
      el("div", { class: "wrap" }, [
        el("span", {}, ["Cosmopolitan — атлас памяти. 192 страны, столицы и флаги."]),
        el("span", {}, [el("a", { href: "about.html" }, ["О проекте"]), " · ", el("a", { href: "privacy.html" }, ["Политика конфиденциальности"])])
      ])
    ]);
    document.body.appendChild(footer);

    var seen = false;
    try { seen = !!localStorage.getItem("cookieNoticeSeen"); } catch (e) { seen = true; }
    if (!seen) {
      var okBtn = el("button", { class: "btn primary", type: "button" }, ["Хрум, понятно"]);
      var barEl = el("div", { class: "cookie-bar" }, [
        el("p", {}, ["Этот атлас работает на печеньках 🍪 (обычных веб-куки — вкусных, увы, не завезли). Помнят твой прогресс и ", el("a", { href: "privacy.html" }, ["как это устроено"]), "."]),
        okBtn
      ]);
      okBtn.addEventListener("click", function () {
        barEl.remove();
        try { localStorage.setItem("cookieNoticeSeen", "1"); } catch (e) {}
      });
      document.body.appendChild(barEl);
    }
  }

  window.CA = {
    el: el, qs: qs, kicker: kicker, bar: bar, flagUrl: flagUrl, stars: stars,
    shuffle: shuffle, norm: norm, fuzzy: fuzzy,
    progress: progress, saveProgress: saveProgress, entry: entry, isStudied: isStudied,
    byIso: byIso, regionCountries: regionCountries, regionName: regionName, studiedCount: studiedCount,
    unlocked: unlocked, REGION_ORDER: REGION_ORDER, SIZE_TOL: SIZE_TOL, PERSONAS: PERSONAS,
    saveSession: saveSession, loadSession: loadSession, clearSession: clearSession,
    project: project, insideCountry: insideCountry, mapSvg: mapSvg,
    currentDisplayName: currentDisplayName, pickPersona: pickPersona,
    submitToLeaderboard: submitToLeaderboard, fetchLeaderboard: fetchLeaderboard, hasServer: !!sb,
    mount: function (node) { document.getElementById("app").appendChild(el("div", { class: "wrap" }, [node])); },
    ready: function (fn) { chrome(); fn(); }
  };
})();
