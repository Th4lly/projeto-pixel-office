export class Emitter {
  constructor() {
    this.handlers = {};
  }

  on(evt, fn) {
    (this.handlers[evt] = this.handlers[evt] || []).push(fn);
    return () => this.off(evt, fn);
  }

  off(evt, fn) {
    this.handlers[evt] = (this.handlers[evt] || []).filter((f) => f !== fn);
  }

  emit(evt, data) {
    for (const fn of this.handlers[evt] || []) {
      try {
        fn(data);
      } catch (e) {
        console.error(`[evento ${evt}]`, e);
      }
    }
    for (const fn of this.handlers['*'] || []) {
      try {
        fn(evt, data);
      } catch (e) {
        console.error('[evento *]', e);
      }
    }
  }
}
