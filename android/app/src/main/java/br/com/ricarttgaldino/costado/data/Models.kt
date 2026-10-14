package br.com.ricarttgaldino.costado.data

enum class TipoOperacao(val rotulo: String) {
    DESCARGA("Descarga"),
    EMBARQUE("Embarque"),
}

data class Etapa(
    val bay: String,
    val operacao: TipoOperacao,
    val movimentos: Int,
)

data class OperacaoTerno(
    val equipamento: String,
    val terno: Int?,
    val navio: String,
    val produtividade: Double,
    val etapas: List<Etapa>,
    val etapaAtual: Int,
    val restantes: Int?,
    val iniciado: Boolean,
    val atualizadoEm: Long?,
) {
    val atual: Etapa? get() = etapas.getOrNull(etapaAtual)
    val proxima: Etapa? get() = etapas.getOrNull(etapaAtual + 1)
    val concluido: Boolean get() = etapaAtual >= etapas.size

    val progresso: Float
        get() {
            val total = atual?.movimentos ?: return 0f
            val faltam = restantes ?: total
            return if (total <= 0) 0f else ((total - faltam).toFloat() / total).coerceIn(0f, 1f)
        }

    fun ajustarRestantes(delta: Int): OperacaoTerno {
        val atual = atuaisRestantes() ?: return this
        return copy(restantes = (atual + delta).coerceAtLeast(0), atualizadoEm = System.currentTimeMillis())
    }

    fun concluirEtapa(): OperacaoTerno {
        if (concluido) return this
        val novoIndice = etapaAtual + 1
        return copy(
            etapaAtual = novoIndice,
            restantes = etapas.getOrNull(novoIndice)?.movimentos,
            iniciado = false,
            atualizadoEm = System.currentTimeMillis(),
        )
    }

    fun iniciarEtapa(): OperacaoTerno {
        val etapa = atual ?: return this
        return copy(iniciado = true, restantes = restantes ?: etapa.movimentos, atualizadoEm = System.currentTimeMillis())
    }

    fun atribuirTerno(numero: Int?): OperacaoTerno = copy(terno = numero)

    private fun atuaisRestantes(): Int? = if (iniciado) restantes ?: atual?.movimentos else null
}
