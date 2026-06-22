package kr.roopre.iringer_app.presentation.main

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

private const val TAG = "CameraQrPreview"

@Composable
fun CameraQrPreview(
    onBarcodeDetected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                    PackageManager.PERMISSION_GRANTED
        )
    }

    var permissionDenied by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) permissionDenied = true
    }

    // 권한 요청
    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        when {
            permissionDenied -> {
                Text(
                    text = "카메라 권한이 필요합니다.\n설정에서 권한을 허용해주세요.",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
            hasCameraPermission -> {
                // 중복 감지 방지 플래그
                val isProcessing = remember { mutableStateOf(false) }
                val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
                val cameraProviderRef = remember { mutableStateOf<ProcessCameraProvider?>(null) }

                DisposableEffect(Unit) {
                    onDispose {
                        cameraProviderRef.value?.unbindAll()
                        cameraExecutor.shutdown()
                    }
                }

                // 카메라 프리뷰
                AndroidView(
                    factory = { ctx ->
                        val previewView = PreviewView(ctx)

                        val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                        cameraProviderFuture.addListener({
                            val cameraProvider = cameraProviderFuture.get()
                            cameraProviderRef.value = cameraProvider

                            val preview = Preview.Builder()
                                .build()
                                .also {
                                    it.setSurfaceProvider(previewView.surfaceProvider)
                                }

                            val imageAnalysis = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                                .also {
                                    it.setAnalyzer(cameraExecutor) { imageProxy ->
                                        processImage(imageProxy, isProcessing) { barcode ->
                                            onBarcodeDetected(barcode)
                                        }
                                    }
                                }

                            try {
                                cameraProvider.unbindAll()
                                cameraProvider.bindToLifecycle(
                                    lifecycleOwner,
                                    CameraSelector.DEFAULT_BACK_CAMERA,
                                    preview,
                                    imageAnalysis
                                )
                            } catch (e: Exception) {
                                Log.e(TAG, "카메라 바인딩 실패", e)
                            }
                        }, ContextCompat.getMainExecutor(ctx))

                        previewView
                    },
                    modifier = Modifier.fillMaxSize()
                )

                // 오버레이는 외부 ScanOverlay()에서 처리
            }
            else -> {
                Text(
                    text = "카메라 권한 요청 중...",
                    color = Color.White,
                    fontSize = 14.sp
                )
            }
        }
    }
}

@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
private fun processImage(
    imageProxy: ImageProxy,
    isProcessing: MutableState<Boolean>,
    onBarcodeDetected: (String) -> Unit
) {
    if (isProcessing.value) {
        imageProxy.close()
        return
    }

    val mediaImage = imageProxy.image
    if (mediaImage == null) {
        imageProxy.close()
        return
    }

    isProcessing.value = true

    val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
    val scanner = BarcodeScanning.getClient()

    scanner.process(inputImage)
        .addOnSuccessListener { barcodes ->
            for (barcode in barcodes) {
                // QR에는 ID만 포함되므로 UTF-8로 충분 (한글은 서버 API에서 가져옴)
                val value = barcode.rawBytes?.let { rawBytes ->
                    try { String(rawBytes, Charsets.UTF_8).trimEnd('\u0000') } catch (_: Exception) { null }
                } ?: barcode.rawValue

                if (!value.isNullOrEmpty()) {
                    Log.d(TAG, "QR 코드 감지: ${value.take(200)}")
                    onBarcodeDetected(value)
                    return@addOnSuccessListener
                }
            }
            isProcessing.value = false
        }
        .addOnFailureListener { e ->
            Log.e(TAG, "바코드 스캔 실패", e)
            isProcessing.value = false
        }
        .addOnCompleteListener {
            imageProxy.close()
        }
}
