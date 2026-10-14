# Auto Vision AI

Estúdio de edição de fotografias de veículos, em português, com interface escura e detalhes azuis. Projeto Next.js + React + TypeScript, com processamento de imagens no servidor via Sharp. Não há geração simulada.

## Publicar este repositório na Vercel

Este é o projeto completo, pronto para importar a partir de `michel121246-hash/foto-carros`.

1. Acesse https://vercel.com/new e entre com sua conta GitHub.
2. Importe o repositório **foto-carros**; o framework deve ser detectado como **Next.js**.
3. Em Environment Variables, adicione `OPENAI_API_KEY` (chave da API OpenAI) e `APP_PASSWORD` (senha escolhida para proteger o estúdio).
4. Clique em Deploy. A URL de produção poderá ser aberta no telefone e no PC.

A interface pode ser publicada antes de configurar a chave; nesse caso a geração informa que não está configurada. Para editar de verdade, a conta da API precisa de créditos e acesso ao modelo. A assinatura do ChatGPT não inclui esses créditos. A hospedagem deve permitir funções com duração de até 300 segundos; o limite efetivo depende do plano da Vercel.

## Executar localmente

Requer Node.js 22 ou mais recente.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000. Configure `OPENAI_API_KEY` em `.env.local` para gerar de verdade. `OPENAI_IMAGE_MODEL` usa `gpt-image-1` por padrão. A conta OpenAI precisa ter acesso ao modelo, faturamento ativo e eventuais verificações exigidas pelo provedor. Configure `APP_PASSWORD` para proteger o uso. A senha é digitada em “Acesso ao estúdio”; não é a chave da API e permanece somente na memória da página. Nunca exponha a chave com um prefixo `NEXT_PUBLIC_`.

## Fluxo implementado

- Importação por seletor nativo e arrastar/soltar: JPG, JPEG, PNG, HEIC e HEIF, até 20 MB.
- Prévia imediatamente após selecionar a foto. HEIC não renderizável nativamente mostra a preparação e recebe uma prévia após conversão.
- HEIC: primeiro tenta o decodificador do navegador; depois carrega `heic2any` dinamicamente. Não força captura pela câmera, para permitir selecionar do app Fotos ou Arquivos no iPhone.
- Canvas aplica a orientação decodificada pelo navegador, redimensiona para até 2048 px e converte para JPEG. O mesmo arquivo pode ser escolhido novamente; arquivos temporários são liberados da memória.
- Nove cartões visuais selecionáveis, com uma edição independente por estilo.
- Proporções finais exatas: 1024×1024, 1024×1280, 864×1536 e 1536×864.
- A rota `POST /api/edit` envia a fotografia real como multipart para `https://api.openai.com/v1/images/edits`. A imagem retornada é ajustada à proporção escolhida com recorte central, mantendo resolução definida. Como o provedor não oferece todas essas proporções diretamente, o prompt pede margens; o recorte pode remover bordas.
- Progresso, erros por resultado, ampliação e download JPEG. No Safari, se o download abrir a imagem, use Compartilhar → Salvar Imagem ou Salvar em Arquivos.

O backend confere os bytes reais, limita o tamanho e a quantidade de pixels, rejeita origem externa e protege a geração com uma senha. A produção exige `APP_PASSWORD`. A API nunca recebe comandos arbitrários escritos pelo usuário. Erros do provedor são traduzidos sem encaminhar mensagens potencialmente sensíveis.

Fotos não são armazenadas pelo aplicativo. Os resultados permanecem na memória da aba; recarregar a página limpa a galeria. A foto é enviada à OpenAI somente ao gerar e está sujeita à política de dados do provedor. Cada estilo tem custo independente. Cancelar para novas solicitações e interrompe a conexão do navegador, mas uma edição já iniciada no provedor pode continuar e ser cobrada. A IA pode alterar detalhes do carro; revise resultados antes de uso comercial.

