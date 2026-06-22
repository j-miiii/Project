package kr.roopre.iringer_app.presentation.main

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * 하드웨어 스캐너로부터 스캔 데이터를 수신하는 BroadcastReceiver
 * Urovo, Point Mobile 등 멀티벤더 지원
 */
class ScanReceiver(
    private val onDataReceived: (String) -> Unit,
    pmScanManagerRef: Any? = null  // Point Mobile SDK ScanManager (리플렉션)
) : BroadcastReceiver() {

    // var로 외부에서 나중에 설정 가능 (SDK 감지 후 업데이트)
    var pmScanManagerRef: Any? = pmScanManagerRef

    companion object {
        private const val TAG = "ScanReceiver"

        // Urovo 스캐너 관련 상수
        const val ACTION_DECODE_DATA = "android.intent.action.DECODE_DATA"
        const val ACTION_UROVO_MESSAGE = "urovo.rcv.message"

        // Point Mobile 스캐너 관련 상수
        const val ACTION_PM_USERMSG = "device.common.USERMSG"

        // 스캔 데이터 추출 키 (여러 벤더 호환)
        const val KEY_BARCODE_STRING = "barcode_string"
        const val KEY_BARCODE_DATA = "barcode"
        const val KEY_SCAN_DATA = "data"
    }

    /**
     * 외부에서 직접 바코드 데이터를 전달 (카메라 QR 스캔 등)
     */
    fun onBarcodeScanned(barcode: String) {
        onDataReceived(barcode)
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        // Log.d(TAG, "===== onReceive 호출됨 =====")
        // Log.d(TAG, "Intent Action: ${intent?.action}")

        intent?.let {
            when (it.action) {
                // Urovo / PM Intent Broadcast 모드 / 표준 DECODE_DATA
                ACTION_DECODE_DATA, ACTION_UROVO_MESSAGE, "android.intent.ACTION_DECODE_DATA" -> {
                    val barcode = extractBarcodeData(it)
                    if (!barcode.isNullOrEmpty()) {
                        onDataReceived(barcode)
                    } else {
                        Log.w(TAG, "✗ Received scan intent but no barcode data found")
                        it.extras?.let { bundle ->
                            Log.d(TAG, "Available keys: ${bundle.keySet()}")
                            bundle.keySet().forEach { key ->
                                Log.d(TAG, "  $key: ${bundle.get(key)}")
                            }
                        }
                    }
                }

                // Point Mobile USERMSG 모드 (SDK 연동)
                ACTION_PM_USERMSG -> {
                    val barcode = extractPmResult()
                    if (!barcode.isNullOrEmpty()) {
                        Log.d(TAG, "✓ PM USERMSG 바코드 수신: ${barcode.take(50)}")
                        onDataReceived(barcode)
                    } else {
                        // USERMSG에서 못 읽으면 intent extras에서 시도
                        val fallback = extractBarcodeData(it)
                        if (!fallback.isNullOrEmpty()) {
                            onDataReceived(fallback)
                        } else {
                            Log.w(TAG, "✗ PM USERMSG: 바코드 데이터 추출 실패")
                        }
                    }
                }
            }
        }
    }

    /**
     * Point Mobile SDK의 aDecodeGetResult()를 리플렉션으로 호출하여 스캔 결과 추출
     */
    private fun extractPmResult(): String? {
        val scanner = pmScanManagerRef ?: return null
        return try {
            val decodeResultClass = Class.forName("device.common.DecodeResult")
            val decodeResult = decodeResultClass.getDeclaredConstructor().newInstance()

            // recycle() 호출
            val recycleMethod = decodeResultClass.getMethod("recycle")
            recycleMethod.invoke(decodeResult)

            // aDecodeGetResult(DecodeResult) 호출
            val scanManagerClass = scanner.javaClass
            val getResultMethod = scanManagerClass.getMethod("aDecodeGetResult", decodeResultClass)
            getResultMethod.invoke(scanner, decodeResult)

            // symName 필드로 실패 여부 확인
            val symNameField = decodeResultClass.getDeclaredField("symName")
            symNameField.isAccessible = true
            val symName = symNameField.get(decodeResult) as? String
            if (symName == "READ_FAIL" || symName.isNullOrEmpty()) return null

            // toString()으로 바코드 데이터 추출
            decodeResult.toString()
        } catch (e: Exception) {
            Log.e(TAG, "PM DecodeResult 추출 실패: ${e.message}")
            null
        }
    }

    /**
     * Intent에서 바코드 데이터를 추출
     * Urovo SDK 버전에 따라 다른 키를 사용할 수 있으므로 여러 키를 시도
     * ★ 바이트 배열을 우선 시도 (UTF-8 인코딩 직접 제어 → 한글 깨짐 방지)
     */
    private fun extractBarcodeData(intent: Intent): String? {
        // 1. 바이트 배열 우선 시도 (UTF-8 인코딩 직접 제어 가능)
        val byteArrayKeys = listOf(
            "barcode",                             // 실제 로그에서 발견됨!
            "barocode",                            // 실제 로그에서 발견됨 (오타?)
            "com.ubx.datawedge.data_raw",         // 실제 로그에서 발견됨!
            "DECODE_DATA_TAG"
        )

        for (key in byteArrayKeys) {
            val byteData = intent.getByteArrayExtra(key)
            if (byteData != null && byteData.isNotEmpty()) {
                val result = String(byteData, Charsets.UTF_8)
                Log.d(TAG, "✓ 바이트 키 '$key'에서 UTF-8 디코딩 (${byteData.size}bytes): ${result.take(50)}")
                return result
            }
        }

        // 2. 문자열로 전달되는 경우 시도
        val possibleKeys = listOf(
            "barcode_string",                      // 실제 로그에서 발견됨!
            "com.ubx.datawedge.data_string",      // 실제 로그에서 발견됨!
            KEY_BARCODE_DATA,                      // barcode
            KEY_SCAN_DATA,                         // data
            "SCAN_BARCODE1",                       // 일부 Urovo 모델
            "EXTRA_BARCODE_DATA"                   // 일부 Urovo 모델
        )

        for (key in possibleKeys) {
            val value = intent.getStringExtra(key)
            if (!value.isNullOrEmpty()) {
                // 한글이 깨진 경우 ISO-8859-1 → UTF-8 재변환 시도
                val fixed = try {
                    val bytes = value.toByteArray(Charsets.ISO_8859_1)
                    val utf8Str = String(bytes, Charsets.UTF_8)
                    // 한글이 포함되어 있으면 재변환 성공
                    if (utf8Str.contains(Regex("[가-힣]"))) {
                        Log.d(TAG, "✓ 키 '$key' 인코딩 재변환 성공: ${utf8Str.take(50)}")
                        utf8Str
                    } else {
                        value
                    }
                } catch (e: Exception) {
                    value
                }
                Log.d(TAG, "✓ 키 '$key'에서 데이터 발견: ${fixed.take(50)}")
                return fixed
            }
        }

        Log.w(TAG, "✗ 모든 키 시도 실패. 데이터를 찾을 수 없음.")
        return null
    }
}
