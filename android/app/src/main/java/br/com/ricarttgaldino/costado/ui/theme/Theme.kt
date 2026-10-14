package br.com.ricarttgaldino.costado.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Fundo = Color(0xFF0D151B)
val Painel = Color(0xFF14212A)
val PainelAtual = Color(0xFF223426)
val Linha = Color(0xFF385163)
val Lima = Color(0xFFC6F26B)
val Azul = Color(0xFF8FCEFF)
val Texto = Color(0xFFE8EEF2)
val TextoSecundario = Color(0xFFA3B3BE)

private val Esquema = darkColorScheme(
    primary = Lima,
    onPrimary = Color(0xFF14210B),
    secondary = Azul,
    background = Fundo,
    onBackground = Texto,
    surface = Painel,
    onSurface = Texto,
    outline = Linha,
)

@Composable
fun ControleCostadoTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Esquema, content = content)
}
