// Global Color Gradients
export const colors = {
  gradients: {
    red: 'linear-gradient(to right, #F17C7C, #E60000)',
    blue: 'linear-gradient(to right, #7CCAF1, #0058E6)',
    orange: 'linear-gradient(to right, #F1DF7C, #E6AC00)',
  },
  gray: {
    gray100: '#F2F4FA',
    gray200: '#EDEDF5',
    gray300: '#DBDBE9',
    gray400: '#A0A0B2',
    gray500: '#6C6C7A',
    gray600: '#484856',
    gray700: '#3A3A4A',
    gray800: '#2C2C3C',
    gray900: '#232334',
    gray1000: '#1E1E2F',
  },

  mainColor: {
    blue: '#009EE6',
    lightBlue: '#7CCAF1',
    red: '#FF3E3E',
    green: '#8ECE4B',
    deepGreen: '#5AAE00',
    orange: '#FFC800',
  },

} as const

export type GradientType = keyof typeof colors.gradients
export type GrayType = keyof typeof colors.gray
