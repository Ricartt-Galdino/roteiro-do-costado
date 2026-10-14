package br.com.ricarttgaldino.costado.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class ModelsTest {
    private val operacao = OperacaoTerno(
        equipamento = "M003",
        terno = 1,
        navio = "NAVIO TESTE",
        produtividade = 25.0,
        etapas = listOf(
            Etapa("34A", TipoOperacao.DESCARGA, 20),
            Etapa("34B", TipoOperacao.DESCARGA, 26),
        ),
        etapaAtual = 0,
        restantes = 16,
        iniciado = true,
        atualizadoEm = null,
    )

    @Test fun `ajuste nunca deixa movimentos negativos`() {
        assertEquals(0, operacao.ajustarRestantes(-20).restantes)
    }

    @Test fun `concluir prepara a proxima bay sem iniciar automaticamente`() {
        val proxima = operacao.concluirEtapa()
        assertEquals("34B", proxima.atual?.bay)
        assertEquals(26, proxima.restantes)
        assertFalse(proxima.iniciado)
    }

    @Test fun `progresso usa movimentos da etapa atual`() {
        assertEquals(0.2f, operacao.progresso)
    }
}
