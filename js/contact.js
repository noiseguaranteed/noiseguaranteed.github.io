/* contact.js: builds the email address in the browser, so it never appears whole in the
   page source and simple scrapers miss it. Screen readers still get an ordinary link.

     <a class="buy" data-contact data-subject="My music" href="#contact">email us</a>
     <span data-contact-addr>hello at noiseguaranteed dot org</span>

   Without JavaScript, links fall back to #contact, where the spelled-out address is shown.
   ADDRESS: swap for a Proton alias (e.g. hello@noiseguaranteed.org) by changing this line. */
(function () {
  var user = 'alexmlucas', domain = 'proton' + '.' + 'me';
  var addr = user + '@' + domain;

  document.querySelectorAll('a[data-contact]').forEach(function (a) {
    var subject = a.getAttribute('data-subject');
    a.href = 'mailto:' + addr + (subject ? '?subject=' + encodeURIComponent(subject) : '');
  });

  document.querySelectorAll('[data-contact-addr]').forEach(function (el) {
    var a = document.createElement('a');
    a.href = 'mailto:' + addr;
    a.textContent = addr;
    el.replaceWith(a);
  });
})();
