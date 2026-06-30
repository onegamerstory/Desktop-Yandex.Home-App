import { useState, useCallback } from 'react';
import { YandexUserInfoResponse } from '../types/index';

interface UseHouseholdReturn {
    activeHouseholdId: string | null;
    handleSwitchHousehold: () => void;
}

export function useHousehold(
    userData: YandexUserInfoResponse | null,
    token: string | null,
    refreshDashboardData: (apiToken: string, silent?: boolean) => Promise<void>
): UseHouseholdReturn {
    const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);

    const handleSwitchHousehold = useCallback(() => {
        if (!userData || !userData.households || userData.households.length === 0) return;

        setActiveHouseholdId(prev => {
            const households = userData.households;
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
