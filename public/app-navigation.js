(() => {
  if (window.top !== window.self || document.getElementById('uimemocho-navigation')) return;
  const slug = location.pathname.split('/')[2];
  const host = document.createElement('div');
  host.id = 'uimemocho-navigation';
  // A separate top-layer surface avoids inherited game styles and clipped containers.
  host.setAttribute('popover', 'manual');
  host.style.cssText = 'position:fixed;inset:auto 8px max(8px, env(safe-area-inset-bottom)) auto;margin:0;padding:0;border:0;background:transparent;overflow:visible;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = 'a{box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:36px;padding:7px 12px;border:1px solid #18211f;background:#f6f6f0;color:#18211f;font:600 12px/1.4 system-ui,sans-serif;text-decoration:none;box-shadow:0 2px 6px #0002;touch-action:manipulation}a:focus-visible{outline:3px solid #2454e6;outline-offset:2px}';
  const link = document.createElement('a');
  link.href = '/#project-' + encodeURIComponent(slug);
  link.textContent = '← 一覧';
  link.setAttribute('aria-label', 'uimemocho の作品一覧へ戻る');
  shadow.append(style, link);
  document.body.append(host);
  function reveal() {
    try { if (host.matches(':popover-open')) host.hidePopover(); host.showPopover(); } catch { /* Older browsers use the fixed-position fallback. */ }
  }
  document.addEventListener('fullscreenchange', reveal);
  document.addEventListener('webkitfullscreenchange', reveal);
  reveal();
})();
