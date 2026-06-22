import React from 'react'
import {
  Box,
  Typography,
  Button,
  Modal
} from '@mui/material'
import QRCode from 'react-qr-code'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'

interface DeviceInfo {
  serialNumber: string
  deviceName: string
}

interface DeviceQRCodeModalProps {
  open: boolean
  onClose: () => void
  selectedDevices: DeviceInfo[]
}

const DeviceQRCodeModal: React.FC<DeviceQRCodeModalProps> = ({
  open,
  onClose,
  selectedDevices
}) => {
  const { isDarkMode } = useTheme()

  const handlePrint = () => {
    window.print()
  }

  // QR코드 개수에 따라 그리드 열 개수 결정 (최대 5개)
  const gridColumns = Math.min(selectedDevices.length, 5)

  // 모달 너비 계산: 각 QR 카드 약 200px + gap 16px + 패딩
  const getModalWidth = () => {
    if (selectedDevices.length === 0) return 500
    const cardWidth = 200
    const gap = 16
    const padding = 64 // 좌우 패딩
    const minWidth = 400 // 최소 너비
    const calculatedWidth = Math.min(selectedDevices.length, 5) * cardWidth + (Math.min(selectedDevices.length, 5) - 1) * gap + padding
    return Math.max(calculatedWidth, minWidth)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        className="qr-print-area"
        sx={{
          bgcolor: isDarkMode ? colors.gray.gray800 : 'white',
          borderRadius: '20px',
          boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)',
          p: 3,
          width: getModalWidth(),
          maxWidth: '90vw',
          outline: 'none',
        }}
      >
        {/* 제목 */}
        <Typography
          className="no-print"
          sx={{
            fontSize: '22px',
            fontWeight: 700,
            mb: 2,
            color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900,
          }}
        >
          선택한 기기 QR코드
        </Typography>

        {/* 선택한 기기 QR 코드 그리드 */}
        <Box
          sx={{
            bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray100,
            borderRadius: '12px',
            p: 3,
            mb: 2,
            maxHeight: '70vh',
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px'
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
              borderRadius: '4px',
              '&:hover': {
                bgcolor: isDarkMode ? colors.gray.gray500 : colors.gray.gray500
              }
            }
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gap: 2,
            }}
          >
            {selectedDevices.map((device, index) => (
              <Box
                key={device.serialNumber}
                className={`qr-item ${Math.floor(index / 10) > 0 ? 'page-break-before' : ''}`}
                sx={{
                  bgcolor: isDarkMode ? colors.gray.gray800 : 'white',
                  borderRadius: '12px',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                {/* 기기명 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', justifyContent: 'center' }}>
                  <Typography
                    sx={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600,
                    }}
                  >
                    기기명:
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                      fontFamily: 'monospace',
                    }}
                  >
                    {device.deviceName}
                  </Typography>
                </Box>

                {/* QR 코드 영역 */}
                <Box
                  sx={{
                    width: '100%',
                    aspectRatio: '1',
                    bgcolor: 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1.5,
                  }}
                >
                  <QRCode
                    value={`serial_number:${device.serialNumber}`}
                    size={256}
                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* 버튼 */}
        <Box className="no-print" sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button
            onClick={onClose}
            sx={{
              height: 42,
              px: 3,
              borderRadius: '21px',
              bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray200,
              color: isDarkMode ? colors.gray.gray300 : colors.gray.gray700,
              fontSize: '15px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: isDarkMode ? colors.gray.gray600 : colors.gray.gray300,
                boxShadow: 'none',
              },
            }}
          >
            취소
          </Button>
          <Button
            onClick={handlePrint}
            sx={{
              height: 42,
              px: 3,
              borderRadius: '21px',
              bgcolor: colors.mainColor.green,
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: colors.mainColor.green,
                opacity: 0.9,
                boxShadow: 'none',
              },
            }}
          >
            인쇄
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}

export default DeviceQRCodeModal
