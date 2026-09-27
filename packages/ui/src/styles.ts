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
.toolbar button.danger { background: var(--danger); color: #fff; }

.toggle {
  position: fixed; right: 16px; bottom: 16px; pointer-events: auto; display: flex; align-items: center; gap: 8px;
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
.drop {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 48px 16px; border-radius: 10px;
  border: 2px dashed var(--line); background: var(--field); color: var(--muted);
}
.drop strong { color: var(--fg); font-size: 14px; }
.drop.active { border-color: var(--accent); }
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
`;
