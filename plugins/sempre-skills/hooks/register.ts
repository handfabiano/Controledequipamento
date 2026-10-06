import type { Register } from 'claude-code'

// Regra acrescentada ao prompt de sistema de toda sessão. Fica do lado "session" do cache
// porque o texto é do usuário, não da build.
export const REGRA = [
  '# Regra: sempre usar todas as skills e plugins disponíveis',
  'No início de TODA tarefa, antes de escrever código ou responder:',
  '1. Faça o inventário: skills da sessão (ferramenta Skill), skills da conta (ListSkills) e plugins habilitados (ListPlugins). Se não houver plugins ou faltar algum útil, use SearchPlugins/SearchSkills e sugira a instalação (SuggestPluginInstall/SuggestSkills) em vez de ignorar.',
  '2. Invoque, via Skill, toda skill ou plugin cujo gatilho case com a tarefa. Nenhuma que se aplique pode ficar de fora, e uma tarefa "simples" não é motivo para pular.',
  '3. No resumo final, liste o que foi invocado e, se algo disponível ficou de fora, diga por quê.',
].join('\n')

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)

    // Prompt de uma linha (--bare) e medições de contexto (/context) ficam como estão
    if (e.traits.includes('bare') || e.traits.includes('analysis')) return composed

    return {
      sections: [
        ...composed.sections,
        { id: `${$.plugin.name}:regra`, text: REGRA, scope: 'session' },
      ],
    }
  })
}
