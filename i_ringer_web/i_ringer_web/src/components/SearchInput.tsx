import React from 'react'
import { TextField, InputAdornment, Box } from '@mui/material'
import { colors } from '../styles/colors'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  isDarkMode?: boolean
  minWidth?: number | string
  flex?: string
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = '검색',
  isDarkMode = false,
  minWidth = 300,
  flex
}) => {
  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{
        minWidth: minWidth,
        flex: flex,
        '& .MuiOutlinedInput-root': {
          backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
          borderRadius: '32px',
          fontSize: '18px',
          height: '44px',
          boxShadow: isDarkMode ? '0px 2px 8px rgba(0, 0, 0, 0.3)' : '0px 2px 8px rgba(0, 0, 0, 0.08)',
          '& fieldset': {
            border: 'none',
          },
          '&:hover fieldset': {
            border: 'none',
          },
          '&.Mui-focused fieldset': {
            border: 'none',
          },
        },
        '& .MuiOutlinedInput-input': {
          paddingLeft: '16px',
          fontSize: '18px',
          color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
          '&::placeholder': {
            fontSize: '18px',
            opacity: 0.8,
            color: isDarkMode ? colors.gray.gray200 : '#2C2C3C',
          },
        },
      }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <Box
              component="img"
              src="/icons/ic_search.svg"
              sx={{
                width: 24,
                height: 24,
                mr: 1,
                filter: isDarkMode ? 'brightness(0) saturate(100%) invert(94%) sepia(3%) saturate(485%) hue-rotate(177deg) brightness(92%) contrast(87%)' : 'none'
              }}
            />
          </InputAdornment>
        ),
      }}
    />
  )
}

export default SearchInput
