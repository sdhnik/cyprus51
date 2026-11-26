// Hash routes: #/login, #/passport, #/race/nicosia-2027 …
const routes = new Map();
let renderHook = () => {};
let flash = '';

export const route = (name, view, opts = {}) => routes.set(name, { view, ...opts });
export const onRender = (fn) => { renderHook = fn; };

// Navigate; an optional banner is shown once on the next screen.
export function go(name, { flash: f = '' } = {}) {
  flash = f;
  const target = '#/' + name;
  if (location.hash === target) render();
  else location.hash = target;
}

export function takeFlash() { const f = flash; flash = ''; return f; }

export function current() {
  const [name = '', ...args] = location.hash.replace(/^#\/?/, '').split('/');
  return { name, args: args.map(decodeURIComponent) };
}

export async function render() {
  const { name, args } = current();
  const r = routes.get(name);
  await renderHook(name, r, args);
}

window.addEventListener('hashchange', render);
