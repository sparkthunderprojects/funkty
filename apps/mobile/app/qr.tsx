import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inviteUrl } from '../src/lib/invite';
import { useSession } from '../src/lib/session';
import { useTheme } from '../src/theme';
import { Avatar } from '../src/ui/Avatar';
import { QrCode } from '../src/ui/QrCode';

/** Pulls the username out of a Funkty profile link; anything else is ignored. */
export function usernameFromLink(data: string): string | null {
  const m = /\/user\/([a-z0-9._]{3,30})(?:[/?#]|$)/i.exec(data);
  return m ? m[1]!.toLowerCase() : null;
}

export default function Qr() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { profile } = useSession();
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);
  if (!profile) return null;

  function onScan(data: string) {
    if (handled.current) return;
    const name = usernameFromLink(data);
    if (!name) {
      setMessage('That is not a Funkty QR code.');
      return;
    }
    handled.current = true;
    router.replace({ pathname: '/user/[username]', params: { username: name } });
  }

  async function startScan() {
    setMessage(null);
    handled.current = false;
    const granted = permission?.granted ? permission : await requestPermission();
    if (granted.granted) setScanning(true);
    else setMessage('Allow camera access in your phone settings to scan a code.');
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, alignItems: 'center', gap: spacing.lg }}>
      {scanning ? (
        <View style={{ flex: 1, alignSelf: 'stretch', borderRadius: 16, overflow: 'hidden' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => onScan(data)}
          />
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg }}>
          <Avatar username={profile.username} size={72} />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>@{profile.username}</Text>
          <View style={{ padding: 14, backgroundColor: '#ffffff', borderRadius: 16 }}>
            <QrCode value={inviteUrl(profile.username)} size={230} />
          </View>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Friends can scan this with their camera to open your profile.</Text>
        </View>
      )}
      {message ? <Text accessibilityRole="alert" style={{ color: colors.danger, textAlign: 'center' }}>{message}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => (scanning ? setScanning(false) : void startScan())}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 }}
      >
        <Ionicons name={scanning ? 'qr-code-outline' : 'scan-outline'} size={20} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 16 }}>{scanning ? 'Show my code' : 'Scan a code'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
