package expo.modules.sonycamera

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.BitmapFactory
import android.net.Uri
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.util.ArrayDeque
import java.util.Locale
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

internal class SonyCameraController(private val context: Context) {
  interface Listener {
    fun onStateChanged(payload: Map<String, Any?>)
    fun onDeviceAttached(payload: Map<String, Any?>)
    fun onPhotoCaptured(payload: Map<String, Any?>)
    fun onFrame(jpeg: ByteArray)
  }

  companion object {
    private const val TAG = "ListingOSSonyCamera"
    private const val SONY_VENDOR_ID = 0x054C
    private const val PERMISSION_ACTION_SUFFIX = ".SONY_CAMERA_USB_PERMISSION"
    private const val DIAGNOSTICS_PREFERENCE = "sony_camera_diagnostics"
    private const val DIAGNOSTICS_KEY = "trace"
    private const val MAX_DIAGNOSTICS = 80
  }

  private val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
  private val executor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "ListingOSSonyCamera").apply { isDaemon = true }
  }
  private val listeners = CopyOnWriteArraySet<Listener>()
  private val connecting = AtomicBoolean(false)
  private val permissionRequestPending = AtomicBoolean(false)
  private val liveViewRequested = AtomicBoolean(false)
  private val streaming = AtomicBoolean(false)
  private val permissionAction = context.packageName + PERMISSION_ACTION_SUFFIX
  private val diagnosticsPreferences = context.getSharedPreferences(DIAGNOSTICS_PREFERENCE, Context.MODE_PRIVATE)
  private val diagnostics = ArrayDeque<String>()
  private var transport: SonyPtpTransport? = null
  private var device: UsbDevice? = null
  private var state = "disconnected"
  private var message: String? = null
  private var frameFuture: Future<*>? = null
  private var frameCount = 0

  private val usbReceiver = object : BroadcastReceiver() {
    override fun onReceive(receiverContext: Context, intent: Intent) {
      trace("broadcast action=${intent.action}")
      when (intent.action) {
        permissionAction -> {
          val attached = intent.usbDevice()
          val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
          permissionRequestPending.set(false)
          trace("permission result granted=$granted device=${attached?.let(::describeDevice) ?: "missing"}")
          if (granted && attached != null) {
            device = attached
            enqueueConnect(attached, settleDelayMs = 300)
          } else {
            updateState("permission_required", "USB permission is required to use the Sony camera.")
          }
        }
        UsbManager.ACTION_USB_DEVICE_DETACHED -> {
          val detached = intent.usbDevice()
          permissionRequestPending.set(false)
          trace("device detached ${detached?.let(::describeDevice) ?: "unknown"}")
          if (detached == null || detached.deviceId == device?.deviceId) disconnectBlocking(preserveLiveViewRequest = true)
        }
        UsbManager.ACTION_USB_DEVICE_ATTACHED -> handleIntent(intent)
      }
    }
  }

  init {
    diagnosticsPreferences.getString(DIAGNOSTICS_KEY, null)
      ?.lineSequence()
      ?.filter(String::isNotBlank)
      ?.toList()
      ?.takeLast(MAX_DIAGNOSTICS - 1)
      ?.forEach(diagnostics::addLast)
    trace("session started sdk=${Build.VERSION.SDK_INT} knownUsbDevices=${usbManager.deviceList.size}")
    val filter = IntentFilter().apply {
      addAction(permissionAction)
      addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
      addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(usbReceiver, filter)
    }
  }

  fun addListener(listener: Listener) {
    listeners.add(listener)
    listener.onStateChanged(statePayload())
  }

  fun removeListener(listener: Listener) { listeners.remove(listener) }

  fun handleIntent(intent: Intent) {
    if (intent.action != UsbManager.ACTION_USB_DEVICE_ATTACHED) {
      trace("activity intent ignored action=${intent.action}")
      return
    }
    val attached = intent.usbDevice()
    if (attached == null) {
      trace("attach intent missing USB device")
      updateState("error", "Android opened ListingOS for USB, but did not provide a camera descriptor.")
      return
    }
    trace("attach intent ${describeDevice(attached)}")
    if (!isSonyPtp(attached)) {
      trace("attach rejected: not Sony still-image PTP")
      updateState(
        "error",
        "Sony USB was detected, but the camera is not exposing a still-image PTP interface. Set USB Connection to PC Remote.",
      )
      return
    }
    device = attached
    val payload = payloadFor("disconnected", "Sony camera attached. Preparing USB connection.", attached)
    listeners.forEach { it.onDeviceAttached(payload) }
    if (usbManager.hasPermission(attached)) {
      if (permissionRequestPending.get()) {
        trace("permission granted; waiting for Android permission result broadcast")
      } else {
        enqueueConnect(attached, settleDelayMs = 300)
      }
    } else {
      requestPermission(attached)
    }
  }

  fun refreshAttachedDevice(autoConnect: Boolean) {
    val attached = findSonyPtpDevice()
    trace("refresh autoConnect=$autoConnect matched=${attached?.let(::describeDevice) ?: "none"}")
    if (attached == null) {
      if (device != null) disconnectBlocking()
      return
    }
    device = attached
    if (!autoConnect || transport != null || state == "connecting") return
    if (usbManager.hasPermission(attached)) {
      enqueueConnect(attached, settleDelayMs = 300)
    } else {
      updateState("permission_required", "Connect the Sony camera and allow USB access.")
    }
  }

  fun statePayload(): Map<String, Any?> = payloadFor(state, message, device)

  fun connectBlocking(): Map<String, Any?> {
    val attached = device ?: findSonyPtpDevice()
      ?: return updateState("disconnected", "No compatible Sony PTP camera is attached.")
    device = attached
    if (!usbManager.hasPermission(attached)) {
      requestPermission(attached)
      return statePayload()
    }
    enqueueConnect(attached)
    return statePayload()
  }

  private fun enqueueConnect(attached: UsbDevice, settleDelayMs: Long = 0) {
    if (transport != null && state in setOf("ready", "streaming", "capturing")) return
    if (!connecting.compareAndSet(false, true)) {
      trace("connect coalesced: handshake already in flight")
      return
    }
    updateState("connecting", "Negotiating Sony Camera Control PTP 2…")
    executor.execute {
      try {
        if (settleDelayMs > 0) SystemClock.sleep(settleDelayMs)
        connectInternal(attached)
        if (liveViewRequested.get()) beginLiveView()
      } catch (error: Throwable) {
        fail(error)
      } finally {
        connecting.set(false)
      }
    }
  }

  private fun connectInternal(attached: UsbDevice): Map<String, Any?> {
    if (transport != null && state in setOf("ready", "streaming", "capturing")) return statePayload()
    trace("opening PTP transport ${describeDevice(attached)} permission=${usbManager.hasPermission(attached)}")
    transport?.close()
    val next = SonyPtpTransport.open(usbManager, attached, ::trace)
    try {
      trace("PTP interface claimed; authenticating")
      next.authenticate()
      trace("Sony PTP authentication complete")
      next.prepareStillCapture()
      trace("still-capture properties requested")
      transport = next
      updateState("ready", "Sony A7 III is ready.")
      return statePayload()
    } catch (error: Throwable) {
      next.close()
      throw error
    }
  }

  fun startLiveView() {
    liveViewRequested.set(true)
    trace("startLiveView state=$state transport=${transport != null}")
    if (transport == null) {
      connectBlocking()
      return
    }
    beginLiveView()
  }

  private fun beginLiveView() {
    if (!streaming.compareAndSet(false, true)) return
    updateState("streaming", "Sony live view")
    frameFuture = executor.submit {
      var liveViewPrepared = false
      frameCount = 0
      while (streaming.get()) {
        var startedAt = SystemClock.elapsedRealtime()
        try {
          val activeTransport = transport ?: break
          if (!liveViewPrepared) {
            trace("preparing Sony live-view object handle")
            activeTransport.prepareLiveView()
            liveViewPrepared = true
            trace("live-view handle ready")
            // Do not count Sony's preparation time against the first frame's
            // pacing window; the camera needs a short quiet interval here.
            startedAt = SystemClock.elapsedRealtime()
          }
          if (frameCount > 0 && frameCount % 10 == 0) {
            activeTransport.pollCapturedJpeg()?.let(::persistCapturedJpeg)
          }
          val jpeg = activeTransport.getLiveViewJpeg()
          if (jpeg != null && jpeg.isNotEmpty()) {
            frameCount += 1
            if (frameCount == 1) {
              trace("first live-view JPEG received bytes=${jpeg.size}")
              listeners.forEach { it.onStateChanged(statePayload()) }
            }
            listeners.forEach { it.onFrame(jpeg) }
          }
        } catch (error: SonyPtpException) {
          if (!streaming.get()) break
          if (!error.retryable) {
            fail(error)
            break
          }
        } catch (error: Throwable) {
          if (!streaming.get()) break
          fail(error)
          break
        }
        val remaining = 100L - (SystemClock.elapsedRealtime() - startedAt)
        if (remaining > 0) SystemClock.sleep(remaining)
      }
      if (state == "streaming") updateState("ready", "Sony A7 III is ready.")
    }
  }

  fun stopLiveView() {
    stopLiveView(preserveRequest = false)
  }

  private fun stopLiveView(preserveRequest: Boolean) {
    if (!preserveRequest) liveViewRequested.set(false)
    streaming.set(false)
    frameFuture?.cancel(false)
    frameFuture = null
    if (state == "streaming") updateState("ready", "Sony A7 III is ready.")
  }

  fun capturePhotoBlocking(): Map<String, Any?> {
    val resumeStream = liveViewRequested.get() || streaming.get()
    stopLiveView(preserveRequest = true)
    return try {
      val result = executor.submit<Map<String, Any?>> {
      val activeTransport = transport ?: throw SonyPtpException("Sony camera is not connected.")
      updateState("capturing", "Capturing on Sony A7 III…")
      activeTransport.captureStill()
      val jpeg = activeTransport.awaitCapturedJpeg(35_000)
      val payload = persistCapturedJpeg(jpeg)
      updateState("ready", "Photo transferred from Sony A7 III.")
      payload
      }.get(45, TimeUnit.SECONDS)
      if (resumeStream) startLiveView()
      result
    } catch (error: Throwable) {
      fail(error.cause ?: error)
      throw error.cause ?: error
    }
  }

  fun disconnectBlocking(preserveLiveViewRequest: Boolean = false): Map<String, Any?> {
    stopLiveView(preserveRequest = preserveLiveViewRequest)
    val old = transport
    transport = null
    runCatching { old?.close() }
    device = findSonyPtpDevice()
    return updateState("disconnected", "Sony camera disconnected.")
  }

  private fun persistCapturedJpeg(jpeg: ByteArray): Map<String, Any?> {
    val bitmap = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size)
      ?: throw SonyPtpException("Sony returned an unreadable image.")
    val name = "listingos-sony-${System.currentTimeMillis()}.jpg"
    val output = File(context.cacheDir, name)
    FileOutputStream(output).use { it.write(jpeg) }
    val payload = mapOf(
      "uri" to Uri.fromFile(output).toString(),
      "width" to bitmap.width,
      "height" to bitmap.height,
      "fileName" to name,
      "mimeType" to "image/jpeg",
    )
    bitmap.recycle()
    listeners.forEach { it.onPhotoCaptured(payload) }
    trace("captured JPEG persisted bytes=${jpeg.size}")
    return payload
  }

  fun close() {
    disconnectBlocking()
    runCatching { context.unregisterReceiver(usbReceiver) }
    executor.shutdownNow()
  }

  private fun requestPermission(attached: UsbDevice) {
    if (!permissionRequestPending.compareAndSet(false, true)) {
      trace("USB permission request coalesced")
      return
    }
    trace("requesting Android USB permission ${describeDevice(attached)}")
    updateState("permission_required", "Allow ListingOS to use the attached Sony camera.")
    val intent = Intent(permissionAction).setPackage(context.packageName)
    val pending = PendingIntent.getBroadcast(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
    )
    usbManager.requestPermission(attached, pending)
  }

  private fun fail(error: Throwable) {
    trace("failure ${error::class.java.simpleName}: ${error.message ?: "no message"}")
    streaming.set(false)
    runCatching { transport?.close() }
    transport = null
    updateState("error", error.message ?: "Sony camera connection failed.")
  }

  private fun updateState(next: String, nextMessage: String?): Map<String, Any?> {
    state = next
    message = nextMessage
    trace("state=$next message=${nextMessage ?: "none"}")
    val payload = statePayload()
    listeners.forEach { it.onStateChanged(payload) }
    return payload
  }

  private fun findSonyPtpDevice(): UsbDevice? = usbManager.deviceList.values.firstOrNull(::isSonyPtp)

  private fun isSonyPtp(candidate: UsbDevice): Boolean {
    if (candidate.vendorId != SONY_VENDOR_ID) return false
    return (0 until candidate.interfaceCount).any { index -> candidate.getInterface(index).interfaceClass == 6 }
  }

  private fun payloadFor(state: String, message: String?, attached: UsbDevice?): Map<String, Any?> {
    val result = linkedMapOf<String, Any?>("state" to state)
    if (message != null) result["message"] = message
    result["diagnostics"] = diagnosticSnapshot()
    if (attached != null) {
      result["device"] = mapOf(
        "vendorId" to attached.vendorId,
        "productId" to attached.productId,
        "deviceName" to attached.deviceName,
        "manufacturerName" to runCatching { attached.manufacturerName }.getOrNull(),
        "productName" to runCatching { attached.productName }.getOrNull(),
        "model" to "Sony A7 III",
        "protocol" to "sony_camera_control_ptp2",
      )
    }
    return result
  }

  private fun trace(event: String) {
    val now = System.currentTimeMillis()
    val entry = String.format(Locale.US, "%1\$tT.%1\$tL %2\$s", now, event)
    Log.i(TAG, entry)
    synchronized(diagnostics) {
      diagnostics.addLast(entry)
      while (diagnostics.size > MAX_DIAGNOSTICS) diagnostics.removeFirst()
      diagnosticsPreferences.edit().putString(DIAGNOSTICS_KEY, diagnostics.joinToString("\n")).apply()
    }
  }

  private fun diagnosticSnapshot(): List<String> = synchronized(diagnostics) { diagnostics.toList() }

  private fun describeDevice(candidate: UsbDevice): String {
    val interfaces = (0 until candidate.interfaceCount).joinToString(",") { index ->
      val usbInterface = candidate.getInterface(index)
      "${usbInterface.interfaceClass}/${usbInterface.interfaceSubclass}/${usbInterface.interfaceProtocol}:ep${usbInterface.endpointCount}"
    }
    return "%04x:%04x interfaces=[%s]".format(candidate.vendorId, candidate.productId, interfaces)
  }
}

private fun Intent.usbDevice(): UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
  getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
} else {
  @Suppress("DEPRECATION")
  getParcelableExtra(UsbManager.EXTRA_DEVICE)
}
