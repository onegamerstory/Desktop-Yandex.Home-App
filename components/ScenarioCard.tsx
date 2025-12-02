import React, { useState } from 'react';
import { getIconForScenario } from '../constants';
import { YandexScenario } from '../types';
import { Loader2, CheckCircle2, Star } from 'lucide-react';

interface ScenarioCardProps {
  scenario: YandexScenario;
  onExecute: (id: string) => Promise<void>;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, onExecute, isFavorite, onToggleFavorite }) => {
  const [loading, setLoading] = useState(false);
  const [justExecuted, setJustExecuted] = useState(false);

  const handleClick = async () => {
    if (loading) return;

    setLoading(true);
    try {
      await onExecute(scenario.id);
      
      // Success animation state
      setJustExecuted(true);
      setTimeout(() => setJustExecuted(false), 2000);
      
    } catch (err) {
      console.error(err);
      // Ideally show a toast here, but simple visual feedback for now
      alert(`Ошибка при запуске сценария "${scenario.name}"`);
    } finally {
      setLoading(false);
    }
  };

  const icon = getIconForScenario(scenario.icon, scenario.name);

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        relative overflow-hidden group
        flex flex-col items-center justify-center p-6 gap-4
        bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-slate-700/80 active:scale-95
        border border-gray-200 dark:border-white/5 rounded-2xl
        transition-all duration-300 ease-out
        shadow-lg shadow-gray-200 dark:shadow-lg hover:shadow-purple-200 dark:hover:shadow-primary/10
        min-h-[160px] w-full
        ${loading ? 'cursor-wait opacity-80' : 'cursor-pointer'}
        ${justExecuted ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/10' : ''}
      `}
    >
	
		<button
          onClick={(e) => {
              e.stopPropagation(); // Важно: предотвращаем запуск сценария
              onToggleFavorite(scenario.id);
          }}
          className={`
              absolute top-3 right-3 z-20 p-1 rounded-full transition-all duration-200
              ${isFavorite ? 'text-yellow-500 dark:text-accent bg-white/80 dark:bg-surface/80 hover:bg-white dark:hover:bg-surface' : 'text-gray-400 dark:text-slate-500 hover:text-yellow-500 dark:hover:text-accent opacity-0 group-hover:opacity-100'}
          `}
          title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      >
          <Star className="w-4 h-4 fill-current" />
      </button>
	
      {/* Background Gradient on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/0 dark:from-primary/0 to-purple-50/0 dark:to-primary/0 group-hover:from-purple-100 dark:group-hover:from-primary/10 group-hover:to-transparent transition-all duration-500"></div>

      {/* State Overlay (Loading or Success) */}
      <div className="relative z-10 text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-white transition-colors duration-300">
        {loading ? (
          <Loader2 className="w-10 h-10 animate-spin text-purple-600 dark:text-primary" />
        ) : justExecuted ? (
          <CheckCircle2 className="w-10 h-10 text-green-500 scale-110 duration-300 animate-in fade-in zoom-in" />
        ) : (
          <div className="text-purple-600 dark:text-primary group-hover:text-purple-700 dark:group-hover:text-white group-hover:scale-110 transition-all duration-300">
            {icon}
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <span className="font-semibold text-lg text-slate-900 dark:text-slate-100 text-center line-clamp-2">
          {scenario.name}
        </span>
        {justExecuted && (
          <span className="text-xs text-green-600 dark:text-green-400 mt-1 animate-pulse">Выполнено</span>
        )}
      </div>
    </button>
  );
};