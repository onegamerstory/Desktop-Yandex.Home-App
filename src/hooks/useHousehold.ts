import { useState, useCallback, useEffect } from 'react';
import { YandexUserInfoResponse } from '../types/index';

const STORAGE_KEY = 'app:activeHouseholdId';

interface UseHouseholdReturn {
    activeHouseholdId: string | null;
    handleSwitchHousehold: (householdId?: string) => void;
}

export function useHousehold(
    userData: YandexUserInfoResponse | null,
    token: string | null,
    refreshDashboardData: (apiToken: string, silent?: boolean) => Promise<void>
): UseHouseholdReturn {
    // Lazy init from localStorage — читаем сохранённый дом при монтировании
    const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || null;
        } catch {
            return null;
        }
    });

    // Эффект 1: валидация при загрузке userData
    // Если сохранённый ID не найден в списке домов — fallback на первый
    useEffect(() => {
        if (!userData?.households?.length) return;

        setActiveHouseholdId(prev => {
            if (prev && userData.households.some(h => h.id === prev)) {
                return prev; // сохранённый дом валиден
            }
            return userData.households[0].id; // fallback на первый дом
        });
    }, [userData]);

    // Эффект 2: сохранение activeHouseholdId в localStorage при каждом изменении
    useEffect(() => {
        try {
            if (activeHouseholdId) {
                localStorage.setItem(STORAGE_KEY, activeHouseholdId);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {
            console.error('Failed to persist activeHouseholdId', e);
        }
    }, [activeHouseholdId]);

    const handleSwitchHousehold = useCallback((householdId?: string) => {
        if (!userData || !userData.households || userData.households.length === 0) return;

        setActiveHouseholdId(prev => {
            const households = userData.households;

            // Режим 1: передан конкретный ID — выбираем этот дом
            if (householdId) {
                const exists = households.some(h => h.id === householdId);
                if (!exists) return prev || households[0].id;
                return householdId;
            }

            // Режим 2: циклический (backward compatibility)
            if (!prev) return households[0].id;
            const currentIndex = households.findIndex(h => h.id === prev);
            if (currentIndex === -1) return households[0].id;
            const nextIndex = (currentIndex + 1) % households.length;
            return households[nextIndex].id;
        });

        if (token) {
            refreshDashboardData(token);
        }
    }, [userData, token, refreshDashboardData]);

    return { activeHouseholdId, handleSwitchHousehold };
}
