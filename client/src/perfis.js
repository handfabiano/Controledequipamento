// Rótulos dos perfis de usuário (os valores são os do campo tipo no servidor)
export const PERFIS = {
  coordenador: 'Coordenador',
  responsavel_entrega: 'Responsável pela entrega',
  responsavel_recebimento: 'Responsável pelo recebimento',
  tecnico: 'Técnico',
};

export const rotuloPerfil = (tipo) => PERFIS[tipo] || tipo;
