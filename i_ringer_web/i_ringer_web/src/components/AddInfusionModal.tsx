import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  Dialog,
  CircularProgress,
  Paper,
  Divider,
  ClickAwayListener,
  InputAdornment,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { dataProvider } from '../providers/dataProvider'

interface InfusionOption {
  id: number
  code: string
  name: string
  default_volume: number | null
  default_gtt: number | null  // legacy, unused
  default_cchr: number | null
  is_active: number
}

interface AddInfusionModalProps {
  open: boolean
  onClose: () => void
  patientId: number
  patientName: string
  bedId: number
  bedNumber: string
  roomNumber: string
  currentAssignmentCount: number
  onSuccess: () => void
}

const AddInfusionModal: React.FC<AddInfusionModalProps> = ({
  open,
  onClose,
  patientId,
  patientName,
  bedId,
  bedNumber,
  roomNumber,
  currentAssignmentCount,
  onSuccess,
}) => {
  const { isDarkMode } = useTheme()
  const [loading, setLoading] = useState(false)
  const [infusionOptions, setInfusionOptions] = useState<InfusionOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [formData, setFormData] = useState({
    infusion_id: 0,
    infusion_total_volume: '500',
    infusion_cchr: '200',
  })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownAnchorRef = useRef<HTMLDivElement>(null)

  // 서버에서 수액 종류 목록 조회
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const fetchInfusions = async () => {
      setOptionsLoading(true)
      try {
        const result = await dataProvider.getList<InfusionOption>('infusions', { limit: 100, filter: { is_active: 1 }, order: 'display_order:asc' })
        if (!cancelled && result.data) {
          const list = Array.isArray(result.data) ? result.data : []
          setInfusionOptions(list)
          if (list.length > 0) {
            setFormData(prev => ({
              ...prev,
              infusion_id: list[0].id,
              infusion_total_volume: (list[0].default_volume ?? 500).toString(),
              infusion_cchr: (list[0].default_cchr ?? 200).toString(),
            }))
          }
        }
      } catch (error) {
        console.error('수액 종류 조회 실패:', error)
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    }

    fetchInfusions()
    return () => { cancelled = true }
  }, [open])

  const selectedInfusion = infusionOptions.find(o => o.id === formData.infusion_id)

  const filteredOptions = searchQuery.trim()
    ? infusionOptions.filter(o =>
        o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : infusionOptions

  const handleDropdownOpen = () => {
    setSearchQuery('')
    setDropdownOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }

  const isFormValid =
    !!selectedInfusion &&
    formData.infusion_total_volume.trim() !== '' &&
    parseInt(formData.infusion_total_volume) > 0

  const handleInfusionChange = (id: number) => {
    const option = infusionOptions.find(o => o.id === id)
    setFormData({
      infusion_id: id,
      infusion_total_volume: (option?.default_volume ?? 500).toString(),
      infusion_cchr: (option?.default_cchr ?? 200).toString(),
    })
  }

  const handleSubmit = async () => {
    if (!isFormValid || !selectedInfusion || loading) return

    setLoading(true)
    try {
      await dataProvider.addInfusion({
        patient_id: patientId,
        bed_id: bedId,
        infusion_type: selectedInfusion.name,
        infusion_total_volume: parseInt(formData.infusion_total_volume),
        infusion_code: selectedInfusion.code,
        infusion_cchr: formData.infusion_cchr ? parseInt(formData.infusion_cchr) : 200,
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('수액 추가 실패:', error)
      alert(error.message || '수액 추가에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const textFieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
      height: '45px',
      '& fieldset': {
        borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
        borderWidth: '1px',
      },
      '& input': {
        fontSize: '16px',
        color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
        '&::placeholder': {
          color: isDarkMode ? colors.gray.gray600 : '#ADAEBC',
          opacity: 1,
        },
      },
    },
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          padding: 0,
          maxWidth: '480px',
          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
        },
      }}
    >
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '24px', fontWeight: 700, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800 }}>
            수액 추가
          </Typography>
          <Typography sx={{ fontSize: '14px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray500, mt: 0.5 }}>
            {roomNumber}호 {bedNumber}번 침상 - {patientName} ({currentAssignmentCount}/3)
          </Typography>
        </Box>

        {/* Form */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* 수액 종류 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              수액 종류 *
            </Typography>
            <Box sx={{ position: 'relative' }} ref={dropdownAnchorRef}>
              {optionsLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '45px' }}>
                  <CircularProgress size={20} />
                </Box>
              ) : (
                <>
                  <Box
                    onClick={handleDropdownOpen}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: '45px',
                      px: 1.5,
                      borderRadius: '12px',
                      border: `1px solid ${isDarkMode ? colors.gray.gray700 : colors.gray.gray300}`,
                      bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: isDarkMode ? colors.gray.gray500 : colors.gray.gray500,
                      },
                    }}
                  >
                    <Typography sx={{
                      fontSize: '16px',
                      color: selectedInfusion
                        ? (isDarkMode ? colors.gray.gray100 : colors.gray.gray800)
                        : (isDarkMode ? colors.gray.gray600 : '#ADAEBC'),
                    }}>
                      {selectedInfusion ? `${selectedInfusion.name} (${selectedInfusion.code})` : '수액 종류를 선택하세요'}
                    </Typography>
                    <KeyboardArrowDownIcon sx={{
                      color: isDarkMode ? colors.gray.gray400 : colors.gray.gray500,
                      transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }} />
                  </Box>

                  {dropdownOpen && (
                    <ClickAwayListener onClickAway={() => setDropdownOpen(false)}>
                      <Paper sx={{
                        position: 'absolute',
                        top: '48px',
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        maxHeight: '280px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '12px',
                        border: `1px solid ${isDarkMode ? colors.gray.gray700 : colors.gray.gray300}`,
                        bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}>
                        <Box sx={{ p: 1 }}>
                          <TextField
                            inputRef={searchInputRef}
                            fullWidth
                            size="small"
                            placeholder="검색"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon sx={{ fontSize: 18, color: isDarkMode ? colors.gray.gray500 : colors.gray.gray400 }} />
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '8px',
                                height: '36px',
                                fontSize: '14px',
                                bgcolor: isDarkMode ? colors.gray.gray1000 : colors.gray.gray100,
                                '& fieldset': { borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray200 },
                                '& input': {
                                  color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                                  '&::placeholder': { color: isDarkMode ? colors.gray.gray600 : '#ADAEBC', opacity: 1 },
                                },
                              },
                            }}
                          />
                        </Box>
                        <Box sx={{ overflowY: 'auto', maxHeight: '220px' }}>
                          {filteredOptions.length > 0 ? filteredOptions.map((option, idx) => (
                            <React.Fragment key={option.id}>
                              {idx > 0 && <Divider sx={{ borderColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100 }} />}
                              <MenuItem
                                selected={option.id === formData.infusion_id}
                                onClick={() => {
                                  handleInfusionChange(option.id)
                                  setDropdownOpen(false)
                                }}
                                sx={{
                                  fontSize: '15px',
                                  py: 1.2,
                                  color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                                  '&:hover': { bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100 },
                                  '&.Mui-selected': {
                                    bgcolor: isDarkMode ? `${colors.mainColor.blue}20` : `${colors.mainColor.blue}0A`,
                                    '&:hover': { bgcolor: isDarkMode ? `${colors.mainColor.blue}30` : `${colors.mainColor.blue}14` },
                                  },
                                }}
                              >
                                {option.name} ({option.code})
                              </MenuItem>
                            </React.Fragment>
                          )) : (
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                              <Typography sx={{ fontSize: '14px', color: isDarkMode ? colors.gray.gray500 : colors.gray.gray400 }}>
                                검색 결과가 없습니다
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Paper>
                    </ClickAwayListener>
                  )}
                </>
              )}
            </Box>
          </Box>

          {/* 전체 용량 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              전체 용량 (ml) *
            </Typography>
            <TextField
              fullWidth
              type="number"
              placeholder="전체 용량을 입력하세요."
              value={formData.infusion_total_volume}
              onChange={(e) => setFormData({ ...formData, infusion_total_volume: e.target.value })}
              inputProps={{ min: 1 }}
              sx={textFieldSx}
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              {[250, 500, 1000].map((vol) => (
                <Button
                  key={vol}
                  variant="outlined"
                  onClick={() => setFormData({ ...formData, infusion_total_volume: vol.toString() })}
                  sx={{
                    flex: 1,
                    height: '36px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    textTransform: 'none',
                    borderColor: formData.infusion_total_volume === vol.toString()
                      ? colors.mainColor.blue
                      : (isDarkMode ? colors.gray.gray700 : colors.gray.gray300),
                    color: formData.infusion_total_volume === vol.toString()
                      ? colors.mainColor.blue
                      : (isDarkMode ? colors.gray.gray300 : colors.gray.gray600),
                    bgcolor: formData.infusion_total_volume === vol.toString()
                      ? (isDarkMode ? `${colors.mainColor.blue}20` : `${colors.mainColor.blue}0A`)
                      : 'transparent',
                    '&:hover': {
                      borderColor: colors.mainColor.blue,
                      bgcolor: isDarkMode ? `${colors.mainColor.blue}15` : `${colors.mainColor.blue}08`,
                    },
                  }}
                >
                  {vol}
                </Button>
              ))}
            </Box>
          </Box>

          {/* 처방속도 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              처방속도 (cc/hr)
            </Typography>
            <TextField
              fullWidth
              type="number"
              placeholder="기본값: 200"
              value={formData.infusion_cchr}
              onChange={(e) => setFormData({ ...formData, infusion_cchr: e.target.value })}
              inputProps={{ min: 1 }}
              sx={textFieldSx}
            />
          </Box>
        </Box>

        {/* Footer Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'flex-end' }}>
          <Button
            onClick={onClose}
            disabled={loading}
            sx={{
              bgcolor: colors.gray.gray200,
              color: isDarkMode ? colors.gray.gray800 : colors.gray.gray700,
              fontSize: '16px',
              fontWeight: 600,
              height: '45px',
              px: 3,
              borderRadius: '12px',
              textTransform: 'none',
              '&:hover': { bgcolor: colors.gray.gray300 },
            }}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || loading}
            sx={{
              bgcolor: colors.mainColor.blue,
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              height: '45px',
              px: 3,
              borderRadius: '12px',
              textTransform: 'none',
              '&:hover': { bgcolor: colors.mainColor.blue, opacity: 0.9 },
              '&:disabled': {
                bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
              },
            }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : '추가'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}

export default AddInfusionModal
