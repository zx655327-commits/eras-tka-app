package tw.recorder.longrec

import android.content.Context
import java.io.File
import java.net.URL
import java.util.zip.ZipInputStream

/** 第一次使用時下載 Vosk 離線語音模型（約 40–50 MB），之後完全離線。 */
object ModelManager {
    enum class Lang(val label: String, val url: String, val dir: String, val mlSrc: String, val mlDst: String) {
        ZH("中文 → 英文", "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip", "vosk-model-small-cn-0.22", "zh", "en"),
        EN("English → 中文", "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip", "vosk-model-small-en-us-0.15", "en", "zh")
    }

    fun modelDir(ctx: Context, l: Lang) = File(ctx.filesDir, l.dir)

    /** 在背景執行緒呼叫。 */
    fun ensure(ctx: Context, l: Lang, progress: (String) -> Unit): File {
        val dir = modelDir(ctx, l)
        if (File(dir, "DONE").exists()) return dir
        progress("下載語音模型中（僅第一次）…")
        URL(l.url).openStream().use { input ->
            ZipInputStream(input.buffered()).use { zip ->
                var e = zip.nextEntry
                while (e != null) {
                    val out = File(ctx.filesDir, e.name)
                    if (!out.canonicalPath.startsWith(ctx.filesDir.canonicalPath)) throw SecurityException("bad zip")
                    if (e.isDirectory) out.mkdirs() else { out.parentFile?.mkdirs(); out.outputStream().use { zip.copyTo(it) } }
                    e = zip.nextEntry
                }
            }
        }
        File(dir, "DONE").createNewFile()
        return dir
    }
}
