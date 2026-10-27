// NPCs com função. Não existe NPC "decorativo": todo NPC no mapa é um objeto do tipo "npc"
// com um papel (role), um nome e um sprite do catálogo; tecla X abre o diálogo dele.
import { h, fill, toast } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { CAT, frameCanvas } from '../art/assets.js';
import { npcFrames, OBJECTS } from '../art/objects.js';
import { blip } from '../audio.js';

export const ROLES = {
  secretary: { name: 'Secretária', title: 'Secretária da recepção', hello: 'Bem-vindo ao escritório! Posso achar uma mesa para você, levar você a uma sala, ligar para alguém ou abrir a loja de decoração.' },
  info: { name: 'Guia', title: 'Informações', hello: '' },
  arena: { name: 'Mestre do Quartel', title: 'Mestre do Quartel', hello: 'Aqui eu curo suas feridas, explico as regras d20 e solto monstros nas arenas.' },
};


export class NpcRoles {
  constructor(app) {
    this.app = app;
  }

  roleOf(o) {
    return ROLES[(o.data && o.data.role) || 'secretary'] || ROLES.secretary;
  }

  nameOf(o) {
    return (o.data && o.data.name) || this.roleOf(o).name;
  }

  portrait(o) {
    const a = npcFrames(o);
    return a ? frameCanvas(a.s, a.frames[0], 72) : h('span', {});
  }

  open(o) {
    const app = this.app;
    const role = (o.data && o.data.role) || 'secretary';
    const R = this.roleOf(o);
    const body = h('div', { class: 'npc-dialog' });
    const m = openModal({ title: `${this.nameOf(o)} — ${R.title}`, content: body, className: 'modal-wide' });
    blip(740, 0.05, 0.04);
    const opt = (label, fn) => h('button', { type: 'button', class: 'npc-opt', onclick: () => fn() }, label);
    let options = [];
    switch (role) {
      case 'arena':
        options = [
          opt('💖 Curar HP e SP', () => {
            const me = app.me;
            if (app.combat.inArena() && app.combat.nearestTarget(6)) return toast('Saia do combate primeiro!', 'warn');
            me.hp = me.maxHp; me.sp = me.maxSp; app.combat.statuses = {};
            app.combat.publish();
            app.combat.broadcastFx({ fx: 'heal', x: me.x + 0.5, y: me.y + 1 });
            toast('Você foi curado!', 'ok', 1500);
          }),
          opt('📜 Minha ficha e regras d20', () => { m.close(); app.combat.openSheet(); }),
          opt('🐉 Soltar uma onda de monstros', () => {
            const z = app.world.zones.find((zz) => zz.kind === 'arena' && /monstros/i.test(zz.name));
            if (!z) return toast('Não há arena de monstros no mapa.', 'warn');
            for (let i = 0; i < 3; i++) app.room.send('cbt', { type: 'summon', zone: z.id });
            if (app.combat.isAuthority(z)) for (let i = 0; i < 3; i++) app.combat.spawn(z);
            toast('Três monstros entraram na arena!', 'ok', 2000);
          }),
          opt('⚔️ Ranking PvP', () => this.ranking(body)),
        ];
        break;
      case 'info': {
        // faz o papel das antigas placas: o texto da área + atalhos para onde ela indica
        const text = (o.data && (o.data.text || o.data.hello)) || 'Olá!';
        fill(body, h('div', { class: 'npc-head' }, this.portrait(o), h('p', { class: 'npc-hello' }, text)),
          h('div', { class: 'npc-opts' }, opt('🗺️ Me leve até…', () => this.teleportMenu(body, m, true)), opt('👋 Obrigado!', () => m.close())));
        return;
      }
      default: // secretária
        options = [
          opt('🪑 Achar uma mesa para mim', () => { m.close(); this.findDesk(); }),
          opt('🗺️ Me leve até…', () => this.teleportMenu(body, m, true)),
          opt('📞 Ligar para alguém', () => { m.close(); app.calls.openDialer({ place: 'recepção' }); }),
          opt('🛒 Loja de decoração (zeny)', () => { m.close(); app.inventory.openShop(this.nameOf(o)); }),
          opt('📋 Quadro de quests', () => { m.close(); app.quests.open(); }),
          opt('📅 Minha agenda', () => { m.close(); app.integrations.openCalendar(); }),
          opt('❓ Como funciona o escritório', () => { m.close(); document.getElementById('btn-help').click(); }),
        ];
    }
    fill(body,
      h('div', { class: 'npc-head' }, this.portrait(o), h('p', { class: 'npc-hello' }, (o.data && o.data.hello) || R.hello)),
      h('div', { class: 'npc-opts' }, options));
  }

