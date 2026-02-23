import { Text, View } from 'react-native';

export function Pill({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: '#FFFFFF30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
      <Text style={{ color: '#FFFFFFCC' }}>{text}</Text>
    </View>
  );
}
