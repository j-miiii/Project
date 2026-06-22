package kr.roopre.iringer_app.data.mqtt

import kr.roopre.iringer_app.BuildConfig

object MqttConfig {
    val BROKER_URL: String = BuildConfig.MQTT_BROKER_URL

    const val QOS = 1
    const val KEEP_ALIVE_INTERVAL = 60      // seconds
    const val CONNECTION_TIMEOUT = 30        // seconds
    const val RECONNECT_DELAY_MS = 5000L     // 5 seconds
    const val CLEAN_SESSION = true
}
