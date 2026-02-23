import { Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  clamp,
  interpolate,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { CardGradient } from './card-gradient';
import { EASING, EASING_QUAD, PAGE_PX, SWIPE_THRESHOLD } from './constants';
import { Pill } from './pill';
import type { Card } from './types';

export function SwipableCard({
  card,
  onRemove,
  inList,
  deckTopY,
  isDraggingSV,
}: {
  card: Card;
  onRemove: (card: Card) => void;
  inList?: boolean;
  deckTopY: number;
  isDraggingSV: SharedValue<number>;
}) {
  const { width, height } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const rotateX = useSharedValue(0);
  const cardRef = useAnimatedRef<Animated.View>();

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-15, 15])
    .onStart(() => {
      isDraggingSV.value = 1;
    })
    .onUpdate((e) => {
      translateY.value = clamp(e.translationY, 0, deckTopY);
      rotateX.value = interpolate(e.translationY, [30, 0, -30], [0.02, 0, -0.10]);
    })
    .onEnd((e) => {
      const velocityThreshold = 500;
      const passedThreshold = e.translationY > SWIPE_THRESHOLD || e.velocityY > velocityThreshold;
      if (passedThreshold) {
        const measured = measure(cardRef);
        let targetTranslateY: number;

        // if (measured) {
        //   const delta = deckTopY - measured.pageY;
        //   targetTranslateY = translateY.value + delta;
        // } else {
        //   targetTranslateY = translateY.value + 1000;
        // }
        targetTranslateY = translateY.value + 500;

        rotateX.value = withTiming(0, { duration: 500, easing: EASING });
        translateY.value = withTiming(targetTranslateY, { duration: 500, easing: EASING_QUAD }, (finished) => {
          if (finished) scheduleOnRN(onRemove, card);
        });
      } else {
        rotateX.value = withTiming(0, { duration: 500, easing: EASING });
        translateY.value = withTiming(0, { duration: 500, easing: EASING });
      }
      isDraggingSV.value = withTiming(0, { duration: 500, easing: EASING });
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1200 },
        { translateY: translateY.value },
        { rotateX: `${rotateX.value}rad` as const },
      ],
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        ref={cardRef}
        style={[
          {
            width: width - PAGE_PX * 2,
            ...(inList ? {} : { marginRight: PAGE_PX / 2 }),
            height: height * 0.7,
            padding: 10,
            // overflow: 'hidden',
            zIndex: 1000,
          },
          animatedStyle,
        ]}
      >
        <CardGradient colors={card.colors} />

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, zIndex: 10 }}>
          <Text style={{ fontSize: 36, fontWeight: '400', color: '#FFFFFF' }}>{card.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {card.tags.map((tag) => (
              <Pill key={tag} text={tag} />
            ))}
          </View>
          <Text style={{ fontSize: 15, lineHeight: 20, color: '#FFFFFFFF', textAlign: 'center', maxWidth: '80%' }}>{card.description}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
