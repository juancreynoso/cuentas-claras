import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom';
import { Landing } from './components/Landing';
import { GroupPage } from './components/GroupPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* El código del grupo es la ruta compartible: /g/A7K2P9 */}
        <Route path="/g/:code" element={<GroupRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Normaliza el código y lo usa como `key`.
 *
 * Con el código como key, navegar de un grupo a otro remonta la pantalla en
 * lugar de reusarla: el estado arranca limpio y nunca se ve un instante con los
 * datos del grupo anterior.
 */
function GroupRoute() {
  const { code = '' } = useParams<{ code: string }>();
  const normalized = code.toUpperCase();
  return <GroupPage key={normalized} code={normalized} />;
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-8">
      <h1 className="text-xl font-semibold tracking-tight">Esta página no existe</h1>
      <Link to="/" className="mt-4 text-[13px] text-muted transition-colors hover:text-ink">
        ← Volver al inicio
      </Link>
    </main>
  );
}
