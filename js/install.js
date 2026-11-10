// "Install on phone" button under the remote.
// Chrome/Edge/Samsung (Android, desktop): uses the browser's install prompt.
// iPhone/iPad: Safari has no install API, so the button shows how to add it to the home screen.
// Hidden when already running as an installed app.

const box = document.getElementById('install');
const button = document.getElementById('install-button');
const iosHelp = document.getElementById('install-ios');

const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);  // iPadOS reports itself as a Mac

let deferred = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();  // show our button instead of the browser's mini bar
  deferred = e;
  if (!installed()) box.hidden = false;
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  box.hidden = true;
});

button.addEventListener('click', async () => {
  if (deferred) {
    deferred.prompt();
    const {outcome} = await deferred.userChoice;
    deferred = null;
    if (outcome === 'accepted') box.hidden = true;
  } else if (isIOS) {
    iosHelp.hidden = !iosHelp.hidden;
    button.setAttribute('aria-expanded', !iosHelp.hidden);
  }
});

if (isIOS && !installed()) box.hidden = false;
