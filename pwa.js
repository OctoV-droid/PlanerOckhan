/* Поддержка офлайн-режима GitHub Pages / Safari iOS. */
(() => {
  'use strict';
  const notice = document.querySelector('#connection-notice');
  const showNetwork = () => { if (notice) notice.hidden = navigator.onLine; };
  window.addEventListener('online', showNetwork);
  window.addEventListener('offline', showNetwork);
  showNetwork();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(error => console.warn('Офлайн-режим не удалось включить:', error)));
  }
})();
