import { SignedIn, SignedOut, useAuth, useOAuth } from '@clerk/clerk-expo';
import { Text, View, Button } from 'react-native';
import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';

// Warm up the browser implementation
WebBrowser.maybeCompleteAuthSession();

export default function Page() {
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });

  const handleSignIn = React.useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startOAuthFlow();
      if (createdSessionId) {
        setActive!({ session: createdSessionId });
      }
    } catch (err) {
      console.error('OAuth error', err);
    }
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
      <SignedIn>
        <Text style={{fontSize: 20, fontWeight: 'bold'}}>Welcome back!</Text>
        {/* Placeholder for navigation */}
        <Text>You are signed in</Text>
        <SignOutButton />
      </SignedIn>
      <SignedOut>
        <Text style={{fontSize: 24, fontWeight: 'bold', marginBottom: 20}}>HoopHoop</Text>
        <Button title="Sign in with Google" onPress={handleSignIn} />
      </SignedOut>
    </View>
  );
}

const SignOutButton = () => {
  const { isLoaded, signOut } = useAuth();
  if (!isLoaded) {
    return null;
  }
  return (
    <Button
      title="Sign Out"
      onPress={() => {
        signOut();
      }}
    />
  );
};
