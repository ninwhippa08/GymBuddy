// A DOM small enough to read in one sitting.
//
// It exists because js/ui.js builds real nodes and Node has no DOM, and this
// project takes no npm dependencies. It implements exactly what ui.js's el()
// touches, plus the query helpers the tests need.
//
// NOT a substitute for a browser. This project has already been bitten once --
// a headless sweep passed clean while two real bugs sat in the code. Anything
// visual still gets looked at. design-card-flip.md §8.

class ClassList {
  constructor(node) { this.node = node; }
  _set() { return new Set(this.node.className.split(/\s+/).filter(Boolean)); }
  _write(set) { this.node.className = [...set].join(' '); }
  contains(c) { return this._set().has(c); }
  add(c) { const s = this._set(); s.add(c); this._write(s); }
  remove(c) { const s = this._set(); s.delete(c); this._write(s); }
  toggle(c, force) {
    const want = force === undefined ? !this.contains(c) : !!force;
    if (want) this.add(c); else this.remove(c);
    return want;
  }
}

class TextNode {
  constructor(text) { this.nodeType = 3; this.data = String(text); }
  get textContent() { return this.data; }
}

// 'tag', '.class', 'tag.class'. Anything else is a typo in a test, and a
// silent no-match would hide it.
function parseSelector(sel) {
  const m = /^([a-zA-Z][\w-]*)?(?:\.([\w-]+))?$/.exec(String(sel).trim());
  if (!m || (!m[1] && !m[2])) {
    throw new Error(`dom-shim: selector "${sel}" not implemented`);
  }
  return { tag: m[1] ? m[1].toUpperCase() : null, cls: m[2] || null };
}

class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.attributes = {};
    this.childNodes = [];
    this.listeners = {};
    this.classList = new ClassList(this);
  }

  set textContent(v) { this.childNodes = [new TextNode(v)]; }
  get textContent() { return this.childNodes.map(c => c.textContent).join(''); }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }

  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  // Test-only. There is no event system here, and no bubbling.
  dispatch(type) {
    for (const fn of this.listeners[type] || []) fn({ type, target: this });
  }

  append(...kids) {
    for (const k of kids) this.childNodes.push(k);
  }

  matches(sel) {
    const { tag, cls } = parseSelector(sel);
    if (tag && this.tagName !== tag) return false;
    if (cls && !this.classList.contains(cls)) return false;
    return true;
  }

  querySelectorAll(sel) {
    const out = [];
    const walk = node => {
      for (const c of node.childNodes) {
        if (c.nodeType !== 1) continue;
        if (c.matches(sel)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }

  querySelector(sel) {
    const hits = this.querySelectorAll(sel);
    return hits.length ? hits[0] : null;
  }
}

// Everything ui.js might reach for that this shim does not have. Throwing is
// the whole point: an undefined return would turn a bug into a green test.
for (const name of [
  'insertAdjacentHTML', 'replaceChildren', 'remove', 'closest',
  'getBoundingClientRect', 'focus'
]) {
  Element.prototype[name] = function notImplemented() {
    throw new Error(`dom-shim: ${name} is not implemented`);
  };
}

export function installDom() {
  const document = {
    createElement: tag => new Element(tag),
    createTextNode: text => new TextNode(text)
  };
  globalThis.document = document;
  return document;
}

export { Element, TextNode };
