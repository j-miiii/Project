import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { dataProvider } from '../providers/dataProvider'
import { Box, CircularProgress } from '@mui/material'

interface PrivateRouteProps {
  children: React.ReactElement
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const [isValidating, setIsValidating] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 초기 렌더링 시 토큰 존재 여부 확인
  const token = localStorage.getItem('auth_token')

  useEffect(() => {
    // 토큰이 없으면 검증 없이 바로 인증 실패 처리
    if (!token) {
      setIsAuthenticated(false)
      setIsValidating(false)
      return
    }

    // 토큰이 있을 때만 검증 진행
    const validateToken = async () => {
      try {
        const isValid = await dataProvider.validateAndRefreshToken()
        setIsAuthenticated(isValid)
      } catch (error) {
        console.error('Token validation error:', error)
        setIsAuthenticated(false)
      } finally {
        setIsValidating(false)
      }
    }

    validateToken()
  }, [token])

  // 토큰 검증 중에는 로딩 표시 (토큰이 있을 때만)
  if (isValidating && token) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  // 토큰 검증 완료 후 결과에 따라 라우팅
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default PrivateRoute