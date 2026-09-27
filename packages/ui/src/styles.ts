export const styles = /* css */ `
:host { all: initial; }
.layer {
  --bg: #ffffff; --fg: #111827; --muted: #6b7280; --line: #e5e7eb; --field: #f9fafb;
  --accent: #6366f1; --accent-fg: #ffffff; --danger: #dc2626; --ok: #059669;
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
  font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg);
}
.layer[data-theme="dark"] {
  --bg: #18181b; --fg: #f4f4f5; --muted: #a1a1aa; --line: #3f3f46; --field: #27272a;
  --accent: #818cf8; --accent-fg: #0b0b0f;
}
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .55; }

.outline { position: fixed; outline: 1.5px dashed var(--accent); outline-offset: 2px; border-radius: 4px; pointer-events: none; }
.insert-bar { position: fixed; height: 2px; background: var(--accent); display: flex; justify-content: center; pointer-events: none; }
.insert-button {
  pointer-events: auto; transform: translateY(-50%); height: 24px; padding: 0 10px; border: 0; border-radius: 999px;
  background: var(--accent); color: var(--accent-fg); font-weight: 600; font-size: 12px; box-shadow: 0 2px 8px rgb(0 0 0 / .2);
}
.toolbar {
  position: fixed; transform: translateX(-100%); display: flex; gap: 4px; padding: 4px; pointer-events: auto;
  background: var(--bg); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 4px 16px rgb(0 0 0 / .18);
}
.toolbar button { border: 0; background: transparent; padding: 4px 10px; border-radius: 6px; font-weight: 500; }
.toolbar button:hover:not(:disabled) { background: var(--field); }
.toolbar .missing-label {
  display: flex; align-items: center; gap: 4px; padding: 0 8px; max-width: 280px; font-size: 12px; color: #b45309;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.toolbar .missing-label code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow: hidden; text-overflow: ellipsis; }
.toolbar button.danger { background: var(--danger); color: #fff; }

.dock { position: fixed; right: 16px; bottom: 16px; display: flex; gap: 8px; pointer-events: none; }
.toggle, .library-button {
  pointer-events: auto; display: flex; align-items: center; gap: 8px;
  height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg);
  box-shadow: 0 4px 16px rgb(0 0 0 / .15); font-weight: 500;
}
.toggle .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.toggle.on .dot { background: var(--ok); }
.toggle.offline .dot { background: var(--danger); }

.toast {
  position: fixed; right: 16px; bottom: 60px; max-width: 360px; padding: 10px 14px; border-radius: 8px; pointer-events: auto;
  background: var(--bg); border: 1px solid var(--line); box-shadow: 0 4px 16px rgb(0 0 0 / .15);
}
.toast.error { border-color: var(--danger); color: var(--danger); }

.backdrop {
  position: fixed; inset: 0; pointer-events: auto; background: rgb(0 0 0 / .45); display: grid; place-items: center; padding: 16px;
}
.dialog {
  width: min(720px, 100%); max-height: calc(100vh - 32px); overflow: auto; display: flex; flex-direction: column; gap: 12px;
  background: var(--bg); border-radius: 12px; padding: 16px 20px; box-shadow: 0 16px 48px rgb(0 0 0 / .3);
}
.dialog header { display: flex; align-items: center; justify-content: space-between; }
.dialog h2 { margin: 0; font-size: 16px; font-weight: 600; }
.icon { border: 0; background: transparent; font-size: 20px; line-height: 1; padding: 4px 8px; border-radius: 6px; }
.dialog { position: relative; outline: none; }
.drop {
  display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 44px 16px; border-radius: 10px;
  border: 2px dashed var(--line); background: var(--field); color: var(--muted);
}
.drop strong { color: var(--fg); font-size: 14px; }
.drop.active { border-color: var(--accent); }
.drop-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.drop-actions button {
  height: 32px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); font-weight: 500;
}
.drop-actions .primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.drop-overlay {
  position: absolute; inset: 8px; display: grid; place-items: center; border-radius: 10px; pointer-events: none;
  border: 2px dashed var(--accent); background: color-mix(in srgb, var(--bg) 85%, transparent);
  color: var(--accent); font-weight: 600; font-size: 15px;
}
.hint { margin: 0; }
.name-input { display: flex; align-items: center; gap: 6px; }
.name-input input { flex: 1; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.name-input input[aria-invalid="true"] { border-color: var(--danger); }
.field-note { color: var(--muted); font-size: 12px; }
.field-note code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg); }
.field-warn { color: #b45309; font-size: 12px; }
.layer[data-theme="dark"] .field-warn { color: #fbbf24; }
.field-warn code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.field-error { color: var(--danger); font-size: 12px; }
.name-input .suffix { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; white-space: nowrap; }
.hint .link { display: inline; }
.notice { margin: 0; color: var(--muted); }
.crop-area { display: flex; justify-content: center; background: var(--field); border-radius: 8px; padding: 8px; }
.crop-area img { max-height: 50vh; max-width: 100%; display: block; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.label { font-weight: 600; min-width: 56px; }
.label em { font-weight: 400; font-style: normal; color: var(--muted); }
.inline { display: inline-flex; align-items: center; gap: 6px; }
.muted { color: var(--muted); }
.num { min-width: 24px; font-variant-numeric: tabular-nums; }
input[type="number"] { width: 72px; }
input:not([type="range"]), select {
  height: 30px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--field);
}
.field { display: flex; flex-direction: column; gap: 6px; }
.segmented { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.segmented button { border: 0; background: transparent; padding: 5px 10px; }
.segmented button + button { border-left: 1px solid var(--line); }
.segmented button.on { background: var(--accent); color: var(--accent-fg); }
.link { align-self: flex-start; border: 0; background: transparent; color: var(--accent); padding: 0; }
.error { margin: 0; color: var(--danger); }
.dialog footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
.dialog footer button { height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); font-weight: 500; }
.dialog footer .primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }

.flash {
  position: fixed; pointer-events: none; border-radius: 6px; outline: 3px solid var(--accent); outline-offset: 4px;
  animation: mmm-flash 2.5s ease-out forwards;
}
@keyframes mmm-flash { 0%, 60% { outline-color: var(--accent); } 100% { outline-color: transparent; } }

.tabs { align-self: flex-start; }
.segmented .count {
  margin-left: 6px; padding: 0 6px; border-radius: 999px; font-size: 11px; background: var(--field); color: var(--muted);
}
.segmented .on .count { background: rgb(255 255 255 / .25); color: inherit; }
.segmented .count.attention { color: #b45309; }
.segmented .on .count.attention { color: inherit; }

.library {
  width: min(1180px, 100%); height: min(820px, calc(100vh - 32px)); display: flex; flex-direction: column; gap: 12px;
  background: var(--bg); border-radius: 12px; padding: 16px 20px; box-shadow: 0 16px 48px rgb(0 0 0 / .3); overflow: hidden;
}
.library header { display: flex; align-items: center; gap: 8px; }
.library h2 { margin: 0; font-size: 16px; font-weight: 600; }
.library .spacer { flex: 1; }
.library-toolbar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
.library-toolbar input[type="search"] { flex: 1 1 220px; }
.library-message { margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--field); }
.library-body { flex: 1; min-height: 0; display: flex; gap: 16px; }
.library-main { flex: 1; min-width: 0; overflow: auto; }
.library footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.library footer button, .detail-actions button, .inline-form button {
  height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); font-weight: 500; white-space: nowrap;
}
.library footer button.danger, .detail-actions button.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.empty { padding: 32px 0; text-align: center; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 12px; }
.grid.compact { grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); max-height: 42vh; overflow: auto; padding: 2px; }
.card {
  display: flex; flex-direction: column; gap: 4px; padding: 6px; text-align: left; border-radius: 10px;
  border: 1px solid var(--line); background: var(--bg); min-width: 0;
}
.card:hover { border-color: var(--muted); }
.card.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
.thumb {
  aspect-ratio: 4 / 3; border-radius: 6px; overflow: hidden; display: grid; place-items: center;
  background: repeating-conic-gradient(var(--field) 0 25%, var(--bg) 0 50%) 0 0 / 16px 16px;
}
.thumb img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.card-name { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-meta { font-size: 11px; }
.badges { display: flex; flex-wrap: wrap; gap: 4px; }
.badge { font-size: 10.5px; padding: 1px 6px; border-radius: 999px; background: var(--field); color: var(--muted); }
.badge.warn { color: #b45309; background: color-mix(in srgb, #f59e0b 16%, transparent); }
.layer[data-theme="dark"] .badge.warn, .layer[data-theme="dark"] .segmented .count.attention { color: #fbbf24; }

.details {
  width: 340px; flex-shrink: 0; overflow: auto; display: flex; flex-direction: column; gap: 14px;
  padding-left: 16px; border-left: 1px solid var(--line);
}
.details .preview {
  border-radius: 8px; overflow: hidden; display: grid; place-items: center; max-height: 200px;
  background: repeating-conic-gradient(var(--field) 0 25%, var(--bg) 0 50%) 0 0 / 16px 16px;
}
.details .preview img { max-width: 100%; max-height: 200px; object-fit: contain; display: block; }
.details h3 { margin: 0 0 6px; font-size: 13px; font-weight: 600; }
.facts { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 0; font-size: 12px; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.facts code, .details code, .usages code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
.inline-form { display: flex; gap: 6px; }
.inline-form input { flex: 1; min-width: 0; }
.usages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 12px; }
.usages li { display: flex; flex-direction: column; gap: 2px; }
.usages a { color: var(--accent); text-decoration: none; font-weight: 500; }
.usages a:hover { text-decoration: underline; }
.usages.broken li { padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; }
.warn-text { color: #b45309; }
.detail-actions { display: flex; gap: 8px; }
.picker { display: flex; flex-direction: column; gap: 10px; }
`;
