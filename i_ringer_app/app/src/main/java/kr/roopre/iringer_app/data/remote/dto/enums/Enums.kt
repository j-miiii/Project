package kr.roopre.iringer_app.data.remote.dto.enums

import com.google.gson.annotations.SerializedName

enum class AlertType(val value: String) {
    @SerializedName("stop") STOP("stop"),
    @SerializedName("done") DONE("done"),
    @SerializedName("fast") FAST("fast"),
    @SerializedName("slow") SLOW("slow"),
    @SerializedName("almost_done") ALMOST_DONE("almost_done"),
    @SerializedName("disconnected") DISCONNECTED("disconnected")
}

enum class AlertCategory(val value: String) {
    @SerializedName("critical") CRITICAL("critical"),
    @SerializedName("caution") CAUTION("caution"),
    @SerializedName("system_error") SYSTEM_ERROR("system_error")
}

enum class InfusionStatus(val value: String) {
    @SerializedName("pending") PENDING("pending"),
    @SerializedName("infusing") INFUSING("infusing"),
    @SerializedName("paused") PAUSED("paused"),
    @SerializedName("completed") COMPLETED("completed"),
    @SerializedName("canceled") CANCELED("canceled")
}

enum class InfusionEventType(val value: String) {
    @SerializedName("start") START("start"),
    @SerializedName("pause") PAUSE("pause"),
    @SerializedName("resume") RESUME("resume"),
    @SerializedName("complete") COMPLETE("complete"),
    @SerializedName("cancel") CANCEL("cancel"),
    @SerializedName("alert") ALERT("alert"),
    @SerializedName("modify") MODIFY("modify")
}

enum class NotificationType(val value: String) {
    @SerializedName("slow") SLOW("slow"),
    @SerializedName("fast") FAST("fast"),
    @SerializedName("almost_done") ALMOST_DONE("almost_done"),
    @SerializedName("stop") STOP("stop"),
    @SerializedName("done") DONE("done"),
    @SerializedName("disconnected") DISCONNECTED("disconnected")
}

enum class TermType(val value: String) {
    @SerializedName("privacy") PRIVACY("privacy"),
    @SerializedName("service") SERVICE("service"),
    @SerializedName("marketing") MARKETING("marketing"),
    @SerializedName("location") LOCATION("location")
}
