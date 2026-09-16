import { useFonts } from 'expo-font';

/**
 * Loads brand fonts ('Smooch Sans', 'Share Tech Mono', 'Inter').
 * Adapted directly from Percel's typography architecture.
 */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    SpaceMono_400Regular: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Space Mono': require('../assets/fonts/SpaceMono-Regular.ttf'),
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Nunito_400Regular: require('../assets/fonts/Nunito-Regular.ttf'),
    Nunito_700Bold: require('../assets/fonts/Nunito-Bold.ttf'),
    Nunito: require('../assets/fonts/Nunito-Bold.ttf'),
    SmoochSans_800ExtraBold: require('../assets/fonts/SmoochSans-ExtraBold.ttf'),
    ShareTechMono_400Regular: require('../assets/fonts/ShareTechMono-Regular.ttf'),
    Inter_700Bold: require('../assets/fonts/Inter-Bold.ttf'),
    'Smooch Sans': require('../assets/fonts/SmoochSans-ExtraBold.ttf'),
    'Share Tech Mono': require('../assets/fonts/ShareTechMono-Regular.ttf'),
    'Inter': require('../assets/fonts/Inter-Bold.ttf'),
  });

  return loaded;
}

