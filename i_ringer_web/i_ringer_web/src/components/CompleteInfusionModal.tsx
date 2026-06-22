import React from 'react'
import { Box, Typography, Button, Modal } from '@mui/material'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'

interface CompleteInfusionModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  selectedBeds: Array<{ roomNumber: string; bedNumber: string }>
}

const CompleteInfusionModal: React.FC<CompleteInfusionModalProps> = ({
  open,
  onClose,
  onConfirm,
  selectedBeds
}) => {
  const { isDarkMode } = useTheme()

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
        sx={{
          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
          borderRadius: '20px',
          boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)',
          p: 3,
          minWidth: 400,
          maxWidth: 480,
          outline: 'none',
        }}
      >
        {/* 제목 */}
        <Typography
          sx={{
            fontSize: '22px',
            fontWeight: 700,
            mb: 2,
            color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900,
          }}
        >
          투여 완료 확인
        </Typography>

        {/* 선택한 환자 정보 */}
        <Box
          sx={{
            bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
            borderRadius: '12px',
            p: 2,
            mb: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: '15px',
              fontWeight: 600,
              mb: 1.5,
              color: isDarkMode ? colors.gray.gray200 : colors.gray.gray700,
            }}
          >
            선택한 환자: 총 {selectedBeds.length}명
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: selectedBeds.length > 2 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
              gap: 1.5,
            }}
          >
            {selectedBeds.map((bed, index) => (
              <Box
                key={index}
                sx={{
                  bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                  borderRadius: '10px',
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: `${colors.mainColor.lightBlue}33`,
                    border: `2px solid ${colors.mainColor.lightBlue}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Box
                    component="img"
                    src="/icons/ic_bed.svg"
                    sx={{
                      width: 18,
                      height: 18,
                      filter: 'brightness(0) saturate(100%) invert(69%) sepia(32%) saturate(1061%) hue-rotate(168deg) brightness(96%) contrast(92%)',
                    }}
                  />
                </Box>
                <Typography
                  sx={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                  }}
                >
                  {bed.roomNumber}-{bed.bedNumber}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* 확인 메시지 */}
        <Typography
          sx={{
            fontSize: '15px',
            fontWeight: 500,
            mb: 3,
            color: isDarkMode ? colors.gray.gray300 : colors.gray.gray700,
          }}
        >
          선택한 환자의 투여를 완료 처리하시겠습니까?
        </Typography>

        {/* 버튼 */}
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button
            onClick={onClose}
            sx={{
              height: 42,
              px: 3,
              borderRadius: '12px',
              bgcolor: colors.gray.gray200,
              color: isDarkMode ? colors.gray.gray800 : colors.gray.gray700,
              fontSize: '15px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: colors.gray.gray300,
                boxShadow: 'none',
              },
            }}
          >
            취소
          </Button>
          <Button
            onClick={onConfirm}
            sx={{
              height: 42,
              px: 3,
              borderRadius: '12px',
              bgcolor: colors.mainColor.blue,
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: colors.mainColor.blue,
                opacity: 0.9,
                boxShadow: 'none',
              },
            }}
          >
            투여 완료
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}

export default CompleteInfusionModal
