import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Box, Typography, Divider } from '@mui/material'
import { colors } from '../styles/colors'

export interface DropdownOption {
  id: string | number
  label: string
}

interface CustomDropdownProps {
  options: DropdownOption[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  placeholder?: string
  showAllOption?: boolean
  allOptionLabel?: string
  disabled?: boolean
  isDarkMode?: boolean
  multiSelect?: boolean
  loading?: boolean
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = '선택',
  showAllOption = false,
  allOptionLabel = '전체',
  disabled = false,
  isDarkMode = false,
  multiSelect = false,
  loading = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 가장 긴 이름 기준으로 드롭다운 너비 계산
  const dropdownMinWidth = useMemo(() => {
    const allLabels = showAllOption
      ? [allOptionLabel, ...options.map(opt => opt.label)]
      : [placeholder, ...options.map(opt => opt.label)]
    const longestLabel = allLabels.reduce((a, b) => a.length > b.length ? a : b, '')
    const estimatedWidth = longestLabel.length * 16 + 64
    return Math.max(120, Math.min(250, estimatedWidth))
  }, [options, placeholder, showAllOption, allOptionLabel])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // 선택된 옵션의 라벨 찾기
  const getSelectedLabel = () => {
    if (multiSelect) {
      const selectedValues = Array.isArray(value) ? value : []
      if (selectedValues.length === 0) {
        return showAllOption ? allOptionLabel : placeholder
      }
      const selectedLabels = selectedValues
        .map(val => options.find(opt => opt.id.toString() === val)?.label)
        .filter(Boolean)
      return selectedLabels.length > 0 ? `${selectedLabels.length}개 선택` : (showAllOption ? allOptionLabel : placeholder)
    } else {
      const singleValue = Array.isArray(value) ? value[0] : value
      if (!singleValue || singleValue === '') {
        return showAllOption ? allOptionLabel : placeholder
      }
      const selected = options.find(opt => opt.id.toString() === singleValue)
      return selected ? selected.label : placeholder
    }
  }

  const handleSelect = (optionId: string) => {
    if (multiSelect) {
      const selectedValues = Array.isArray(value) ? value : []
      if (selectedValues.includes(optionId)) {
        // 이미 선택된 경우 제거
        onChange(selectedValues.filter(id => id !== optionId))
      } else {
        // 선택되지 않은 경우 추가
        onChange([...selectedValues, optionId])
      }
      // 다중 선택 모드에서는 드롭다운을 닫지 않음
    } else {
      onChange(optionId)
      setIsOpen(false)
    }
  }

  const isSelected = (optionId: string) => {
    if (multiSelect) {
      const selectedValues = Array.isArray(value) ? value : []
      return selectedValues.includes(optionId.toString())
    } else {
      const singleValue = Array.isArray(value) ? value[0] : value
      return singleValue === optionId.toString()
    }
  }

  return (
    <Box ref={dropdownRef} sx={{ position: 'relative', width: 'fit-content' }}>
      {/* 닫힌 상태 버튼 */}
      <Box
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        sx={{
          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
          borderRadius: '32px',
          px: 2.5,
          py: 1.25,
          cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
          opacity: (disabled || loading) ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '44px',
          minWidth: dropdownMinWidth,
          boxShadow: isDarkMode ? '0px 2px 8px rgba(0, 0, 0, 0.3)' : '0px 2px 8px rgba(0, 0, 0, 0.08)',
          visibility: isOpen ? 'hidden' : 'visible'
        }}
      >
        <Typography sx={{
          color: isDarkMode ? colors.gray.gray200 : '#2C2C3C',
          fontSize: '16px',
          fontWeight: 500,
          whiteSpace: 'nowrap'
        }}>
          {loading ? '로딩 중...' : getSelectedLabel()}
        </Typography>
        {loading ? (
          <Box
            sx={{
              width: 12,
              height: 12,
              ml: 1,
              borderRadius: '50%',
              border: `2px solid ${isDarkMode ? colors.gray.gray500 : colors.gray.gray300}`,
              borderTopColor: colors.mainColor.blue,
              animation: 'spin 0.6s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }}
          />
        ) : (
          <Box
            component="img"
            src="/icons/ic_arrow.svg"
            sx={{
              width: 12,
              height: 12,
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              ml: 1,
              filter: isDarkMode ? 'brightness(0) saturate(100%) invert(94%) sepia(3%) saturate(485%) hue-rotate(177deg) brightness(92%) contrast(87%)' : 'none'
            }}
          />
        )}
      </Box>

      {/* 열린 상태 드롭다운 */}
      {isOpen && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
            borderRadius: '32px',
            px: 2.5,
            py: 1.5,
            boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: '250px'
          }}
        >
          {/* 헤더 부분 */}
          <Box
            onClick={() => setIsOpen(false)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              mb: 1
            }}
          >
            <Typography sx={{
              color: '#A0A0B2',
              fontSize: '14px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {getSelectedLabel()}
            </Typography>
            <Box
              component="img"
              src="/icons/ic_arrow.svg"
              sx={{
                width: 12,
                height: 12,
                transform: 'rotate(180deg)',
                ml: 1,
                filter: isDarkMode ? 'brightness(0) saturate(100%) invert(94%) sepia(3%) saturate(485%) hue-rotate(177deg) brightness(92%) contrast(87%)' : 'none'
              }}
            />
          </Box>

          <Divider sx={{ my: 0.5 }} />

          {/* 목록 */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            '&::-webkit-scrollbar': {
              width: '6px'
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: isDarkMode ? colors.gray.gray600 : '#D0D0E0',
              borderRadius: '3px',
              '&:hover': {
                bgcolor: isDarkMode ? colors.gray.gray500 : '#B0B0C0'
              }
            }
          }}>
            {/* "전체" 옵션 */}
            {showAllOption && !multiSelect && (
              <Typography
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelect('')
                }}
                sx={{
                  color: value === '' ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray100 : '#2C2C3C'),
                  fontSize: '16px',
                  fontWeight: value === '' ? 600 : 500,
                  lineHeight: '24px',
                  minHeight: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  py: 0.75,
                  px: 1,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  '&:hover': {
                    bgcolor: isDarkMode ? colors.gray.gray600 : '#F8F9FA'
                  }
                }}
              >
                {allOptionLabel}
              </Typography>
            )}

