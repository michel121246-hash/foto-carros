# Verificação — 13 de outubro de 2026

## Executado

- `npm test`: 18 testes passando, validação de formatos/limites, assinatura real do arquivo, multipart para a API OpenAI, proporções finais com Sharp, erros de créditos, senha e origem atrás de proxy.
- `npm run build`: compilação otimizada Next.js e validação de tipos aprovadas.
- `npm run typecheck`: aprovado.
- `tests/browser-smoke.cjs`: Chromium, viewport 390×844 com toque e viewport 1440×1000. Nove cartões, ausência de rolagem horizontal, prévia JPEG, escolha repetida, erro de arquivo inválido, EXIF de retrato preservado, conversão de um HEIC real, múltiplos estilos, proporção, erro verdadeiro de servidor sem chave, galeria, ampliação e download.
- O teste HEIC utilizou https://github.com/strukturag/libheif/blob/master/examples/example.heic baixado temporariamente fora do projeto.
- Download e ampliação usam uma resposta de imagem controlada apenas no teste de navegador. A integração de produção não possui fallback, imagem simulada ou geração local.
- Capturas de tela móvel e desktop inspecionadas visualmente.

## Limites de verificação

Não foi usado Safari em iPhone físico. Não foi realizada chamada paga ao endpoint OpenAI porque não há chave disponível. O endpoint está integrado de verdade, mas sua execução com a conta do proprietário precisa ser verificada após configurar o segredo. Nenhuma publicação web foi concluída durante a verificação inicial. O README documenta publicação Node.js na Vercel ou em hosts de contêiner.

O projeto usa `gpt-image-1` por padrão. A disponibilidade real do modelo, seus limites e eventuais requisitos de verificação dependem da conta OpenAI. Defina `OPENAI_IMAGE_MODEL` se precisar alterar o modelo compatível com a Images Edit API.
