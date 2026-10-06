// Senhas: política para novas senhas e hash/comparação com bcrypt, no mesmo lugar para que o
// custo do hash real e o do hash fictício do login nunca divirjam.
const bcrypt = require('bcryptjs');

const TAMANHO_MINIMO = 8;
// bcrypt só considera os 72 primeiros bytes; acima disso a senha seria truncada em silêncio.
const TAMANHO_MAXIMO_BYTES = 72;

// Hash de uma senha aleatória que ninguém conhece. Usado quando o e-mail não existe, para o login
// demorar o mesmo que com uma senha errada (senão o tempo de resposta revela quais e-mails estão
// cadastrados). Fixo no código para não custar um hash a cada cold start.
// Para mudar o custo do bcrypt, gere outro hash fictício com o novo custo: CUSTO_BCRYPT sai dele,
// então o hash fictício e os hashes reais nunca divergem.
const HASH_FICTICIO = '$2a$10$3nGvjFrIHN.YC7YY6k45EOOsxndB/7E9SDcp8vWqA6y7MKEX3.byC';
const CUSTO_BCRYPT = bcrypt.getRounds(HASH_FICTICIO);

const hashSenha = (senha) => bcrypt.hash(senha, CUSTO_BCRYPT);

// Compara com o hash do usuário; sem usuário (hash nulo) faz a mesma conta contra o fictício e
// devolve false.
async function compararSenha(senha, hash) {
  const confere = await bcrypt.compare(senha, hash || HASH_FICTICIO);
  return Boolean(hash) && confere;
}

// O comprimento mínimo é a regra principal; a lista abaixo só barra as senhas mais repetidas em
// vazamentos (e variações óbvias do nome do sistema), que passariam no tamanho.
const SENHAS_COMUNS = new Set([
  '12345678', '123456789', '1234567890', '87654321', '12341234',
  'password', 'password1', 'password123', 'passw0rd', 'qwertyui', 'qwerty123', 'qwertyuiop',
  'abc12345', 'abcd1234', 'abcdefgh', 'iloveyou', 'admin123', 'admin1234', 'administrador',
  'senha123', 'senha1234', 'senha@123', 'mudar123', 'mudar@123', 'brasil123', 'brasil2024',
  'sistema123', 'equipamento', 'equipamentos', 'coordenador', 'coordenador123', 'tecnico123',
  'teste1234', 'trocar123'
]);

// Devolve a mensagem de erro (em português) ou null quando a senha é aceita.
// `emailNormalizado` é o e-mail do cadastro, já em minúsculas e sem espaços.
function validarSenha(senha, emailNormalizado) {
  if (senha.length < TAMANHO_MINIMO) {
    return `A senha deve ter no mínimo ${TAMANHO_MINIMO} caracteres`;
  }
  if (Buffer.byteLength(senha, 'utf8') > TAMANHO_MAXIMO_BYTES) {
    return `A senha deve ter no máximo ${TAMANHO_MAXIMO_BYTES} bytes`;
  }

  const normalizada = senha.trim().toLowerCase();
  const umSoCaractere = new Set(normalizada).size === 1;

  if (umSoCaractere || normalizada === emailNormalizado || SENHAS_COMUNS.has(normalizada)) {
    return 'Senha muito comum ou previsível. Escolha outra';
  }
  return null;
}

module.exports = { validarSenha, hashSenha, compararSenha, CUSTO_BCRYPT, HASH_FICTICIO };
