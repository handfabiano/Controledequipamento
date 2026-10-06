// Política de senha para novos usuários (A07-003).
// O comprimento mínimo é a regra principal; a lista abaixo só barra as senhas mais
// repetidas em vazamentos (e variações óbvias do nome do sistema), que passariam no tamanho.

const TAMANHO_MINIMO = 8;
// bcrypt só considera os 72 primeiros bytes; acima disso a senha seria truncada em silêncio.
const TAMANHO_MAXIMO_BYTES = 72;

const SENHAS_COMUNS = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234',
  'password', 'password1', 'password123', 'passw0rd', 'qwertyui', 'qwerty123', 'qwertyuiop',
  'abc12345', 'abcd1234', 'abcdefgh', 'iloveyou', 'admin123', 'admin1234', 'administrador',
  'senha123', 'senha1234', 'senha@123', 'mudar123', 'mudar@123', 'brasil123', 'brasil2024',
  'sistema123', 'equipamento', 'equipamentos', 'coordenador', 'coordenador123', 'tecnico123',
  'teste1234', 'trocar123'
]);

// Devolve a mensagem de erro (em português) ou null quando a senha é aceita.
function validarSenha(senha, { email } = {}) {
  if (senha.length < TAMANHO_MINIMO) {
    return `A senha deve ter no mínimo ${TAMANHO_MINIMO} caracteres`;
  }
  if (Buffer.byteLength(senha, 'utf8') > TAMANHO_MAXIMO_BYTES) {
    return `A senha deve ter no máximo ${TAMANHO_MAXIMO_BYTES} bytes`;
  }

  const normalizada = senha.trim().toLowerCase();
  const umSoCaractere = new Set(normalizada).size === 1;
  const igualAoEmail = email && normalizada === email.trim().toLowerCase();

  if (umSoCaractere || igualAoEmail || SENHAS_COMUNS.has(normalizada)) {
    return 'Senha muito comum ou previsível. Escolha outra';
  }
  return null;
}

module.exports = { validarSenha, TAMANHO_MINIMO, TAMANHO_MAXIMO_BYTES };
