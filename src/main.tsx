import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Depois de uma atualização, uma aba antiga pode pedir arquivos que não existem mais.
// Nesse caso, recarrega uma vez para pegar a versão nova.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('giro.reloaded')) return;
    sessionStorage.setItem('giro.reloaded', '1');
  } catch { /* sem storage: recarrega mesmo assim */ }
  e.preventDefault();
  window.location.reload();
});
window.addEventListener('load', () => { try { setTimeout(() => sessionStorage.removeItem('giro.reloaded'), 10_000); } catch { /* ok */ } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
