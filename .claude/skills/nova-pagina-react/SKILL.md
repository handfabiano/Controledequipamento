---
name: nova-pagina-react
description: Cria uma nova página React (rota, menu, CSS, chamadas de API, estados de loading/erro) no padrão do client/. Use ao adicionar telas ao frontend.
---
# Nova página React

1. Leia a página mais parecida (`Equipamentos.js`, `Transferencias.js`, `Eventos.js`) e `services/api.js`.
2. **API**: adicione/confirme as funções no objeto do domínio em `client/src/services/api.js` (nunca `axios` direto na página).
3. **Página**: `client/src/pages/Nome.js` + `Nome.css`.
   - `useState/useEffect` para carregar; estados `loading`, `error` (`err.response?.data?.error || 'mensagem padrão'`) e lista vazia.
   - `useAuth()` para esconder ações por papel (apenas UX; o servidor valida).
   - Ações destrutivas pedem confirmação; formulários desabilitam o botão durante o envio.
   - Layout responsivo (uso em celular/campo); textos em pt-BR.
4. **Rota**: `<Route path="nome" element={<Nome />} />` dentro do `Layout` em `App.js`; **link** em `components/Layout.js`.
5. **Verificar**: `cd client && npm run build` sem warnings novos de eslint; se possível rodar `npm run dev:full` e percorrer o fluxo (login seed, estado vazio, erro de API forçado).
6. Atualize `docs/ARQUITETURA.md` se criou componente/rota relevante.
