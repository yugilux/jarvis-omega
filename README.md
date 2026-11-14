# SHADOW COUNCIL Ω — otimizado para Moto G20

A interface é responsiva e funciona no navegador Android. Para o conselho realmente gerar diálogos com IA, o projeto precisa ser publicado num servidor Node.js e usar uma chave da API.

## Configurar só pelo celular
1. Abre o Replit no navegador e cria/abre um projeto Node.js.
2. Envia estes arquivos mantendo a estrutura: `server.js`, `package.json`, `README.md` e `public/index.html`.
3. Nas opções **Secrets / Environment Variables** do projeto, adiciona `OPENAI_API_KEY` com a chave da API. Opcional: `OPENAI_MODEL` = `gpt-4o-mini`.
4. Inicia com `npm start` e abre a URL pública fornecida pelo serviço.
5. Usa a caixa “Ordem do Monarca” e toca em “Iniciar conselho”.

Os menus e a importação de ZIP podem variar conforme o serviço/plano. Se não houver importação de ZIP, cria os arquivos pelo editor web.

## Importante
- Este ZIP não é uma URL publicada; ainda é necessário hospedar o projeto.
- A API é separada da assinatura ChatGPT e pode gerar custos.
- Nunca coloques `OPENAI_API_KEY` no HTML, nem a compartilhes em mensagens. Guarda-a só nos Secrets do servidor.
- O modo automático solicita uma rodada a cada 12 segundos enquanto a página está aberta. O Android pode suspender atividade em segundo plano.
- O histórico é temporário e some ao recarregar ou iniciar uma nova sessão.
