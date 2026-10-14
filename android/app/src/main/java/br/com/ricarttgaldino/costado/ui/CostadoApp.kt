package br.com.ricarttgaldino.costado.ui

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.ricarttgaldino.costado.data.CostadoRepository
import br.com.ricarttgaldino.costado.data.OperacaoTerno
import br.com.ricarttgaldino.costado.data.TipoOperacao
import br.com.ricarttgaldino.costado.ui.theme.Azul
import br.com.ricarttgaldino.costado.ui.theme.Fundo
import br.com.ricarttgaldino.costado.ui.theme.Lima
import br.com.ricarttgaldino.costado.ui.theme.Linha
import br.com.ricarttgaldino.costado.ui.theme.Painel
import br.com.ricarttgaldino.costado.ui.theme.PainelAtual
import br.com.ricarttgaldino.costado.ui.theme.TextoSecundario
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.ceil

@Composable
fun ControleCostadoApp(repositorio: CostadoRepository) {
    var operacoes by remember { mutableStateOf(repositorio.carregar()) }
    var equipamentoSelecionado by remember { mutableStateOf<String?>(null) }
    var mensagem by remember { mutableStateOf<String?>(null) }
    var atribuindo by remember { mutableStateOf<OperacaoTerno?>(null) }

    val contexto = androidx.compose.ui.platform.LocalContext.current
    val abrirArquivo = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            runCatching {
                contexto.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                    ?: error("Não foi possível ler o arquivo.")
            }.mapCatching(repositorio::importarBackup).onSuccess {
                operacoes = it
                equipamentoSelecionado = null
                mensagem = "Plano importado: ${it.size} equipamento${if (it.size == 1) "" else "s"}."
            }.onFailure {
                mensagem = it.message ?: "A cópia não pôde ser importada."
            }
        }
    }

    fun atualizar(alterada: OperacaoTerno) {
        operacoes = operacoes.map { if (it.equipamento == alterada.equipamento) alterada else it }
        repositorio.salvar(operacoes)
    }

    val selecionada = operacoes.firstOrNull { it.equipamento == equipamentoSelecionado }
    BackHandler(enabled = selecionada != null) { equipamentoSelecionado = null }

    Scaffold(containerColor = Fundo) { espaco ->
        if (selecionada == null) {
            VisaoCostado(
                operacoes = operacoes,
                mensagem = mensagem,
                aoImportar = { abrirArquivo.launch(arrayOf("application/json", "text/plain")) },
                aoAbrir = { equipamentoSelecionado = it.equipamento },
                modifier = Modifier.padding(espaco),
            )
        } else {
            DetalheTerno(
                operacao = selecionada,
                aoVoltar = { equipamentoSelecionado = null },
                aoAtribuir = { atribuindo = selecionada },
                aoAtualizar =(::atualizar),
                modifier = Modifier.padding(espaco),
            )
        }
    }

    atribuindo?.let { operacao ->
        DialogoTerno(
            operacao = operacao,
            ocupados = operacoes.filter { it.equipamento != operacao.equipamento }.mapNotNull { it.terno }.toSet(),
            aoFechar = { atribuindo = null },
            aoEscolher = { numero ->
                atualizar(operacao.atribuirTerno(numero))
                atribuindo = null
            },
        )
    }
}

@Composable
private fun VisaoCostado(
    operacoes: List<OperacaoTerno>,
    mensagem: String?,
    aoImportar: () -> Unit,
    aoAbrir: (OperacaoTerno) -> Unit,
    modifier: Modifier = Modifier,
) {
    val navio = operacoes.firstOrNull()?.navio ?: "Controle do Costado"
    val ativos = operacoes.count { it.iniciado && !it.concluido }
    LazyColumn(
        modifier = modifier.fillMaxSize().safeDrawingPadding(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Rotulo("OPERAÇÃO DO NAVIO")
                    Text(navio, fontSize = 24.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("$ativos terno${if (ativos == 1) "" else "s"} operando agora", color = TextoSecundario, fontSize = 13.sp)
                }
                TextButton(onClick = aoImportar) { Text("Importar plano") }
            }
        }
        mensagem?.let { item { Aviso(it) } }
        if (operacoes.isEmpty()) {
            item { EstadoVazio(aoImportar) }
        } else {
            items(operacoes, key = { it.equipamento }) { operacao ->
                CartaoTerno(operacao, aoAbrir)
            }
            item {
                Text(
                    "Os dados ficam somente neste aparelho. Importe uma nova cópia para substituir o plano.",
                    color = TextoSecundario,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 8.dp, bottom = 18.dp),
                )
            }
        }
    }
}

