import React, { useState, FormEvent } from 'react';

/**
 * "Change password" form — shown inside the account menu (AccountMenu.tsx).
 * Posts to server/auth.cjs's POST /api/change-password.
 */
export default function ChangePasswordPanel({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirm,         setConfirm]         = useState('');
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/change-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirm('');
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Could not change password.');
      }
    } catch {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="change-password">
        <p className="change-password-ok">Password changed.</p>
        <button type="button" className="btn-dark" onClick={onClose}>Done</button>
      </div>
    );
  }

  return (
    <form className="change-password" onSubmit={handleSubmit}>
      {error && <div className="form-error" role="alert">{error}</div>}
      <label className="stack-field">
        <span>Current password</span>
        <input className="text-input" type="password" value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      <label className="stack-field">
        <span>New password</span>
        <input className="text-input" type="password" value={newPassword}
          onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
      </label>
      <label className="stack-field">
        <span>Confirm new password</span>
        <input className="text-input" type="password" value={confirm}
          onChange={e => setConfirm(e.target.value)} autoComplete="new-password" minLength={6} required />
      </label>
      <div className="popover-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-dark" disabled={loading}>
          {loading ? <><span className="spinner" /> Saving…</> : 'Save'}
        </button>
      </div>
    </form>
  );
}
