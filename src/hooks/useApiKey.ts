import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const API_KEY_STORAGE_KEY = 'api_key';

export function useApiKey() {
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  // Restore saved API key on mount
  useEffect(() => {
    AsyncStorage.getItem(API_KEY_STORAGE_KEY).then(key => {
      if (key) {
        setApiKey(key);
        setKeySaved(true);
      }
    });
  }, []);

  const saveApiKey = async () => {
    const key = apiKey.trim();
    if (!key) {
      Alert.alert('Empty', 'API key cannot be empty.');
      return;
    }
    await AsyncStorage.setItem(API_KEY_STORAGE_KEY, key);
    setKeySaved(true);
  };

  const updateApiKey = (key: string) => {
    setApiKey(key);
    setKeySaved(false);
  };

  return {
    apiKey,
    keySaved,
    saveApiKey,
    updateApiKey,
  };
}
