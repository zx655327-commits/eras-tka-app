package tw.recorder.longrec

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private lateinit var btn: Button

    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        setContentView(R.layout.activity_main)
        val spinner = findViewById<Spinner>(R.id.langSpinner)
        spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item,
            ModelManager.Lang.entries.map { it.label })
        btn = findViewById(R.id.btnToggle)
        btn.setOnClickListener {
            if (RecordingService.running) {
                startService(Intent(this, RecordingService::class.java).setAction(RecordingService.ACTION_STOP))
            } else if (askPermissions()) {
                ContextCompat.startForegroundService(this, Intent(this, RecordingService::class.java)
                    .putExtra(RecordingService.EXTRA_LANG, ModelManager.Lang.entries[spinner.selectedItemPosition].name))
            }
            btn.postDelayed({ refreshBtn() }, 300)
        }
    }

    override fun onResume() {
        super.onResume()
        val t = findViewById<TextView>(R.id.transcript); val r = findViewById<TextView>(R.id.translation)
        val st = findViewById<TextView>(R.id.status)
        RecordingService.listener = { tx, tr, status ->
            t.text = tx; r.text = tr; st.text = status; refreshBtn()
            findViewById<ScrollView>(R.id.scrollT).post { findViewById<ScrollView>(R.id.scrollT).fullScroll(ScrollView.FOCUS_DOWN) }
            findViewById<ScrollView>(R.id.scrollR).post { findViewById<ScrollView>(R.id.scrollR).fullScroll(ScrollView.FOCUS_DOWN) }
        }
        t.text = RecordingService.transcript; r.text = RecordingService.translation; st.text = RecordingService.status
        refreshBtn()
    }
    override fun onPause() { RecordingService.listener = null; super.onPause() }

    private fun refreshBtn() { btn.text = if (RecordingService.running) "停止錄音" else "開始錄音" }

    private fun askPermissions(): Boolean {
        val need = mutableListOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.READ_PHONE_STATE)
        if (Build.VERSION.SDK_INT >= 33) need += Manifest.permission.POST_NOTIFICATIONS
        val missing = need.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) return true
        requestPermissions(missing.toTypedArray(), 1)
        Toast.makeText(this, "授權後請再按一次開始", Toast.LENGTH_LONG).show()
        return false
    }
}
