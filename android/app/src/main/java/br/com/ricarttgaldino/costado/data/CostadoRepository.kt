package br.com.ricarttgaldino.costado.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class CostadoRepository(context: Context) {
    private val preferencias = context.getSharedPreferences("controle_costado", Context.MODE_PRIVATE)

    fun carregar(): List<OperacaoTerno> {
        val texto = preferencias.getString(CHAVE_OPERACOES, null) ?: return emptyList()
        return runCatching { lerOperacoes(JSONArray(texto)) }.getOrDefault(emptyList())
    }

    fun salvar(operacoes: List<OperacaoTerno>) {
        preferencias.edit().putString(CHAVE_OPERACOES, escreverOperacoes(operacoes).toString()).apply()
    }

    /**
     * Le o JSON exportado pelo Roteiro do Costado. Assim o plano conferido no
     * computador pode entrar no Android sem redigitacao e sem servidor.
     */
    fun importarBackup(texto: String): List<OperacaoTerno> {
        val raiz = JSONObject(texto)
        val frota = raiz.optJSONObject("fleet")
        val equipes = raiz.optJSONObject("teams")
        val operacoes = buildList {
            if (frota != null) {
                val chaves = frota.keys()
                while (chaves.hasNext()) {
                    val equipamento = chaves.next()
                    frota.optJSONObject(equipamento)?.let { estado ->
                        converterEstado(estado, equipamento, equipes?.optIntOrNull(equipamento))?.let(::add)
                    }
                }
            } else {
                raiz.optJSONObject("state")?.let { estado ->
                    val equipamento = estado.optJSONObject("plan")?.optString("equipment").orEmpty()
                    converterEstado(estado, equipamento, equipes?.optIntOrNull(equipamento))?.let(::add)
                }
            }
        }.sortedWith(compareBy<OperacaoTerno> { it.terno ?: Int.MAX_VALUE }.thenBy { it.equipamento })
        require(operacoes.isNotEmpty()) { "A cópia não contém planos de equipamentos." }
        salvar(operacoes)
        return operacoes
    }

    private fun converterEstado(estado: JSONObject, equipamentoPadrao: String, terno: Int?): OperacaoTerno? {
        val plano = estado.optJSONObject("plan") ?: return null
        val execucao = estado.optJSONObject("run") ?: JSONObject()
        val equipamento = plano.optString("equipment", equipamentoPadrao).ifBlank { equipamentoPadrao }
        if (equipamento.isBlank()) return null
        val etapasJson = plano.optJSONArray("steps") ?: return null
        val etapas = buildList {
            for (indice in 0 until etapasJson.length()) {
                val linha = etapasJson.optJSONObject(indice) ?: continue
                val movimentos = linha.optIntOrNull("moves") ?: continue
                add(
                    Etapa(
                        bay = linha.optString("bay", "—"),
                        operacao = if (linha.optString("operation") == "embarque") TipoOperacao.EMBARQUE else TipoOperacao.DESCARGA,
                        movimentos = movimentos,
                    ),
                )
            }
        }
        if (etapas.isEmpty()) return null
        val atual = execucao.optInt("current", 0).coerceIn(0, etapas.size)
        return OperacaoTerno(
            equipamento = equipamento,
            terno = terno,
            navio = plano.optString("vessel", "Navio não informado"),
            produtividade = plano.optDouble("rate", 25.0),
            etapas = etapas,
            etapaAtual = atual,
            restantes = execucao.optIntOrNull("remaining") ?: etapas.getOrNull(atual)?.movimentos,
            iniciado = !execucao.isNull("started"),
            atualizadoEm = execucao.optLongOrNull("updated"),
        )
    }

    private fun escreverOperacoes(operacoes: List<OperacaoTerno>) = JSONArray().apply {
        operacoes.forEach { operacao ->
            put(JSONObject().apply {
                put("equipamento", operacao.equipamento)
                put("terno", operacao.terno ?: JSONObject.NULL)
                put("navio", operacao.navio)
                put("produtividade", operacao.produtividade)
                put("etapaAtual", operacao.etapaAtual)
                put("restantes", operacao.restantes ?: JSONObject.NULL)
                put("iniciado", operacao.iniciado)
                put("atualizadoEm", operacao.atualizadoEm ?: JSONObject.NULL)
                put("etapas", JSONArray().apply {
                    operacao.etapas.forEach { etapa ->
                        put(JSONObject().apply {
                            put("bay", etapa.bay)
                            put("operacao", etapa.operacao.name)
                            put("movimentos", etapa.movimentos)
                        })
                    }
                })
            })
        }
    }

    private fun lerOperacoes(json: JSONArray) = buildList {
        for (indice in 0 until json.length()) {
            val item = json.getJSONObject(indice)
            val etapasJson = item.getJSONArray("etapas")
            val etapas = buildList {
                for (etapaIndice in 0 until etapasJson.length()) {
                    val etapa = etapasJson.getJSONObject(etapaIndice)
                    add(Etapa(etapa.getString("bay"), TipoOperacao.valueOf(etapa.getString("operacao")), etapa.getInt("movimentos")))
                }
            }
            add(
                OperacaoTerno(
                    equipamento = item.getString("equipamento"),
                    terno = item.optIntOrNull("terno"),
                    navio = item.getString("navio"),
                    produtividade = item.getDouble("produtividade"),
                    etapas = etapas,
                    etapaAtual = item.getInt("etapaAtual"),
                    restantes = item.optIntOrNull("restantes"),
                    iniciado = item.getBoolean("iniciado"),
                    atualizadoEm = item.optLongOrNull("atualizadoEm"),
                ),
            )
        }
    }

    private fun JSONObject.optIntOrNull(chave: String): Int? = if (isNull(chave)) null else optInt(chave)
    private fun JSONObject.optLongOrNull(chave: String): Long? = if (isNull(chave)) null else optLong(chave)

    companion object { private const val CHAVE_OPERACOES = "operacoes_v1" }
}
