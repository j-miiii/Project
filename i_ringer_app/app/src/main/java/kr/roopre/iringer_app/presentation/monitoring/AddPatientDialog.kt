package kr.roopre.iringer_app.presentation.monitoring

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AddPatientDialog(
    roomNumber: String,
    bedNumber: String,
    bedId: Int,
    viewModel: PatientMonitoringViewModel,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var chartNumber by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("M") }
    var genderExpanded by remember { mutableStateOf(false) }
    var age by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val genderOptions = listOf("M" to "남", "F" to "여")

    Dialog(
        onDismissRequest = { if (!isSubmitting) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth(0.85f)
                .clip(RoundedCornerShape(16.dp))
                .background(Color.White)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 제목
            Text(
                text = "환자 추가",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF1F2937)
            )

            // 침상 정보
            Text(
                text = "${roomNumber}호 ${bedNumber}번 침상",
                fontSize = 14.sp,
                color = Color(0xFF6B7280)
            )

            // 환자 이름
            DialogInputField(
                label = "환자 이름",
                value = name,
                onValueChange = { name = it },
                placeholder = "이름 입력"
            )

            // 차트 번호
            DialogInputField(
                label = "차트 번호",
                value = chartNumber,
                onValueChange = { chartNumber = it },
                placeholder = "차트 번호 입력"
            )

            // 성별 (드롭다운)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "성별",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF374151)
                )
                ExposedDropdownMenuBox(
                    expanded = genderExpanded,
                    onExpandedChange = { genderExpanded = it }
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFF9FAFB))
                            .border(1.dp, Color(0xFFD1D5DB), RoundedCornerShape(8.dp))
                            .clickable { genderExpanded = true }
                            .padding(horizontal = 14.dp, vertical = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = genderOptions.first { it.first == gender }.second,
                                fontSize = 15.sp,
                                color = Color(0xFF1F2937)
                            )
                            Icon(
                                imageVector = Icons.Default.ArrowDropDown,
                                contentDescription = null,
                                tint = Color(0xFF6B7280)
                            )
                        }
                    }
                    ExposedDropdownMenu(
                        expanded = genderExpanded,
                        onDismissRequest = { genderExpanded = false }
                    ) {
                        genderOptions.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    gender = value
                                    genderExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            // 나이
            DialogInputField(
                label = "나이",
                value = age,
                onValueChange = { age = it.filter { c -> c.isDigit() } },
                placeholder = "나이 입력",
                keyboardType = KeyboardType.Number
            )

            // 에러 메시지
            if (errorMessage != null) {
                Text(
                    text = errorMessage!!,
                    fontSize = 13.sp,
                    color = MonitoringColors.CriticalText
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // 버튼
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .weight(1f)
                        .height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    enabled = !isSubmitting
                ) {
                    Text("취소", color = Color(0xFF6B7280))
                }
                Button(
                    onClick = {
                        if (name.isBlank()) {
                            errorMessage = "환자 이름을 입력해주세요."
                            return@Button
                        }
                        if (chartNumber.isBlank()) {
                            errorMessage = "차트 번호를 입력해주세요."
                            return@Button
                        }
                        if (age.isBlank()) {
                            errorMessage = "나이를 입력해주세요."
                            return@Button
                        }
                        errorMessage = null
                        isSubmitting = true
                        viewModel.addPatient(
                            name = name.trim(),
                            chartNumber = chartNumber.trim(),
                            gender = gender,
                            age = age.toInt(),
                            bedId = bedId,
                            onSuccess = {
                                isSubmitting = false
                                onSuccess()
                            },
                            onError = { msg ->
                                isSubmitting = false
                                errorMessage = msg
                            }
                        )
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(44.dp),
                    enabled = !isSubmitting,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF3B82F6),
                        disabledContainerColor = Color(0xFF93C5FD)
                    )
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(18.dp)
                        )
                    } else {
                        Text(
                            "추가",
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DialogInputField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFF374151)
        )
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(
                fontSize = 15.sp,
                color = Color(0xFF1F2937)
            ),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            cursorBrush = SolidColor(Color(0xFF3B82F6)),
            singleLine = true,
            decorationBox = { innerTextField ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFF9FAFB))
                        .border(1.dp, Color(0xFFD1D5DB), RoundedCornerShape(8.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp)
                ) {
                    if (value.isEmpty()) {
                        Text(
                            text = placeholder,
                            fontSize = 15.sp,
                            color = Color(0xFF9CA3AF)
                        )
                    }
                    innerTextField()
                }
            }
        )
    }
}
