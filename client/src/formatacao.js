// Data e hora no formato brasileiro ('-' quando não há data). O SQLite devolve
// 'AAAA-MM-DD HH:MM:SS' em UTC sem fuso, que o navegador leria como hora local; o Postgres
// já devolve ISO com fuso.
export const dataHora = (valor) => {
  if (!valor) return '-';
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valor) ? `${valor.replace(' ', 'T')}Z` : valor;
  return new Date(iso).toLocaleString('pt-BR');
};
