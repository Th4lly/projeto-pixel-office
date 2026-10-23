// Ponto de entrada: escolhe o backend, verifica a sessão e abre o login ou o escritório.
import { createBackend } from './backend/index.js';
import { showLogin } from './ui/login.js';
import { applyTheme } from './ui/theme.js';
import { App } from './app.js';
import { $ } from './ui/dom.js';

applyTheme();

async function enter(backend, user) {
  const app = new App(backend, user);
  window.app = app;
  try {
    await app.start();
  } catch (e) {
    console.error(e);
    alert(`Não foi possível abrir o escritório: ${e.message}`);
  }
}

async function boot() {
  let backend;
  try {
    backend = await createBackend();
  } catch (e) {
    $('#boot').innerHTML = `<p class="boot-error">Erro ao iniciar: ${e.message}</p>`;
    return;
  }
  let user = null;
  try {
    user = await backend.session();
  } catch (e) {
    console.warn(e);
  }
  $('#boot').remove();
  if (user) enter(backend, user);
  else showLogin(backend, (u) => enter(backend, u));
}

boot();
