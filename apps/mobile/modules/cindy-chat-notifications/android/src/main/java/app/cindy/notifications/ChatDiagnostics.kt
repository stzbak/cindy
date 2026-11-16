package app.cindy.notifications

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

/** Phone-local non-sensitive delivery counters and SSE stream state. */
internal object ChatDiagnostics {
  private val counts = ConcurrentHashMap<String, AtomicInteger>()
  private val sseState = AtomicReference("idle")
  private val lastHttpStatus = AtomicInteger(0)
  private val lastErrorKind = AtomicReference("")
  private val lastSseEventAt = AtomicLong(0L)

  fun count(name: String) {
    counts.computeIfAbsent(name) { AtomicInteger(0) }.incrementAndGet()
  }

  fun setSseState(state: String) {
    sseState.set(state)
    if (state == "connected") lastErrorKind.set("")
  }

  fun recordHttpStatus(status: Int) {
    lastHttpStatus.set(status)
    if (status >= 400) {
      count("sseHttpErrors")
      sseState.set("http_error")
      lastErrorKind.set("HTTP_$status")
    }
  }

  fun recordSseEvent() {
    lastSseEventAt.set(System.currentTimeMillis())
    count("sseEvents")
  }

  fun recordSseException(kind: String) {
    count("sseExceptions")
    sseState.set("error")
    lastErrorKind.set(kind)
  }

  fun reset() {
    counts.clear()
    sseState.set("idle")
    lastHttpStatus.set(0)
    lastErrorKind.set("")
    lastSseEventAt.set(0L)
  }

  fun snapshot(): Map<String, Any> {
    val result = mutableMapOf<String, Any>(
      "sseState" to sseState.get(),
      "lastHttpStatus" to lastHttpStatus.get(),
      "lastErrorKind" to lastErrorKind.get(),
      "lastSseEventAt" to lastSseEventAt.get(),
    )
    for ((key, value) in counts) result[key] = value.get()
    return result
  }
}
