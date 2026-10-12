# Roteiro do Costado

App web independente em TypeScript, para tablet e celular. Não altera o app Android de escalas.

## Abrir no Windows

Abra `Iniciar Costado.cmd`. Ele instala dependências caso necessário, gera a versão offline e inicia o app em http://localhost:5178. Mantenha a janela aberta enquanto acessar pelo computador. É necessário Node.js 20.19+ (esta máquina tem Node 24).

Para desenvolvimento: `npm install`, `npm run dev`. Para verificar: `npm test` e `npm run build`.

## Uso

1. Use o plano de demonstração ou clique em **Importar**. Escolha o Crane Work List.
2. Na tabela de conferência, escolha o equipamento e ajuste bay, operação, movimentos, reefers e vazios diretamente nas células. O total muda durante a edição. A foto fica ao lado em telas largas e acima da tabela em telas menores. Use **Conferir** em cada linha revisada e **Continuar com o equipamento** para revisar tampas. O texto bruto permanece disponível na seção avançada.
3. Confira navio, sequência, quantidades, estados de tampa e horários planejados. Adicione ou reorganize etapas conforme necessário.
4. Clique em **Conferido · usar este plano**, selecione a etapa atual e informe seu início.
5. Atualize movimentos restantes, acrescente atraso ou conclua a etapa. Use **Desfazer última ação** para corrigir uma conclusão acidental.

Salvar um plano revisado reinicia o acompanhamento, com confirmação. Exportar/restaurar JSON permite levar os dados para outro aparelho ou endereço do app. Limpar dados do navegador apaga o armazenamento local: exporte uma cópia para preservá-lo.

## Offline e privacidade

Plano e progresso ficam no localStorage deste navegador. Não há conta, telemetria ou envio de imagens. A versão compilada usa um service worker para guardar a interface e reabrir sem conexão após o primeiro carregamento completo. HTTPS ou localhost são necessários; acesso por HTTP via IP da rede permite uso conectado, mas não instalação offline. O ambiente de desenvolvimento não registra service worker.

O OCR Tesseract roda no navegador, sem chaves ou serviço pago. O motor e o idioma inglês (os documentos usam Disch/Load) são distribuídos com o app e incluídos no cache offline inicial. Não depende de CDN em tempo de execução. OCR não é infalível: confira cada linha. Imagens e texto bruto ficam somente na sessão de importação; o plano conferido é persistido.

A importação separa os blocos por equipamento e mantém a ordem original das bays. S01/S02 são normalizados para S001/S002. Cabeçalhos ilegíveis ficam em blocos separados que precisam de identificação manual; nunca são associados automaticamente ao equipamento anterior. A importação Quay Commander foi removida.

A leitura compara a foto original com uma versão ampliada, em cinza e com redução de ruído. As etiquetas dos equipamentos são lidas em recortes separados; a cor apenas localiza a etiqueta, sem determinar seu nome. Variações como `S08`/`50B`, `228`/`22B` e `Dischi2`/`Disch:2` são interpretadas pelo contexto e sinalizadas para conferência. Quando as duas leituras discordam sobre uma quantidade, o campo fica em branco. O total do cabeçalho serve apenas para conferência, nunca para completar números ilegíveis. Ao corrigir o texto manualmente, remova o marcador `[OCR: conferir ...]` da linha corrigida, ou preencha o campo diretamente em **Conferir plano**.

## Regras

Atualização da comparação: linhas divergentes recebem uma terceira leitura em recorte ampliado. Uma leitura ausente não apaga automaticamente o número encontrado na outra versão; ele permanece sinalizado para revisão. Valores numéricos conflitantes sem confirmação continuam em branco. As linhas recuperadas são apresentadas em movimentos, preservando a ordem e a operação. Reefers/vazios maiores que o total da etapa são rejeitados.

- A: convés; B: porão. Um B é acesso, não prova de abertura.
- Acesso consecutivo igual não repete abertura. Bays podem compartilhar um nome de acesso.
- Estado da tampa pertence à visita ao acesso; não se presume que continue aberta após etapas intermediárias. Uma etapa A não prova fechamento.
- Aberturas possíveis entram como hipótese quando configurado tempo de abertura. Fechamento só adiciona tempo quando explicitamente marcado na etapa.
- Tempo restante = quantidade informada / produtividade × 60. O relógio não reduz quantidades.
- Atualizar restantes ancora novamente o cálculo na hora da atualização e substitui atrasos já informados. Concluir usa a hora real, mantendo a próxima etapa aguardando início.
- A próxima tampa mostra o início da abertura; sua duração afeta o início da movimentação e os eventos posteriores.
- Horários são instantes com data e fuso IANA configurável. America/Sao_Paulo é o padrão.
- Reefers e vazios são partes do total. Linhas com twin exigem revisão de movimentos versus contêineres.
- Produtividade real não é inferida: não há medição de tempo puro de movimentação para sugeri-la com segurança.

## Verificação

`npm test`: exemplos 17h48 e 17h54, continuidade, tampa aberta/desconhecida, atrasos, conclusão e desfazer, virada de dia, acesso compartilhado, tempos auxiliares, validação de dados, persistência e OCR estruturado.

## Arquivos

`src/core.ts`: cálculo e estado, sem dependência de interface. `src/import.ts`: interpretação da lista. `src/main.ts`: interface e OCR. `vite.config.ts`: cache offline. O WebMCP experimental expõe apenas leitura do roteiro, quando suportado pelo navegador.