  teleportMenu(body, m, walk = false) {
    const app = this.app;
    const zones = app.world.zones.filter((z) => z.name && z.kind !== 'desk').sort((a, b) => a.name.localeCompare(b.name));
    fill(body, h('p', {}, walk ? 'Para onde? Eu te levo andando.' : 'Escolha o destino:'),
      h('div', { class: 'npc-opts' }, zones.map((z) => h('button', { type: 'button', class: 'npc-opt', onclick: () => {
        m.close();
        const spot = this.spotIn(z);
        if (!spot) return toast('Não achei um lugar livre lá.', 'warn');
        if (walk) app.goTo(spot.x, spot.y);
        else { app.teleport(spot.x, spot.y); app.combat.broadcastFx({ fx: 'cast', x: spot.x + 0.5, y: spot.y + 1 }); blip(520, 0.25, 0.06); }
      } }, `📍 ${z.name}`))));
  }

  spotIn(z) {
    const w = this.app.world;
    const cx = z.x + Math.floor(z.w / 2);
    const cy = z.y + Math.floor(z.h / 2);
    for (let r = 0; r < Math.max(z.w, z.h); r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h && w.walkable(x, y) && !w.seatAt(x, y)) return { x, y };
      }
    }
    return null;
  }

  goZone(re) {
    const z = this.app.world.zones.find((zz) => re.test(zz.name || ''));
    const s = z && this.spotIn(z);
    if (s) this.app.teleport(s.x, s.y);
  }

  findDesk() {
    const app = this.app;
    const mine = app.world.deskOf(app.user.id);
    const target = mine || app.world.objects.find((o) => OBJECTS[o.type] && OBJECTS[o.type].desk && !(o.data && o.data.owner) && app.world.deskZoneOf(o));
    if (!target) return toast('Todas as mesas estão ocupadas.', 'warn');
    app.goTo(target.x, target.y + 1);
    toast(mine ? 'Indo para a sua mesa.' : 'Achei uma mesa livre! Chegue perto e aperte X para reivindicar.', 'info', 3000);
  }

  async ranking(body) {
    const list = (this.app.profiles || []).map((p) => ({ name: p.name, k: (p.combat && p.combat.pvpKills) || 0 })).sort((a, b) => b.k - a.k).slice(0, 10);
    fill(body, h('p', {}, '⚔️ Ranking PvP'), list.length ? h('ol', {}, list.map((r) => h('li', {}, `${r.name} — ${r.k} vitórias`))) : h('p', { class: 'muted' }, 'Ninguém lutou ainda.'));
  }

  /** Editor do NPC (modo Construir → Editar). */
  edit(o) {
    const app = this.app;
    const d = o.data || {};
    const role = h('select', {}, Object.entries(ROLES).map(([k, r]) => h('option', { value: k, selected: (d.role || 'secretary') === k }, `${r.name} — ${r.title}`)));
    const name = h('input', { type: 'text', maxlength: 30, value: d.name || '', placeholder: 'Nome (opcional)' });
    const hello = h('textarea', { rows: 3, maxlength: 600, placeholder: 'Fala (para o guia: o texto informativo da área)' }, d.text || d.hello || '');
    let sprite = d.sprite || '';
    const grid = h('div', { class: 'palette npc-sprites' });
    const paintGrid = () => fill(grid, CAT.npcs.slice(0, 160).map((n) => {
      const a = npcFrames({ data: { sprite: n.id } });
      return h('button', { type: 'button', class: `pal-item ${sprite === n.id ? 'on' : ''}`, title: n.name, onclick: () => { sprite = n.id; paintGrid(); } }, a ? frameCanvas(a.s, a.frames[0], 40) : null);
    }));
    paintGrid();
    const m = openModal({
      title: 'Editar NPC', className: 'modal-wide',
      content: h('div', { class: 'form-stack' }, h('label', {}, 'Função', role), h('label', {}, 'Nome', name), h('label', {}, 'Fala', hello), h('div', { class: 'opt-label' }, 'Aparência'), grid),
      footer: [h('button', { class: 'btn-primary', onclick: () => {
        app.edit([{ t: 'data', id: o.id, data: { ...d, role: role.value, name: name.value.trim(), hello: hello.value.trim(), text: role.value === 'info' ? hello.value.trim() : d.text, sprite } }]);
        m.close();
      } }, 'Salvar')],
    });
  }
}
