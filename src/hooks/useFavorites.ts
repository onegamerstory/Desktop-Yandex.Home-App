import { useState, useCallback } from 'react';
import { getFavorites, setFavorites } from '../utils/storage';

interface UseFavoritesReturn {
    favoriteDeviceIds: string[];
    favoriteScenarioIds: string[];
    favoriteGroupIds: string[];
    toggleFavorite: (type: 'device' | 'scenario' | 'group', id: string) => void;
    isFavorite: (type: 'device' | 'scenario' | 'group', id: string) => boolean;
}

const STORAGE_KEYS = {
    device: 'favoriteDeviceIds',
    scenario: 'favoriteScenarioIds',
    group: 'favoriteGroupIds',
} as const;

export function useFavorites(): UseFavoritesReturn {
    const [favoriteDeviceIds, setFavoriteDeviceIds] = useState<string[]>(getFavorites('favoriteDeviceIds'));
    const [favoriteScenarioIds, setFavoriteScenarioIds] = useState<string[]>(getFavorites('favoriteScenarioIds'));
    const [favoriteGroupIds, setFavoriteGroupIds] = useState<string[]>(getFavorites('favoriteGroupIds'));

    const toggleFavorite = useCallback((type: 'device' | 'scenario' | 'group', id: string) => {
        const setters = {
            device: setFavoriteDeviceIds,
            scenario: setFavoriteScenarioIds,
            group: setFavoriteGroupIds,
        };

        setters[type](prevIds => {
            const newIds = prevIds.includes(id)
                ? prevIds.filter(itemId => itemId !== id)
                : [...prevIds, id];
            setFavorites(STORAGE_KEYS[type], newIds);
            return newIds;
        });
    }, []);

    const isFavorite = useCallback((type: 'device' | 'scenario' | 'group', id: string): boolean => {
        const state = {
            device: favoriteDeviceIds,
            scenario: favoriteScenarioIds,
            group: favoriteGroupIds,
        };
        return state[type].includes(id);
    }, [favoriteDeviceIds, favoriteScenarioIds, favoriteGroupIds]);

    return { favoriteDeviceIds, favoriteScenarioIds, favoriteGroupIds, toggleFavorite, isFavorite };
}
