import { useState, useCallback } from 'react';

interface UseNavigationReturn {
    activeSidebarView: 'home' | 'room' | 'group';
    activeRoomId: string | null;
    activeGroupId: string | null;
    onSelectHome: () => void;
    onSelectRoom: (roomId: string) => void;
    onSelectGroup: (groupId: string) => void;
}

export function useNavigation(): UseNavigationReturn {
    const [activeSidebarView, setActiveSidebarView] = useState<'home' | 'room' | 'group'>('home');
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

    const onSelectHome = useCallback(() => {
        setActiveSidebarView('home');
        setActiveRoomId(null);
        setActiveGroupId(null);
    }, []);

    const onSelectRoom = useCallback((roomId: string) => {
        setActiveSidebarView('room');
        setActiveRoomId(roomId);
        setActiveGroupId(null);
    }, []);

    const onSelectGroup = useCallback((groupId: string) => {
        setActiveSidebarView('group');
        setActiveRoomId(null);
        setActiveGroupId(groupId);
    }, []);

    return { activeSidebarView, activeRoomId, activeGroupId, onSelectHome, onSelectRoom, onSelectGroup };
}
