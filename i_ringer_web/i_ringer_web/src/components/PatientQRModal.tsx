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

interface PatientQRModalProps {
  open: boolean
  onClose: () => void
  wardName: string
  roomNumber: string
  bedNumber: string
  patientInfo: { id: number; name: string; chart_number: string; gender?: string | null; age?: number | null }
  bedId: number
  assignment?: { id: number; infusion_type: string; infusion_total_volume: number; infusion_gtt: number | null; infusion_cchr?: number | null } | null
  onDelete?: (assignmentId: number) => void
  onDeletePatient?: () => Promise<void>
}

const PatientQRModal: React.FC<PatientQRModalProps> = ({
  open,
  onClose,
  wardName,
  roomNumber,
  bedNumber,
  patientInfo,
  bedId,
  assignment,
  onDelete,
  onDeletePatient,
}) => {
  const [deleteLoading, setDeleteLoading] = React.useState(false)
  const { isDarkMode } = useTheme()

  // QR에는 ID만 포함 (앱에서 스캔 후 서버에서 상세 데이터 조회)
  const qrData = assignment
    ? JSON.stringify({
        type: 'infusion',
        patient_id: patientInfo.id,
        bed_id: bedId,
        assignment_id: assignment.id,
      })
    : JSON.stringify({
        type: 'patient',
        patient_id: patientInfo.id,
        bed_id: bedId,
      })

  const title = assignment ? '수액 QR코드' : '환자 QR코드'

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
          bgcolor: isDarkMode ? colors.gray.gray800 : 'white',
          borderRadius: '20px',
          boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)',
          p: 3,
          width: 400,
          maxWidth: '90vw',
          outline: 'none',
        }}
      >
        {/* 제목 */}
        <Typography
          sx={{
            fontSize: '18px',
            fontWeight: 700,
            mb: 2,
            textAlign: 'center',
            color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900,
          }}
        >
          {title}
        </Typography>

        {/* 환자/수액 정보 */}
        <Box
          sx={{
            bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray100,
            borderRadius: '8px',
            px: 2,
            py: 1.5,
            mb: 2,
          }}
        >
          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? colors.gray.gray300 : '#64748B', mb: 0.5 }}>
            {wardName} · {roomNumber}호 · {bedNumber}번 침상
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 700, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900 }}>
              {patientInfo.name}
            </Typography>
            <Typography sx={{ fontSize: '14px', color: isDarkMode ? colors.gray.gray400 : '#64748B' }}>
              {patientInfo.gender && patientInfo.age
                ? `${patientInfo.gender}/${patientInfo.age}`
                : patientInfo.chart_number}
            </Typography>
          </Box>
          {assignment && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray700 }}>
                {assignment.infusion_type}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: isDarkMode ? colors.gray.gray400 : '#64748B' }}>
                {assignment.infusion_total_volume}ml
                {assignment.infusion_cchr != null && ` / ${Math.round(assignment.infusion_cchr)} cc/hr`}
              </Typography>
            </Box>
          )}
        </Box>

        {/* QR 코드 */}
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: '12px',
            p: 3,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <QRCode
            value={qrData}
            size={256}
            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          />
        </Box>

        {/* 버튼 영역 */}
        <Box sx={{ display: 'flex', justifyContent: (assignment && onDelete) || onDeletePatient ? 'space-between' : 'flex-end' }}>
          {assignment && onDelete && (
            <Button
              onClick={async () => {
                setDeleteLoading(true)
                try {
                  await onDelete(assignment.id)
                } finally {
                  setDeleteLoading(false)
                }
              }}
              disabled={deleteLoading}
              sx={{
                height: 36,
                px: 3,
                borderRadius: '4px',
                bgcolor: '#FEF2F2',
                color: '#EF4444',
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 'none',
                border: '1px solid #FECACA',
                '&:hover': {
                  bgcolor: '#FEE2E2',
                  boxShadow: 'none',
                },
                '&:disabled': {
                  bgcolor: '#FEF2F2',
                  color: '#FCA5A5',
                },
              }}
            >
              {deleteLoading ? '삭제중...' : '수액 삭제'}
            </Button>
          )}
          {!assignment && onDeletePatient && (
            <Button
              onClick={async () => {
                setDeleteLoading(true)
                try {
                  await onDeletePatient()
                } finally {
                  setDeleteLoading(false)
                }
              }}
              disabled={deleteLoading}
              sx={{
                height: 36,
                px: 3,
                borderRadius: '4px',
                bgcolor: '#FEF2F2',
                color: '#EF4444',
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 'none',
                border: '1px solid #FECACA',
                '&:hover': {
                  bgcolor: '#FEE2E2',
                  boxShadow: 'none',
                },
                '&:disabled': {
                  bgcolor: '#FEF2F2',
                  color: '#FCA5A5',
                },
              }}
            >
              {deleteLoading ? '삭제중...' : '환자 삭제'}
            </Button>
          )}
          <Button
            onClick={onClose}
            sx={{
              height: 36,
              px: 3,
              borderRadius: '4px',
              bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray200,
              color: isDarkMode ? colors.gray.gray300 : colors.gray.gray700,
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: isDarkMode ? colors.gray.gray600 : colors.gray.gray300,
                boxShadow: 'none',
              },
            }}
          >
            닫기
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}

export default PatientQRModal
