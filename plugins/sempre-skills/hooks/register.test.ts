import { test, expect } from 'claude-code/testing'

const ID = 'sempre-skills:regra'

// No teste, o que fica por baixo do plugin é o próprio teste: ele faz o papel do engine,
// devolvendo o prompt-base que o plugin vai complementar.
const BASE = { sections: [{ id: 'intro', text: 'Você é um agente de código.', scope: 'shared' as const }] }
// Todos os fatos precisam vir informados: o teste não tem sessão de onde o engine os leria
const FATOS = {
  model: 'modelo-de-teste',
  promptModel: 'modelo-de-teste',
  surfaces: [],
  tools: [],
  outputStyle: null,
}

test('acrescenta a regra ao fim do prompt de sistema', async ($, on) => {
  on('prompt.compose', () => BASE)

  const { sections } = await $.prompt.compose({ ...FATOS, traits: [] })
  const regra = sections.find(s => s.id === ID)

  expect(sections[0]!.id).toBe('intro')
  expect(regra).toBeDefined()
  expect(regra!.scope).toBe('session')
  expect(regra!.text).toContain('ListPlugins')
  expect(regra!.text).toContain('ListSkills')
  expect(sections[sections.length - 1]!.id).toBe(ID)
})

test('não mexe no prompt de uma linha (--bare)', async ($, on) => {
  on('prompt.compose', () => BASE)

  const { sections } = await $.prompt.compose({ ...FATOS, traits: ['bare'] })
  expect(sections.some(s => s.id === ID)).toBe(false)
})

test('não mexe nas medições de contexto (/context)', async ($, on) => {
  on('prompt.compose', () => BASE)

  const { sections } = await $.prompt.compose({ ...FATOS, traits: ['analysis'] })
  expect(sections.some(s => s.id === ID)).toBe(false)
})
