import { YandexDevice } from '../types/index';

export const getCapabilityInstance = (cap: YandexDevice['capabilities'][number]): string | undefined => {
    const fromParams = (cap.parameters as { instance?: string } | undefined)?.instance;
    if (fromParams) {
        return fromParams;
    }
    return cap.state?.instance;
};
