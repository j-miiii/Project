package kr.roopre.iringer_app.di

import kr.roopre.iringer_app.BuildConfig
import kr.roopre.iringer_app.data.remote.api.UserApi
import kr.roopre.iringer_app.data.repository.DeviceRepository
import kr.roopre.iringer_app.data.repository.MonitoringRepository
import kr.roopre.iringer_app.data.repository.NotificationRepository
import kr.roopre.iringer_app.data.repository.PatientRepository
import kr.roopre.iringer_app.data.repository.UserSettingsRepository
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object totalProvider {

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val userApi: UserApi by lazy {
        retrofit.create(UserApi::class.java)
    }

    val monitoringRepository: MonitoringRepository by lazy { MonitoringRepository(userApi) }
    val patientRepository: PatientRepository by lazy { PatientRepository(userApi) }
    val deviceRepository: DeviceRepository by lazy { DeviceRepository(userApi) }
    val notificationRepository: NotificationRepository by lazy { NotificationRepository(userApi) }
    val userSettingsRepository: UserSettingsRepository by lazy { UserSettingsRepository(userApi) }
}