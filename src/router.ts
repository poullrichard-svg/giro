import { useEffect, useState } from 'react';

export type Route = 'inicio' | 'lancamentos' | 'contas' | 'fixas' | 'motorista' | 'veiculos' | 'calculadoras' | 'metas' | 'compras' | 'assistente' | 'mais';
const ROUTES: Route[] = ['inicio', 'lancamentos', 'contas', 'fixas', 'motorista', 'veiculos', 'calculadoras', 'metas', 'compras', 'assistente', 'mais'];

const parse = (): { route: Route; param?: string } => {
  const [r, param] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { route: (ROUTES as string[]).includes(r) ? (r as Route) : 'inicio', param };
};

/** Navegação por hash: funciona com o botão "voltar" do celular e não precisa de config no servidor. */
export function useRoute() {
  const [state, setState] = useState(parse);
  useEffect(() => {
    const on = () => { setState(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return state;
}

export const go = (route: Route, param?: string) => { window.location.hash = `/${route}${param ? `/${param}` : ''}`; };
