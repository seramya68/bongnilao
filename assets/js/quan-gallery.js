// Gallery extension for Trần Minh Quân: 1.jpg–7.jpg + 8.png.
// Runs after app.js. Leaves existing character gallery behavior unchanged.
(function(){
  'use strict';
  const oldOpenProfile = window.openProfile;
  if (typeof oldOpenProfile !== 'function') return;
  window.openProfile = function(id) {
    const result = oldOpenProfile.apply(this, arguments);
    if (id === 'tranminhquan') {
      const container = document.getElementById('galleryGrid');
      const last = container && container.querySelector('img.gallery-img:last-of-type');
      if (last) {
        last.src = 'assets/images/tranminhquan/8.png';
        last.alt = 'Trần Minh Quân 8';
      }
    }
    return result;
  };
})();
