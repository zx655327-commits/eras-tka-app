package tw.recorder.longrec

import java.io.File
import java.io.RandomAccessFile

/** 16 kHz / 16-bit / mono WAV。每寫入一段就更新檔頭，App 被系統殺掉時檔案仍可播放。 */
class WavWriter(file: File, private val sampleRate: Int = 16000) {
    private val raf = RandomAccessFile(file, "rw")
    private var dataBytes = 0L
    init { raf.setLength(0); writeHeader() }

    fun write(buf: ByteArray, len: Int) {
        raf.seek(44 + dataBytes); raf.write(buf, 0, len); dataBytes += len
        if (dataBytes % (sampleRate * 2 * 5) < len) writeHeader() // 約每 5 秒更新檔頭
    }
    fun close() { writeHeader(); raf.close() }

    private fun writeHeader() {
        val h = java.nio.ByteBuffer.allocate(44).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        h.put("RIFF".toByteArray()); h.putInt((36 + dataBytes).toInt()); h.put("WAVE".toByteArray())
        h.put("fmt ".toByteArray()); h.putInt(16); h.putShort(1); h.putShort(1)
        h.putInt(sampleRate); h.putInt(sampleRate * 2); h.putShort(2); h.putShort(16)
        h.put("data".toByteArray()); h.putInt(dataBytes.toInt())
        raf.seek(0); raf.write(h.array())
    }
}