            {/* 옵션 목록 */}
            {options.map(option => {
              const selected = isSelected(option.id.toString())
              return multiSelect ? (
                <Box
                  key={option.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelect(option.id.toString())
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    minHeight: '36px',
                    py: 0.75,
                    px: 1,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: isDarkMode ? colors.gray.gray600 : '#F8F9FA'
                    }
                  }}
                >
                  <Box
                    component="img"
                    src={
                      isDarkMode
                        ? (selected ? "/icons/ic_room_check_on_dark.svg" : "/icons/ic_room_check_off_dark.svg")
                        : (selected ? "/icons/ic_blue_check_on_simple.svg" : "/icons/ic_blue_check_off.svg")
                    }
                    sx={{
                      width: 24,
                      height: 'auto',
                      flexShrink: 0
                    }}
                  />
                  <Typography
                    sx={{
                      color: selected ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray100 : '#2C2C3C'),
                      fontSize: '16px',
                      fontWeight: selected ? 600 : 500,
                      lineHeight: '24px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {option.label}
                  </Typography>
                </Box>
              ) : (
                <Typography
                  key={option.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelect(option.id.toString())
                  }}
                  sx={{
                    color: selected ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray100 : '#2C2C3C'),
                    fontSize: '16px',
                    fontWeight: selected ? 600 : 500,
                    lineHeight: '24px',
                    minHeight: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    py: 0.75,
                    px: 1,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    '&:hover': {
                      bgcolor: isDarkMode ? colors.gray.gray600 : '#F8F9FA'
                    }
                  }}
                >
                  {option.label}
                </Typography>
              )
            })}
          </Box>
        </Box>
      )}
    </Box>
  )
}

export default CustomDropdown
