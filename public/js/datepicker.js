/* Sevenity date picker: on desktop, replaces the browser's tiny native
 * calendar with a large, on-brand one. Phones keep their native picker. */
(function () {
  var input = document.getElementById('req-date');
  if (!input || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;

  var css = document.createElement('style');
  css.textContent =
    '.sdp-wrap{position:relative}' +
    '#req-date{background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27white%27 stroke-width=%272%27%3E%3Crect x=%273%27 y=%275%27 width=%2718%27 height=%2716%27 rx=%272%27/%3E%3Cpath d=%27M3 10h18M8 3v4M16 3v4%27/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .8rem center;background-size:1.15rem;padding-right:2.6rem}' +
    '.sdp{position:absolute;z-index:50;top:calc(100% + .5rem);left:0;width:min(30rem,90vw);background:#0D131B;border:1px solid #fff;border-radius:12px;padding:1.2rem;box-shadow:0 20px 50px rgba(0,0,0,.55);color:#F6F8FB;font-family:inherit}' +
    '.sdp[hidden]{display:none}' +
    '.sdp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.9rem}' +
    '.sdp-title{font-size:1.15rem;font-weight:600}' +
    '.sdp-nav{background:transparent;border:1px solid rgba(255,255,255,.6);color:#fff;border-radius:8px;width:2.6rem;height:2.6rem;font-size:1.3rem;cursor:pointer}' +
    '.sdp-nav:hover{background:rgba(255,255,255,.12)}' +
    '.sdp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:.3rem;text-align:center}' +
    '.sdp-dow{font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:#C3CCDC;padding:.3rem 0}' +
    '.sdp-day{background:transparent;border:1px solid transparent;color:#F6F8FB;border-radius:8px;height:3rem;font-size:1rem;cursor:pointer}' +
    '.sdp-day:hover:not(:disabled){border-color:#fff}' +
    '.sdp-day:disabled{color:rgba(255,255,255,.25);cursor:default}' +
    '.sdp-day.today{border-color:rgba(255,255,255,.45)}' +
    '.sdp-day.sel{background:#F2C879;color:#0D131B;font-weight:700}';
  document.head.appendChild(css);

  input.type = 'text';
  input.readOnly = true;
  input.placeholder = 'Pick a date';
  input.style.cursor = 'pointer';

  var wrap = document.createElement('div');
  wrap.className = 'sdp-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  var pop = document.createElement('div');
  pop.className = 'sdp';
  pop.hidden = true;
  wrap.appendChild(pop);

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var selected = null;

  function render() {
    var y = view.getFullYear(), m = view.getMonth();
    var h = '<div class="sdp-head"><button type="button" class="sdp-nav" data-nav="-1" aria-label="Previous month">&#8249;</button>' +
      '<div class="sdp-title">' + MONTHS[m] + ' ' + y + '</div>' +
      '<button type="button" class="sdp-nav" data-nav="1" aria-label="Next month">&#8250;</button></div><div class="sdp-grid">';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function (d) { h += '<div class="sdp-dow">' + d + '</div>'; });
    var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    for (var i = 0; i < first; i++) h += '<div></div>';
    for (var d = 1; d <= days; d++) {
      var dt = new Date(y, m, d), cls = 'sdp-day';
      if (+dt === +today) cls += ' today';
      if (selected && +dt === +selected) cls += ' sel';
      h += '<button type="button" class="' + cls + '" data-day="' + d + '"' + (dt < today ? ' disabled' : '') + '>' + d + '</button>';
    }
    pop.innerHTML = h + '</div>';
  }

  function open() { render(); pop.hidden = false; }
  function close() { pop.hidden = true; }

  input.addEventListener('click', function () { pop.hidden ? open() : close(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    if (e.key === 'Escape') close();
  });
  pop.addEventListener('click', function (e) {
    e.stopPropagation();
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.nav) { view.setMonth(view.getMonth() + +b.dataset.nav); render(); return; }
    selected = new Date(view.getFullYear(), view.getMonth(), +b.dataset.day);
    input.value = selected.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    input.dataset.iso = selected.getFullYear() + '-' + String(selected.getMonth() + 1).padStart(2, '0') + '-' + String(selected.getDate()).padStart(2, '0');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
    input.focus();
  });
  document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
