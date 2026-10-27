// Vídeo e áudio por proximidade (WebRTC em malha; sinalização pelo canal de tempo real).
// • Conecta sozinho com quem está perto (ou na mesma área privada) e também ligou a câmera/mic
// • Áudio espacial: volume cai com a distância e o som vem do lado onde a pessoa está
// • Palco (área de Destaque): quem fala lá é ouvido por todo o escritório
// • Compartilhamento de tela troca o vídeo enviado, sem precisar reconectar
import { $, h, toast } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { isNear, onStage } from '../game/world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mediaErrorMessage(error) {
  const messages = {
    NotAllowedError: 'Permita o acesso ao microfone e à câmera nas configurações do navegador.',
    NotFoundError: 'Nenhum microfone ou câmera compatível foi encontrado.',
    NotReadableError: 'O microfone ou a câmera já está sendo usado por outro aplicativo.',
    OverconstrainedError: 'O microfone ou a câmera não atende aos requisitos do navegador.',
    SecurityError: 'O navegador bloqueou o acesso ao dispositivo. Use HTTPS e confira as permissões.',
  };
  return messages[error && error.name] || 'Verifique as permissões de áudio e vídeo e tente novamente.';
}

export class Media {
  constructor(app) {
    this.app = app;
    this.stream = null;
    this.screen = null;
    this.peers = new Map();
    this.tiles = new Map();
    this.earlyCandidates = new Map();
    this.signalQueues = new Map();
    this.ctx = null;
    this.lastConnectionWarningAt = 0;
    setInterval(() => this.tick(), 700);
    setInterval(() => this.detectSpeaking(), 200);
    window.addEventListener('pointerdown', () => { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); });
  }

  get on() { return !!this.stream; }
  get strip() { return $('#video-strip') || document.querySelector('.video-strip'); }

  audioCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  async toggle() {
    if (this.on) this.disable();
    else await this.enable();
  }

  async enable() {
    if (this.stream) return true;
    if (this.enabling) return this.enabling;
    this.enabling = this.acquireMedia();
    try { return await this.enabling; } finally { this.enabling = null; }
  }

  async acquireMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Câmera/microfone exigem HTTPS (o GitHub Pages já usa).', 'error', 5000);
      return false;
    }
    this.audioCtx();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 20 } },
      });
    } catch (cameraError) {
      console.warn('[rtc] Falha ao abrir áudio e vídeo; tentando somente áudio.', { stage: 'get-user-media', error: cameraError && cameraError.name });
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        toast('Câmera indisponível — entrando só com áudio.', 'warn');
      } catch (e) {
        console.warn('[rtc] Não foi possível abrir o microfone.', { stage: 'get-user-media-audio', error: e && e.name });
        toast(mediaErrorMessage(e), 'error', 6000);
        return false;
      }
    }
    this.addTile('self', `${this.app.me.name} (você)`, this.stream, true);
    for (const peer of this.peers.values()) this.applyLocalTracks(peer);
    this.sync();
    this.tick();
    return true;
  }

  disable() {
    this.stopScreen(true);
    for (const id of [...this.peers.keys()]) this.close(id, true);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.removeTile('self');
    this.sync();
  }

  toggleTrack(kind) {
    if (!this.stream) return;
    const tracks = kind === 'audio' ? this.stream.getAudioTracks() : this.stream.getVideoTracks();
    if (!tracks.length) return toast(kind === 'audio' ? 'Sem microfone.' : 'Sem câmera.', 'warn');
    const enabled = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = enabled; });
    this.sync();
  }

  // ------------------------------------------------------------------ tela
  async toggleScreen() {
    if (this.screen) this.stopScreen();
    else await this.startScreen();
  }

  async startScreen() {
    if (!this.on) {
      const ok = await this.enable();
      if (!ok) return;
    }
    if (!navigator.mediaDevices.getDisplayMedia) return toast('Seu navegador não compartilha tela.', 'warn');
    try {
      this.screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 12 }, audio: false });
    } catch (error) {
      console.warn('[rtc] Falha ao compartilhar tela.', { stage: 'get-display-media', error: error && error.name });
      toast('Não foi possível compartilhar a tela. Confira a permissão do navegador.', 'warn', 5000);
      return;
    }
    const track = this.screen.getVideoTracks()[0];
    track.onended = () => this.stopScreen();
    for (const peer of this.peers.values()) this.applyLocalTracks(peer);
    this.addTile('self', `${this.app.me.name} (sua tela)`, new MediaStream([track]), true);
    this.sync();
    toast('🖥️ Compartilhando tela com quem está conectado com você.', 'ok', 3000);
  }

  stopScreen(silent = false) {
    if (!this.screen) return;
    this.screen.getTracks().forEach((t) => t.stop());
    this.screen = null;
    for (const peer of this.peers.values()) this.applyLocalTracks(peer);
    if (this.stream) this.addTile('self', `${this.app.me.name} (você)`, this.stream, true);
    if (!silent) this.sync();
    const projector = this.app.world.objects.find((o) => o.type === 'projector' && o.state && o.state.on);
    if (projector && !silent) this.app.setObjectState(projector, { ...projector.state, on: false });
  }

  localTrack(kind) {
    if (kind === 'video' && this.screen) return this.screen.getVideoTracks()[0] || null;
    if (!this.stream) return null;
    return (kind === 'audio' ? this.stream.getAudioTracks() : this.stream.getVideoTracks())[0] || null;
  }

  applyLocalTracks(peer) {
    for (const t of peer.pc.getTransceivers()) {
      const kind = t.receiver && t.receiver.track && t.receiver.track.kind;
      if (!kind || t.stopped) continue;
      try {
        t.direction = 'sendrecv';
        t.sender.replaceTrack(this.localTrack(kind)).catch((error) => console.warn('[rtc] Falha ao atualizar a mídia.', { stage: 'replace-track', error: error && error.name }));
      } catch (error) { console.warn('[rtc] Falha ao atualizar a mídia.', { stage: 'replace-track', error: error && error.name }); }
    }
  }

  state() {
    const s = this.stream;
    return {
      on: !!s,
      cam: !!s && s.getVideoTracks().some((t) => t.enabled),
      mic: !!s && s.getAudioTracks().some((t) => t.enabled),
      screen: !!this.screen,
    };
  }

  sync() {
    const media = this.state();
    this.app.me.media = media;
    this.app.trackSoon();
    this.updateTile('self', media);
    this.app.emitUi('media');
  }

  reset() {
    for (const id of [...this.peers.keys()]) this.close(id);
    if (this.stream) this.sync();
  }

  // ------------------------------------------------------------------ quem conectar
  wants(p) {
    const { app } = this;
    const me = app.me;
    const connected = this.peers.has(p.id);
    if (this.on && p.media && p.media.on && isNear(app.world, me, p, app.proximity + (connected ? 1 : 0))) return true;
    if (this.on && p.media && p.media.on && app.calls && (app.calls.wants(p) || app.calls.roomWants(p))) return true; // chamada direta
    if (onStage(app.world, p)) return true; // ouvir quem está no palco
    if (onStage(app.world, me) && this.on) return true; // estou no palco: todos me ouvem
    return false;
  }

  tick() {
    const { app } = this;
    if (!app.me || !app.room) return;
    if (typeof RTCPeerConnection === 'undefined') {
      if (this.on) this.warnConnectionFailure('Este navegador não oferece suporte a chamadas de áudio e vídeo em tempo real.');
      return;
    }
    for (const [id, early] of this.earlyCandidates) if (Date.now() - early.at > 15000) this.earlyCandidates.delete(id);
    for (const [id, peer] of this.peers) {
      const stalled = peer.pc.connectionState !== 'connected' && Date.now() - peer.createdAt > 20000;
      if (stalled || (peer.disconnectedAt && Date.now() - peer.disconnectedAt > 8000)) {
        this.warnConnectionFailure();
        this.close(id, true);
      }
    }
    for (const p of app.players.values()) {
      if (p === app.me) continue;
      const want = this.wants(p);
      const connected = this.peers.has(p.id);
      if (want && !connected && app.me.id < p.id) this.call(p.id);
      else if (!want && connected) this.close(p.id, true);
    }
    for (const id of [...this.peers.keys()]) if (!app.players.has(id)) this.close(id);
    this.updateAudio();
  }

  createPeer(id, initiator) {
    const pc = new RTCPeerConnection({ iceServers: this.app.iceServers });
    const early = this.earlyCandidates.get(id);
    this.earlyCandidates.delete(id);
    const peer = { pc, pending: early && Date.now() - early.at < 15000 ? early.items : [], remote: new MediaStream(), audio: null, createdAt: Date.now(), disconnectedAt: 0 };
    this.peers.set(id, peer);
    if (initiator) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
      this.applyLocalTracks(peer);
    }
    pc.onicecandidate = (e) => { if (e.candidate) this.send(id, { type: 'candidate', candidate: e.candidate.toJSON() }); };
    pc.ontrack = (e) => {
      if (!peer.remote.getTracks().includes(e.track)) peer.remote.addTrack(e.track);
      const p = this.app.players.get(id);
      this.addTile(id, p ? p.name : '…', peer.remote);
      if (e.track.kind === 'audio') this.attachAudio(peer, e.track);
    };
    pc.onconnectionstatechange = () => {
      if (this.peers.get(id) !== peer) return;
      peer.disconnectedAt = pc.connectionState === 'disconnected' ? Date.now() : 0;
      if (pc.connectionState === 'failed') {
        console.warn('[rtc] Negociação de mídia falhou.', { stage: 'peer-connection', state: pc.connectionState });
        this.warnConnectionFailure();
        this.close(id, true);
      } else if (pc.connectionState === 'closed') this.close(id, true);
      this.app.calls?.renderBar();
    };
    return peer;
  }

  async call(id) {
    if (this.peers.has(id)) return;
    try {
      const peer = this.createPeer(id, true);
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      if (!this.send(id, { type: 'offer', sdp: peer.pc.localDescription.toJSON() })) this.close(id);
    } catch (e) {
      console.warn('[rtc] Falha ao criar oferta.', { stage: 'create-offer', error: e && e.name });
      this.close(id);
    }
  }

  onSignal(message) {
    const previous = this.signalQueues.get(message.from) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => this.handleSignal(message));
    this.signalQueues.set(message.from, next);
    next.finally(() => { if (this.signalQueues.get(message.from) === next) this.signalQueues.delete(message.from); });
    return next;
  }

  async handleSignal({ to, from, data }) {
    if (to !== this.app.me.id || !data) return;
    try {
      if (data.type === 'offer') {
        const p = this.app.players.get(from);
        if (!p || !this.wants(p)) return this.send(from, { type: 'bye' });
        if (this.peers.has(from)) this.close(from);
        const peer = this.createPeer(from, false);
        await peer.pc.setRemoteDescription(data.sdp);
        this.applyLocalTracks(peer);
        await this.flush(peer);
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        if (!this.send(from, { type: 'answer', sdp: peer.pc.localDescription.toJSON() })) this.close(from);
      } else if (data.type === 'answer') {
        const peer = this.peers.get(from);
        if (peer && peer.pc.signalingState === 'have-local-offer') {
          await peer.pc.setRemoteDescription(data.sdp);
          await this.flush(peer);
        }
      } else if (data.type === 'candidate') {
        const peer = this.peers.get(from);
        if (!peer) {
          if (!this.app.players.has(from)) return;
          let early = this.earlyCandidates.get(from);
          if (!early || Date.now() - early.at > 15000) early = { at: Date.now(), items: [] };
          if (early.items.length < 64) early.items.push(data.candidate);
          this.earlyCandidates.set(from, early);
          return;
        }
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate);
        else if (peer.pending.length < 64) peer.pending.push(data.candidate);
      } else if (data.type === 'bye') {
        this.close(from);
      }
    } catch (e) {
      console.warn('[rtc] Falha ao processar sinalização.', { stage: 'handle-signal', error: e && e.name });
    }
  }

  async flush(peer) {
    for (const c of peer.pending.splice(0)) {
      try { await peer.pc.addIceCandidate(c); }
      catch (error) { console.warn('[rtc] Falha ao aplicar candidato ICE.', { stage: 'add-ice-candidate', error: error && error.name }); }
    }
  }

  close(id, notify = false) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    try { peer.pc.close(); } catch { /* já fechado */ }
    if (peer.audio) { try { peer.audio.src.disconnect(); peer.audio.gain.disconnect(); peer.audio.pan?.disconnect(); peer.audio.analyser.disconnect(); } catch { /* ok */ } }
    this.removeTile(id);
    if (notify) this.send(id, { type: 'bye' });
  }

  send(to, data) {
    return this.app.room.send('signal', { to, from: this.app.me.id, data });
  }

  warnConnectionFailure(message = 'Não foi possível conectar áudio/vídeo. Verifique a rede; algumas redes exigem um servidor TURN.') {
    if (Date.now() - this.lastConnectionWarningAt < 15000) return;
    this.lastConnectionWarningAt = Date.now();
    toast(message, 'warn', 6000);
  }

  // ------------------------------------------------------------------ áudio espacial
  attachAudio(peer, track) {
    const ctx = this.audioCtx();
    if (!ctx) return;
    if (peer.audio) { try { peer.audio.src.disconnect(); } catch { /* ok */ } }
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    if (pan) src.connect(gain).connect(pan).connect(ctx.destination);
    else src.connect(gain).connect(ctx.destination);
    peer.audio = { src, gain, pan, analyser, buf: new Uint8Array(analyser.fftSize) };
  }

  updateAudio() {
    const { app } = this;
    const me = app.me;
    const meOnStage = onStage(app.world, me);
    for (const [id, peer] of this.peers) {
      const p = app.players.get(id);
      const tile = this.tiles.get(id);
      if (!p) continue;
      const near = isNear(app.world, me, p, app.proximity + 1);
      const sameRoom = !!app.world.privateZoneAt(me.x, me.y);
      const dist = Math.max(Math.abs(p.x - me.x), Math.abs(p.y - me.y));
      let vol = clamp(1 - (dist - 1) / (app.proximity + 1), 0.15, 1);
      let pan = clamp((p.x - me.x) / (app.proximity + 1), -0.8, 0.8);
      if (sameRoom && near) vol = 1;
      if (app.calls && (app.calls.wants(p) || app.calls.roomWants(p))) { vol = 1; pan = 0; }
      if (onStage(app.world, p) && !near) { vol = 1; pan = 0; }
      const audience = meOnStage && !near && !onStage(app.world, p);
      if (audience) vol = 0; // no palco, eu não ouço a plateia inteira
      if (peer.audio && this.ctx) {
        if (tile) tile.video.muted = true;
        peer.audio.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.15);
        if (peer.audio.pan) peer.audio.pan.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.15);
      } else if (tile) {
        tile.video.muted = false;
        tile.video.volume = vol;
      }
      if (tile) {
        tile.el.hidden = audience;
        tile.label.textContent = onStage(app.world, p) ? `📢 ${p.name}` : p.name;
        this.updateTile(id, p.media);
      }
    }
  }

  detectSpeaking() {
    for (const [id, peer] of this.peers) {
      const tile = this.tiles.get(id);
      if (!tile || !peer.audio) continue;
      const { analyser, buf } = peer.audio;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      tile.el.classList.toggle('speaking', Math.sqrt(sum / buf.length) > 0.04);
    }
  }

  // ------------------------------------------------------------------ interface dos vídeos
  addTile(id, name, stream, self = false) {
    let tile = this.tiles.get(id);
    if (!tile) {
      const video = h('video', { autoplay: true, playsinline: true });
      video.muted = true; // o som passa pelo áudio espacial
      const label = h('span', { class: 'vt-name' }, name);
      const mic = h('span', { class: 'vt-mic' });
      const el = h('div', { class: `video-tile ${self ? 'self' : ''}`, title: 'Clique para ampliar' }, video, h('div', { class: 'vt-placeholder' }, name.slice(0, 1).toUpperCase()), h('div', { class: 'vt-bar' }, label, mic));
      el.addEventListener('click', () => el.classList.toggle('big'));
      tile = { el, video, label, mic };
      this.tiles.set(id, tile);
      if (self) this.strip.prepend(el); else this.strip.append(el);
    }
    tile.label.textContent = name;
    if (tile.video.srcObject !== stream) tile.video.srcObject = stream;
    tile.video.play().catch(() => {});
    this.updateTile(id, self ? this.state() : (this.app.players.get(id) || {}).media);
  }

  updateTile(id, media) {
    const tile = this.tiles.get(id);
    if (!tile || !media) return;
    tile.el.classList.toggle('cam-off', !media.cam && !media.screen);
    tile.el.classList.toggle('screen', !!media.screen);
    tile.mic.innerHTML = media.mic ? '' : ICONS.micOff;
  }

  removeTile(id) {
    const tile = this.tiles.get(id);
    if (!tile) return;
    tile.video.srcObject = null;
    tile.el.remove();
    this.tiles.delete(id);
  }
}
