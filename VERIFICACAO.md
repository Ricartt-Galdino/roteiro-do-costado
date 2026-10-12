# Verificação da entrega

## Conferência direta na importação

- Tabela editável por equipamento, metadados editáveis, total recalculado durante a digitação e destaque dos campos obrigatórios ausentes. As alterações na tabela ficam nos candidatos da sessão e seguem para o editor ao continuar; o plano em acompanhamento só muda ao aplicar o plano conferido.
- Foto ao lado em telas largas; referência acima da tabela em telas menores. Avisos originais recolhidos e texto bruto em seção avançada. Reprocessar o texto após ajustes exige confirmação na interface para evitar perda acidental das edições.
- Build concluído, 33 testes existentes passaram e servidor local respondeu HTTP 200. A ferramenta de navegador voltou a falhar na inicialização; o fluxo visual não foi validado nesta rodada.

## Foto adicional MAERSK LEON — comparação por linha

- 33 testes passaram e build concluído.
- Tesseract local com adaptador Sharp: M006 com 7 etapas/65 movimentos; S002 com 11 etapas/203 movimentos; S001 com 6 etapas/211 movimentos. Todas as quantidades de movimentos recuperadas sem usar o total para completá-las. Identificação adicional de etiquetas sem restrição de alfabeto, validada contra os cinco equipamentos permitidos.
- Reefers e vazios ainda exigem revisão. Exemplo: 22B Load pode retornar 31 reefers, enquanto a imagem mostra 33. Totais corretos não comprovam acerto das parcelas.
- Regressão das fotos anteriores: IRENES WISDOM mantém 69/77 movimentos; MSC MADHU B mantém S002=104 e S001=96. A quantidade da 06A de M006 continua incorreta em leituras concordantes (1 em vez de 6); o bloco permanece com alerta de divergência do total. OCR não elimina a conferência da foto.
- A transcrição adicional `Transcricao MAERSK LEON.txt` foi conferida visualmente, separada dos resultados automáticos. Pode ser colada na área de texto da importação.
- A validação desta rodada foi local, sem repetir o upload no navegador.

## Atualização do OCR — 10/10/2026

- 31 testes passaram; TypeScript e build Vite concluídos.
- Leitura original e tratada, recortes de etiquetas, correção contextual de bays e operações, divergências numéricas indicadas com campos em branco.
- Fotos reais executadas com Tesseract local e adaptador Sharp para recorte/redimensionamento, usando o mesmo interpretador e tratamento de pixels do app. A renderização Canvas do navegador pode produzir diferenças.
- `1.jpg`: S002 com sete etapas/69 movimentos e S001 com seis etapas/77 movimentos. Todas as bays recuperadas, incluindo 22A. Reefers divergentes em 18B e 30A ficaram para revisão.
- `3.jpg`: M006, S002 e S001 identificados, com duas, duas e três etapas respectivamente. S002 totalizou 104 movimentos e S001 96. Quantidade de 06A ficou em branco por divergência; 61A foi lida como seis movimentos. Etiquetas com baixa confiança exigem conferência.
- Navio/viagem ainda podem ficar ilegíveis nessas fotos e devem ser preenchidos na conferência.
- Upload pela interface não foi repetido nesta atualização: o navegador de testes falhou na inicialização com `setup refresh had errors`. Os registros de interface abaixo pertencem às versões anteriores.

- Testes automatizados: 21 casos, incluindo 17h48, 17h54, atraso, conclusão real, continuidade, acesso compartilhado, tampa aberta, meia-noite, fuso, persistência e divergências no OCR.
- Build TypeScript e Vite concluído.
- Navegador: seleção da etapa 46A com 20 movimentos às 17h e exibição da possível abertura 46B às 17h48; a recarga preservou andamento.
- Layout inspecionado em 1280×900 (tablet) e 390×844 (celular).
- Foto Crane Work List fornecida foi lida pelo OCR local: confiança média de 34%. Muitos caracteres ficam incorretos nessa foto de tela; não utilizar a extração sem conferência.
- Correção testada: texto OCR revisado, escolha de S001, edição de 20 para 21 movimentos, aplicação do plano e recarga. Os 21 movimentos e as três etapas corrigidas persistiram.
- WebMCP de leitura: chamada válida retornou o mesmo roteiro e previsão da interface; entrada inválida foi recusada.
- Quay: OCR textual e referência visual; associação gráfica automática de blocos aos horários não implementada. Preenchimento e revisão manuais disponíveis.

Imagens de referência não são incluídas na distribuição; o usuário importa suas imagens no aparelho. A demonstração usa apenas a transcrição solicitada.

## Atualização: escolha por equipamento
- Quay Commander removido da importação.
- Cinco equipamentos fixos: S001, S002, M003, M005, M006.
- 26 testes passando e build concluído.
- Navegador: transcrição conferida da IRENES WISDOM mostra S001 com seis etapas/77 movimentos e S002 com sete etapas/69 movimentos; clicar em cada opção abre somente suas bays.
- OCR da foto 1.jpg foi executado localmente. Cabeçalhos coloridos e A/B exigem revisão: blocos sem identificação ficam separados para associação manual. A transcrição corrigida foi usada no teste da seleção.

