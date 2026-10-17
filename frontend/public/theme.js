// Applies the saved theme before the app loads, so a dark-theme user never sees a white flash.
// A separate file rather than an inline script because the content security policy forbids inline scripts.
// With nothing saved, the device's own light/dark setting decides.
;(function () {
  var saved = null
  try {
    saved = localStorage.getItem('hsmlis.theme')
  } catch {}
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
})()
