/**
 * JWT 토큰 관련 유틸리티 함수
 */

interface JWTPayload {
  email: string;
  sub: number;
  role: string;
  type: string;
  iat: number;
  exp: number;
}

/**
 * JWT 토큰의 payload를 디코딩합니다
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * JWT 토큰이 만료되었는지 확인합니다
 * @param token JWT 토큰
 * @param bufferMinutes 만료 전 몇 분을 버퍼로 둘지 (기본 5분)
 * @returns true면 만료됨 (또는 곧 만료됨)
 */
export function isTokenExpired(token: string, bufferMinutes: number = 5): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const expiryTime = payload.exp * 1000; // 밀리초로 변환
  const bufferTime = bufferMinutes * 60 * 1000; // 버퍼 시간
  const now = Date.now();

  // 현재 시간 + 버퍼가 만료 시간을 넘으면 true
  return now + bufferTime >= expiryTime;
}

/**
 * 토큰의 남은 시간을 분 단위로 반환합니다
 */
export function getTokenRemainingMinutes(token: string): number {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return 0;
  }

  const expiryTime = payload.exp * 1000;
  const now = Date.now();
  const remaining = expiryTime - now;

  return Math.max(0, Math.floor(remaining / 60000));
}

/**
 * 토큰이 유효한지 확인합니다 (형식과 만료 여부)
 */
export function isTokenValid(token: string | null): boolean {
  if (!token) {
    return false;
  }

  const payload = decodeJWT(token);
  if (!payload) {
    return false;
  }

  return !isTokenExpired(token, 0); // 버퍼 없이 실제 만료만 체크
}
