# Verificação — 14 de outubro de 2026

## Atualização: acesso explícito e múltiplas referências

- `npm test`: 31 testes passando. Validação de formatos, assinatura do arquivo, proporções finais, multipart real do adaptador com 5 e 10 referências, fidelidade alta, limites de quantidade, erros da API, origem atrás de proxy e proteção do servidor.
- Login sem chamada paga: senha correta e incorreta, senha Unicode, cookie HttpOnly/Secure/SameSite, renovação do estado após recarregar, expiração e invalidação após trocar APP_PASSWORD, logout e rejeição de cookie forjado.
- `npm run build` e `npm run typecheck`: aprovados.
- Teste em Chromium: viewport 390×844 com toque e 1440×1000, botão Entrar e tecla Enter, erro visível para senha incorreta, sessão real com cookie no servidor local, JPEG/EXIF/HEIC real, arquivo inválido e corrompido, seleção repetida sem duplicação, 5 e 10 referências, adicionar/remover/escolher principal, limite de 10, compressão real de fotos ruidosas para caber em 3,5 MiB, referências presentes em cada envio por estilo, erros de servidor inclusive resposta HTML 504, ampliação e download.
- O HEIC de teste foi obtido de https://github.com/strukturag/libheif/blob/master/examples/example.heic e baixado temporariamente fora do repositório.
- Testes de imagem usam respostas controladas apenas no processo de teste. A aplicação de produção continua usando exclusivamente a API de edição da OpenAI com as fotografias enviadas.
- Capturas de tela móvel e desktop inspecionadas.

## Limites

Não foi usado Safari em iPhone físico. Nenhuma edição paga foi iniciada durante os testes. A senha e a chave de produção permanecem somente no servidor Vercel; não foram solicitadas nem copiadas para o ambiente de desenvolvimento. A validade da chave, os créditos e o acesso ao modelo só podem ser confirmados em uma edição real autenticada.
