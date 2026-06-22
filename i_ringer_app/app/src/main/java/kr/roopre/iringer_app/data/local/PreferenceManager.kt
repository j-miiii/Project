package kr.roopre.iringer_app.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kr.roopre.iringer_app.data.remote.dto.UserData
import com.google.gson.Gson

class PreferenceManager(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        PREF_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    private val gson = Gson()

    companion object {
        private const val PREF_NAME = "iringer_secure_prefs"
        private const val KEY_AUTO_LOGIN = "auto_login"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_PASSWORD = "password"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_DATA = "user_data"
    }

    var isAutoLoginEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUTO_LOGIN, false)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_LOGIN, value).apply()

    var savedUserId: String?
        get() = prefs.getString(KEY_USER_ID, null)
        set(value) = prefs.edit().putString(KEY_USER_ID, value).apply()

    var savedPassword: String?
        get() = prefs.getString(KEY_PASSWORD, null)
        set(value) = prefs.edit().putString(KEY_PASSWORD, value).apply()

    var accessToken: String?
        get() = prefs.getString(KEY_ACCESS_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_ACCESS_TOKEN, value).apply()

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()

    var userData: UserData?
        get() {
            val json = prefs.getString(KEY_USER_DATA, null)
            return if (json != null) {
                try {
                    gson.fromJson(json, UserData::class.java)
                } catch (e: Exception) {
                    null
                }
            } else {
                null
            }
        }
        set(value) {
            val json = if (value != null) gson.toJson(value) else null
            prefs.edit().putString(KEY_USER_DATA, json).apply()
        }

    fun saveLoginData(
        userId: String,
        password: String,
        autoLogin: Boolean,
        accessToken: String,
        refreshToken: String,
        userData: UserData
    ) {
        prefs.edit().apply {
            putBoolean(KEY_AUTO_LOGIN, autoLogin)
            putString(KEY_USER_ID, userId)
            putString(KEY_PASSWORD, password)
            putString(KEY_ACCESS_TOKEN, accessToken)
            putString(KEY_REFRESH_TOKEN, refreshToken)
            putString(KEY_USER_DATA, gson.toJson(userData))
            apply()
        }
    }

    fun clearLoginData() {
        prefs.edit().apply {
            remove(KEY_AUTO_LOGIN)
            remove(KEY_USER_ID)
            remove(KEY_PASSWORD)
            remove(KEY_ACCESS_TOKEN)
            remove(KEY_REFRESH_TOKEN)
            remove(KEY_USER_DATA)
            apply()
        }
    }
}
