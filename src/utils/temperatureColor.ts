const temperatureColorStops = [
  { position: 0, color: [66, 153, 225] },
  { position: 0.5, color: [99, 179, 237] },
  { position: 1, color: [237, 137, 54] },
] as const;

export function getTemperatureSliderColor(value: number, min: number, max: number): string {
  const progress = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0.5;
  const lowerStop = progress <= 0.5 ? temperatureColorStops[0] : temperatureColorStops[1];
  const upperStop = progress <= 0.5 ? temperatureColorStops[1] : temperatureColorStops[2];
  const segmentProgress = (progress - lowerStop.position) / (upperStop.position - lowerStop.position);
  const rgb = lowerStop.color.map((channel, index) =>
    Math.round(channel + (upperStop.color[index] - channel) * segmentProgress)
  );

  return `rgb(${rgb.join(', ')})`;
}
