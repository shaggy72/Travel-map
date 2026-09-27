/**
 * PresetBar.tsx — preset switcher + "save as preset" button in the stage's
 * top bar. Presets used to be the first collapsible section of the sidebar;
 * the 2026-09-27 "Color Stack" redesign moved them here because a preset is
 * a whole-project choice, not one settings group among others. Same
 * /api/presets endpoints and error handling as before (see CLAUDE.md).
 */
import React, { useState, useEffect, useRef } from 'react';
import { Props, DEFAULT_PROPS } from './types';
import { BookmarkIcon, ChevronDownIcon, PlusIcon, CloseIcon } from './icons';

interface Preset {
  id:        string;
  name:      string;
  props:     Props;
  createdAt: string;
}

function useDismiss(open: boolean, close: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!refs.some(r => r.current?.contains(t))) close();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
}

function presetErrorMessage(status: number): string {
  if (status === 401) return 'Your session expired (the server restarted). Refresh the page and log in again.';
  return `Saving failed (server responded ${status}). Try again in a moment.`;
}

export default function PresetBar({ props, onChange }: { props: Props; onChange: (p: Props) => void }) {
  const [presets,    setPresets]    = useState<Preset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error,      setError]      = useState('');
  const [listOpen,   setListOpen]   = useState(false);
  const [saveOpen,   setSaveOpen]   = useState(false);
  const [name,       setName]       = useState('');

  const listRef    = useRef<HTMLDivElement>(null);
  const saveRef    = useRef<HTMLDivElement>(null);

  useDismiss(listOpen, () => setListOpen(false), [listRef]);
  useDismiss(saveOpen, () => setSaveOpen(false), [saveRef]);

  useEffect(() => {
    fetch('/api/presets')
      .then(r => r.ok ? r.json() : [])
      .then(setPresets)
      .catch(() => {});
  }, []);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError('');
    const preset: Preset = { id: Date.now().toString(), name: trimmed, props, createdAt: new Date().toISOString() };
    try {
      const r = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      });
      if (r.ok) {
        setPresets(prev => [...prev, preset]);
        setSelectedId(preset.id);
        setName('');
        setSaveOpen(false);
      } else {
        setError(presetErrorMessage(r.status));
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    }
  }

  async function remove(p: Preset) {
    if (!window.confirm(`Delete preset "${p.name}"? This cannot be undone.`)) return;
    setError('');
    try {
      const r = await fetch(`/api/presets/${p.id}`, { method: 'DELETE' });
      if (r.ok) {
        setPresets(prev => prev.filter(x => x.id !== p.id));
        setSelectedId(prev => prev === p.id ? null : prev);
      } else {
        setError(presetErrorMessage(r.status));
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    }
  }

  const current = presets.find(p => p.id === selectedId);

  return (
    <div className="preset-bar">
      <div className="popover-anchor" ref={listRef}>
        <button
          type="button"
          className="pill-btn"
          aria-haspopup="listbox"
          aria-expanded={listOpen}
          onClick={() => setListOpen(o => !o)}
        >
          <BookmarkIcon size={16} />
          <span className="pill-btn-text">{current ? current.name : 'Untitled route'}</span>
          <span className="pill-btn-chev"><ChevronDownIcon size={14} /></span>
        </button>
        {listOpen && (
          <div className="popover preset-list" role="listbox" aria-label="Presets">
            {presets.length === 0 && <div className="popover-empty">No presets saved yet.</div>}
            {presets.map(p => (
              <div key={p.id} className={`preset-row${p.id === selectedId ? ' selected' : ''}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === selectedId}
                  className="preset-apply"
                  onClick={() => {
                    // Merge onto defaults so presets saved before newer props existed still render.
                    onChange({ ...DEFAULT_PROPS, ...p.props });
                    setSelectedId(p.id);
                    setListOpen(false);
                  }}
                >
                  {p.name}
                </button>
                <button type="button" className="preset-delete" aria-label={`Delete preset ${p.name}`} onClick={() => remove(p)}>
                  <CloseIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="popover-anchor" ref={saveRef}>
        <button
          type="button"
          className="round-btn round-btn--dark"
          aria-label="Save current settings as preset"
          title="Save as preset"
          aria-expanded={saveOpen}
          onClick={() => setSaveOpen(o => !o)}
        >
          <PlusIcon size={16} />
        </button>
        {saveOpen && (
          <form className="popover save-preset" onSubmit={e => { e.preventDefault(); save(); }}>
            <label htmlFor="preset-name" className="popover-label">Save current settings as</label>
            <input
              id="preset-name"
              className="text-input"
              type="text"
              placeholder="Preset name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <div className="popover-actions">
              <button type="button" className="btn-ghost" onClick={() => setSaveOpen(false)}>Cancel</button>
              <button type="submit" className="btn-dark" disabled={!name.trim()}>Save</button>
            </div>
          </form>
        )}
      </div>

      {error && (
        <div className="toast toast--error" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setError('')}><CloseIcon size={14} /></button>
        </div>
      )}
    </div>
  );
}
