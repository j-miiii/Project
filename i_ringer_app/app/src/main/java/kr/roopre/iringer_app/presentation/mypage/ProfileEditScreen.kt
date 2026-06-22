package kr.roopre.iringer_app.presentation.mypage

import android.util.Log
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import kr.roopre.iringer_app.data.manager.UserManager
import kr.roopre.iringer_app.di.totalProvider
import kr.roopre.iringer_app.ui.theme.AppColors
import kotlinx.coroutines.launch

private const val TAG = "ProfileEdit"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileEditScreen(
    onBack: () -> Unit
) {
    val user = UserManager.currentUser ?: return
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val api = totalProvider.userApi

    // 편집 가능 필드
    var name by remember { mutableStateOf(user.nickname) }

    // 병원 정보 (표시만)
    var hospitalName by remember { mutableStateOf("") }
    var isLoadingHospital by remember { mutableStateOf(true) }

    // 병동 정보 (드랍다운 변경 가능)
    var wardList by remember { mutableStateOf<List<Pair<Int, String>>>(emptyList()) }
    var selectedWardId by remember { mutableIntStateOf(user.ward_id) }
    var selectedWardName by remember { mutableStateOf("") }
    var isLoadingWards by remember { mutableStateOf(true) }
    var wardDropdownExpanded by remember { mutableStateOf(false) }

    // 사번 (표시만)
    val employeeNumber = user.employee_number?.ifEmpty { null }

    // 저장 상태
    var isSaving by remember { mutableStateOf(false) }

    // 병원 이름 로드
    LaunchedEffect(Unit) {
        try {
            val response = api.getById("hospitals", user.hospital_id)
            if (response.isSuccessful) {
                val body = response.body()
                hospitalName = body?.get("name")?.asString ?: ""
            }
        } catch (e: Exception) {
            Log.e(TAG, "병원 정보 로드 실패", e)
        }
        isLoadingHospital = false
    }

    // 병동 목록 로드
    LaunchedEffect(Unit) {
        try {
            val response = api.getList(
                tableName = "wards",
                where = "hospital_id:${user.hospital_id}",
                limit = 100,
                order = "id:asc"
            )
            if (response.isSuccessful) {
                val body = response.body()
                val dataArray = body?.getAsJsonArray("data")
                if (dataArray != null) {
                    wardList = dataArray.map { item ->
                        val obj = item.asJsonObject
                        val id = obj.get("id").asInt
                        val wardName = obj.get("name")?.asString ?: "병동 $id"
                        id to wardName
                    }
                    // 현재 병동 이름 설정
                    selectedWardName = wardList.find { it.first == selectedWardId }?.second ?: ""
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "병동 목록 로드 실패", e)
        }
        isLoadingWards = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "프로필 수정",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = AppColors.TextOnDark
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "뒤로",
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    TextButton(
                        onClick = {
                            if (isSaving) return@TextButton
                            isSaving = true
                            scope.launch {
                                try {
                                    val data = JsonObject().apply {
                                        addProperty("nickname", name)
                                        addProperty("ward_id", selectedWardId)
                                    }
                                    val response = api.updateUser(user.id, data)
                                    if (response.isSuccessful) {
                                        // UserManager 업데이트
                                        val updatedUser = user.copy(
                                            nickname = name,
                                            ward_id = selectedWardId
                                        )
                                        UserManager.setUserData(
                                            updatedUser,
                                            UserManager.accessToken ?: "",
                                            UserManager.refreshToken ?: ""
                                        )
                                        Toast.makeText(context, "저장되었습니다.", Toast.LENGTH_SHORT).show()
                                        onBack()
                                    } else {
                                        Toast.makeText(context, "저장에 실패했습니다.", Toast.LENGTH_SHORT).show()
                                    }
                                } catch (e: Exception) {
                                    Log.e(TAG, "프로필 저장 실패", e)
                                    Toast.makeText(context, "저장에 실패했습니다.", Toast.LENGTH_SHORT).show()
                                }
                                isSaving = false
                            }
                        },
                        enabled = !isSaving
                    ) {
                        Text(
                            text = if (isSaving) "저장 중..." else "저장",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isSaving) Color(0xFF94A3B8) else Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppColors.AppBarBg
                )
            )
        },
        containerColor = AppColors.PageBg
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // 이름
            ProfileField(label = "이름") {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AppColors.ButtonPrimary,
                        unfocusedBorderColor = AppColors.InputBorder,
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White
                    ),
                    textStyle = LocalTextStyle.current.copy(
                        fontSize = 15.sp,
                        color = AppColors.TextPrimary
                    )
                )
            }

            // 소속 병원 (표시만)
            ProfileField(label = "소속 병원") {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF1F5F9), RoundedCornerShape(10.dp))
                        .border(1.dp, AppColors.InputBorderDisabled, RoundedCornerShape(10.dp))
                        .padding(horizontal = 16.dp, vertical = 14.dp)
                ) {
                    Text(
                        text = if (isLoadingHospital) "로딩 중..." else hospitalName.ifEmpty { "-" },
                        fontSize = 15.sp,
                        color = AppColors.TextSecondary
                    )
                }
            }

            // 소속 병동 (드랍다운 변경 가능)
            ProfileField(label = "소속 병동") {
                Box {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White, RoundedCornerShape(10.dp))
                            .border(1.dp, AppColors.InputBorder, RoundedCornerShape(10.dp))
                            .clickable(enabled = !isLoadingWards) {
                                wardDropdownExpanded = true
                            }
                            .padding(horizontal = 16.dp, vertical = 14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isLoadingWards) "로딩 중..." else selectedWardName.ifEmpty { "병동 선택" },
                                fontSize = 15.sp,
                                color = if (selectedWardName.isNotEmpty()) AppColors.TextPrimary else AppColors.PlaceholderText,
                                modifier = Modifier.weight(1f)
                            )
                            Icon(
                                imageVector = Icons.Default.KeyboardArrowDown,
                                contentDescription = null,
                                tint = AppColors.IconDefault,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = wardDropdownExpanded,
                        onDismissRequest = { wardDropdownExpanded = false },
                        modifier = Modifier
                            .fillMaxWidth(0.85f)
                            .background(Color.White)
                    ) {
                        wardList.forEach { (wardId, wardName) ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = wardName,
                                        fontSize = 15.sp,
                                        fontWeight = if (wardId == selectedWardId) FontWeight.Bold else FontWeight.Normal,
                                        color = if (wardId == selectedWardId) AppColors.ButtonPrimary else AppColors.TextPrimary
                                    )
                                },
                                onClick = {
                                    selectedWardId = wardId
                                    selectedWardName = wardName
                                    wardDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            // 사번 (표시만)
            ProfileField(label = "사번") {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF1F5F9), RoundedCornerShape(10.dp))
                        .border(1.dp, AppColors.InputBorderDisabled, RoundedCornerShape(10.dp))
                        .padding(horizontal = 16.dp, vertical = 14.dp)
                ) {
                    Text(
                        text = employeeNumber ?: "-",
                        fontSize = 15.sp,
                        color = AppColors.TextSecondary
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileField(
    label: String,
    content: @Composable () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = AppColors.FormLabel
        )
        content()
    }
}
