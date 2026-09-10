/* Технические шоколадки — «закрыто на переучёт» для статического сайта.
   Сервера, который мог бы отдавать заглушку, у нас нет: страницы лежат на
   GitHub Pages как файлы. Поэтому выключатель живёт здесь, а скрипт стоит
   первым в <head> — до стилей и до разметки, чтобы посетитель не успел
   увидеть недоделанную страницу.

   Включить: SHOKOLADKI = true, закоммитить, дождаться развёртывания.
   Выключить: обратно в false. Иначе никак — это обычный файл сайта.

   PEEK — не защита, а занавеска: слово лежит в открытом коде, и кто угодно
   может его прочитать и зайти. Оно нужно нам с тобой, чтобы смотреть сайт
   во время переделки, а не чтобы кого-то не пускать.
   Открыть сайт: ?peek=shokoladki  ·  снова видеть заглушку: ?peek=off */
(function () {
  "use strict";
  var SHOKOLADKI = false;
  var PEEK = "shokoladki";
  var KEY = "caPeek";
  var PAGE = "maintenance.html";

  var peek = null;
  try {
    var m = location.search.match(/[?&]peek=([^&]*)/);
    if (m) peek = decodeURIComponent(m[1]);
  } catch (e) {}
  try {
    if (peek === PEEK) localStorage.setItem(KEY, "1");
    else if (peek === "off") localStorage.removeItem(KEY);
  } catch (e) {}

  var allowed = peek === PEEK;
  if (!allowed) {
    try { allowed = localStorage.getItem(KEY) === "1"; } catch (e) {}
  }

  var here = (location.pathname.split("/").pop() || "index.html");
  if (SHOKOLADKI && !allowed && here !== PAGE) location.replace(PAGE);
})();
