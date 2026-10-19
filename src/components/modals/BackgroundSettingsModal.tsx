import React, { useEffect, useState } from 'react';
import { ImagePlus, Trash2, X } from 'lucide-react';

export interface BackgroundSettings {
    image: string;
    positionX: number;
    positionY: number;
    zoom: number;
    blur: number;
    dim: number;
}

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
    image: '',
    positionX: 50,
    positionY: 50,
    zoom: 100,
    blur: 0,
    dim: 20,
};

interface BackgroundSettingsModalProps {
    title: string;
    initialSettings: BackgroundSettings;
    onClose: () => void;
    onSave: (settings: BackgroundSettings) => void;
}

const readAndCompressImage = async (file: File): Promise<string> => {
    const objectUrl = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();

        const maxDimension = 1920;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Не удалось обработать изображение');

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.85);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

export const BackgroundSettingsModal: React.FC<BackgroundSettingsModalProps> = ({
    title,
    initialSettings,
    onClose,
    onSave,
}) => {
    const [settings, setSettings] = useState(initialSettings);
    const [error, setError] = useState('');

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const updateSetting = <K extends keyof BackgroundSettings>(key: K, value: BackgroundSettings[K]) => {
        setSettings(current => ({ ...current, [key]: value }));
    };

    const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Выберите файл изображения.');
            return;
        }

        try {
            const image = await readAndCompressImage(file);
            setSettings(current => ({ ...current, image }));
            setError('');
        } catch (cause) {
            console.error('Failed to load background image', cause);
            setError('Не удалось загрузить изображение. Попробуйте выбрать другой файл.');
        }
    };

    const handleSave = () => {
        try {
            onSave(settings);
            onClose();
        } catch (cause) {
            console.error('Failed to save background settings', cause);
            setError('Не удалось сохранить настройки. Проверьте свободное место в хранилище приложения.');
        }
    };

    const renderSlider = (
        label: string,
        key: 'positionX' | 'positionY' | 'zoom' | 'blur' | 'dim',
        min: number,
        max: number,
        suffix: string,
    ) => (
        <label className="background-setting">
            <span>
                {label}
                <strong>{settings[key]}{suffix}</strong>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                value={settings[key]}
                onChange={event => updateSetting(key, Number(event.target.value))}
            />
        </label>
    );

    return (
        <div className="background-modal-backdrop" onMouseDown={event => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section className="background-modal" role="dialog" aria-modal="true" aria-labelledby="background-modal-title">
                <header className="background-modal-header">
                    <div>
                        <h2 id="background-modal-title">Фон: {title}</h2>
                        <p>Выберите изображение и настройте его отображение</p>
                    </div>
                    <button type="button" className="header-btn" onClick={onClose} aria-label="Закрыть">
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="background-modal-body">
                    <div className="background-preview" aria-label="Предпросмотр фона">
                        {settings.image ? (
                            <img
                                src={settings.image}
                                alt=""
                                style={{
                                    objectPosition: `${settings.positionX}% ${settings.positionY}%`,
                                    transform: `scale(${settings.zoom / 100})`,
                                    filter: `blur(${settings.blur}px)`,
                                }}
                            />
                        ) : (
                            <div className="background-preview-empty">
                                <ImagePlus />
                                <span>Предпросмотр появится здесь</span>
                            </div>
                        )}
                        <div style={{ backgroundColor: `rgba(0, 0, 0, ${settings.dim / 100})` }} />
                    </div>

                    <div className="background-image-actions">
                        <label className="background-upload-button">
                            <ImagePlus className="w-4 h-4" />
                            {settings.image ? 'Заменить фото' : 'Загрузить фото'}
                            <input type="file" accept="image/*" onChange={handleImageChange} />
                        </label>
                        {settings.image && (
                            <button
                                type="button"
                                className="background-remove-button"
                                onClick={() => {
                                    setSettings({ ...DEFAULT_BACKGROUND_SETTINGS });
                                    setError('');
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                                Удалить фото
                            </button>
                        )}
                    </div>

                    <div className="background-controls">
                        {renderSlider('Кадрирование по горизонтали', 'positionX', 0, 100, '%')}
                        {renderSlider('Кадрирование по вертикали', 'positionY', 0, 100, '%')}
                        {renderSlider('Масштаб', 'zoom', 100, 200, '%')}
                        {renderSlider('Размытие', 'blur', 0, 20, ' px')}
                        {renderSlider('Затемнение', 'dim', 0, 80, '%')}
                    </div>

                    {error && <p className="background-modal-error" role="alert">{error}</p>}
                </div>

                <footer className="background-modal-footer">
                    <button type="button" className="background-cancel-button" onClick={onClose}>Отмена</button>
                    <button type="button" className="background-save-button" onClick={handleSave}>Сохранить</button>
                </footer>
            </section>
        </div>
    );
};
