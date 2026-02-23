import { LinearGradient } from "expo-linear-gradient";

export function CardGradient({ colors }: { colors: [string, string] }) {
  return (
    <LinearGradient
      colors={colors}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 24,
        borderCurve: 'continuous',
        zIndex: 5,
      }}
    />
  );
}