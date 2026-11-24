import QRCode from 'qrcode';
import { useMemo } from 'react';
import { View } from 'react-native';

/** Draws a QR code from its module matrix with plain views, so no native drawing library is needed. */
export function QrCode({ value, size = 240, color = '#000000' }: { value: string; size?: number; color?: string }) {
  const cells = useMemo(() => {
    const { size: n, data } = QRCode.create(value, { errorCorrectionLevel: 'M' }).modules;
    const rows: boolean[][] = [];
    for (let r = 0; r < n; r++) rows.push(Array.from({ length: n }, (_, c) => !!data[r * n + c]));
    return rows;
  }, [value]);
  const cell = size / cells.length;
  return (
    <View accessibilityLabel="QR code" style={{ width: size, height: size, backgroundColor: '#ffffff' }}>
      {cells.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {row.map((on, c) => (
            <View key={c} style={{ width: cell, height: cell, backgroundColor: on ? color : '#ffffff' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
