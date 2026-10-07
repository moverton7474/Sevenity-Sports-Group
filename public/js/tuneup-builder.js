/**
 * In Season Tune Up: build your own monthly package.
 *
 * Players pick 0-8 player development sessions, 0-4 games of videography and
 * 0-4 film breakdowns (at least one item overall). Prices are never shown per
 * item, only the monthly total at the end. api/lead.js holds the same rates and
 * recomputes the price, so the invoice never trusts a number sent from the browser.
 *
 * Used on tune-up.html (the build your own section).
 */
window.SevenityTuneUp = (function(){
  "use strict";

  var ITEMS = [
    { key: 'pd',   min: 0, max: 8, rate: 65, one: 'Player development session', many: 'Player development sessions' },
    { key: 'vid',  min: 0, max: 4, rate: 85, one: 'Game with videography',      many: 'Games with videography' },
    { key: 'film', min: 0, max: 4, rate: 35, one: 'Film breakdown session',     many: 'Film breakdown sessions' }
  ];
  var PACKAGES = [
    { id: 'tuneup-starter', name: 'Starter', pd: 2, vid: 1, film: 1, price: 300 },
    { id: 'tuneup-pro',     name: 'Pro',     pd: 4, vid: 2, film: 2, price: 500 },
    { id: 'tuneup-elite',   name: 'Elite',   pd: 8, vid: 3, film: 4, price: 750 }
  ];
  var DEFAULTS = { pd: 0, vid: 0, film: 0 };

  function clamp(item, v){
    v = parseInt(v, 10);
    if (isNaN(v)) v = DEFAULTS[item.key];
    return Math.max(item.min, Math.min(item.max, v));
  }
  function normalize(c){
    var out = {};
    ITEMS.forEach(function(it){ out[it.key] = clamp(it, c && c[it.key]); });
    return out;
  }
  function total(c){
    return ITEMS.reduce(function(sum, it){ return sum + c[it.key] * it.rate; }, 0);
  }
  function lines(c){
    return ITEMS.filter(function(it){ return c[it.key] > 0; }).map(function(it){ return c[it.key] + ' ' + (c[it.key] === 1 ? it.one : it.many).toLowerCase(); });
  }
  /* The cheapest ready-made package that covers everything picked, if it costs
     the same or less than the custom build. */
  function better(c){
    var t = total(c), best = null;
    PACKAGES.forEach(function(p){
      if (p.pd >= c.pd && p.vid >= c.vid && p.film >= c.film && p.price <= t && (!best || p.price < best.price)) best = p;
    });
    return best;
  }
  function fromQuery(){
    var q = {};
    window.location.search.replace(/[?&](pd|vid|film)=(\d+)/g, function(_, k, v){ q[k] = v; });
    return normalize(q);
  }
  function query(c){
    return 'pd=' + c.pd + '&vid=' + c.vid + '&film=' + c.film;
  }

  var styled = false;
  function addStyles(){
    if (styled) return; styled = true;
    var css = ''
      + '.tub-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.75rem 0;border-top:1px solid var(--line-soft)}'
      + '.tub-row:first-child{border-top:0}'
      + '.tub-name{font-size:.92rem;color:var(--ink);line-height:1.35}'
      + '.tub-name small{display:block;font-family:var(--f-m);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-top:.15rem}'
      + '.tub-step{display:flex;align-items:center;gap:.35rem;flex:none}'
      + '.tub-step button{width:2.2rem;height:2.2rem;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink);font:700 1.05rem/1 var(--f-m);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}'
      + '.tub-step button:hover:not(:disabled){border-color:#fff}'
      + '.tub-step button:disabled{opacity:.3;cursor:default}'
      + '.tub-step output{min-width:1.8rem;text-align:center;font:700 1.15rem var(--f-m);color:#fff;font-variant-numeric:tabular-nums}'
      + '.tub-total{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;border-top:1px solid var(--line);margin-top:.4rem;padding-top:1rem}'
      + '.tub-total .lbl{font-family:var(--f-m);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}'
      + '.tub-total .amt{font-family:var(--f-m);font-size:1.6rem;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}'
      + '.tub-total .amt small{font-size:.68rem;color:var(--ink-3);font-weight:500;letter-spacing:.04em;text-transform:uppercase}'
      + '.tub-tip{display:none;margin:.8rem 0 0;font-size:.85rem;color:var(--ink-2);border-left:2px solid var(--gold);padding:.1rem 0 .1rem .7rem}'
      + '.tub-tip.on{display:block}'
      + '.tub-tip a{color:var(--gold)}'
      + '@media(max-width:480px){.tub-row{gap:.6rem}.tub-name{font-size:.86rem}.tub-name small{white-space:nowrap;letter-spacing:.05em}'
      + '.tub-step{gap:.2rem}.tub-step button{width:1.85rem;height:1.85rem;font-size:.95rem}.tub-step output{min-width:1.4rem;font-size:1.05rem}}';
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  /* Renders the steppers + running total into el. onChange(counts, total) runs on
     every change (and once at start). opts.tipLink(pkg) returns an href for the
     "a package covers this" tip, or omit it for plain text. opts.hidePrice drops
     the running total and the tip, for a pick-first, see-the-total-after flow. */
  function mount(el, start, onChange, opts){
    addStyles();
    opts = opts || {};
    var c = normalize(start);
    el.innerHTML = '';
    var rows = document.createElement('div');
    ITEMS.forEach(function(it){
      var row = document.createElement('div'); row.className = 'tub-row';
      row.innerHTML = '<div class="tub-name"></div><div class="tub-step">'
        + '<button type="button" data-d="-1"></button><output aria-live="polite"></output><button type="button" data-d="1"></button></div>';
      row.querySelector('.tub-name').textContent = it.many;
      var minus = row.querySelectorAll('button')[0], plus = row.querySelectorAll('button')[1], out = row.querySelector('output');
      minus.textContent = '−'; plus.textContent = '+';
      minus.setAttribute('aria-label', 'Fewer ' + it.many.toLowerCase());
      plus.setAttribute('aria-label', 'More ' + it.many.toLowerCase());
      function paint(){ out.textContent = c[it.key]; minus.disabled = c[it.key] <= it.min; plus.disabled = c[it.key] >= it.max; }
      [minus, plus].forEach(function(b){
        b.addEventListener('click', function(){
          c[it.key] = clamp(it, c[it.key] + parseInt(b.getAttribute('data-d'), 10));
          paint(); update();
        });
      });
      paint();
      rows.appendChild(row);
    });
    el.appendChild(rows);

    var tot = document.createElement('div'); tot.className = 'tub-total';
    if (opts.hidePrice) tot.style.display = 'none';
    tot.innerHTML = '<span class="lbl">Your monthly total</span><span class="amt"></span>';
    el.appendChild(tot);
    var tip = document.createElement('p'); tip.className = 'tub-tip';
    el.appendChild(tip);

    function update(){
      var t = total(c), b = better(c);
      tot.querySelector('.amt').innerHTML = '$' + t + ' <small>/ month</small>';
      if (b && !opts.hidePrice) {
        var nm = opts.tipLink ? '<a href="' + opts.tipLink(b) + '">' + b.name + ' package</a>' : 'the ' + b.name + ' package';
        tip.innerHTML = b.price < t
          ? 'The ' + nm + ' covers all of this for $' + b.price + ' / month. That saves you $' + (t - b.price) + '.'
          : 'This is the same as the ' + nm + '.';
        tip.className = 'tub-tip on';
      } else { tip.className = 'tub-tip'; tip.innerHTML = ''; }
      if (onChange) onChange(normalize(c), t);
    }
    update();
    return { get: function(){ return normalize(c); }, total: function(){ return total(c); } };
  }

  return { ITEMS: ITEMS, PACKAGES: PACKAGES, normalize: normalize, total: total, lines: lines, better: better, fromQuery: fromQuery, query: query, mount: mount };
})();
