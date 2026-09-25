/**
 * Wires up every ".book-btn" on a booking page against
 * window.SEVENITY_BOOKING_LINKS (see booking-config.js).
 *
 * A package with a real Stripe Payment Link gets "Book and pay" and
 * opens that link. A package left blank gets "Request this package"
 * and scrolls to the on-page request form with that package
 * preselected, instead of faking a checkout.
 */
(function(){
  "use strict";
  var links = window.SEVENITY_BOOKING_LINKS || {};

  Array.prototype.forEach.call(document.querySelectorAll('.book-btn'), function(btn){
    var id = btn.getAttribute('data-package-id');
    var url = (links[id] || '').trim();

    if(url){
      btn.textContent = 'Book and pay';
      btn.addEventListener('click', function(){
        window.location.href = url;
      });
    } else {
      btn.textContent = 'Request this package';
      btn.addEventListener('click', function(){ requestPackage(id); });
    }
  });

  function requestPackage(id){
    var select = document.getElementById('package');
    if(select){
      for(var i = 0; i < select.options.length; i++){
        if(select.options[i].value === id){ select.selectedIndex = i; break; }
      }
    }
    var form = document.getElementById('request-form');
    if(form && form.scrollIntoView){ form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    var nameInput = document.getElementById('req-name');
    if(nameInput){ setTimeout(function(){ nameInput.focus({ preventScroll: true }); }, 450); }
  }

  // Arriving from the Pricing page with ?package=<id>: go straight to booking
  // that package (request form preselected, or its pay button if it has a link).
  var wanted = (window.location.search.match(/[?&]package=([\w-]+)/) || [])[1];
  var wantedBtn = wanted && document.querySelector('.book-btn[data-package-id="' + wanted + '"]');
  if(wantedBtn){
    setTimeout(function(){
      if((links[wanted] || '').trim()){ wantedBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else { requestPackage(wanted); }
    }, 300);
  }
})();
