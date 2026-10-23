// Tela de login / cadastro / convidado / provedores.
import { $, $$, h, fill } from './dom.js';
import { ICONS } from './icons.js';
import { startHero } from './hero.js';
import { toggleTheme, currentTheme } from './theme.js';
import { CRAFTER_LOGO } from './brand.js';

const OAUTH = [
  ['google', 'Google', '#ffffff', '#3c4043'],
  ['azure', 'Microsoft', '#2f2f2f', '#ffffff'],
  ['github', 'GitHub', '#24292f', '#ffffff'],
];

export function showLogin(backend, onEnter) {
  const screen = $('#login-screen');
  screen.hidden = false;
  for (const el of $$('[data-logo]', screen)) el.innerHTML = CRAFTER_LOGO;
  pixelDecor(screen);
  for (const el of $$('[data-icon]', screen)) el.innerHTML = ICONS[el.dataset.icon] || '';
  const themeBtn = $('#login-theme');
  const paintTheme = () => { themeBtn.innerHTML = currentTheme() === 'dark' ? ICONS.sun : ICONS.moon; };
  paintTheme();
  themeBtn.onclick = () => { toggleTheme(); paintTheme(); };
  const stopHero = startHero($('#hero-canvas'));

  $('#demo-banner').hidden = backend.mode !== 'local';
  if (backend.mode === 'supabase') {
    const row = $('#oauth-row');
    row.hidden = false;
    fill(row, ...OAUTH.filter(([p]) => backend.cfg.INTEGRATIONS[p] !== false).map(([p, label, bg, fg]) =>
      h('button', { type: 'button', class: 'oauth-btn', style: `background:${bg};color:${fg}`, onclick: () => backend.signInWith(p).catch((e) => showErr(e.message)) }, `Entrar com ${label}`)));
  }

  const forms = { login: $('#form-login'), register: $('#form-register') };
  const show = (name) => {
    for (const [k, f] of Object.entries(forms)) f.hidden = k !== name;
    const first = forms[name].querySelector('input');
    if (first) first.focus();
  };
  const showErr = (msg) => {
    const f = forms.login.hidden ? forms.register : forms.login;
    f.querySelector('.form-error').textContent = msg;
  };
  for (const a of $$('[data-go]', screen)) a.addEventListener('click', (e) => { e.preventDefault(); show(a.dataset.go); });

  for (const btn of $$('.eye', screen)) {
    btn.innerHTML = ICONS.eye;
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const hidden = input.type === 'password';
      input.type = hidden ? 'text' : 'password';
      btn.innerHTML = hidden ? ICONS.eyeOff : ICONS.eye;
    });
  }

  const finish = (user) => {
    stopHero();
    screen.hidden = true;
    onEnter(user);
  };

  const submitWith = (form, fn) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      const btn = form.querySelector('button[type=submit]');
      if (err) err.textContent = '';
      btn.disabled = true;
      try {
        await fn(Object.fromEntries(new FormData(form)));
      } catch (ex) {
        if (err) err.textContent = ex.message;
        else showErr(ex.message);
      } finally {
        btn.disabled = false;
      }
    });
  };

  submitWith(forms.login, async (v) => finish(await backend.signIn(v.email, v.password, forms.login.remember.checked)));

  submitWith(forms.register, async (v) => {
    if (!v.name || v.name.trim().length < 2) throw new Error('Informe um nome com pelo menos 2 letras.');
    if (v.password !== v.confirm) throw new Error('As senhas não coincidem.');
    const r = await backend.signUp(v.name.trim(), v.email.trim(), v.password);
    if (r && r.needsConfirmation) {
      show('login');
      forms.login.email.value = v.email;
      showErr('');
      forms.login.querySelector('.form-error').textContent = '✉️ Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.';
      return;
    }
    finish(r);
  });

  const guest = $('#form-guest');
  submitWith(guest, async (v) => {
    if (!v.name || v.name.trim().length < 2) {
      guest.name.focus();
      guest.classList.add('shake');
      setTimeout(() => guest.classList.remove('shake'), 400);
      return;
    }
    finish(await backend.signInGuest(v.name.trim()));
  });

  show('login');
}

/** Quadradinhos verdes decorativos nos cantos (como pixels se desfazendo). */
function pixelDecor(screen) {
  for (const box of $$('.px-decor', screen)) {
    if (box.childElementCount) continue;
    const corner = box.classList.contains('px-decor-tl') ? 'tl' : 'br';
    for (let i = 0; i < 70; i++) {
      // mais densos perto do canto
      const r = Math.pow(Math.random(), 1.8);
      const a = Math.random() * Math.PI / 2;
      const x = Math.round((Math.cos(a) * r * 260) / 14) * 14;
      const y = Math.round((Math.sin(a) * r * 200) / 14) * 14;
      const sq = document.createElement('i');
      sq.style[corner === 'tl' ? 'left' : 'right'] = `${x}px`;
      sq.style[corner === 'tl' ? 'top' : 'bottom'] = `${y}px`;
      sq.style.opacity = (0.25 + (1 - r) * 0.6).toFixed(2);
      if (Math.random() < 0.3) sq.className = 'd';
      box.append(sq);
    }
  }
}
