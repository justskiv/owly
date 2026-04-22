// Dynamic favicon — mirrors today's date.
// Drop-in: <script type="module" src="dynamic-favicon.js"></script>
// Or import { installDynamicFavicon } from './dynamic-favicon.js'.

const TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="7" fill="#131313"/>
<rect x="4" y="5" width="24" height="4" rx="1" fill="#e0b860"/>
<text x="16" y="25.5" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif" font-weight="700" font-size="15" fill="#f2f2f2" letter-spacing="-0.03em">__DAY__</text>
</svg>`;

export function renderFaviconDataUrl(day = new Date().getDate()) {
  const svg = TEMPLATE.replace('__DAY__', String(day));
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function updateFavicon(day = new Date().getDate()) {
  const href = renderFaviconDataUrl(day);
  let link = document.querySelector('link[rel="icon"][data-dynamic="1"]');
  if (!link) {
    // Remove any existing static favicon link so this one wins.
    document.querySelectorAll('link[rel~="icon"]').forEach(n => n.remove());
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.dataset.dynamic = '1';
    document.head.appendChild(link);
  }
  link.href = href;
}

function msUntilNextLocalMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  return next.getTime() - now.getTime();
}

function scheduleNext() {
  setTimeout(() => {
    updateFavicon();
    scheduleNext();
  }, msUntilNextLocalMidnight());
}

export function installDynamicFavicon() {
  updateFavicon();
  scheduleNext();
  // Also refresh when tab regains focus after sleep / long idle —
  // otherwise the cached link may show yesterday's date.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateFavicon();
  });
}

// Auto-install when loaded as a plain <script>.
if (typeof document !== 'undefined') installDynamicFavicon();
