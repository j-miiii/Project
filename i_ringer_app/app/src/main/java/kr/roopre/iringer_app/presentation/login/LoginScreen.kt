package kr.roopre.iringer_app.presentation.login

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.imePadding
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.ui.theme.AppColors
import android.widget.Toast

@Composable
fun LoginScreen(
    modifier: Modifier = Modifier,
    onLoginSuccess: () -> Unit = {},
    viewModel: LoginViewModel
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var autoLogin by remember { mutableStateOf(false) }

    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val scrollState = rememberScrollState()
    val passwordFocusRequester = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current

    // 저장된 로그인 정보 불러오기
    LaunchedEffect(Unit) {
        val savedUserId = viewModel.getSavedUserId()
        val savedPassword = viewModel.getSavedPassword()

        if (savedUserId.isNotEmpty()) {
            username = savedUserId
        }
        if (savedPassword.isNotEmpty()) {
            password = savedPassword
        }
    }

    // 로그인 상태 관찰
    LaunchedEffect(uiState) {
        when (val state = uiState) {
            is LoginUiState.Success -> {
                Toast.makeText(context, state.message, Toast.LENGTH_SHORT).show()
                onLoginSuccess()
            }
            is LoginUiState.Error -> {
                Toast.makeText(context, state.message, Toast.LENGTH_SHORT).show()
            }
            else -> {
                // Idle 또는 Loading
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.White)
            .imePadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 32.dp)
                .padding(top = 60.dp, bottom = 80.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top
        ) {
            // 로고 이미지
            Image(
                painter = painterResource(id = R.drawable.main_logo),
                contentDescription = "iRinger 로고",
                modifier = Modifier.size(80.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // iRinger 텍스트
            Text(
                text = "iRinger",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF2C3E50)
            )

            Spacer(modifier = Modifier.height(32.dp))

            // User ID 레이블
            Text(
                text = "User ID",
                fontSize = 18.sp,
                fontWeight = FontWeight.Normal,
                color = Color(0xFF2C2C3C),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 4.dp)
            )

            // User ID 입력 필드
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(45.dp)
                    .background(Color(0xFFF5F5F5), RoundedCornerShape(12.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_user),
                        contentDescription = "사용자 아이콘",
                        tint = Color(0xFF9E9E9E),
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    BasicTextField(
                        value = username,
                        onValueChange = { username = it },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = LocalTextStyle.current.copy(
                            fontSize = 12.sp,
                            color = Color.Black
                        ),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = {
                                passwordFocusRequester.requestFocus()
                            }
                        ),
                        decorationBox = { innerTextField ->
                            if (username.isEmpty()) {
                                Text(
                                    "아이디를 입력하세요",
                                    color = Color(0xFFBDBDBD),
                                    fontSize = 12.sp
                                )
                            }
                            innerTextField()
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Password 레이블
            Text(
                text = "Password",
                fontSize = 18.sp,
                fontWeight = FontWeight.Normal,
                color = Color(0xFF2C2C3C),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 4.dp)
            )

            // Password 입력 필드
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(45.dp)
                    .background(Color(0xFFF5F5F5), RoundedCornerShape(12.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_password),
                        contentDescription = "비밀번호 아이콘",
                        tint = Color(0xFF9E9E9E),
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    BasicTextField(
                        value = password,
                        onValueChange = { password = it },
                        modifier = Modifier
                            .weight(1f)
                            .focusRequester(passwordFocusRequester),
                        textStyle = LocalTextStyle.current.copy(
                            fontSize = 12.sp,
                            color = Color.Black
                        ),
                        singleLine = true,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                if (username.isNotEmpty() && password.isNotEmpty()) {
                                    viewModel.login(username, password, autoLogin)
                                }
                            }
                        ),
                        decorationBox = { innerTextField ->
                            if (password.isEmpty()) {
                                Text(
                                    "비밀번호를 입력하세요",
                                    color = Color(0xFFBDBDBD),
                                    fontSize = 12.sp
                                )
                            }
                            innerTextField()
                        }
                    )
                    IconButton(
                        onClick = { passwordVisible = !passwordVisible },
                        modifier = Modifier.size(20.dp)
                    ) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                            contentDescription = if (passwordVisible) "비밀번호 숨기기" else "비밀번호 보기",
                            tint = Color(0xFF9E9E9E),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 자동 로그인 체크박스
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
                    .clickable { autoLogin = !autoLogin },
                verticalAlignment = Alignment.CenterVertically
            ) {
                // 커스텀 원형 체크박스
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(
                            brush = if (autoLogin) {
                                Brush.horizontalGradient(
                                    colors = listOf(
                                        Color(0xFF7CCAF1),
                                        Color(0xFF0058E6)
                                    )
                                )
                            } else {
                                Brush.horizontalGradient(
                                    colors = listOf(
                                        Color.White,
                                        Color.White
                                    )
                                )
                            }
                        )
                        .then(
                            if (!autoLogin) {
                                Modifier.border(1.dp, Color(0xFF9E9E9E), CircleShape)
                            } else {
                                Modifier
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = if (autoLogin) "체크됨" else "체크 안됨",
                        tint = if (autoLogin) Color.White else Color(0xFF9E9E9E),
                        modifier = Modifier.size(16.dp)
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "자동 로그인",
                    fontSize = 14.sp,
                    color = if (autoLogin) AppColors.ButtonPrimary else Color(0xFF757575),
                    fontWeight = if (autoLogin) FontWeight.Bold else FontWeight.Normal
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // 로그인 버튼
            val isLoginEnabled = username.isNotEmpty() && password.isNotEmpty() && uiState !is LoginUiState.Loading
            val gradientBrush = Brush.horizontalGradient(
                colors = listOf(
                    Color(0xFF7CCAF1),
                    Color(0xFF0058E6)
                )
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(45.dp)
                    .shadow(
                        elevation = if (isLoginEnabled) 20.dp else 0.dp,
                        shape = RoundedCornerShape(28.dp),
                        ambientColor = if (isLoginEnabled) Color(0xFF3B8FC7) else Color.Transparent,
                        spotColor = if (isLoginEnabled) Color(0xFF0058E6) else Color.Transparent
                    )
                    .background(
                        brush = if (isLoginEnabled) {
                            gradientBrush
                        } else {
                            Brush.horizontalGradient(
                                colors = listOf(
                                    Color(0xFF7CCAF1).copy(alpha = 0.2f),
                                    Color(0xFF0058E6).copy(alpha = 0.2f)
                                )
                            )
                        },
                        shape = RoundedCornerShape(28.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                TextButton(
                    onClick = {
                        if (isLoginEnabled) {
                            viewModel.login(username, password, autoLogin)
                        }
                    },
                    modifier = Modifier.fillMaxSize(),
                    enabled = isLoginEnabled
                ) {
                    if (uiState is LoginUiState.Loading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    } else {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_login),
                                contentDescription = "로그인 아이콘",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "로그인",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color.White
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // 저작권 표시
            Text(
                text = "\u00a9 2025 iRinger. All rights reserved.",
                fontSize = 12.sp,
                color = Color(0xFFBDBDBD),
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
fun LoginScreenPreview() {
    // Preview는 실제 앱 실행 시에만 작동
}
