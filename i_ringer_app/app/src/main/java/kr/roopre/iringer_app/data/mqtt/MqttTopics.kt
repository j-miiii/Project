package kr.roopre.iringer_app.data.mqtt

object MqttTopics {
    fun userNotification(userId: Int) = "user/$userId/notification"
    fun userAssignmentRefresh(userId: Int) = "user/$userId/assignment/refresh"
    fun bedAssignmentUpdate(bedId: Int) = "bed/$bedId/assignment/update"
}
