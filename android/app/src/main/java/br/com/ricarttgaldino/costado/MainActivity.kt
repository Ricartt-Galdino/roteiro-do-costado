package br.com.ricarttgaldino.costado

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import br.com.ricarttgaldino.costado.data.CostadoRepository
import br.com.ricarttgaldino.costado.ui.ControleCostadoApp
import br.com.ricarttgaldino.costado.ui.theme.ControleCostadoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ControleCostadoTheme {
                ControleCostadoApp(CostadoRepository(applicationContext))
            }
        }
    }
}
