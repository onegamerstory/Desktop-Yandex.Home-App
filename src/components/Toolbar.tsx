import React from 'react';
import { Pencil, Power, Sun, Moon, RefreshCw, Info, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ToolbarProps {
  isEditMode: boolean;
  toggleEditMode: () => void;
  isAutostartEnabled: boolean;
  onToggleAutostart: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenInfo: () => void;
  onLogout: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isEditMode,
  toggleEditMode,
  isAutostartEnabled,
  onToggleAutostart,
  onRefresh,
  isRefreshing,
  onOpenInfo,
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="window-header">
      <div className="window-header-actions">
        <button
          onClick={toggleEditMode}
          className={`header-btn ${isEditMode ? 'active' : ''}`}
          title={isEditMode ? 'Выйти из режима редактирования' : 'Редактировать дашборд'}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleAutostart}
          className={`header-btn ${isAutostartEnabled ? 'active' : ''}`}
          title={isAutostartEnabled ? 'Автозапуск включен' : 'Автозапуск выключен'}
        >
          <Power className="w-4 h-4" />
        </button>
        <button
          onClick={toggleTheme}
          className="header-btn"
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="header-btn"
          title="Обновить"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={onOpenInfo}
          className="header-btn"
          title="О программе"
        >
          <Info className="w-4 h-4" />
        </button>
        <button
          onClick={onLogout}
          className="header-btn"
          title="Выйти"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
