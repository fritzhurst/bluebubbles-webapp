import { useAuth } from '@/ui/hooks/useAuth';
import Login from '@/ui/pages/Login';
import Main from '@/ui/pages/Main';
import LiveDeviceMap from '@/ui/pages/LiveDeviceMap';
import { useHashRoute } from '@/utils/route';

export default function App() {
  const { authed, checking } = useAuth();
  const route = useHashRoute();

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }

  // Not logged in → login page regardless of route.
  if (!authed) return <Login />;

  // Hash-routed sub-pages (opened in new tabs from the main app).
  if (route.type === 'live-device') {
    return <LiveDeviceMap deviceId={route.deviceId} />;
  }

  return <Main />;
}
