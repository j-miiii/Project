package kr.roopre.iringer_app.data.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kr.roopre.iringer_app.MainActivity
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.data.manager.UserManager

class FCMService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "FCMService"
        private const val CHANNEL_ID_CRITICAL = "iringer_critical_v2"
        private const val CHANNEL_ID_CAUTION = "iringer_caution_v2"
        private const val CHANNEL_ID_SYSTEM = "iringer_system_v2"
        private const val CHANNEL_ID_DEFAULT = "iringer_default"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM 토큰 갱신: $token")
        val userId = UserManager.userId
        if (userId != null) {
            FCMTokenSender.sendToken(userId, token)
        } else {
            Log.d(TAG, "로그인 상태 아님, 토큰 전송 스킵")
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "FCM 메시지 수신: ${message.data}")

        val data = message.data
        val title = data["title"] ?: message.notification?.title ?: "알림"
        val body = data["body"] ?: message.notification?.body ?: ""
        val alertCategory = data["alert_category"] ?: "default"
        val alertType = data["alert_type"] ?: ""

        showNotification(title, body, alertCategory, alertType)
    }

    private fun showNotification(
        title: String,
        body: String,
        alertCategory: String,
        alertType: String
    ) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("alert_category", alertCategory)
            putExtra("alert_type", alertType)
        }

        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = when (alertCategory) {
            "critical" -> CHANNEL_ID_CRITICAL
            "caution" -> CHANNEL_ID_CAUTION
            "system_error" -> CHANNEL_ID_SYSTEM
            else -> CHANNEL_ID_DEFAULT
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // 이전 채널 삭제 (importance 변경을 위해)
            listOf("iringer_critical", "iringer_caution", "iringer_system").forEach {
                manager.deleteNotificationChannel(it)
            }

            val criticalChannel = NotificationChannel(
                CHANNEL_ID_CRITICAL, "위급 알림",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "수액 정지, 속도 빠름, 완료 등 위급 상황 알림"
                enableVibration(true)
            }

            val cautionChannel = NotificationChannel(
                CHANNEL_ID_CAUTION, "주의 알림",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "속도 느림, 완료 임박 등 주의 알림"
                enableVibration(true)
            }

            val systemChannel = NotificationChannel(
                CHANNEL_ID_SYSTEM, "시스템 알림",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "기기 연결 끊김 등 시스템 알림"
                enableVibration(true)
            }

            val defaultChannel = NotificationChannel(
                CHANNEL_ID_DEFAULT, "일반 알림",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply { description = "기타 일반 알림" }

            manager.createNotificationChannels(
                listOf(criticalChannel, cautionChannel, systemChannel, defaultChannel)
            )
        }
    }
}
