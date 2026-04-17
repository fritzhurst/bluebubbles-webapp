import { useState } from 'react';
import { useAuth } from '@/ui/hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const [url, setUrl] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await login(url, password);
    setBusy(false);
    if (!result.ok) setError(result.error ?? 'Login failed');
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl bg-slate-900/70 p-8 shadow-2xl ring-1 ring-white/10 backdrop-blur"
      >
        <h1 className="mb-1 text-2xl font-semibold text-white">BlueBubbles Web</h1>
        <p className="mb-6 text-sm text-slate-400">
          Sign in with your BlueBubbles Server URL and password. This client does not use Google or
          Firebase — it connects to your server directly.
        </p>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-slate-300">Server URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://imessage.example.com"
            autoComplete="url"
            autoFocus
            required
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-slate-100 ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-imessage-blue"
          />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-slate-300">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-imessage-blue"
          />
        </label>

        {error && (
          <div className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-imessage-blue px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Connecting…' : 'Connect'}
        </button>

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Credentials are stored locally in IndexedDB on this browser only. Nothing leaves your
          machine except the direct connection to your server.
        </p>
      </form>
    </div>
  );
}
