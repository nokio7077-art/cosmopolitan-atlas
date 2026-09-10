/* Cosmopolitan — общий слой: данные прогресса, рейтинг, карта, шапка и подвал. */
(function () {
  "use strict";

  var STORE_KEY = "geomaster_v3";
  // Личная статистика: счётчик Яндекс Метрики
  var YANDEX_METRIKA_ID = 112345804;
  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
  })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id='+YANDEX_METRIKA_ID, 'ym');
  window.ym(YANDEX_METRIKA_ID, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
  var REGION_ORDER = ["europe", "asia", "africa", "namerica", "samerica", "oceania"];
  var REGION_META = {
    europe: { name: "Европа" }, asia: { name: "Азия" }, africa: { name: "Африка" },
    namerica: { name: "Северная Америка" }, samerica: { name: "Южная Америка" },
    oceania: { name: "Австралия и Океания" }
  };
  var FREE = ["europe", "asia"];
  // Пока нет рекламы и продаж, платной версии не существует: все регионы открыты,
  // подсказки не кончаются. Вернуть премиум — поставить здесь true.
  var PREMIUM_ENABLED = false;
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
  function flagUrl(f) { return "flags/" + f + ".svg"; }

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

  /* --- население --- */
  function population(iso) { return (window.POPULATION && POPULATION[iso]) || null; }
  function groupDigits(n) {
    var s = String(n), out = "";
    for (var i = s.length; i > 0; i -= 3) out = s.slice(Math.max(0, i - 3), i) + (out ? "\u00A0" + out : "");
    return out;
  }
  // «146 млн» запоминается лучше, чем «146 000 000», поэтому от миллиона и выше
  // округляем, а маленькие страны показываем полным числом — там важна каждая тысяча.
  function popText(iso) {
    var n = population(iso);
    if (!n) return null;
    if (n < 1000000) return groupDigits(n);
    if (n >= 1000000000) return String(Math.round(n / 10000000) / 100).replace(".", ",") + "\u00A0млрд";
    var m = n / 1000000;
    return (m >= 100 ? String(Math.round(m)) : String(Math.round(m * 10) / 10).replace(".", ",")) + "\u00A0млн";
  }

  /* --- прогресс --- */
  function loadProgress() {
    try { var raw = localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return { perCountry: {}, highScore: 0, totalRounds: 0, premium: false, hints: 0, welcomed: false };
  }
  var progress = loadProgress();
  function saveProgress() { try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) {} }

  function entry(iso) { return progress.perCountry[iso]; }
  // За раунд дают 30 очков: столица, флаг и карта по десятке. Изученной считаем
  // страну, если в среднем берутся хотя бы два шага из трёх.
  function isStudied(iso) { var e = entry(iso); return !!e && e.attempts > 0 && (e.sumScore / e.attempts) >= 20; }
  function byIso(iso) { for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].f === iso) return COUNTRIES[i]; return null; }
  function regionCountries(key) {
    return key === "world" ? COUNTRIES.slice() : COUNTRIES.filter(function (c) { return c.r === key; });
  }
  function regionName(key) { return key === "world" ? "Весь мир" : (REGION_META[key] ? REGION_META[key].name : "Мир"); }
  function studiedCount(key) { return regionCountries(key).filter(function (c) { return isStudied(c.f); }).length; }
  function unlocked(key) { return !PREMIUM_ENABLED || !!progress.premium || FREE.indexOf(key) >= 0; }
  function hintsLeft() { return PREMIUM_ENABLED ? (progress.hints || 0) : Infinity; }
  function spendHint() {
    if (!PREMIUM_ENABLED) return;
    if (progress.hints > 0) { progress.hints--; saveProgress(); }
  }

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
  var GEOM = {};
  // Контур страны в координатах карты: точки для проверки «рядом ли клик» и рамки
  // отдельных кусков суши — по ним же считается масштаб крупного плана.
  function geom(iso) {
    if (GEOM.hasOwnProperty(iso)) return GEOM[iso];
    var g = window.GEO_DATA[iso];
    if (!g) return (GEOM[iso] = null);
    var blocks = g.t === 0 ? [g.c] : g.c, pts = [], boxes = [];
    for (var b = 0; b < blocks.length; b++) {
      var rings = blocks[b], bx = null;
      for (var r = 0; r < rings.length; r++) {
        var ring = rings[r];
        for (var k = 0; k < ring.length; k++) {
          var p = project(ring[k][0], ring[k][1]);
          pts.push(p);
          if (!bx) bx = { x0: p.x, x1: p.x, y0: p.y, y1: p.y };
          else {
            if (p.x < bx.x0) bx.x0 = p.x;
            if (p.x > bx.x1) bx.x1 = p.x;
            if (p.y < bx.y0) bx.y0 = p.y;
            if (p.y > bx.y1) bx.y1 = p.y;
          }
        }
      }
      if (bx) boxes.push(bx);
    }
    GEOM[iso] = pts.length ? { pts: pts, boxes: boxes } : null;
    return GEOM[iso];
  }
  // Попал ли клик внутрь какой-нибудь другой страны. Нужно, чтобы поблажка «почти
  // попал в границу» не превращала соседнее государство в правильный ответ:
  // клик в Испании — это Испания, а не «почти Португалия».
  function insideAnyOther(iso, lng, lat) {
    for (var other in window.GEO_DATA) {
      if (other === iso) continue;
      if (insideCountry(other, lng, lat)) return true;
    }
    return false;
  }
  // Клик у самого берега или на границе — тоже попадание: контуры в данных
  // упрощены, да и палец на телефоне не бывает ювелирно точным.
  function nearCountry(iso, x, y, tol) {
    var g = geom(iso);
    if (!g) return false;
    var t2 = tol * tol;
    for (var i = 0; i < g.pts.length; i++) {
      var dx = g.pts[i].x - x, dy = g.pts[i].y - y;
      if (dx * dx + dy * dy <= t2) return true;
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
  /* --- политическая раскраска --- */
  // Соседние страны должны отличаться по цвету, иначе граница между ними теряется.
  // Точный список соседей считать неоткуда, поэтому соседство определяем по
  // близости рамок кусков суши, а дальше — обычная жадная раскраска.
  var POLI_COLORS = ["#f7d9a8", "#cfe6b4", "#bcdcf2", "#f3c9c3", "#dfd2f0", "#f8ecab", "#c3e4dc", "#f0cfe0", "#dde3b8"];
  var POLI = null;
  function boxesNear(a, b, tol) {
    return a.x0 - tol <= b.x1 && b.x0 - tol <= a.x1 && a.y0 - tol <= b.y1 && b.y0 - tol <= a.y1;
  }
  function buildPolitical() {
    POLI = {};
    var isos = [], big = {}, i, j;
    for (var iso in window.GEO_DATA) {
      var g = geom(iso);
      if (!g) continue;
      isos.push(iso);
      big[iso] = g.boxes;
    }
    var nb = {};
    isos.forEach(function (a) { nb[a] = []; });
    for (i = 0; i < isos.length; i++) {
      for (j = i + 1; j < isos.length; j++) {
        var A = big[isos[i]], B = big[isos[j]], touch = false;
        for (var x = 0; x < A.length && !touch; x++) {
          for (var y = 0; y < B.length; y++) {
            if (boxesNear(A[x], B[y], 1.2)) { touch = true; break; }
          }
        }
        if (touch) { nb[isos[i]].push(isos[j]); nb[isos[j]].push(isos[i]); }
      }
    }
    // Начинаем с самых «многососедних» стран — так реже приходится брать
    // девятый цвет там, где хватило бы четырёх.
    isos.sort(function (a, b) { return nb[b].length - nb[a].length; });
    isos.forEach(function (iso) {
      var used = {};
      nb[iso].forEach(function (o) { if (POLI[o] !== undefined) used[POLI[o]] = true; });
      var c = 0;
      while (used[c] && c < POLI_COLORS.length - 1) c++;
      POLI[iso] = c;
    });
  }
  function politicalFill(iso) {
    if (!POLI) buildPolitical();
    // Антарктида, Гренландия, Западная Сахара есть в контурах, но в списке 192
    // стран их нет — красим нейтральным, чтобы не выдавать их за государства.
    if (!byIso(iso)) return "#e4eaf2";
    var c = POLI[iso];
    return POLI_COLORS[c === undefined ? 0 : c];
  }

  /* --- подписи стран --- */
  // Ставим подпись в центр тяжести самого крупного куска суши; если он оказался
  // вне страны (Чили, Норвегия, Хорватия — вытянутые и изогнутые), отступаем к
  // столице: она заведомо внутри.
  function ringCentroid(ring) {
    var a = 0, cx = 0, cy = 0;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (!a) return null;
    return [cx / (3 * a), cy / (3 * a)];
  }
  var LABELS = null;
  function buildLabels() {
    LABELS = COUNTRIES.map(function (c) {
      var g = geom(c.f), anchor = null, w = 0, h = 0;
      if (g) {
        var raw = window.GEO_DATA[c.f], blocks = raw.t === 0 ? [raw.c] : raw.c;
        var best = null, bestArea = -1, bi = 0;
        for (var b = 0; b < g.boxes.length; b++) {
          var bx = g.boxes[b], area = (bx.x1 - bx.x0) * (bx.y1 - bx.y0);
          if (area > bestArea) { bestArea = area; best = bx; bi = b; }
        }
        w = best.x1 - best.x0; h = best.y1 - best.y0;
        var ctr = ringCentroid(blocks[bi][0]);
        if (ctr && insideCountry(c.f, ctr[0], ctr[1])) anchor = project(ctr[0], ctr[1]);
      }
      if (!anchor) anchor = project(c.lng, c.lat);
      return { n: c.n, f: c.f, x: anchor.x, y: anchor.y, w: w, h: h, tiny: !g };
    }).sort(function (a, b) { return (b.w * b.h) - (a.w * a.h); });
  }
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  // Подписи появляются по мере приближения: сначала крупные страны, потом мелкие,
  // микрогосударства — только когда карта увеличена настолько, что им есть где
  // поместиться. Наложившиеся подписи пропускаем — лучше меньше, но читаемо.
  function labelsMarkup(view, boxW) {
    if (!LABELS) buildLabels();
    var f = 11 * view.w / Math.max(200, boxW);
    var placed = [], out = "";
    for (var i = 0; i < LABELS.length; i++) {
      var L = LABELS[i];
      if (L.tiny ? view.w > 200 : (L.w / view.w * boxW) < 34) continue;
      if (L.x < view.x || L.x > view.x + view.w || L.y < view.y || L.y > view.y + view.h) continue;
      var ty = L.y + (L.tiny ? f * 1.6 : f * 0.35);
      var tw = L.n.length * 0.52 * f, th = f * 1.2;
      var bx = { x0: L.x - tw / 2, x1: L.x + tw / 2, y0: ty - th, y1: ty + th * 0.3 };
      var clash = false;
      for (var j = 0; j < placed.length; j++) {
        if (boxesNear(bx, placed[j], f * 0.25)) { clash = true; break; }
      }
      if (clash) continue;
      placed.push(bx);
      if (L.tiny) out += '<circle cx="' + L.x.toFixed(1) + '" cy="' + L.y.toFixed(1) + '" r="' + (f * 0.32).toFixed(2) + '" fill="#e8523f"/>';
      out += '<text x="' + L.x.toFixed(1) + '" y="' + ty.toFixed(1) + '" font-size="' + f.toFixed(2) +
        '" text-anchor="middle" fill="#26456f" stroke="#fff" stroke-width="' + (f * 0.28).toFixed(2) +
        '" paint-order="stroke" style="font-weight:700">' + esc(L.n) + "</text>";
    }
    return out;
  }
  // В контурах есть земли, которых нет среди 192 стран игры. В ответ они не
  // годятся, но сказать человеку, куда он попал, надо честно.
  var TERRITORIES = {
    eh: "Западная Сахара", fk: "Фолклендские острова", gl: "Гренландия",
    tf: "Французские южные территории", pr: "Пуэрто-Рико", ps: "Палестина",
    nc: "Новая Каледония", tw: "Тайвань", aq: "Антарктида", xk: "Косово"
  };
  // Что находится под точкой: страна, территория или вода.
  function placeName(lng, lat) {
    for (var iso in window.GEO_DATA) {
      if (!insideCountry(iso, lng, lat)) continue;
      var c = byIso(iso);
      return c ? c.n : (TERRITORIES[iso] || null);
    }
    return null;
  }
  // Расстояние по дуге большого круга, километры.
  function distanceKm(lng1, lat1, lng2, lat2) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  // Точность тут ни к чему: важен порядок промаха, а не третий знак.
  function formatKm(km) {
    var v = km < 100 ? Math.round(km / 10) * 10 : (km < 1000 ? Math.round(km / 50) * 50 : Math.round(km / 100) * 100);
    return groupDigits(Math.max(10, v)) + "\u00A0км";
  }

  // Какая страна под точкой: сначала контуры, потом — ближайшее из государств
  // без контура, если тыкнули рядом с ним.
  function countryAt(lng, lat, tolDeg) {
    for (var iso in window.GEO_DATA) {
      var c = byIso(iso);
      if (c && insideCountry(iso, lng, lat)) return c;
    }
    var best = null, bestD = tolDeg || 3;
    for (var i = 0; i < COUNTRIES.length; i++) {
      var c = COUNTRIES[i];
      if (window.GEO_DATA[c.f]) continue;
      var d = Math.sqrt(Math.pow(c.lng - lng, 2) + Math.pow(c.lat - lat, 2));
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // Разметка стран и отметок вынесена отдельно: статичной карте она нужна один раз,
  // а карте с приближением — заново на каждом шаге зума.
  function countryPaths(opts, scale, fixedStroke) {
    var out = "";
    for (var iso in PATHS) {
      var fill = opts.highlight === iso ? (opts.highlightFill || "#ffd66b")
        : (opts.political ? politicalFill(iso) : "#d5e8c4");
      out += '<path d="' + PATHS[iso] + '" fill="' + fill + '" stroke="#9cba86" stroke-width="' +
        (fixedStroke ? "0.5" : (0.5 * scale).toFixed(3)) + '"' +
        (fixedStroke ? ' vector-effect="non-scaling-stroke"' : "") + "/>";
    }
    return out;
  }
  // Толщина линий и радиусы задаются в единицах полной карты: при увеличении
  // окна просмотра их надо ужать, иначе границы превращаются в кляксы.
  function markMarkup(opts, scale) {
    var out = "";
    (opts.rects || []).forEach(function (r) {
      out += '<rect x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + r.w.toFixed(1) + '" height="' + r.h.toFixed(1) +
        '" fill="none" stroke="' + (r.stroke || "#e8523f") + '" stroke-width="' + (1.8 * scale).toFixed(3) + '"/>';
    });
    (opts.pins || []).forEach(function (p) {
      out += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + ((p.r || 6) * scale).toFixed(2) + '" fill="' + p.fill + '"' +
        (p.opacity ? ' opacity="' + p.opacity + '"' : "") +
        (p.stroke ? ' stroke="' + p.stroke + '" stroke-width="' + (1.6 * scale).toFixed(2) + '"' : "") + "/>";
    });
    return out;
  }
  function mapSvg(opts) {
    opts = opts || {};
    if (!PATHS) buildPaths();
    var v = opts.view || { x: 0, y: 0, w: 1000, h: 500 };
    var s = v.w / 1000;
    var svg = '<svg viewBox="' + v.x.toFixed(1) + " " + v.y.toFixed(1) + " " + v.w.toFixed(1) + " " + v.h.toFixed(1) +
      '" preserveAspectRatio="none" role="img" aria-label="' + (opts.label || "Карта мира") + '">' +
      '<rect x="' + v.x.toFixed(1) + '" y="' + v.y.toFixed(1) + '" width="' + v.w.toFixed(1) + '" height="' + v.h.toFixed(1) + '" fill="#d9ecff"/>' +
      countryPaths(opts, s) + markMarkup(opts, s) + "</svg>";
    var box = el("div", { class: "mapbox" + (opts.onClick ? " play" : ""), html: svg });
    if (opts.onClick) box.addEventListener("click", opts.onClick);
    return box;
  }

  /* --- карта с приближением --- */
  // Ткнуть в Люксембург или Бруней на карте во весь мир невозможно ни мышью, ни
  // пальцем, поэтому карту для игры можно приближать: кнопками, колесом, двойным
  // касанием — и таскать, когда приблизили. Само окно просмотра — тот же viewBox,
  // что и у статичной карты, так что все координаты считаются одинаково.
  var MAX_ZOOM = 16;
  function zoomMap(opts) {
    opts = opts || {};
    if (!PATHS) buildPaths();
    // В игре карта — мишень, поэтому курсор-перекрестие и умеренное приближение.
    // В атласе по ней просто гуляют и читают подписи, там нужно куда ближе.
    var MAX = opts.maxZoom || MAX_ZOOM;
    var view = { x: 0, y: 0, w: 1000, h: 500 }, pins = [], picking = true;
    var box = el("div", { class: "mapbox zoom" + (opts.explore ? " explore" : " play"), html:
      '<svg viewBox="0 0 1000 500" preserveAspectRatio="none" role="img" aria-label="' + (opts.label || "Карта мира") + '">' +
      '<rect x="0" y="0" width="1000" height="500" fill="#d9ecff"/>' +
      countryPaths({ political: opts.political }, 1, true) +
      '<path class="hl" d="" fill="none"/>' +
      '<g class="marks"></g><g class="labels"></g></svg>' });
    var svg = box.querySelector("svg"), hl = box.querySelector(".hl"),
        marks = box.querySelector(".marks"), labels = box.querySelector(".labels");

    // Кнопки живут под картой, а не поверх неё: наложенные, они закрывали бы
    // северо-восток карты — по Японии и Камчатке было бы просто не попасть.
    var plus = el("button", { class: "mapbtn", type: "button", "aria-label": "Приблизить карту" }, ["+"]);
    var minus = el("button", { class: "mapbtn", type: "button", "aria-label": "Отдалить карту" }, ["−"]);
    var reset = el("button", { class: "mapbtn wide", type: "button" }, ["Вся карта"]);
    plus.addEventListener("click", function () { zoomAt(1.6, 0.5, 0.5); });
    minus.addEventListener("click", function () { zoomAt(1 / 1.6, 0.5, 0.5); });
    reset.addEventListener("click", function () { view.x = 0; view.y = 0; view.w = 1000; apply(); });
    var scale = el("span", { class: "mapscale" }, ["1×"]);
    var wrap = el("div", { class: "mapzoom" }, [box, el("div", { class: "mapctrls" }, [plus, minus, reset, scale])]);

    function apply() {
      view.h = view.w / 2;
      view.x = Math.max(0, Math.min(1000 - view.w, view.x));
      view.y = Math.max(0, Math.min(500 - view.h, view.y));
      svg.setAttribute("viewBox", view.x.toFixed(2) + " " + view.y.toFixed(2) + " " + view.w.toFixed(2) + " " + view.h.toFixed(2));
      marks.innerHTML = markMarkup({ pins: pins }, view.w / 1000);
      // Подписи зависят не только от окна просмотра, но и от того, сколько
      // пикселей на экране занимает карта: на телефоне их помещается меньше.
      if (opts.labels) labels.innerHTML = labelsMarkup(view, pxWidth());
      var zoomed = view.w < 999.5;
      if (zoomed) box.classList.add("zoomed"); else box.classList.remove("zoomed");
      plus.disabled = view.w <= 1000 / MAX + 0.01;
      minus.disabled = !zoomed;
      reset.disabled = !zoomed;
      scale.textContent = (Math.round(1000 / view.w * 10) / 10) + "×";
    }
    // u и v — доля ширины и высоты окна: точка под курсором или между пальцами
    // должна остаться на месте, иначе карта «убегает» при каждом приближении.
    function zoomAt(factor, u, v) {
      var fx = view.x + u * view.w, fy = view.y + v * view.h;
      var w = Math.max(1000 / MAX, Math.min(1000, view.w / factor));
      view.x = fx - u * w; view.y = fy - v * (w / 2); view.w = w;
      apply();
    }
    function frac(cx, cy) {
      var b = box.getBoundingClientRect();
      return { u: (cx - b.left) / b.width, v: (cy - b.top) / b.height, b: b };
    }
    function pxWidth() {
      var w = box.getBoundingClientRect().width;
      return w > 0 ? w : 1000;
    }
    function dist(a, b) { return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)); }

    box.addEventListener("wheel", function (ev) {
      // Пока карта не приближена, колесо оставляем странице: иначе курсор над
      // картой запирает прокрутку и до кнопки ответа не добраться. Приблизить с
      // самого начала можно двойным нажатием, кнопками или Ctrl с колесом.
      if (view.w > 999.5 && !ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      var f = frac(ev.clientX, ev.clientY);
      zoomAt(ev.deltaY < 0 ? 1.25 : 1 / 1.25, f.u, f.v);
    }, { passive: false });

    var pointers = {}, drag = null, pinch = null, lastTap = { t: 0, u: 0, v: 0 };
    box.addEventListener("pointerdown", function (ev) {
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 1) {
        try { box.setPointerCapture(ev.pointerId); } catch (e) {}
        drag = { id: ev.pointerId, moved: 0 };
      } else if (ids.length === 2) {
        drag = null;
        pinch = { ids: ids, d: dist(pointers[ids[0]], pointers[ids[1]]) };
      }
    });
    box.addEventListener("pointermove", function (ev) {
      var prev = pointers[ev.pointerId];
      if (!prev) return;
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      if (pinch) {
        var a = pointers[pinch.ids[0]], b = pointers[pinch.ids[1]];
        if (!a || !b) return;
        var d = dist(a, b);
        if (pinch.d > 4 && d > 4) {
          var f = frac((a.x + b.x) / 2, (a.y + b.y) / 2);
          zoomAt(d / pinch.d, f.u, f.v);
        }
        pinch.d = d;
        return;
      }
      if (!drag || drag.id !== ev.pointerId) return;
      var dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (view.w < 999.5) {
        var r = box.getBoundingClientRect();
        view.x -= dx / r.width * view.w;
        view.y -= dy / r.height * view.h;
        apply();
      }
    });
    function release(ev) {
      var was = drag;
      delete pointers[ev.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      if (!was || was.id !== ev.pointerId) return;
      drag = null;
      // Короткое касание без движения — это ответ, а не перетаскивание карты.
      if (was.moved > 8) return;
      var f = frac(ev.clientX, ev.clientY);
      if (f.u < 0 || f.u > 1 || f.v < 0 || f.v > 1) return;
      // Двойное касание (или двойной клик) приближает туда, куда ткнули: на телефоне
      // это самый быстрый способ добраться до нужного угла карты.
      var now = Date.now();
      if (now - lastTap.t < 350 && Math.abs(f.u - lastTap.u) < 0.03 && Math.abs(f.v - lastTap.v) < 0.03) {
        lastTap.t = 0;
        zoomAt(2, f.u, f.v);
        return;
      }
      lastTap = { t: now, u: f.u, v: f.v };
      if (!picking) return;
      var x = view.x + f.u * view.w, y = view.y + f.v * view.h;
      if (opts.onPick) opts.onPick({
        x: x, y: y, lng: x / 1000 * 360 - 180, lat: 90 - y / 500 * 180,
        // сколько единиц карты приходится на экранный пиксель: чем ближе
        // приближение, тем точнее можно ткнуть — и тем строже допуск
        upp: view.w / f.b.width
      });
    }
    box.addEventListener("pointerup", release);
    box.addEventListener("pointercancel", release);

    wrap.setMarks = function (list) { pins = list || []; apply(); };
    wrap.setHighlight = function (iso, fill) {
      hl.setAttribute("d", PATHS[iso] || "");
      hl.setAttribute("fill", fill || "#9fdcb6");
    };
    // После ответа карта остаётся живой: приблизить и рассмотреть можно, ткнуть — нет.
    wrap.stopPicking = function () { picking = false; box.classList.remove("play"); };
    wrap.refresh = apply;
    apply();
    // На момент сборки ширины у карты ещё нет, а от неё зависят подписи —
    // пересчитываем, как только карта окажется на странице, и при смене размера.
    if (opts.labels) {
      setTimeout(apply, 0);
      window.addEventListener("resize", function () {
        clearTimeout(wrap.__rt);
        wrap.__rt = setTimeout(apply, 180);
      });
    }
    return wrap;
  }

  // Карта положения страны: мир целиком с рамкой и та же область крупным планом.
  // У 27 самых маленьких государств контура в GEO_DATA нет вовсе, поэтому точку
  // ставим всегда — иначе Монако или Науру на карте просто не существует.
  var MIN_VIEW = 153;      // ≈55° по долготе: страна показана вместе с соседями
  var MIN_VIEW_TINY = 111; // ≈40°: города-государства без контура, им нужен план покрупнее
  function frame(cx, cy, w) {
    var h = w / 2;
    return {
      x: Math.max(0, Math.min(1000 - w, cx - w / 2)),
      y: Math.max(0, Math.min(500 - h, cy - h / 2)),
      w: w, h: h
    };
  }
  // Окно крупного плана подгоняем под размер страны: у России оно почти во всю
  // карту, у Люксембурга — минимальное. Мелкие острова и заморские куски в рамку
  // не берём, иначе Аляска растянула бы США на пол-карты, а сама страна стала бы
  // неразличимой точкой.
  function closeView(c) {
    var t = project(c.lng, c.lat), g = geom(c.f);
    if (!g) return frame(t.x, t.y, MIN_VIEW_TINY);
    var big = 0, i, a, b;
    for (i = 0; i < g.boxes.length; i++) {
      b = g.boxes[i];
      a = (b.x1 - b.x0) * (b.y1 - b.y0);
      if (a > big) big = a;
    }
    var box = { x0: t.x, x1: t.x, y0: t.y, y1: t.y };
    for (i = 0; i < g.boxes.length; i++) {
      b = g.boxes[i];
      a = (b.x1 - b.x0) * (b.y1 - b.y0);
      if (a < big * 0.45) continue;
      if (b.x0 < box.x0) box.x0 = b.x0;
      if (b.x1 > box.x1) box.x1 = b.x1;
      if (b.y0 < box.y0) box.y0 = b.y0;
      if (b.y1 > box.y1) box.y1 = b.y1;
    }
    var w = Math.max(box.x1 - box.x0, 2 * (box.y1 - box.y0)) * 1.25;
    // Страна по обе стороны 180-го меридиана (Фиджи, Кирибати) даёт рамку во всю
    // карту — для неё берём обычное окно вокруг столицы.
    if (w > 700) return frame(t.x, t.y, MIN_VIEW);
    w = Math.max(MIN_VIEW, Math.min(w, 1000));
    return frame((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, w);
  }
  function locator(c) {
    var t = project(c.lng, c.lat);
    var view = closeView(c);
    var halo = { x: t.x, y: t.y, r: 18, fill: "#e8523f", opacity: 0.22 };
    var dot = { x: t.x, y: t.y, r: 7, fill: "#e8523f", stroke: "#fff" };
    return el("div", { class: "locator" }, [
      el("div", {}, [
        kicker("Страна на карте мира"),
        mapSvg({ highlight: c.f, highlightFill: "#ffd66b", pins: [{ x: t.x, y: t.y, r: 4, fill: "#e8523f" }], rects: [view], label: c.n + " на карте мира" })
      ]),
      el("div", {}, [
        kicker("Крупным планом"),
        mapSvg({ highlight: c.f, highlightFill: "#ffd66b", pins: [halo, dot], view: view, label: c.n + " крупным планом" })
      ])
    ]);
  }

  /* --- карточка страны --- */
  // Одна карточка на весь сайт: и в режиме «Карточки», и на странице страны.
  // Лицо — флаг и название, оборот — столица, население и факт о флаге; отдельной
  // страницы с тем же самым больше нет.
  function countryCard(c) {
    var facts = window.FLAG_FACTS || {};
    var rows = [
      ["Регион", regionName(c.r)],
      ["Население", popText(c.f) || "нет данных"],
      ["Код страны", c.f.toUpperCase()]
    ];
    var e = entry(c.f);
    if (e && e.attempts) rows.push(["Ваши попытки", e.attempts + " · ошибок " + (e.mistakes.capital + e.mistakes.flag + e.mistakes.map)]);

    var front = el("div", { class: "face front" }, [
      el("img", { src: flagUrl(c.f), alt: "Флаг " + c.n, decoding: "async" }),
      el("div", { class: "cc-title" }, [c.n]),
      el("div", { class: "cc-hint" }, ["Нажмите на карточку, чтобы перевернуть"])
    ]);
    var back = el("div", { class: "face back" }, [
      kicker("Столица", "ac"),
      el("div", { class: "cc-capital" }, [c.c]),
      el("table", {}, [el("tbody", {}, rows.map(function (r) {
        return el("tr", {}, [el("td", {}, [r[0]]), el("td", { style: "text-align:right" }, [r[1]])]);
      }))]),
      facts[c.f] ? el("div", { class: "fact" }, [kicker("О флаге", "ac"), el("p", {}, [facts[c.f]])]) : null,
      el("div", { class: "cc-hint" }, ["Нажмите, чтобы вернуться к флагу"])
    ]);
    var card = el("div", {
      class: "flip", role: "button", tabindex: "0",
      "aria-label": "Карточка страны " + c.n + ". Перевернуть, чтобы увидеть столицу и население."
    }, [el("div", { class: "flip-inner" }, [front, back])]);

    var flipped = false;
    function apply() {
      if (flipped) card.classList.add("on"); else card.classList.remove("on");
      card.setAttribute("aria-pressed", flipped ? "true" : "false");
      front.setAttribute("aria-hidden", flipped ? "true" : "false");
      back.setAttribute("aria-hidden", flipped ? "false" : "true");
    }
    function toggle() { flipped = !flipped; apply(); }
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") { ev.preventDefault(); toggle(); }
    });
    apply();
    return card;
  }

  // Ответ игроку: крупное «Верно» или «Неверно» и строка о том, что это значит.
  function verdict(ok, note) {
    var kids = Object.prototype.toString.call(note) === "[object Array]" ? note : [note];
    return el("div", { class: "answer " + (ok ? "ok" : "bad") }, [
      el("div", { class: "answer-word" }, [ok ? "Верно" : "Неверно"]),
      el("p", { class: "answer-note" }, kids)
    ]);
  }

  /* --- режим игры и «поделиться» --- */
  // Во время раунда шапка сайта прячется: на телефоне она занимала половину
  // экрана, и до карты приходилось лишний раз пролистывать. Всё нужное —
  // счёт, номер раунда и выход — есть в игровой строке.
  function playMode(on) {
    if (!document.body) return;
    if (on) document.body.classList.add("playing");
    else document.body.classList.remove("playing");
  }

  var SITE = "https://cosmopolitan-atlas.online/";

  /* --- картинка результата --- */
  // Текстом делиться скучно, поэтому рисуем открытку прямо в браузере: фон с
  // картой мира из наших же контуров, белая панель со счётом и разбивкой.
  // Ничего не грузим со стороны — только собственный значок сайта.
  var CARD_W = 1080, CARD_H = 1350;
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function drawWorld(g) {
    if (!PATHS) buildPaths();
    g.save();
    // карта 1000×500 растянута на всю открытку, с обрезкой по краям
    g.translate(CARD_W / 2, CARD_H * 0.46);
    var sc = CARD_W / 1000 * 1.55;
    g.scale(sc, sc);
    g.translate(-500, -250);
    g.fillStyle = "rgba(255,255,255,.13)";
    for (var iso in PATHS) {
      try { g.fill(new Path2D(PATHS[iso])); } catch (e) { break; }
    }
    g.restore();
  }
  function resultImage(o, cb) {
    var c = document.createElement("canvas");
    c.width = CARD_W; c.height = CARD_H;
    var g = c.getContext("2d");

    var grad = g.createLinearGradient(0, 0, 0, CARD_H);
    grad.addColorStop(0, "#2b7fff"); grad.addColorStop(1, "#1147b0");
    g.fillStyle = grad; g.fillRect(0, 0, CARD_W, CARD_H);
    drawWorld(g);

    var F = "Nunito, 'Segoe UI', system-ui, sans-serif";
    g.textAlign = "center";
    g.fillStyle = "#fff";
    g.font = "900 52px " + F;
    g.fillText("COSMOPOLITAN ATLAS", CARD_W / 2, 118);
    g.font = "700 30px " + F;
    g.fillStyle = "rgba(255,255,255,.72)";
    g.fillText("столицы, флаги и карта мира", CARD_W / 2, 166);

    var px = 80, py = 300, pw = CARD_W - px * 2, ph = 880;
    g.save();
    g.shadowColor = "rgba(6,32,80,.35)"; g.shadowBlur = 60; g.shadowOffsetY = 18;
    g.fillStyle = "#fff";
    roundRect(g, px, py, pw, ph, 56); g.fill();
    g.restore();

    var y = py + 108;
    g.fillStyle = "#6a86a8"; g.font = "800 30px " + F;
    g.fillText((o.badge || "результат сессии").toUpperCase(), CARD_W / 2, y);
    y += 150;
    g.fillStyle = "#2b7fff"; g.font = "900 168px " + F;
    g.fillText(String(o.score), CARD_W / 2, y);
    y += 62;
    g.fillStyle = "#0f2f5e"; g.font = "800 38px " + F;
    g.fillText(o.sub || "", CARD_W / 2, y);

    y += 84;
    (o.rows || []).forEach(function (row) {
      g.strokeStyle = "#e3edfa"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(px + 74, y + 26); g.lineTo(px + pw - 74, y + 26); g.stroke();
      g.textAlign = "left"; g.fillStyle = "#3a5a86"; g.font = "700 40px " + F;
      g.fillText(row[0], px + 74, y);
      g.textAlign = "right"; g.fillStyle = "#0f2f5e"; g.font = "900 40px " + F;
      g.fillText(row[1], px + pw - 74, y);
      g.textAlign = "center";
      y += 82;
    });

    g.fillStyle = "#6a86a8"; g.font = "800 34px " + F;
    g.fillText("cosmopolitan-atlas.online", CARD_W / 2, py + ph - 54);

    // Значок сайта садится на верхний край панели — как медаль на карточке.
    var img = new Image();
    img.onload = function () { finish(img); };
    img.onerror = function () { finish(null); };
    img.src = "favicon-192.png";

    function finish(icon) {
      if (icon) {
        var s = 190;
        g.save();
        g.shadowColor = "rgba(6,32,80,.3)"; g.shadowBlur = 34; g.shadowOffsetY = 10;
        g.drawImage(icon, (CARD_W - s) / 2, py - s / 2 - 14, s, s);
        g.restore();
      }
      c.toBlob(function (blob) { cb(blob, c.toDataURL("image/png")); }, "image/png");
    }
  }

  var ICON_SHARE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '<path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';

  // Телеграм и ВК открываем обычными ссылками на их формы, без подключения
  // чужих скриптов: и приватнее, и работает даже с блокировщиками.
  function shareBlock(opts) {
    opts = opts || {};
    var url = opts.url || SITE, text = opts.text || "";
    var tg = "https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(text);
    var vk = "https://vk.com/share.php?noparse=true&url=" + encodeURIComponent(url) +
      "&title=" + encodeURIComponent(opts.title || "Cosmopolitan — атлас памяти") +
      "&description=" + encodeURIComponent(text) +
      "&image=" + encodeURIComponent(SITE + "favicon-512.png");

    var note = el("span", { class: "sharenote" }, []);
    var blob = null, dataUrl = null;
    var preview = el("img", { class: "sharecard", alt: "Картинка с результатом" });
    var wrap = el("div", { class: "sharebar" }, [kicker("Поделиться результатом")]);

    var shareBtn = el("button", {
      class: "btn primary iconbtn", type: "button", "aria-label": "Поделиться результатом", title: "Поделиться",
      html: ICON_SHARE
    });
    shareBtn.addEventListener("click", function () {
      var files = blob ? [new File([blob], "cosmopolitan-atlas.png", { type: "image/png" })] : null;
      var payload = { title: opts.title || "Cosmopolitan Atlas", text: text, url: url };
      if (files && navigator.canShare && navigator.canShare({ files: files })) payload.files = files;
      if (navigator.share) {
        navigator.share(payload).catch(function () {});
      } else if (dataUrl) {
        saveCard();
        note.textContent = "Браузер не умеет делиться напрямую — картинка сохранена, отправьте её вручную.";
      }
    });
    function saveCard() {
      if (!dataUrl) return;
      var a = el("a", { href: dataUrl, download: "cosmopolitan-atlas.png" }, []);
      document.body.appendChild(a); a.click(); a.remove();
    }
    var saveBtn = el("button", { class: "btn ghost", type: "button", onclick: saveCard }, ["Сохранить картинку"]);

    wrap.appendChild(el("div", { class: "row" }, [
      shareBtn,
      el("a", { class: "btn tg", href: tg, target: "_blank", rel: "noopener noreferrer" }, ["Telegram"]),
      el("a", { class: "btn vk", href: vk, target: "_blank", rel: "noopener noreferrer" }, ["ВКонтакте"]),
      saveBtn
    ]));
    wrap.appendChild(note);
    if (opts.card) {
      wrap.appendChild(preview);
      // Шрифт подгружается асинхронно; без ожидания открытка нарисуется системным.
      var draw = function () {
        resultImage(opts.card, function (b, d) { blob = b; dataUrl = d; preview.src = d; });
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw, draw);
      else draw();
    }
    return wrap;
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

  /* Код игрока. Титул и номер живут в localStorage, а он исчезает вместе с
     «очистить данные сайта» — и человек возвращается в рейтинг новым игроком.
     Код кодирует ту же пару «титул + номер», поэтому по записанному коду игрок
     забирает свой номер обратно на любом устройстве, без пароля и регистрации. */
  var CODE_A = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // без I и O — их путают с 1 и 0
  function toBase(n, len) {
    var s = "";
    n = Math.max(0, Math.floor(n));
    while (n > 0) { s = CODE_A.charAt(n % 34) + s; n = Math.floor(n / 34); }
    while (s.length < len) s = "0" + s;
    return s;
  }
  function fromBase(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var d = CODE_A.indexOf(s.charAt(i));
      if (d < 0) return -1;
      n = n * 34 + d;
    }
    return n;
  }
  function checkChar(body) {
    var sum = 0;
    for (var i = 0; i < body.length; i++) sum += CODE_A.indexOf(body.charAt(i)) * (i + 1);
    return CODE_A.charAt(sum % 34);
  }
  function playerCode(title, number) {
    var idx = PERSONAS.indexOf(title);
    if (idx < 0 || !number) return null;
    var body = toBase(idx, 2) + toBase(number, 3);
    var code = body + checkChar(body);
    return code.slice(0, 3) + "-" + code.slice(3);
  }
  function myCode() { return currentDisplayName() ? playerCode(progress.playerTitle, progress.playerNumber) : null; }
  function readPlayerCode(raw) {
    var s = String(raw || "").toUpperCase().replace(/I/g, "1").replace(/O/g, "0").replace(/[^0-9A-Z]/g, "");
    if (s.length < 6) return null;
    var body = s.slice(0, s.length - 1);
    if (checkChar(body) !== s.charAt(s.length - 1)) return null;
    var idx = fromBase(body.slice(0, 2)), num = fromBase(body.slice(2));
    if (idx < 0 || idx >= PERSONAS.length || num <= 0) return null;
    return { title: PERSONAS[idx], number: num };
  }
  function restorePlayer(raw) {
    var p = readPlayerCode(raw);
    if (!p) return false;
    progress.playerTitle = p.title; progress.playerNumber = p.number; saveProgress();
    return true;
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
        // Строки отсортированы по очкам, поэтому первая встреченная строка игрока —
        // его лучший результат за неделю. Ключ — номер игрока: титул можно сменить
        // в настройках, номер остаётся, и один человек занимает одну строку.
        var seen = {}, out = [];
        (res.data || []).forEach(function (row) {
          var m = /№\s*(\d+)/.exec(String(row.name || ""));
          var key = m ? "n" + m[1] : "s" + String(row.name || "").toLowerCase().trim();
          if (!seen[key]) { seen[key] = true; out.push(row); }
        });
        cb(out, null);
      });
  }

  /* --- шапка, подвал, куки --- */
  var NAV = [
    ["index.html", "Главная"], ["play.html", "Играть"], ["flags.html", "Флаги"],
    ["learn.html", "Карточки"], ["map.html", "Карта"], ["board.html", "Рейтинг"]
  ];
  var ICON_STAR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="#1b1200"><path d="M12 2.6l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 16.6 6.4 19.8l1.3-6.3L3 9.2l6.3-.7z"/></svg>';
  function brandMark() {
    return el("img", { class: "mark", src: "art/globe.png", alt: "", width: "44", height: "44" });
  }
  // Значки регионов — рисованные, лежат в art/.
  var REGION_ART = {
    world: "globe", europe: "r-europe", asia: "r-asia", africa: "r-africa",
    namerica: "r-namerica", samerica: "r-samerica", oceania: "r-oceania"
  };
  function regionIcon(key, size) {
    return el("img", {
      class: "ricon", src: "art/" + (REGION_ART[key] || "globe") + ".png", alt: "",
      loading: "lazy", decoding: "async", style: size ? "width:" + size + "px;height:" + size + "px" : null
    });
  }
  function chrome() {
    var here = (location.pathname.split("/").pop() || "index.html");
    var links = el("nav", { class: "navlinks" }, NAV.map(function (item) {
      return el("a", { href: item[0], class: here === item[0] ? "on" : "" }, [item[1]]);
    }));
    var header = el("header", { class: "nav" }, [
      el("div", { class: "wrap" }, [
        el("a", { class: "nav-brand", href: "index.html" }, [brandMark(), "Cosmopolitan Atlas"]),
        links,
        el("div", { class: "nav-right" }, [
          el("a", { class: "nav-ava", href: "settings.html", "aria-label": "Настройки игрока" }, [
            el("img", { src: "art/avatar.png", alt: "", width: "44", height: "44" })
          ]),
          el("a", { class: "nav-score", href: "settings.html", title: "Лучший результат за сессию" }, [
            el("span", { class: "st", html: ICON_STAR }),
            el("span", {}, [String(progress.highScore || 0)])
          ])
        ])
      ])
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
    el: el, qs: qs, kicker: kicker, bar: bar, flagUrl: flagUrl,
    shuffle: shuffle, norm: norm, fuzzy: fuzzy,
    progress: progress, saveProgress: saveProgress, entry: entry, isStudied: isStudied,
    byIso: byIso, regionCountries: regionCountries, regionName: regionName, studiedCount: studiedCount,
    unlocked: unlocked, REGION_ORDER: REGION_ORDER, SIZE_TOL: SIZE_TOL, PERSONAS: PERSONAS,
    premiumEnabled: PREMIUM_ENABLED, hintsLeft: hintsLeft, spendHint: spendHint,
    myCode: myCode, readPlayerCode: readPlayerCode, restorePlayer: restorePlayer,
    saveSession: saveSession, loadSession: loadSession, clearSession: clearSession,
    project: project, insideCountry: insideCountry, nearCountry: nearCountry, insideAnyOther: insideAnyOther,
    mapSvg: mapSvg, zoomMap: zoomMap, locator: locator, closeView: closeView, regionIcon: regionIcon,
    countryAt: countryAt, placeName: placeName, distanceKm: distanceKm, formatKm: formatKm,
    playMode: playMode, shareBlock: shareBlock, resultImage: resultImage,
    population: population, popText: popText, countryCard: countryCard, verdict: verdict,
    currentDisplayName: currentDisplayName, pickPersona: pickPersona,
    submitToLeaderboard: submitToLeaderboard, fetchLeaderboard: fetchLeaderboard, hasServer: !!sb,
    mount: function (node) { document.getElementById("app").appendChild(el("div", { class: "wrap" }, [node])); },
    ready: function (fn) { chrome(); fn(); }
  };
})();
