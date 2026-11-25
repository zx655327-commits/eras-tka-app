package tw.recorder.longrec

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.*
import android.os.*
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.translate.*
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.Executors

/**
 * 前景服務：切換 App、關螢幕都持續錄音。
 * 來電／通話時系統會收回麥克風 → 自動暫停並在逐字稿標註，掛斷後自動恢復，錄音檔不中斷遺失。
 */
class RecordingService : Service() {

    companion object {
        const val EXTRA_LANG = "lang"
        const val ACTION_STOP = "stop"
        @Volatile var running = false
        /** UI 監聽：(逐字稿, 翻譯, 狀態) */
        var listener: ((String, String, String) -> Unit)? = null
        val transcript = StringBuilder(); val translation = StringBuilder(); var status = "待機中"
    }

    private val main = Handler(Looper.getMainLooper())
    private val translateExec = Executors.newSingleThreadExecutor()
    private var worker: Thread? = null
    @Volatile private var paused = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var translator: Translator? = null
    private var telCallback: Any? = null
    private lateinit var outDir: File
    private lateinit var txtFile: File

    override fun onBind(i: Intent?) = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
        if (running) return START_STICKY
        running = true
        val lang = ModelManager.Lang.valueOf(intent?.getStringExtra(EXTRA_LANG) ?: "ZH")
        startForegroundCompat("錄音中")
        wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "longrec:rec").apply { acquire() }
        transcript.clear(); translation.clear()
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        outDir = File(getExternalFilesDir(null), "rec_$stamp").apply { mkdirs() }
        txtFile = File(outDir, "transcript.txt")
        setupTranslator(lang)
        listenCalls()
        worker = Thread { loop(lang) }.apply { start() }
        return START_STICKY
    }

    private fun setupTranslator(l: ModelManager.Lang) {
        val opt = TranslatorOptions.Builder()
            .setSourceLanguage(TranslateLanguage.fromLanguageTag(l.mlSrc)!!)
            .setTargetLanguage(TranslateLanguage.fromLanguageTag(l.mlDst)!!).build()
        translator = Translation.getClient(opt).also {
            it.downloadModelIfNeeded(DownloadConditions.Builder().build()) // 首次下載翻譯模型，之後離線
        }
    }

    @SuppressLint("MissingPermission")
    private fun loop(lang: ModelManager.Lang) {
        try {
            val model = Model(ModelManager.ensure(this, lang) { post(status = it) }.absolutePath)
            val rec = Recognizer(model, 16000f)
            val minBuf = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val buf = ByteArray(maxOf(minBuf, 8192))
            var part = 1
            var wav = WavWriter(File(outDir, "audio_%03d.wav".format(part)))
            var ar = newRecorder(minBuf)
            ar.startRecording(); post(status = "錄音中（${lang.label}）")
            var silentChunks = 0
            while (running) {
                if (paused) { Thread.sleep(300); continue }
                val n = ar.read(buf, 0, buf.size)
                if (n <= 0) { // 麥克風被收回或錯誤 → 重建
                    ar.release(); Thread.sleep(500); ar = newRecorder(minBuf); ar.startRecording(); continue
                }
                // 通話中部分機型會回傳全零資料：視為被佔用
                silentChunks = if (buf.take(n).all { it.toInt() == 0 }) silentChunks + 1 else 0
                wav.write(buf, n)
                if (rec.acceptWaveForm(buf, n)) onFinal(JSONObject(rec.result).optString("text"))
                else post(partial = JSONObject(rec.partialResult).optString("partial"))
                // 單檔約 1 小時（115 MB）自動切檔，避免過大
                if (File(outDir, "audio_%03d.wav".format(part)).length() > 115_000_000L) {
                    wav.close(); part++; wav = WavWriter(File(outDir, "audio_%03d.wav".format(part)))
                }
            }
            onFinal(JSONObject(rec.finalResult).optString("text"))
            wav.close(); ar.stop(); ar.release(); rec.close(); model.close()
        } catch (e: Exception) {
            post(status = "錯誤：${e.message}")
        }
    }

    @SuppressLint("MissingPermission")
    private fun newRecorder(minBuf: Int) = AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000,
        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBuf * 4)

    private fun now() = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())

    private fun onFinal(raw: String) {
        val text = if (raw.isNotBlank() && raw.any { it.code > 0x2E80 }) raw.replace(" ", "") else raw
        if (text.isBlank()) return
        val line = "[${now()}] $text\n"
        synchronized(transcript) { transcript.append(line) }
        txtFile.appendText(line)
        post()
        translateExec.execute {
            translator?.translate(text)?.addOnSuccessListener { tr ->
                val l2 = "[${now()}] $tr\n"
                synchronized(translation) { translation.append(l2) }
                File(outDir, "translation.txt").appendText(l2); post()
            }
        }
    }

    private fun mark(msg: String) {
        val line = "—— ${now()} $msg ——\n"
        synchronized(transcript) { transcript.append(line) }; txtFile.appendText(line); post()
    }

    private var lastPartial = ""
    private fun post(partial: String? = null, status: String? = null) {
        if (status != null) { Companion.status = status; updateNotif(status) }
        if (partial != null) lastPartial = partial
        main.post { listener?.invoke(transcript.toString() + lastPartial, translation.toString(), Companion.status) }
    }

    // ---- 通話偵測：暫停 → 恢復 ----
    private fun onCallState(state: Int) {
        if (state == TelephonyManager.CALL_STATE_IDLE) {
            if (paused) { paused = false; mark("通話結束，恢復錄音"); post(status = "錄音中") }
        } else if (!paused) {
            paused = true; mark("通話中，系統暫停麥克風"); post(status = "通話中（暫停）")
        }
    }

    @SuppressLint("MissingPermission")
    private fun listenCalls() {
        val tm = getSystemService(TELEPHONY_SERVICE) as TelephonyManager
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                val cb = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                    override fun onCallStateChanged(state: Int) = onCallState(state)
                }
                tm.registerTelephonyCallback(mainExecutor, cb); telCallback = cb
            } else {
                @Suppress("DEPRECATION")
                val l = object : android.telephony.PhoneStateListener() {
                    override fun onCallStateChanged(state: Int, n: String?) = onCallState(state)
                }
                @Suppress("DEPRECATION") tm.listen(l, android.telephony.PhoneStateListener.LISTEN_CALL_STATE); telCallback = l
            }
        } catch (_: SecurityException) { /* 未授權電話狀態：仍可錄音，只是不標註通話 */ }
    }

    // ---- 通知 ----
    private fun notif(text: String): Notification {
        val chan = "rec"
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(chan, "錄音", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 1, Intent(this, RecordingService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, chan).setContentTitle("長時錄音翻譯").setContentText(text)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now).setOngoing(true).setContentIntent(open)
            .addAction(0, "停止", stop).build()
    }
    private fun startForegroundCompat(t: String) {
        if (Build.VERSION.SDK_INT >= 29) startForeground(1, notif(t), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        else startForeground(1, notif(t))
    }
    private fun updateNotif(t: String) = getSystemService(NotificationManager::class.java).notify(1, notif(t))

    override fun onDestroy() {
        running = false; worker?.join(3000)
        val tm = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        if (Build.VERSION.SDK_INT >= 31) (telCallback as? TelephonyCallback)?.let { tm.unregisterTelephonyCallback(it) }
        translator?.close(); wakeLock?.release()
        status = "已停止，檔案存於：${outDir.absolutePath}"; post()
        super.onDestroy()
    }
}
