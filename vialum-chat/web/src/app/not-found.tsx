import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg-1 text-text-1">
      <h1 className="text-6xl font-bold text-text-3">404</h1>
      <p className="mt-2 text-text-2 text-lg">Pagina nao encontrada</p>
      <Link
        href="/"
        className="mt-6 px-4 py-2 bg-accent text-bg-1 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Voltar ao inicio
      </Link>
    </div>
  );
}