@Composable
private fun CartaoTerno(operacao: OperacaoTerno, aoAbrir: (OperacaoTerno) -> Unit) {
    val atual = operacao.atual
    val trocaProxima = operacao.iniciado && (operacao.restantes ?: Int.MAX_VALUE) <= 3
    Card(
        modifier = Modifier.fillMaxWidth().clickable { aoAbrir(operacao) },
        shape = RoundedCornerShape(13.dp),
        border = BorderStroke(1.dp, if (trocaProxima) Lima else Linha),
        colors = CardDefaults.cardColors(containerColor = if (trocaProxima) PainelAtual else Painel),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            StatusOperacao(operacao, trocaProxima)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    operacao.terno?.let { "${it}º terno" } ?: "Terno a definir",
                    modifier = Modifier.weight(1f),
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(operacao.equipamento, color = Lima, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
            }
            HorizontalDivider(color = Linha.copy(alpha = .65f))
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Rotulo("AGORA")
                    Text("Bay ${atual?.bay ?: "—"}", fontFamily = FontFamily.Monospace, fontSize = 25.sp, fontWeight = FontWeight.Bold)
                    Text(atual?.operacao?.rotulo ?: "Plano concluído", color = Azul, fontSize = 12.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${operacao.restantes ?: "—"}", color = Lima, fontFamily = FontFamily.Monospace, fontSize = 35.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(7.dp))
                    Text("MOV\nRESTANTES", color = TextoSecundario, fontSize = 9.sp, lineHeight = 11.sp)
                }
            }
            LinearProgressIndicator(
                progress = { operacao.progresso },
                modifier = Modifier.fillMaxWidth().height(5.dp),
                color = Lima,
                trackColor = Linha,
            )
            Row(verticalAlignment = Alignment.Bottom) {
                Column(Modifier.weight(1f)) {
                    Rotulo("DEPOIS")
                    Text(operacao.proxima?.let { "Bay ${it.bay}" } ?: "Fim do plano", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    operacao.proxima?.let { Text("${it.movimentos} mov · ${it.operacao.rotulo}", color = TextoSecundario, fontSize = 10.sp) }
                }
                Text("Acompanhar  →", color = Lima, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun DetalheTerno(
    operacao: OperacaoTerno,
    aoVoltar: () -> Unit,
    aoAtribuir: () -> Unit,
    aoAtualizar: (OperacaoTerno) -> Unit,
    modifier: Modifier = Modifier,
) {
    val atual = operacao.atual
    LazyColumn(
        modifier = modifier.fillMaxSize().safeDrawingPadding(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = aoVoltar, contentPadding = PaddingValues(end = 10.dp)) { Text("← Todos") }
                Column(Modifier.weight(1f)) {
                    Text(operacao.terno?.let { "${it}º terno" } ?: "Terno a definir", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(operacao.equipamento, color = Lima, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                }
                TextButton(onClick = aoAtribuir) { Text("Alterar terno") }
            }
        }
        item {
            Surface(color = PainelAtual, shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, Lima.copy(alpha = .5f))) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Rotulo(if (operacao.iniciado) "VOCÊ ESTÁ AQUI" else "PRÓXIMA ETAPA")
                    Row(verticalAlignment = Alignment.Top) {
                        Column(Modifier.weight(1f)) {
                            Text("Bay ${atual?.bay ?: "—"}", fontFamily = FontFamily.Monospace, fontSize = 34.sp, fontWeight = FontWeight.Bold)
                            Text(atual?.operacao?.rotulo ?: "Plano concluído", color = Azul)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("${operacao.restantes ?: "—"}", color = Lima, fontFamily = FontFamily.Monospace, fontSize = 46.sp, fontWeight = FontWeight.Bold)
                            Text("movimentos restantes", color = TextoSecundario, fontSize = 10.sp)
                        }
                    }
                    LinearProgressIndicator(progress = { operacao.progresso }, modifier = Modifier.fillMaxWidth().height(6.dp), color = Lima, trackColor = Linha)
                    if (operacao.iniciado) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(onClick = { aoAtualizar(operacao.ajustarRestantes(-1)) }, modifier = Modifier.weight(1f)) { Text("− 1 restante") }
                            OutlinedButton(onClick = { aoAtualizar(operacao.ajustarRestantes(1)) }, modifier = Modifier.weight(1f)) { Text("+ 1 restante") }
                        }
                        Button(onClick = { aoAtualizar(operacao.concluirEtapa()) }, modifier = Modifier.fillMaxWidth()) { Text("Concluir bay  →") }
                    } else if (!operacao.concluido) {
                        Button(onClick = { aoAtualizar(operacao.iniciarEtapa()) }, modifier = Modifier.fillMaxWidth()) { Text("Iniciar acompanhamento") }
                    }
                }
            }
        }
        operacao.proxima?.let { proxima ->
            item {
                Surface(color = Painel, shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, Azul.copy(alpha = .5f))) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Rotulo("A SEGUIR")
                            Text("Bay ${proxima.bay}", fontFamily = FontFamily.Monospace, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                            Text(proxima.operacao.rotulo, color = Azul, fontSize = 12.sp)
                        }
                        Text("${proxima.movimentos} mov", color = TextoSecundario)
                    }
                }
            }
        }
        item { Rotulo("SEQUÊNCIA DO PLANO") }
        items(operacao.etapas.drop(operacao.etapaAtual + 2)) { etapa ->
            Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(25.dp).background(Linha, CircleShape), contentAlignment = Alignment.Center) { Text("•") }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("Bay ${etapa.bay}", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    Text(etapa.operacao.rotulo, color = TextoSecundario, fontSize = 11.sp)
                }
                Text("${etapa.movimentos} mov", color = TextoSecundario, fontSize = 12.sp)
            }
        }
        item {
            val minutos = if (operacao.iniciado && operacao.restantes != null && operacao.produtividade > 0) ceil(operacao.restantes / operacao.produtividade * 60).toLong() else null
            val previsao = minutos?.let { DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.now().plusSeconds(it * 60)) }
            Text(
                previsao?.let { "Fim estimado da bay atual: $it · ${operacao.produtividade.toInt()} mov/h" }
                    ?: "A previsão começa quando o acompanhamento da bay é iniciado.",
                color = TextoSecundario,
                fontSize = 11.sp,
                modifier = Modifier.padding(vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun DialogoTerno(operacao: OperacaoTerno, ocupados: Set<Int>, aoFechar: () -> Unit, aoEscolher: (Int?) -> Unit) {
    AlertDialog(
        onDismissRequest = aoFechar,
        title = { Text("Terno · ${operacao.equipamento}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                (1..5).forEach { numero ->
                    val ocupado = numero in ocupados
                    OutlinedButton(
                        onClick = { aoEscolher(numero) },
                        enabled = !ocupado,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(if (ocupado) "${numero}º terno · já atribuído" else "${numero}º terno") }
                }
                TextButton(onClick = { aoEscolher(null) }, modifier = Modifier.fillMaxWidth()) { Text("Remover atribuição") }
            }
        },
        confirmButton = { TextButton(onClick = aoFechar) { Text("Fechar") } },
    )
}

@Composable
private fun StatusOperacao(operacao: OperacaoTerno, trocaProxima: Boolean) {
    val (texto, cor) = when {
        operacao.concluido -> "Plano concluído" to TextoSecundario
        trocaProxima -> "Troca em breve" to Lima
        operacao.iniciado -> "Operando agora" to Color(0xFF79C877)
        else -> "Aguardando início" to TextoSecundario
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).background(cor, CircleShape))
        Spacer(Modifier.width(7.dp))
        Text(texto.uppercase(), color = cor, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
    }
}

@Composable
private fun Rotulo(texto: String) {
    Text(texto, color = TextoSecundario, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.1.sp)
}

@Composable
private fun Aviso(texto: String) {
    Surface(color = Color(0xFF20342B), shape = RoundedCornerShape(9.dp), border = BorderStroke(1.dp, Color(0xFF52745D))) {
        Text(texto, modifier = Modifier.padding(12.dp), fontSize = 12.sp)
    }
}

@Composable
private fun EstadoVazio(aoImportar: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 70.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        Text("Nenhum plano no aparelho", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("Exporte a cópia JSON do Roteiro do Costado e importe aqui.", color = TextoSecundario, fontSize = 13.sp)
        Button(onClick = aoImportar, colors = ButtonDefaults.buttonColors(containerColor = Lima, contentColor = Color(0xFF14210B))) { Text("Importar plano") }
    }
}
