// Mesa da reunião: anexos de arquivos, planilhas conectadas (Google Sheets, Excel Online,
// Airtable…) e gráficos feitos de uma planilha/CSV. Tudo fica ligado à sala (ou à chamada)
// e aparece em tempo real para quem está na reunião.
import { h, fill, toast } from '../ui/dom.js';
import { openModal, confirmBox } from '../ui/modal.js';
import { ICONS } from '../ui/icons.js';
import { iconUrl } from '../art/assets.js';

const KIND_ICON = { sheet: 'Google Sheets', chart: 'Google Slides', link: 'Google Chrome' };
const FILE_ICON = [
  [/sheet|excel|csv|xls/i, 'Microsoft Excel'], [/word|doc/i, 'Microsoft Word'], [/powerpoint|ppt|presentation/i, 'Microsoft PowerPoint'],
  [/pdf/i, 'Google Docs'], [/image/i, 'Google Photos'], [/zip|rar|compressed/i, 'WinRAR'], [/video/i, 'Youtube'], [/audio/i, 'Spotify'],
];

const fmtSize = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n > 1e3 ? `${Math.round(n / 1e3)} KB` : `${n || 0} B`);

/** Link de planilha → URL que pode ser incorporada num iframe. */
export function sheetEmbed(u) {
  try {
    const url = new URL(u);
    if (/docs\.google\.com$/.test(url.hostname) && /\/spreadsheets\//.test(url.pathname)) {
      if (/\/pubhtml|\/htmlview|output=html/.test(u)) return u;
      const id = (/\/d\/([^/]+)/.exec(url.pathname) || [])[1];
      const gid = url.searchParams.get('gid') || (/gid=(\d+)/.exec(url.hash) || [])[1];
      return id ? `https://docs.google.com/spreadsheets/d/${id}/htmlview?rm=minimal${gid ? `&gid=${gid}` : ''}` : u;
    }
    if (/onedrive\.live\.com|sharepoint\.com|1drv\.ms/.test(url.hostname)) return u.includes('action=embedview') ? u : `${u}${u.includes('?') ? '&' : '?'}action=embedview`;
    if (/airtable\.com$/.test(url.hostname) && !/\/embed\//.test(url.pathname)) return u.replace('airtable.com/', 'airtable.com/embed/');
    return u;
  } catch {
    return '';
  }
}

/** CSV de uma planilha do Google publicada ou de um link .csv. */
export function sheetCsvUrl(u) {
  try {
    const url = new URL(u);
    if (/docs\.google\.com$/.test(url.hostname) && /\/spreadsheets\//.test(url.pathname)) {
      const id = (/\/d\/([^/]+)/.exec(url.pathname) || [])[1];
      const gid = url.searchParams.get('gid') || (/gid=(\d+)/.exec(url.hash) || [])[1] || '0';
      if (/\/d\/e\//.test(url.pathname)) return `https://docs.google.com/spreadsheets/d/e/${(/\/d\/e\/([^/]+)/.exec(url.pathname) || [])[1]}/pub?output=csv&gid=${gid}`;
      return id ? `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}` : '';
    }
    return u;
  } catch {
    return '';
  }
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const num = (v) => {
  const s = String(v).trim().replace(/[R$\s%]/g, '');
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

const PALETTE = ['#2e9e8f', '#e0a43a', '#c4547a', '#5b7fd6', '#7bc86a', '#9a6ad6', '#d9783a', '#3fb6c8'];

/** Desenha o gráfico (barras, linhas ou pizza) num canvas, no estilo pixel. */
export function drawChart(canvas, data, type = 'bar') {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const css = getComputedStyle(document.body);
  const ink = css.getPropertyValue('--ink').trim() || '#2a2a3a';
  const grid = 'rgba(128,128,128,.25)';
  ctx.clearRect(0, 0, W, H);
  ctx.font = '600 12px Nunito, system-ui, sans-serif';
  const { labels, series } = data;
  if (!labels.length || !series.length) {
    ctx.fillStyle = ink;
    ctx.fillText('Sem números para desenhar.', 16, 30);
    return;
  }
  if (type === 'pie') {
    const s = series[0];
    const total = s.values.reduce((a, b) => a + Math.max(0, b || 0), 0) || 1;
    let a0 = -Math.PI / 2;
    const r = Math.min(W * 0.32, H * 0.42);
    const cx = W * 0.36;
    const cy = H / 2;
    s.values.forEach((v, i) => {
      const a1 = a0 + (Math.max(0, v || 0) / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fill();
      ctx.strokeStyle = '#fff8e8';
      ctx.lineWidth = 2;
      ctx.stroke();
      a0 = a1;
    });
    labels.forEach((l, i) => {
      const y = 24 + i * 20;
      if (y > H - 10) return;
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fillRect(W * 0.7, y - 10, 12, 12);
      ctx.fillStyle = ink;
      ctx.fillText(`${l} — ${Math.round((Math.max(0, s.values[i] || 0) / total) * 100)}%`, W * 0.7 + 18, y);
    });
    return;
  }
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const L = 54;
  const R = 14;
  const T = 18 + (series.length > 1 ? 20 : 0);
  const B = 40;
  const pw = W - L - R;
  const ph = H - T - B;
  const y = (v) => T + ph - ((v - min) / (max - min || 1)) * ph;
  ctx.strokeStyle = grid;
  ctx.fillStyle = ink;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    const yy = Math.round(y(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(W - R, yy); ctx.stroke();
    ctx.fillText(Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v * 100) / 100), 4, yy + 4);
  }
  const step = pw / labels.length;
  labels.forEach((l, i) => {
    if (labels.length > 16 && i % Math.ceil(labels.length / 16)) return;
    ctx.save();
    ctx.translate(L + step * (i + 0.5), H - B + 14);
    ctx.rotate(labels.length > 8 ? -0.5 : 0);
    ctx.textAlign = 'center';
    ctx.fillText(String(l).slice(0, 14), 0, 0);
    ctx.restore();
  });
  series.forEach((s, si) => {
    const col = PALETTE[si % PALETTE.length];
    if (type === 'line') {
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      s.values.forEach((v, i) => { if (!Number.isFinite(v)) return; const px = L + step * (i + 0.5); const py = y(v); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
      ctx.stroke();
      ctx.fillStyle = col;
      s.values.forEach((v, i) => { if (Number.isFinite(v)) ctx.fillRect(L + step * (i + 0.5) - 3, y(v) - 3, 6, 6); });
    } else {
      const bw = Math.max(2, (step * 0.7) / series.length);
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        const px = L + step * i + step * 0.15 + bw * si;
        const y0 = y(Math.max(0, min));
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(px), Math.round(Math.min(y(v), y0)), Math.round(bw - 1), Math.max(1, Math.round(Math.abs(y(v) - y0))));
      });
    }
    if (series.length > 1) {
      ctx.fillStyle = col;
      ctx.fillRect(L + si * 120, 6, 12, 12);
      ctx.fillStyle = ink;
      ctx.fillText(s.name.slice(0, 14), L + si * 120 + 16, 16);
    }
  });
}

/** Tabela (linhas) → { labels, series } usando a 1ª coluna como rótulo e as numéricas como séries. */
export function tableToChart(rows) {
  if (rows.length < 2) return { labels: [], series: [] };
  const head = rows[0];
  const body = rows.slice(1);
  const series = [];
  for (let c = 1; c < head.length; c++) {
    const values = body.map((r) => num(r[c]));
    if (values.filter(Number.isFinite).length >= Math.max(1, body.length * 0.5)) series.push({ name: head[c] || `Série ${c}`, values });
  }
  return { labels: body.map((r) => r[0]), series: series.slice(0, 6) };
}

export class Meetings {
  constructor(app) {
    this.app = app;
    this.view = null;
    app.backend.onChange('meeting_items', (p) => {
      const row = (p && (p.new || p.old)) || {};
      if (this.view && (!row.room || row.room === this.view.room)) this.refresh();
    });
  }

  /** Abre o painel da reunião da sala (room = id da área ou da chamada). */
  open(room, title = 'Reunião') {
    const app = this.app;
    const list = h('div', { class: 'meet-list' });
    const fileInput = h('input', { type: 'file', multiple: true, hidden: true, onchange: (e) => this.upload([...e.target.files]) });
    const drop = h('div', { class: 'drop-zone', onclick: () => fileInput.click() }, h('span', { html: ICONS.clip }), ' Arraste arquivos aqui ou clique para anexar');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); this.upload([...e.dataTransfer.files]); });
    const content = h('div', { class: 'meeting' },
      h('div', { class: 'meet-actions' },
        h('button', { class: 'btn-secondary small', onclick: () => this.addSheet() }, h('img', { src: iconUrl('Google Sheets'), alt: '' }), 'Conectar planilha'),
        h('button', { class: 'btn-secondary small', onclick: () => this.addChart() }, h('span', { html: ICONS.chart }), 'Criar gráfico'),
        h('button', { class: 'btn-secondary small', onclick: () => this.addLink() }, h('span', { html: ICONS.link }), 'Adicionar link'),
        app.calls.call ? null : h('button', { class: 'btn-primary small', onclick: () => app.calls.openDialer({ place: title }) }, h('span', { class: 'phone-ic', html: ICONS.phone }), 'Chamar alguém')),
      app.user.guest ? h('p', { class: 'muted small' }, 'Convidados podem ver, mas não anexar.') : [drop, fileInput],
      list);
    const m = openModal({ title: `📎 ${title} — anexos, planilhas e gráficos`, content, className: 'modal-wide', onClose: () => { this.view = null; } });
    this.view = { room, title, list, modal: m };
    this.refresh();
    return m;
  }

  async refresh() {
    const v = this.view;
    if (!v) return;
    let items = [];
    try { items = await this.app.backend.meetingItems(v.room); } catch (e) { fill(v.list, h('p', { class: 'form-error' }, e.message)); return; }
    fill(v.list, items.length ? items.map((it) => this.row(it)) : h('p', { class: 'muted' }, 'Nada anexado ainda. Anexe arquivos, conecte planilhas e crie gráficos para todos da reunião.'));
  }

  icon(it) {
    if (it.kind === 'file') {
      const hit = FILE_ICON.find(([re]) => re.test(`${it.mime} ${it.title}`));
      return iconUrl(hit ? hit[1] : 'Google Files');
    }
    if (it.kind === 'sheet' && /onedrive|sharepoint|1drv/.test(it.url || '')) return iconUrl('Microsoft Excel');
    if (it.kind === 'sheet' && /airtable/.test(it.url || '')) return iconUrl('Google Sheets');
    return iconUrl(KIND_ICON[it.kind] || 'Google Chrome');
  }

  row(it) {
    const app = this.app;
    const mine = it.created_by === app.user.id || app.user.admin;
    return h('div', { class: 'meet-item' },
      h('img', { src: this.icon(it), alt: '', class: 'meet-ic' }),
      h('div', { class: 'meet-meta' },
        h('strong', {}, it.title || '(sem título)'),
        h('span', { class: 'muted small' }, [it.kind === 'file' ? fmtSize(it.size) : it.kind === 'sheet' ? 'planilha conectada' : it.kind === 'chart' ? `gráfico (${(it.data && it.data.type) || 'barras'})` : 'link', ' · ', it.created_name || '', ' · ', new Date(it.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })].join(''))),
      h('button', { class: 'btn-secondary small', onclick: () => this.view_(it) }, 'Abrir'),
      mine ? h('button', { class: 'icon-btn danger', title: 'Remover', html: ICONS.trash, onclick: async () => {
        if (await confirmBox('Remover?', `"${it.title}" sai da reunião para todos.`, 'Remover', true)) {
          try { await app.backend.removeMeetingItem(it); this.refresh(); } catch (e) { toast(e.message, 'error'); }
        }
      } }) : null);
  }

  async upload(files) {
    const v = this.view;
    if (!v || !files.length) return;
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) { toast(`${f.name}: máximo de 25 MB.`, 'warn'); continue; }
      toast(`Enviando ${f.name}…`, 'info', 1500);
      try {
        await this.app.backend.addMeetingItem({ room: v.room, kind: 'file', title: f.name, created_name: this.app.me.name }, f);
      } catch (e) { toast(e.message, 'error'); }
    }
    this.announce('anexou arquivo(s)');
    this.refresh();
  }

  async add(item) {
    try {
      await this.app.backend.addMeetingItem({ room: this.view.room, created_name: this.app.me.name, ...item });
      this.announce(item.kind === 'chart' ? 'criou um gráfico' : item.kind === 'sheet' ? 'conectou uma planilha' : 'adicionou um link');
      this.refresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  announce(what) {
    this.app.room.send('meeting', { room: this.view.room, by: this.app.me.name, what });
  }

  addLink() {
    const title = h('input', { type: 'text', placeholder: 'Nome', maxlength: 80 });
    const url = h('input', { type: 'url', placeholder: 'https://…' });
    const m = openModal({
      title: 'Adicionar link', content: h('div', { class: 'form-stack' }, h('label', {}, 'Nome', title), h('label', {}, 'Link', url)),
      footer: [h('button', { class: 'btn-primary', onclick: () => {
        if (!/^https?:\/\//.test(url.value.trim())) return toast('Use um link começando com https://', 'warn');
        this.add({ kind: 'link', title: title.value.trim() || url.value.trim(), url: url.value.trim() });
        m.close();
      } }, 'Adicionar')],
    });
  }

  addSheet() {
    const title = h('input', { type: 'text', placeholder: 'Ex.: Pipeline de vendas', maxlength: 80 });
    const url = h('input', { type: 'url', placeholder: 'https://docs.google.com/spreadsheets/d/…' });
    const m = openModal({
      title: 'Conectar planilha',
      content: h('div', { class: 'form-stack' }, h('label', {}, 'Nome', title), h('label', {}, 'Link da planilha', url),
        h('p', { class: 'muted small' }, 'Google Sheets: Compartilhar → "qualquer pessoa com o link" (ou Arquivo → Publicar na web). Excel Online/OneDrive e Airtable também funcionam. A planilha aparece ao vivo dentro do jogo.')),
      footer: [h('button', { class: 'btn-primary', onclick: () => {
        const u = url.value.trim();
        if (!/^https?:\/\//.test(u)) return toast('Cole o link da planilha.', 'warn');
        this.add({ kind: 'sheet', title: title.value.trim() || 'Planilha', url: u });
        m.close();
      } }, 'Conectar')],
    });
  }

  /** Gráfico a partir de CSV colado ou de uma planilha do Google (lido ao abrir). */
  addChart() {
    const title = h('input', { type: 'text', placeholder: 'Ex.: Leads por semana', maxlength: 80 });
    const type = h('select', {}, h('option', { value: 'bar' }, 'Barras'), h('option', { value: 'line' }, 'Linhas'), h('option', { value: 'pie' }, 'Pizza'));
    const url = h('input', { type: 'url', placeholder: 'Link da planilha (opcional: atualiza sozinho)' });
    const csv = h('textarea', { rows: 6, placeholder: 'Ou cole os dados (CSV ou copiado do Excel/Sheets):\nMês;Leads;Vendas\nJan;120;14\nFev;150;19' });
    const canvas = h('canvas', { width: 560, height: 240, class: 'chart-canvas' });
    let rows = [];
    const preview = async () => {
      try {
        if (url.value.trim()) {
          const res = await fetch(sheetCsvUrl(url.value.trim()));
          if (!res.ok) throw new Error('Não consegui ler a planilha. Publique na web (Arquivo → Publicar na web) ou cole os dados.');
          rows = parseCsv(await res.text());
        } else rows = parseCsv(csv.value.replace(/\t/g, ';'));
        drawChart(canvas, tableToChart(rows), type.value);
      } catch (e) { toast(e.message, 'warn', 4000); }
    };
    csv.addEventListener('input', preview);
    type.addEventListener('change', preview);
    url.addEventListener('change', preview);
    const m = openModal({
      title: 'Criar gráfico',
      className: 'modal-wide',
      content: h('div', { class: 'form-stack' }, h('label', {}, 'Título', title), h('label', {}, 'Tipo', type), h('label', {}, 'Planilha', url), csv, canvas),
      footer: [h('button', { class: 'btn-primary', onclick: async () => {
        await preview();
        const data = tableToChart(rows);
        if (!data.series.length) return toast('Não achei colunas com números.', 'warn');
        this.add({ kind: 'chart', title: title.value.trim() || 'Gráfico', url: url.value.trim() || null, data: { type: type.value, rows: url.value.trim() ? null : rows.slice(0, 200) } });
        m.close();
      } }, 'Salvar gráfico')],
    });
  }

  async view_(it) {
    const app = this.app;
    if (it.kind === 'chart') {
      const canvas = h('canvas', { width: 820, height: 380, class: 'chart-canvas' });
      openModal({ title: `📊 ${it.title}`, className: 'modal-xl', content: h('div', {}, canvas, it.url ? h('p', { class: 'muted small' }, 'Dados lidos ao vivo da planilha.') : null) });
      let rows = (it.data && it.data.rows) || [];
      if (it.url) {
        try { rows = parseCsv(await (await fetch(sheetCsvUrl(it.url))).text()); } catch { toast('Não consegui atualizar a planilha; mostrando o que foi salvo.', 'warn'); }
      }
      drawChart(canvas, tableToChart(rows), (it.data && it.data.type) || 'bar');
      return;
    }
    let link = it.url;
    try { link = await app.backend.fileUrl(it); } catch (e) { return toast(e.message, 'error'); }
    if (it.kind === 'sheet') {
      openModal({ title: `📗 ${it.title}`, className: 'modal-xl', content: h('div', { class: 'embed-box tall' }, h('iframe', { src: sheetEmbed(link), allow: 'clipboard-write' })),
        footer: [h('a', { class: 'btn-secondary', href: link, target: '_blank', rel: 'noopener' }, 'Abrir no navegador')] });
      return;
    }
    if (it.kind === 'file' && /^image\//.test(it.mime || '')) {
      openModal({ title: it.title, className: 'modal-wide', content: h('img', { src: link, alt: it.title, class: 'meet-preview' }), footer: [h('a', { class: 'btn-primary', href: link, download: it.title }, 'Baixar')] });
      return;
    }
    if (it.kind === 'file' && /pdf/.test(it.mime || '')) {
      openModal({ title: it.title, className: 'modal-xl', content: h('div', { class: 'embed-box tall' }, h('iframe', { src: link })), footer: [h('a', { class: 'btn-primary', href: link, download: it.title }, 'Baixar')] });
      return;
    }
    if (it.kind === 'file' && /csv|excel|sheet/.test(`${it.mime} ${it.title}`) && /csv/i.test(`${it.mime} ${it.title}`)) {
      const text = await (await fetch(link)).text();
      const rows = parseCsv(text);
      const canvas = h('canvas', { width: 820, height: 320, class: 'chart-canvas' });
      openModal({ title: it.title, className: 'modal-xl', content: h('div', {}, canvas, h('div', { class: 'csv-table' }, h('table', {}, rows.slice(0, 50).map((r, i) => h('tr', {}, r.map((c) => h(i ? 'td' : 'th', {}, c))))))),
        footer: [h('a', { class: 'btn-primary', href: link, download: it.title }, 'Baixar')] });
      drawChart(canvas, tableToChart(rows), 'bar');
      return;
    }
    window.open(link, '_blank', 'noopener');
  }
}
