package kr.roopre.iringer_app.presentation.common

object FormatUtils {

    fun formatGender(gender: String?): String {
        return when (gender) {
            "male", "M" -> "M"
            "female", "F" -> "F"
            else -> ""
        }
    }

    fun formatGenderAge(gender: String?, age: Int?): String {
        val genderText = formatGender(gender)
        val ageText = age?.toString() ?: ""
        return if (genderText.isNotEmpty() && ageText.isNotEmpty()) {
            "$genderText / $ageText"
        } else {
            genderText + ageText
        }
    }
}
