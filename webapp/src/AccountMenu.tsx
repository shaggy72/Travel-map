/**
 * AccountMenu.tsx — round avatar button in the stage's top bar; opens a small
 * menu with the signed-in email, "Change password" and "Sign out". Replaces
 * the underlined text links that used to sit in the sidebar header.
 */
import React, { useState, useEffect, useRef } from 'react';
import ChangePasswordPanel from './ChangePasswordPanel';

export default function AccountMenu({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [open,       setOpen]       = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const initial = (email.trim()[0] ?? '?').toUpperCase();

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        type="button"
        className="round-btn round-btn--dark avatar-btn"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => { setOpen(o => !o); setChangingPw(false); }}
      >
        {initial}
      </button>
      {open && (
        <div className="popover popover--right account-menu">
          <div className="account-email" title={email}>{email}</div>
          {changingPw ? (
            <ChangePasswordPanel onClose={() => setChangingPw(false)} />
          ) : (
            <div className="account-actions">
              <button type="button" className="menu-item" onClick={() => setChangingPw(true)}>Change password</button>
              <button type="button" className="menu-item" onClick={onLogout}>Sign out</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
