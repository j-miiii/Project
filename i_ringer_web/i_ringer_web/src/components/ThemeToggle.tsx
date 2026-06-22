import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import './ThemeToggle.css'

const ThemeToggle: React.FC = () => {
  const { isDarkMode, toggleTheme } = useTheme()

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <div className="theme-toggle-track">
        <div className={`theme-toggle-thumb ${isDarkMode ? 'dark' : ''}`}>
          {isDarkMode ? '🌙' : '☀️'}
        </div>
      </div>
    </button>
  )
}

export default ThemeToggle