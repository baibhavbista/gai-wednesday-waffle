import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useAuth } from '@/hooks/useAuth';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from '@expo-google-fonts/inter';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold
} from '@expo-google-fonts/poppins';
import { SplashScreen } from 'expo-router';
import Auth from '@/components/Auth';
import ProfileSetup from '@/components/ProfileSetup';

SplashScreen.preventAutoHideAsync();

// FIXME: remove this. Kept for now since easier to scan QR
if (false) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

export default function RootLayout() {
  useFrameworkReady();
  const { session, profile, loading, profileLoading, isReady, hasProfile } = useAuth();
  
  // Check if we're on the OAuth callback route
  const isCallbackRoute = typeof window !== 'undefined' && 
    window.location.pathname.includes('/auth/callback');
  
  // Debug logging (remove in production)
  if (__DEV__) {
    console.log('🏗️ Layout render:', { 
      hasSession: !!session, 
      hasProfile: !!profile,
      loading, 
      profileLoading,
      isReady,
      isCallbackRoute,
    });
  }

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Set up notifications for authenticated users
  useEffect(() => {
    const setupNotifications = async () => {
      if (session && hasProfile && profile) {
        try {
          const { NotificationService } = await import('../lib/notification-service');
          
          // Check if user has enabled notifications
          if (profile.notifications_enabled !== false) {
            // Reschedule notifications on app launch to maintain coverage
            await NotificationService.scheduleWeeklyNudges();
            console.log('✅ Wednesday nudges rescheduled on app launch');
          }
        } catch (error) {
          console.error('Failed to set up notifications:', error);
        }
      }
    };

    setupNotifications();
  }, [session, hasProfile, profile]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Show loading spinner while checking auth or loading profile
  if (loading || (session && profileLoading)) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#FFFFFF'
      }}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={{ 
          color: '#1F2937',
          marginTop: 16, 
          fontSize: 16,
          fontFamily: 'Inter-Regular'
        }}>
          {loading ? 'Checking authentication...' : 'Loading profile...'}
        </Text>
      </View>
    );
  }

  // Always show Stack routes if we're on the callback route (even without session)
  // or if we have a complete authenticated session with profile
  if ((session && hasProfile) || isCallbackRoute) {
    return (
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[groupId]" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="dark" />
      </>
    );
  }

  // Show profile setup if authenticated but no profile
  if (session && !hasProfile && !profileLoading) {
    return (
      <>
        <ProfileSetup 
          userId={session.user.id}
          initialName={session.user.user_metadata?.full_name || session.user.user_metadata?.name}
          initialAvatar={session.user.user_metadata?.picture || session.user.user_metadata?.avatar_url}
        />
        <StatusBar style="light" />
      </>
    );
  }

  // Show auth screen if not authenticated and not on callback route
  return (
    <>
      <Auth />
      <StatusBar style="light" />
    </>
  );
}