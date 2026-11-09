/* =====================================================================
   site.js — fills the page from the generated data (window.HMS)
   and powers the navigation, code viewers, query gallery and lightbox.
   ===================================================================== */
(function () {
  "use strict";

  var DATA = window.HMS || null;

  /* ------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------ */
  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(value) {
    return Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function el(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------
     Syntax highlighting (small, dependency free)
     ------------------------------------------------------------------ */
  var SQL_WORDS = ("select from where and or not null in like between order by group " +
    "having inner left right outer join on as insert into values update set delete create " +
    "table view index drop alter primary key foreign references unique check default " +
    "constraint cascade restrict serial integer varchar numeric date timestamp boolean " +
    "current_date current_timestamp interval limit offset distinct count sum avg min max " +
    "coalesce round case when then else end filter over to_char extract asc desc " +
    "begin commit rollback union all exists is language returns immutable function " +
    "or replace comment if truncate restart identity with").split(" ");

  var PY_WORDS = ("def class return if elif else for while in not and or is None True " +
    "False import from as try except finally raise with pass break continue lambda " +
    "global yield assert del print").split(" ");

  function highlight(code, language) {
    var pattern, kinds;
    if (language === "sql") {
      pattern = new RegExp(
        "(--[^\\n]*)" +
        "|('(?:''|[^'])*')" +
        "|(\\b(?:" + SQL_WORDS.join("|") + ")\\b)" +
        "|(\\b\\d+(?:\\.\\d+)?\\b)", "gi");
    } else {
      pattern = new RegExp(
        "(#[^\\n]*)" +
        "|(\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''" +
        "|\"(?:\\\\.|[^\"\\\\\\\\])*\"|'(?:\\\\.|[^'\\\\\\\\\\\\])*')" +
        "|(\\b(?:" + PY_WORDS.join("|") + ")\\b)" +
        "|(\\b\\d+(?:\\.\\d+)?\\b)", "g");
    }
    kinds = ["c", "s", "k", "n"];

    var out = "", last = 0, match;
    while ((match = pattern.exec(code)) !== null) {
      out += esc(code.slice(last, match.index));
      var group = 1;
      while (group < 5 && match[group] === undefined) group++;
      out += '<span class="tok-' + (kinds[group - 1] || "k") + '">' + esc(match[0]) + "</span>";
      last = match.index + match[0].length;
      if (match[0].length === 0) pattern.lastIndex++;
    }
    return out + esc(code.slice(last));
  }

  /* ------------------------------------------------------------------
     Code viewer with tabs
     ------------------------------------------------------------------ */
  function buildViewer(container, files, language, options) {
    if (!container || !files || !files.length) return;
    options = options || {};

    var tabs = files.map(function (file, index) {
      return '<button class="' + (index === 0 ? "is-active" : "") + '" data-tab="' + index + '">' +
        esc(file.name) + "</button>";
    }).join("");

    container.innerHTML =
      '<div class="viewer-tabs">' + tabs + "</div>" +
      '<div class="viewer-head"><div><h4 class="v-title"></h4><p class="v-purpose"></p></div>' +
      '<button class="copy-btn v-copy">Copy code</button></div>' +
      '<div class="viewer-body"><table class="code-table"><tbody><tr>' +
      '<td class="code-lines v-lines"></td>' +
      '<td><pre class="code-pre v-code"></pre></td>' +
      "</tr></tbody></table></div>";

    var title = container.querySelector(".v-title");
    var purpose = container.querySelector(".v-purpose");
    var lines = container.querySelector(".v-lines");
    var code = container.querySelector(".v-code");
    var copy = container.querySelector(".v-copy");
    var current = files[0];

    function show(index) {
      current = files[index];
      title.textContent = (options.prefix || "") + current.name;
      var meta = current.title || "";
      if (current.lines) meta += " · " + current.lines + " lines";
      if (current.statements) meta += " · " + current.statements + " statements";
      purpose.innerHTML = esc(current.purpose || "") + (meta ? ' <span class="muted">(' + esc(meta) + ")</span>" : "");
      var count = current.code.split("\n").length;
      var numbers = "";
      for (var i = 1; i <= count; i++) numbers += i + "\n";
      lines.textContent = numbers;
      code.innerHTML = highlight(current.code, language);
      Array.prototype.forEach.call(container.querySelectorAll(".viewer-tabs button"), function (button, i) {
        button.classList.toggle("is-active", i === index);
      });
    }

    container.querySelector(".viewer-tabs").addEventListener("click", function (event) {
      var button = event.target.closest("[data-tab]");
      if (!button) return;
      show(Number(button.dataset.tab));
    });

    copy.addEventListener("click", function () {
      navigator.clipboard.writeText(current.code).then(function () {
        copy.textContent = "Copied ✓";
        setTimeout(function () { copy.textContent = "Copy code"; }, 1600);
      });
    });

    show(0);
  }

  /* ------------------------------------------------------------------
     Sections built from the generated data
     ------------------------------------------------------------------ */
  var MODULES = [
    ["01", "Customer management", "customers.py",
      "Add, list, search (ID / name / phone), update and delete guests. Unique e-mail, phone and ID number are enforced by the database."],
    ["02", "Room management", "rooms.py",
      "Add rooms, list all rooms, show the tariff and occupancy per category, update details or status, and run the date-wise availability query."],
    ["03", "Reservation management", "reservations.py",
      "Book a room after an availability check, calculate the bill as nights × tariff, view reservations and cancel a booking."],
    ["04", "Check-in / check-out", "frontdesk.py",
      "Two-table updates inside one transaction: Booked → CheckedIn with the room Occupied, then CheckedIn → CheckedOut with the room Available."],
    ["05", "Payment management", "payments.py",
      "Record Cash / Card / UPI payments, keep the Pending → Paid → Refunded status, and list what is still outstanding."],
    ["06", "Reports and search", "reports.py",
      "Reservations, occupied and available rooms, customer history, revenue, most booked room type, occupancy summary and searches."]
  ];

  var SCHEMA = [
    { name: "customer", note: "12 rows", columns: [
      ["customer_id", "SERIAL", "pk"], ["full_name", "VARCHAR(100)", ""],
      ["email", "VARCHAR(120)", "uq"], ["phone", "VARCHAR(15)", "uq"],
      ["address", "VARCHAR(200)", ""], ["id_proof_type", "VARCHAR(20)", ""],
      ["id_proof_number", "VARCHAR(30)", "uq"], ["created_at", "TIMESTAMP", ""]
    ]},
    { name: "room", note: "14 rows", columns: [
      ["room_id", "SERIAL", "pk"], ["room_number", "VARCHAR(10)", "uq"],
      ["room_type", "VARCHAR(20)", ""], ["floor_no", "INTEGER", ""],
      ["price_per_night", "NUMERIC(10,2)", ""], ["max_occupancy", "INTEGER", ""],
      ["status", "VARCHAR(20)", ""], ["created_at", "TIMESTAMP", ""]
    ]},
    { name: "reservation", note: "16 rows", columns: [
      ["reservation_id", "SERIAL", "pk"], ["customer_id", "INTEGER → customer", "fk"],
      ["room_id", "INTEGER → room", "fk"], ["check_in_date", "DATE", ""],
      ["check_out_date", "DATE", ""], ["booking_date", "DATE", ""],
      ["num_guests", "INTEGER", ""], ["total_amount", "NUMERIC(10,2)", ""],
      ["status", "VARCHAR(20)", ""], ["actual_check_in", "TIMESTAMP", ""],
      ["actual_check_out", "TIMESTAMP", ""]
    ]},
    { name: "payment", note: "16 rows", columns: [
      ["payment_id", "SERIAL", "pk"], ["reservation_id", "INTEGER → reservation", "fk"],
      ["amount", "NUMERIC(10,2)", ""], ["payment_method", "VARCHAR(10)", ""],
      ["payment_status", "VARCHAR(20)", ""], ["payment_date", "TIMESTAMP", ""],
      ["transaction_ref", "VARCHAR(40)", ""]
    ]}
  ];

  function renderStats() {
    if (!DATA) return;
    var stats = DATA.stats;
    document.querySelectorAll("[data-stat]").forEach(function (node) {
      var key = node.dataset.stat;
      if (stats[key] === undefined) return;
      node.textContent = key === "revenue" ? money(stats[key]) : stats[key];
    });
    var generated = el("generatedAt");
    if (generated) generated.textContent = DATA.generated_at;
  }

  function renderModules() {
    var box = el("moduleGrid");
    if (!box) return;
    box.innerHTML = MODULES.map(function (module) {
      return '<article class="module"><span class="num">Module ' + module[0] + "</span>" +
        "<h4>" + module[1] + "</h4><p>" + module[2] + "</p>" +
        '<p style="margin-top:8px"><code>' + module[3] + "</code></p></article>";
    }).join("");
  }

  function renderSchema() {
    var box = el("schemaGrid");
    if (!box) return;
    box.innerHTML = SCHEMA.map(function (table) {
      var rows = table.columns.map(function (column) {
        var name = esc(column[0]);
        var key = column[2];
        var badge = key === "pk" ? " PK" : key === "fk" ? " FK" : key === "uq" ? " UQ" : "";
        var cls = key === "pk" ? " class=\"pk\"" : "";
        return "<li><span" + cls + ">" + (key === "pk" ? "<u>" + name + "</u>" : name) +
          (badge ? '<span class="badge-' + key + '">' + badge.trim() + "</span>" : "") +
          '</span><span class="type">' + esc(column[1]) + "</span></li>";
      }).join("");
      return '<div class="schema-card"><div class="schema-head"><strong>' + table.name +
        "</strong><small>" + table.note + '</small></div><ul class="schema-cols">' + rows + "</ul></div>";
    }).join("");
  }

  var COVERAGE = [
    ["CREATE TABLE", "sql/01_schema.sql · Q1", "Four tables with named constraints"],
    ["INSERT", "Q2 · every add screen", "INSERT … RETURNING gives the new key"],
    ["UPDATE", "Q3 · room status, payments", "UPDATE … WHERE primary key"],
    ["DELETE", "Q4 · customer delete", "DELETE … WHERE, protected by FK"],
    ["SELECT with WHERE", "Q5, Q6, Q7, Q8", "Filters, IN, LIKE, BETWEEN"],
    ["ORDER BY", "Q5, Q10, Q13", "Ascending, descending, LIMIT"],
    ["COUNT · SUM · AVG · MIN · MAX", "Q11, Q12", "All five aggregates"],
    ["GROUP BY", "Q13, Q16, Q17", "Per category, method, price band"],
    ["HAVING", "Q14, Q15, Q16", "Filters on aggregated groups"],
    ["INNER JOIN", "Q18, Q19", "Three-table join for reservations"],
    ["LEFT JOIN", "Q20, Q21", "Customers / rooms with no bookings"],
    ["Subqueries", "Q22–Q26", "IN, EXISTS, scalar, correlated, derived table"],
    ["Views", "Q29–Q33", "The five views used by the application"],
    ["Constraints", "01_schema.sql", "PK, FK, UNIQUE, NOT NULL, CHECK"],
    ["Normalisation", "Report §10", "Up to third normal form (3NF)"],
    ["Transactions", "frontdesk.py", "Check-in / check-out are atomic"]
  ];

  function renderCoverage() {
    var box = el("coverage");
    if (!box) return;
    box.innerHTML = COVERAGE.map(function (item) {
      return '<div class="coverage-item"><span class="tick">✓</span><div><b>' + item[0] +
        "</b><span>" + item[1] + "</span><p class=\"muted small\" style=\"margin:2px 0 0\">" +
        item[2] + "</p></div></div>";
    }).join("");
  }

  function renderQueries() {
    var box = el("queryList");
    if (!box || !DATA) return;
    var filter = el("queryFilter");
    var concepts = [];
    DATA.queries.forEach(function (query) {
      if (concepts.indexOf(query.concept) === -1) concepts.push(query.concept);
    });
    concepts.forEach(function (concept) {
      var option = document.createElement("option");
      option.value = concept;
      option.textContent = concept;
      filter.appendChild(option);
    });

    function draw(selected) {
      var list = DATA.queries.filter(function (q) { return !selected || q.concept === selected; });
      box.innerHTML = list.map(function (query) {
        var moneyColumn = query.columns.map(function (column) {
          return /(price|amount|revenue|spent|value|average|total|tariff|payment|collected|cost)/i.test(column);
        });
        var rows = query.rows.map(function (row) {
          return "<tr>" + query.columns.map(function (column, columnIndex) {
            var value = row[column];
            var numeric = typeof value === "number";
            var text;
            if (value === null) text = "NULL";
            else if (!numeric) text = String(value);
            else if (Number.isInteger(value) && !moneyColumn[columnIndex]) text = value.toLocaleString("en-IN");
            else text = money(value);
            var cls = "num" + (numeric ? " right" : "");
            var style = numeric ? ' style="text-align:right; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"' : "";
            return "<td class=\"" + cls + "\"" + style + ">" + esc(text) + "</td>";
          }).join("") + "</tr>";
        }).join("");
        return '<article class="query-card"><div class="query-head"><span class="query-num">' +
          esc(query.number) + "</span><h4>" + esc(query.title) + '</h4><span class="concept">' +
          esc(query.concept) + "</span></div>" +
          '<div class="query-body"><div class="query-sql"><pre>' + highlight(query.sql, "sql") + "</pre></div>" +
          '<div class="query-out"><table style="table-layout:fixed; width:100%; border-collapse:collapse;">' +
          "<thead><tr>" +
          query.columns.map(function (column) { return "<th>" + esc(column) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + rows + "</tbody></table>" +
          '<span class="rowcount">' + query.rows.length + " row(s) · live PostgreSQL output</span></div></div></article>";
      }).join("");
      el("queryCount").textContent = list.length + " of " + DATA.queries.length + " queries";
    }

    filter.addEventListener("change", function () { draw(filter.value); });
    draw("");
  }

  function renderGallery() {
    var box = el("gallery");
    if (!box || !DATA) return;
    box.innerHTML = DATA.screenshots.map(function (shot, index) {
      return '<figure class="shot" data-index="' + index + '">' +
        '<img src="' + shot.file + '" alt="' + esc(shot.title) + '" loading="lazy" />' +
        '<figcaption class="shot-meta"><strong>' + esc(shot.title) + "</strong><span>" +
        esc(shot.caption) + "</span></figcaption></figure>";
    }).join("");

    var lightbox = el("lightbox");
    var image = el("lightboxImg");
    var caption = el("lightboxCaption");

    box.addEventListener("click", function (event) {
      var figure = event.target.closest("[data-index]");
      if (!figure) return;
      var shot = DATA.screenshots[Number(figure.dataset.index)];
      image.src = shot.file;
      image.alt = shot.title;
      caption.textContent = shot.title + " — " + shot.caption;
      lightbox.hidden = false;
    });

    function close() { lightbox.hidden = true; image.src = ""; }
    el("lightboxClose").addEventListener("click", close);
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
    });
  }

  function renderFiles() {
    var box = el("fileGroups");
    if (!box || !DATA) return;
    var groups = {};
    DATA.files.forEach(function (file) { (groups[file.group] = groups[file.group] || []).push(file); });

    box.innerHTML = Object.keys(groups).map(function (name) {
      var rows = groups[name].map(function (file) {
        return "<tr><td><a href=\"" + file.path + "\" download>" + esc(file.name) + "</a></td>" +
          "<td class=\"num\">" + (file.lines ? file.lines : "—") + "</td>" +
          "<td class=\"num\">" + file.size + "</td>" +
          "<td><a href=\"" + file.path + "\" download>Download</a></td></tr>";
      }).join("");
      return '<div class="file-group"><h4>' + esc(name) + "</h4><div class=\"table-wrap\">" +
        "<table class=\"data\"><thead><tr><th>File</th><th class=\"num\">Lines</th>" +
        "<th class=\"num\">Size</th><th></th></tr></thead><tbody>" + rows + "</tbody></table></div></div>";
    }).join("");
  }

  /* ------------------------------------------------------------------
     Navigation order helper (matches page order in report.html)
     ------------------------------------------------------------------ */
  function setupNavigationOrder() {
    var nav = el("nav");
    if (!nav) return;
    // Expected order: Overview → Application → Database design → Query gallery → Screenshots → All files
    var expectedOrder = [
      "#1-overview",
      "#12-application",
      "#7-database-design",
      "#11-query-gallery",
      "#13-screenshots",
      "#all-files"
    ];
    var links = Array.prototype.slice.call(nav.querySelectorAll("a"));
    // Sort links to match expected order if they are out of order
    links.sort(function (a, b) {
      return expectedOrder.indexOf(a.getAttribute("href")) - expectedOrder.indexOf(b.getAttribute("href"));
    });
    // Re-attach in sorted order
    links.forEach(function (link) { nav.appendChild(link); });
  }

  /* ------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------ */
  function setupNavigation() {
    setupNavigationOrder(); // Ensure order matches page order
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));
    var sections = links.map(function (link) {
      return document.querySelector(link.getAttribute("href"));
    }).filter(Boolean);

    function onScroll() {
      var position = window.scrollY + 140;
      var active = 0;
      sections.forEach(function (section, index) {
        if (section.offsetTop <= position) active = index;
      });
      links.forEach(function (link, index) {
        link.classList.toggle("is-active", index === active);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var sidebar = el("sidebar");
    var toggle = el("menuToggle");
    toggle.addEventListener("click", function () { sidebar.classList.toggle("is-open"); });
    links.forEach(function (link) {
      link.addEventListener("click", function () { sidebar.classList.remove("is-open"); });
    });
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  function init() {
    if (!DATA) {
      console.warn("project.js missing — run docs/tools/build_website.py");
    } else {
      renderStats();
      renderModules();
      renderSchema();
      // REMOVED: buildViewer(el("sqlViewer"), DATA.sql, "sql", { prefix: "sql/" });
      buildViewer(el("appViewer"), DATA.app, "python", { prefix: "app/" });
      renderCoverage();
      renderQueries();
      renderGallery();
      renderFiles();
    }
    setupNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();