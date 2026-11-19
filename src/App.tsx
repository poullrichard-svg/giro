import { lazy, Suspense } from 'react';
import { ToastProvider } from './data/toast';
import { DataProvider } from './data/DataProvider';
import { CloudProvider, useCloud } from './cloud/CloudProvider';
import { MergeChoiceModal, NewPasswordModal } from './cloud/Login';
import { Logo } from './components/Logo';
import Shell from './components/Shell';

const Login = lazy(() => import('./cloud/Login'));

const Splash = () => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-slate-400"><Logo size={56} spin /><span className="label">Abrindo o giro</span></div>
);

/** Com Supabase configurado, o app pede login; sem ele, roda no modo local. */
function Gate() {
  const { enabled, ready, user } = useCloud();
  if (!enabled) return <Shell />;
  if (!ready) return <Splash />;
  if (!user) return <Suspense fallback={<Splash />}><Login /></Suspense>;
  return <><Shell /><MergeChoiceModal /><NewPasswordModal /></>;
}

export default function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <CloudProvider><Gate /></CloudProvider>
      </DataProvider>
    </ToastProvider>
  );
}
