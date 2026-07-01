import React from 'react';
import { isSensorDevice } from '../../constants';
import { SensorCard } from './SensorCard';
import { DeviceCard, DeviceCardProps } from './DeviceCard';

export const DeviceCardAdapter: React.FC<DeviceCardProps> = (props) => {
  return isSensorDevice(props.device)
    ? <SensorCard {...props} />
    : <DeviceCard {...props} />;
};
