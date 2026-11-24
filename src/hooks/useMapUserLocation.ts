import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export type MapUserLocation = {
  latitude: number;
  longitude: number;
};

export type MapLocationState = {
  location: MapUserLocation | null;
  status: 'loading' | 'ready' | 'denied' | 'error';
  message: string | null;
};

export function useMapUserLocation(): MapLocationState {
  const [state, setState] = useState<MapLocationState>({
    location: null,
    status: 'loading',
    message: null,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let subscription: Location.LocationSubscription | null = null;

      setState({
        location: null,
        status: 'loading',
        message: null,
      });

      const updateLocation = (coords: Location.LocationObjectCoords) => {
        if (!active) return;

        setState({
          location: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
          status: 'ready',
          message: null,
        });
      };

      const startWatching = async () => {
        try {
          let permission = await Location.getForegroundPermissionsAsync();

          if (!permission.granted && permission.canAskAgain) {
            permission = await Location.requestForegroundPermissionsAsync();
          }

          if (!active) return;

          if (!permission.granted) {
            setState({
              location: null,
              status: 'denied',
              message:
                'Izin lokasi tidak tersedia. Lokasi laboratorium tetap dapat dilihat.',
            });
            return;
          }

          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 5_000,
              distanceInterval: 10,
            },
            ({ coords }) => updateLocation(coords),
          );

          if (!active) {
            subscription.remove();
            subscription = null;
            return;
          }
        } catch {
          if (!active) return;

          setState({
            location: null,
            status: 'error',
            message:
              'Lokasi perangkat gagal diperoleh. Lokasi laboratorium tetap dapat dilihat.',
          });
        }
      };

      void startWatching();

      return () => {
        active = false;
        subscription?.remove();
      };
    }, []),
  );

  return state;
}
