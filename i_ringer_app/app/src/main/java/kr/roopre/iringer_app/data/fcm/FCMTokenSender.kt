package kr.roopre.iringer_app.data.fcm

import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.google.gson.JsonObject
import kr.roopre.iringer_app.data.manager.UserManager
import kr.roopre.iringer_app.di.totalProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object FCMTokenSender {
    private const val TAG = "FCMTokenSender"

    /**
     * FCM 토큰을 서버에 전송한다.
     * UserManager에 로그인된 userId가 있어야 동작한다.
     */
    fun sendTokenToServer() {
        val userId = UserManager.userId ?: run {
            Log.d(TAG, "userId 없음, 토큰 전송 스킵")
            return
        }

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                Log.d(TAG, "FCM 토큰 획득 성공, 서버 전송 시작")
                sendToken(userId, token)
            } else {
                Log.e(TAG, "FCM 토큰 획득 실패", task.exception)
            }
        }
    }

    /**
     * 로그아웃 시 서버의 FCM 토큰을 null로 초기화한다.
     * onComplete 콜백으로 완료 후 로그아웃 처리를 이어갈 수 있다.
     */
    fun clearTokenOnServer(onComplete: () -> Unit = {}) {
        val userId = UserManager.userId ?: run {
            Log.d(TAG, "userId 없음, 토큰 클리어 스킵")
            onComplete()
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val body = JsonObject().apply {
                    addProperty("fcm_token", "")
                }
                val response = totalProvider.userApi.updateUser(userId, body)
                if (response.isSuccessful) {
                    Log.d(TAG, "FCM 토큰 서버 클리어 성공")
                } else {
                    Log.e(TAG, "FCM 토큰 서버 클리어 실패: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "FCM 토큰 서버 클리어 에러", e)
            } finally {
                CoroutineScope(Dispatchers.Main).launch {
                    onComplete()
                }
            }
        }
    }

    /**
     * 이미 토큰 문자열을 알고 있을 때 직접 서버에 전송한다.
     */
    fun sendToken(userId: Int, token: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val body = JsonObject().apply {
                    addProperty("fcm_token", token)
                }
                val response = totalProvider.userApi.updateUser(userId, body)
                if (response.isSuccessful) {
                    Log.d(TAG, "FCM 토큰 서버 전송 성공")
                } else {
                    Log.e(TAG, "FCM 토큰 서버 전송 실패: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "FCM 토큰 서버 전송 에러", e)
            }
        }
    }
}
