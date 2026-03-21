/**
 * Конвертирует HSV цвет в RGB формат (число)
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param v - Value/Brightness (0-100)
 * @returns RGB цвет как число (0xRRGGBB)
 */
export const hsvToRgb = (h: number, s: number, v: number): number => {
  // Нормализуем значения
  const hNorm = h / 360;
  const sNorm = s / 100;
  const vNorm = v / 100;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((hNorm * 6) % 2) - 1));
  const m = vNorm - c;

  let r = 0, g = 0, b = 0;

  if (hNorm < 1 / 6) {
    r = c; g = x; b = 0;
  } else if (hNorm < 2 / 6) {
    r = x; g = c; b = 0;
  } else if (hNorm < 3 / 6) {
    r = 0; g = c; b = x;
  } else if (hNorm < 4 / 6) {
    r = 0; g = x; b = c;
  } else if (hNorm < 5 / 6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);

  // Возвращаем как число 0xRRGGBB
  return (red << 16) | (green << 8) | blue;
};

/**
 * Конвертирует RGB число в HSV
 * @param rgb - RGB цвет как число (0xRRGGBB)
 * @returns Объект { h, s, v }
 */
export const rgbToHsv = (rgb: number): { h: number; s: number; v: number } => {
  const red = (rgb >> 16) & 0xFF;
  const green = (rgb >> 8) & 0xFF;
  const blue = rgb & 0xFF;

  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // V
  const v = max * 100;

  // S
  const s = max === 0 ? 0 : (delta / max) * 100;

  // H
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = (((g - b) / delta) % 6) * 60;
    } else if (max === g) {
      h = ((b - r) / delta + 2) * 60;
    } else {
      h = ((r - g) / delta + 4) * 60;
    }
    if (h < 0) h += 360;
  }

  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
};