## Testes

```sh
npm test
npm run build
npm run typecheck
```

Os testes unitários cobrem formatos do iPhone, conteúdo inválido, tamanho, estilos, proporções, multipart da API, recorte final e proteção do servidor. Usam respostas controladas no teste; o aplicativo nunca usa esses dados. Nenhuma chamada paga real é realizada pelo teste automatizado.

`tests/browser-smoke.cjs` verifica o fluxo em Chromium com viewport móvel e desktop. Usa Playwright disponível no ambiente ou definido com `PLAYWRIGHT_PATH`. Execute com o servidor em `http://localhost:3000`, `PLAYWRIGHT_PATH` apontando para o módulo Playwright e `CHROMIUM_PATH` para o executável. Esse teste não substitui Safari/iOS físico.

### Checklist de aceitação no iPhone

1. Safari, iPhone real: escolher JPEG e HEIC no Fotos e em Arquivos.
2. Verificar prévia, orientação de foto retrato e o mesmo arquivo selecionado duas vezes.
3. Selecionar arquivo inválido e foto acima de 20 MB: erro claro e sem chamada à API.
4. Selecionar vários estilos e gerar com conta real; revisar os resultados.
5. Baixar resultados em cada proporção e conferir Salvar em Arquivos/Fotos.
6. HEIC de formatos novos pode não ser compatível com o decodificador; a mensagem orienta exportar JPEG. Testar fotos de 48 MP em aparelhos com menos memória.

## Publicar na nuvem

### Vercel (caminho mais simples)

1. Envie esta pasta para um repositório Git privado e importe em Vercel como projeto Next.js.
2. Em Settings → Environment Variables, adicione `OPENAI_API_KEY`, `APP_PASSWORD` e opcionalmente `OPENAI_IMAGE_MODEL`. Marque os segredos como sensíveis. Configure apenas em ambientes que devam gerar imagens.
3. Faça Deploy. O comando de build é `npm run build`.
4. Use um plano/runtime que permita até **300 segundos** para funções. A rota exporta `maxDuration = 300`; o limite efetivo depende do plano. Cada edição usa uma requisição separada e um timeout de 180 segundos para a API.
5. Configure um domínio e teste em HTTPS no iPhone. Compartilhe a senha apenas com quem pode utilizar os créditos da API.

O JPEG preparado é limitado a 4 MB para ficar abaixo do limite de payload de funções Vercel (4,5 MB incluindo multipart). Em aplicações com múltiplos usuários, substitua a senha compartilhada por autenticação individual e imponha quotas persistentes, fila de trabalhos e storage privado. Não remova a proteção da rota sem implementar controle de acesso equivalente.

### Cloud Run, Render, Railway ou outro host de contêiner

Use o `Dockerfile`, porta 3000. Configure os mesmos segredos no gerenciador do provedor; não os inclua na imagem. Habilite HTTPS e timeout de pelo menos 300 segundos. CPU/memória devem suportar Sharp e imagens em base64; comece com 1 GB de memória. Para grande escala, migre a geração para jobs assíncronos com armazenamento privado e controle de custos.

## Estrutura

- `app/page.tsx`: estúdio, importação, seleção e resultados.
- `app/globals.css`: design responsivo, safe area do iPhone e alvos de toque.
- `lib/import-photo.ts`: decodificação, conversão HEIC, orientação e preparação.
- `lib/validation.ts`: validação de formatos e assinatura de arquivo.
- `lib/styles.ts`: catálogo visual e instruções internas para cada estilo.
- `lib/editor.ts`: integração real com a API e proporção de saída.
- `app/api/edit/route.ts`: endpoint privado com validação e erros traduzidos.

Fotografias de referência são exemplos editoriais e não resultados do veículo importado. A imagem principal é uma fotografia do Unsplash (photo-1503376780353-7e6692767b70). As referências são documentadas em `public/styles/CREDITS.md`.
