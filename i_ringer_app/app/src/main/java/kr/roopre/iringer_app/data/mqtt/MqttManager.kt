package kr.roopre.iringer_app.data.mqtt

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended
import org.eclipse.paho.client.mqttv3.MqttClient
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttException
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence

object MqttManager {

    private const val TAG = "MqttManager"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var client: MqttClient? = null
    private val subscribedTopics = mutableSetOf<String>()

    private val _messageFlow = MutableSharedFlow<Pair<String, String>>(extraBufferCapacity = 64)
    val messageFlow: SharedFlow<Pair<String, String>> = _messageFlow.asSharedFlow()

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    fun connect() {
        if (client?.isConnected == true) return

        scope.launch {
            try {
                val clientId = "android_" + System.currentTimeMillis().toString(16)
                val mqttClient = MqttClient(
                    MqttConfig.BROKER_URL,
                    clientId,
                    MemoryPersistence()
                )

                val options = MqttConnectOptions().apply {
                    isCleanSession = MqttConfig.CLEAN_SESSION
                    keepAliveInterval = MqttConfig.KEEP_ALIVE_INTERVAL
                    connectionTimeout = MqttConfig.CONNECTION_TIMEOUT
                    isAutomaticReconnect = true
                }

                mqttClient.setCallback(object : MqttCallbackExtended {
                    override fun connectComplete(reconnect: Boolean, serverURI: String?) {
                        _isConnected.value = true
                        if (reconnect) {
                            Log.d(TAG, "Reconnected to $serverURI")
                            // Re-subscribe all tracked topics after reconnect
                            val topics = subscribedTopics.toList()
                            topics.forEach { topic ->
                                try {
                                    mqttClient.subscribe(topic, MqttConfig.QOS)
                                    Log.d(TAG, "Re-subscribed: $topic")
                                } catch (e: MqttException) {
                                    Log.e(TAG, "Re-subscribe failed [$topic]: ${e.message}")
                                }
                            }
                        }
                    }

                    override fun connectionLost(cause: Throwable?) {
                        Log.w(TAG, "Connection lost: ${cause?.message}")
                        _isConnected.value = false
                    }

                    override fun messageArrived(topic: String, message: MqttMessage) {
                        val payload = String(message.payload)
                        Log.d(TAG, "Message [$topic]: ${payload.take(200)}")
                        _messageFlow.tryEmit(topic to payload)
                    }

                    override fun deliveryComplete(token: IMqttDeliveryToken?) {}
                })

                mqttClient.connect(options)
                client = mqttClient
                // connectComplete callback sets _isConnected
                Log.d(TAG, "Connected to ${MqttConfig.BROKER_URL}")
            } catch (e: MqttException) {
                Log.e(TAG, "Connect failed: ${e.message}")
                _isConnected.value = false
            }
        }
    }

    fun disconnect() {
        try {
            subscribedTopics.clear()
            client?.let {
                if (it.isConnected) {
                    it.disconnect()
                }
            }
            client = null
            _isConnected.value = false
            Log.d(TAG, "Disconnected")
        } catch (e: MqttException) {
            Log.e(TAG, "Disconnect failed: ${e.message}")
        }
    }

    fun subscribe(topic: String) {
        try {
            if (subscribedTopics.contains(topic)) return
            client?.let {
                if (it.isConnected) {
                    it.subscribe(topic, MqttConfig.QOS)
                    subscribedTopics.add(topic)
                    Log.d(TAG, "Subscribed: $topic")
                } else {
                    // Track for subscription when connection is restored
                    subscribedTopics.add(topic)
                }
            }
        } catch (e: MqttException) {
            Log.e(TAG, "Subscribe failed [$topic]: ${e.message}")
        }
    }

    fun unsubscribe(topic: String) {
        try {
            subscribedTopics.remove(topic)
            client?.let {
                if (it.isConnected) {
                    it.unsubscribe(topic)
                    Log.d(TAG, "Unsubscribed: $topic")
                }
            }
        } catch (e: MqttException) {
            Log.e(TAG, "Unsubscribe failed [$topic]: ${e.message}")
        }
    }

    fun unsubscribeAll() {
        val topics = subscribedTopics.toList()
        topics.forEach { unsubscribe(it) }
    }
}
