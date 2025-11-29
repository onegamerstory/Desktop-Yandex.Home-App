import React, { useState } from 'react';
import { KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';

interface TokenInputProps {
  onTokenSubmit: (token: string) => void;
  isLoading: boolean;
  error?: string;
}

export const TokenInput: React.FC<TokenInputProps> = ({ onTokenSubmit, isLoading, error }) => {
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      onTokenSubmit(token.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md p-8 bg-surface/50 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Добро пожаловать</h1>
          <p className="text-secondary text-center text-sm">
            Введите ваш OAuth токен Яндекс Умного Дома для продолжения
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="y0_AgAAAA..."
              className="w-full bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
              required
            />
            <ShieldCheck className="absolute right-3 top-3.5 w-5 h-5 text-slate-500" />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-xs text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group shadow-lg shadow-blue-500/20"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                Войти
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <a 
            href="https://github.com/onegamerstory/Desktop-Yandex.Home-App/blob/main/README.md" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-secondary hover:text-primary transition-colors"
          >
            Где взять токен?
          </a>
        </div>
      </div>
    </div>
  );
};