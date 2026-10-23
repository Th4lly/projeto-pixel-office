// Fliperama (Cobrinha e Memória, com placar) e Jogo da Velha multiplayer nas mesas de jogos.
import { h, toast, fill } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { blip } from '../audio.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export class Games {
  constructor(app) {
    this.app = app;
    this.ttt = new Map(); // obj id -> estado
    this.tttView = null;
  }

  openArcade() {
    const m = openModal({
      title: '🕹️ Fliperama',
      content: h('div', { class: 'arcade-menu' },
        h('button', { class: 'arcade-pick', onclick: () => { m.close(); this.snake(); } }, h('span', { class: 'big-emoji' }, '🐍'), h('strong', {}, 'Cobrinha'), h('span', { class: 'muted small' }, 'Coma as moedas, não bata na parede.')),
        h('button', { class: 'arcade-pick', onclick: () => { m.close(); this.memory(); } }, h('span', { class: 'big-emoji' }, '🃏'), h('strong', {}, 'Memória'), h('span', { class: 'muted small' }, 'Ache os pares em poucas jogadas.')),
        h('button', { class: 'arcade-pick', onclick: () => { m.close(); this.app.quests.openRanking(); } }, h('span', { class: 'big-emoji' }, '🏅'), h('strong', {}, 'Recordes'), h('span', { class: 'muted small' }, 'Placar do time.'))),
    });
  }

  async saveScore(game, score) {
    if (!score) return;
    try {
      await this.app.backend.addScore(game, this.app.me.name, score);
      const top = await this.app.backend.topScores(game);
      if (top[0] && top[0].score <= score) {
        toast(`🏆 Novo recorde do time: ${score}!`, 'ok', 4000);
        this.app.room.send('quest', { type: 'other', title: `bateu o recorde de ${game === 'snake' ? 'Cobrinha' : 'Memória'} com ${score} pontos! 🏆`, by: this.app.me.name });
      }
    } catch (e) {
      console.warn(e);
    }
  }

  // ------------------------------------------------------------------ cobrinha
  snake() {
    const N = 20;
    const C = 18;
    const canvas = h('canvas', { width: N * C, height: N * C, class: 'game-canvas' });
    const ctx = canvas.getContext('2d');
    const info = h('p', { class: 'center' }, 'Use as setas (ou WASD). Espaço para começar.');
    let snake; let dir; let next; let food; let score; let timer = 0; let alive = false;
    const reset = () => {
      snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
      dir = { x: 1, y: 0 };
      next = dir;
      score = 0;
      placeFood();
      draw();
    };
    const placeFood = () => {
      do food = { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 }; while (snake.some((s) => s.x === food.x && s.y === food.y));
    };
    const draw = () => {
      ctx.fillStyle = '#14301f';
      ctx.fillRect(0, 0, N * C, N * C);
      ctx.fillStyle = '#1b3d28';
      for (let i = 0; i < N; i++) for (let j = (i % 2); j < N; j += 2) ctx.fillRect(i * C, j * C, C, C);
      ctx.font = `${C - 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🪙', food.x * C + C / 2, food.y * C + C / 2 + 1);
      snake.forEach((s, i) => {
        ctx.fillStyle = i ? '#5cff8f' : '#b6ffcb';
        ctx.fillRect(s.x * C + 1, s.y * C + 1, C - 2, C - 2);
      });
    };
    const tick = () => {
      dir = next;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || snake.some((s) => s.x === head.x && s.y === head.y)) {
        alive = false;
        clearInterval(timer);
        blip(150, 0.3, 0.08);
        info.textContent = `Fim de jogo! ${score} pontos. Espaço para jogar de novo.`;
        this.saveScore('snake', score);
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score += 10; blip(880, 0.05); placeFood(); info.textContent = `Pontos: ${score}`; } else snake.pop();
      draw();
    };
    const onKey = (e) => {
      const map = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
      if (e.code === 'Space') { e.preventDefault(); if (!alive) { reset(); alive = true; info.textContent = 'Pontos: 0'; clearInterval(timer); timer = setInterval(tick, 110); } return; }
      const d = map[e.code];
      if (!d) return;
      e.preventDefault();
      if (d[0] === -dir.x && d[1] === -dir.y) return;
      next = { x: d[0], y: d[1] };
    };
    window.addEventListener('keydown', onKey);
    reset();
    openModal({ title: '🐍 Cobrinha', content: h('div', { class: 'game' }, canvas, info), onClose: () => { clearInterval(timer); window.removeEventListener('keydown', onKey); } });
  }

  // ------------------------------------------------------------------ memória
  memory() {
    const icons = ['🗡️', '🛡️', '🧪', '🔮', '👑', '💎', '🍄', '🐉'];
    const deck = [...icons, ...icons].sort(() => Math.random() - 0.5).map((e, i) => ({ e, i, open: false, done: false }));
    let first = null; let lock = false; let moves = 0; let found = 0;
    const info = h('p', { class: 'center' }, 'Encontre os 8 pares.');
    const grid = h('div', { class: 'memory' });
    const paint = () => fill(grid, ...deck.map((c) => h('button', { type: 'button', class: `mcard ${c.open || c.done ? 'open' : ''} ${c.done ? 'done' : ''}`, onclick: () => flip(c) }, c.open || c.done ? c.e : '❔')));
    const flip = (c) => {
      if (lock || c.open || c.done) return;
      c.open = true;
      paint();
      if (!first) { first = c; return; }
      moves++;
      if (first.e === c.e) {
        first.done = c.done = true;
        found++;
        blip(990, 0.06);
        first = null;
        paint();
        if (found === icons.length) {
          const score = Math.max(10, 200 - (moves - 8) * 10);
          info.textContent = `Você venceu em ${moves} jogadas! ${score} pontos.`;
          this.saveScore('memory', score);
        } else info.textContent = `Jogadas: ${moves}`;
      } else {
        lock = true;
        info.textContent = `Jogadas: ${moves}`;
        setTimeout(() => { first.open = c.open = false; first = null; lock = false; paint(); }, 700);
      }
    };
    paint();
    openModal({ title: '🃏 Memória', content: h('div', { class: 'game' }, grid, info) });
  }

  // ------------------------------------------------------------------ jogo da velha (multiplayer)
  blankTtt(id) {
    return { obj: id, seq: 0, board: Array(9).fill(''), turn: 'X', X: null, O: null, names: {}, winner: '' };
  }

  openTicTacToe(o) {
    if (!this.ttt.has(o.id)) this.ttt.set(o.id, this.blankTtt(o.id));
    this.app.room.send('ttt', { obj: o.id, req: true });
    const body = h('div', { class: 'ttt' });
    this.tttView = { id: o.id, body };
    this.paintTtt();
    openModal({ title: '⭕ Jogo da velha', content: body, onClose: () => { this.tttView = null; } });
  }

  pushTtt(s) {
    s.seq += 1;
    this.ttt.set(s.obj, s);
    this.app.room.send('ttt', { state: s });
    this.paintTtt();
  }

  onTicTacToe(d) {
    if (d.req) {
      const s = this.ttt.get(d.obj);
      if (s && s.seq > 0) this.app.room.send('ttt', { state: s });
      return;
    }
    const s = d.state;
    if (!s) return;
    const cur = this.ttt.get(s.obj);
    if (cur && cur.seq >= s.seq) return;
    const prevWinner = cur && cur.winner;
    this.ttt.set(s.obj, s);
    if (s.winner && !prevWinner && this.tttView && this.tttView.id === s.obj) blip(s.winner === 'empate' ? 300 : 880, 0.2);
    this.paintTtt();
  }

  paintTtt() {
    const v = this.tttView;
    if (!v) return;
    const s = this.ttt.get(v.id);
    const me = this.app.me;
    const mySide = s.X === me.id ? 'X' : s.O === me.id ? 'O' : null;
    const join = (side) => {
      const n = { ...s, names: { ...s.names, [side]: me.name }, [side]: me.id };
      this.pushTtt(n);
    };
    const play = (i) => {
      if (s.winner || s.board[i] || !s.X || !s.O || mySide !== s.turn) return;
      const n = { ...s, board: [...s.board] };
      n.board[i] = mySide;
      const win = LINES.find(([a, b, c]) => n.board[a] && n.board[a] === n.board[b] && n.board[a] === n.board[c]);
      n.winner = win ? mySide : n.board.every(Boolean) ? 'empate' : '';
      n.turn = mySide === 'X' ? 'O' : 'X';
      blip(600, 0.04);
      this.pushTtt(n);
      if (n.winner === mySide) this.app.emote('🎉');
    };
    const status = s.winner
      ? (s.winner === 'empate' ? 'Deu velha! Empate.' : `${s.names[s.winner] || s.winner} venceu! 🎉`)
      : !s.X || !s.O ? 'Esperando dois jogadores…' : `Vez de ${s.names[s.turn]} (${s.turn})${mySide === s.turn ? ' — sua vez!' : ''}`;
    fill(v.body, 
      h('div', { class: 'ttt-players' }, ['X', 'O'].map((side) => h('div', { class: `ttt-slot ${s.turn === side && !s.winner ? 'turn' : ''}` },
        h('span', { class: 'ttt-mark' }, side),
        s[side] ? h('strong', {}, s.names[side]) : h('button', { class: 'btn-secondary small', disabled: !!mySide, onclick: () => join(side) }, 'Jogar aqui')))),
      h('div', { class: 'ttt-board' }, s.board.map((c, i) => h('button', { type: 'button', class: `ttt-cell ${c}`, onclick: () => play(i) }, c))),
      h('p', { class: 'center' }, status),
      h('div', { class: 'center' }, h('button', { class: 'btn-secondary small', onclick: () => this.pushTtt({ ...this.blankTtt(v.id), seq: s.seq }) }, 'Nova partida')));
  }
}
