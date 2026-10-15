// start.ng owns authentication. This module receives presentation data only.
export function findStartNg(hostname) {
  if (hostname.endsWith('.start.ng')) return 'https://start.ng';
  if (hostname.endsWith('.start.localhost')) return 'http://start.localhost:5173';
  return null;
}

export function createPlatformBridge({ window: win, document: doc, location: loc, timeoutMs = 3000, pollIntervalMs = 15000 }) {
  const origin = findStartNg(loc.hostname);
  let frame = null, loaded = false, pending = null, serial = 0;
  const listeners = new Set();

  function receive(event) {
    if (!pending || event.origin !== origin || event.source !== frame?.contentWindow) return;
    const data = event.data;
    if (data?.type !== 'startng:user' || data.requestId !== pending.id) return;
    if (data.user === null) return pending.finish(null);
    const user = data.user;
    if (!user || !['string', 'number'].includes(typeof user.id) || String(user.id).length === 0 || String(user.id).length > 128) return;
    // Deliberately discard extra account fields, including emails and credentials.
    pending.finish({ id: user.id, name: typeof user.name === 'string' ? user.name.slice(0, 80) : 'Player', style: user.style && typeof user.style === 'object' ? user.style : {} });
  }
  function send() {
    if (loaded && pending) frame.contentWindow.postMessage({ type: 'startng:whoami', requestId: pending.id }, origin);
  }
  function connect() {
    if (frame) return;
    frame = doc.createElement('iframe');
    frame.hidden = true;
    frame.title = 'start.ng player connection';
    frame.src = `${origin}/connect`;
    frame.addEventListener('load', () => { loaded = true; send(); });
    frame.addEventListener('error', () => { loaded = false; pending?.finish(undefined); });
    doc.body.append(frame);
  }
  function getCurrentUser() {
    if (!origin) return Promise.resolve(null);
    if (pending) return pending.promise;
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    const id = win.crypto?.randomUUID?.() ?? `relic-${Date.now()}-${++serial}-${Math.random().toString(36).slice(2)}`;
    const request = { id, promise, finish(value) {
      if (pending !== request) return;
      win.clearTimeout(request.timer);
      pending = null;
      resolve(value);
    }};
    pending = request;
    // Bound the entire request, including a blocked or never-loading iframe.
    request.timer = win.setTimeout(() => request.finish(undefined), timeoutMs);
    connect();
    send();
    return promise;
  }
  async function recheck() {
    if (doc.visibilityState !== 'visible') return;
    const user = await getCurrentUser();
    if (user !== undefined) for (const fn of listeners) fn(user);
  }
  function onUserChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function signIn() {
    if (!origin) return false;
    loc.href = `${origin}/?return_to=${encodeURIComponent(loc.href)}`;
    return true;
  }
  win.addEventListener('message', receive);
  win.addEventListener('focus', recheck);
  doc.addEventListener('visibilitychange', recheck);
  // Some embedded browsers keep every tab 'focused'. A visible-tab fallback also
  // notices account changes made in another window without a navigation.
  const poll = origin && pollIntervalMs > 0 ? win.setInterval(recheck, pollIntervalMs) : null;
  return { START_NG: origin, getCurrentUser, onUserChange, signIn, dispose() {
    pending?.finish(undefined);
    if (poll !== null) win.clearInterval(poll);
    win.removeEventListener('message', receive);
    win.removeEventListener('focus', recheck);
    doc.removeEventListener('visibilitychange', recheck);
    listeners.clear(); frame?.remove();
  }};
}
const bridge = typeof window !== 'undefined' ? createPlatformBridge({ window, document, location }) : null;
export const START_NG = bridge?.START_NG ?? null;
export const getCurrentUser = () => bridge ? bridge.getCurrentUser() : Promise.resolve(null);
export const onUserChange = fn => bridge ? bridge.onUserChange(fn) : () => {};
export const signIn = () => bridge?.signIn() ?? false;
