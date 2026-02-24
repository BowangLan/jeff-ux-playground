import { BlurView } from 'expo-blur';
import { useEffect } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { CardGradient } from './card-gradient';
import {
  APPLE_SPRING_CONFIG,
  APPLE_SPRING_CONFIG_QUICK,
  EASING,
  EASING_QUAD,
  FLIP_DRAG_THRESHOLD,
  PAGE_PX,
  PEEK_PER_CARD_EXPANDED,
  SELECTED_CARD_TOP,
  THUMB_VISIBLE_HEIGHT
} from './constants';
import { Pill } from './pill';
import type { Card } from './types';

const PEEK_CARD_COUNT = 3;
const SECONDARY_PEEK_CARD_COUNT = 4;

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function DeckCard({
  card,
  index,
  count,
  expansionProgress,
  selectionProgress,
  activeIndex,
  activeIndexSV,
  handlePress,
  expandDeck,
  onDelete,
  scrollOffsetSV,
}: {
  card: Card;
  index: number;
  count: number;
  expansionProgress: SharedValue<number>;
  selectionProgress: SharedValue<number>;
  activeIndex: number | null;
  activeIndexSV: SharedValue<number>;
  handlePress: (card: Card) => void;
  expandDeck: () => void;
  onDelete: (card: Card) => void;
  scrollOffsetSV: SharedValue<number>;
}) {
  const { height } = useWindowDimensions();
  // const peekHeightCollapsed = index < 3 ? 0 : (THUMB_VISIBLE_HEIGHT - index * PEEK_PER_CARD);
  const indexOffset = index - (count - PEEK_CARD_COUNT);
  // const peekHeightCollapsed = indexOffset < 0 ? 0 : (indexOffset * -PEEK_PER_CARD);
  let peekHeightCollapsed = 0;
  if (index > (count - PEEK_CARD_COUNT)) {
    peekHeightCollapsed = peekHeightCollapsed - (index - (count - PEEK_CARD_COUNT)) * 28;
  } else if (index > (count - SECONDARY_PEEK_CARD_COUNT - PEEK_CARD_COUNT)) {
    peekHeightCollapsed = peekHeightCollapsed - (index - (count - SECONDARY_PEEK_CARD_COUNT)) * 2;
  }
  const peekHeightExpanded = THUMB_VISIBLE_HEIGHT - index * PEEK_PER_CARD_EXPANDED;
  const collapsedTop = -peekHeightCollapsed;
  const expandedTop = -peekHeightExpanded;
  const dragOffsetY = useSharedValue(0);
  const mountProgress = useSharedValue(0);

  const collapsedTopSV = useSharedValue(collapsedTop);
  const expandedTopSV = useSharedValue(expandedTop);

  const flipAngle = useSharedValue(0); // 0 = front, Math.PI = back
  const dragOffsetX = useSharedValue(0);

  useEffect(() => {
    mountProgress.value = withTiming(1, { duration: 500, easing: EASING_QUAD });
  }, []);

  useEffect(() => {
    collapsedTopSV.value = withSpring(collapsedTop, APPLE_SPRING_CONFIG);
    expandedTopSV.value = withSpring(expandedTop, APPLE_SPRING_CONFIG);
  }, [collapsedTop, expandedTop]);

  useEffect(() => {
    if (activeIndex === null) {
      // Snap to nearest front-face (0, 2π, 4π, ...) to avoid long reverse animations
      const nearestFront = Math.round(flipAngle.value / (2 * Math.PI)) * (2 * Math.PI);
      flipAngle.value = withSpring(nearestFront, APPLE_SPRING_CONFIG_QUICK);
    }
  }, [activeIndex, flipAngle]);

  const animatedStyle = useAnimatedStyle(() => {
    const expandedTranslateY = interpolate(expansionProgress.value, [0, 1], [collapsedTopSV.value, expandedTopSV.value]);
    const expandedScaleX = interpolate(expansionProgress.value, [0, 1], [0.95, 1]);

    const activeIdx = activeIndexSV.value;
    const isActiveNow = activeIdx === index;
    let targetTranslateY;
    if (activeIdx >= 0) {
      if (index > activeIdx) {
        targetTranslateY = height - 120;
      } else {
        targetTranslateY = SELECTED_CARD_TOP;
      }
    } else {
      targetTranslateY = SELECTED_CARD_TOP;
    }
    const targetOpacity = isActiveNow ? 1 : 0;

    const mountOffset = interpolate(mountProgress.value, [0, 1], [30, 0]);
    // Subtract scroll offset from the expanded position so cards shift up when scrolled
    const scrolledTranslateY = expandedTranslateY - scrollOffsetSV.value * expansionProgress.value;
    const translateY = interpolate(selectionProgress.value, [0, 1], [scrolledTranslateY, targetTranslateY]) + mountOffset;
    const scaleX = interpolate(selectionProgress.value, [0, 1], [expandedScaleX, isActiveNow ? 1 : expandedScaleX]);
    const opacity = interpolate(selectionProgress.value, [0.5, 1], [1, targetOpacity]) * mountProgress.value;

    return {
      transform: [
        { perspective: 1200 },
        { translateY },
        { scaleX },
      ],
      opacity,
    };
  });

  const frontFaceAnimatedStyle = useAnimatedStyle(() => {
    const dragContrib = interpolate(
      dragOffsetX.value,
      [-FLIP_DRAG_THRESHOLD, 0, FLIP_DRAG_THRESHOLD],
      [-Math.PI / 3, 0, Math.PI / 3],
    );
    return { transform: [{ perspective: 1200 }, { rotateY: `${flipAngle.value + dragContrib}rad` as const }] };
  });

  const backFaceAnimatedStyle = useAnimatedStyle(() => {
    const dragContrib = interpolate(
      dragOffsetX.value,
      [-FLIP_DRAG_THRESHOLD, 0, FLIP_DRAG_THRESHOLD],
      [-Math.PI / 3, 0, Math.PI / 3],
    );
    return { transform: [{ perspective: 1200 }, { rotateY: `${Math.PI + flipAngle.value + dragContrib}rad` as const }] };
  });

  const dragXGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .enabled(activeIndex !== null)
    .onUpdate((e) => {
      dragOffsetX.value = e.translationX;
    })
    .onEnd((e) => {
      const pastThreshold = Math.abs(e.translationX) > FLIP_DRAG_THRESHOLD || Math.abs(e.velocityX) > 200;
      if (pastThreshold) {
        const direction = e.translationX > 0 ? 1 : -1;
        const previousAngle = Math.round(flipAngle.value / Math.PI) * Math.PI;
        const targetAngle = previousAngle + direction * Math.PI;
        // flipAngle.value = withTiming(targetAngle, { duration: 400, easing: EASING });
        flipAngle.value = withSpring(targetAngle, APPLE_SPRING_CONFIG_QUICK);
      }
      dragOffsetX.value = withSpring(0, APPLE_SPRING_CONFIG_QUICK);
    });

  const dragYGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .enabled(false)
    .onUpdate((e) => {
      dragOffsetY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 500) {
        dragOffsetY.value = withTiming(0, { duration: 400, easing: EASING });
        scheduleOnRN(handlePress, card);
      } else {
        dragOffsetY.value = withSpring(0, APPLE_SPRING_CONFIG);
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (expansionProgress.value < 0.5) {
      scheduleOnRN(expandDeck);
    } else {
      scheduleOnRN(handlePress, card);
    }
  });

  const blurAnimatedProps = useAnimatedProps(() => {
    const activeIdx = activeIndexSV.value;
    const shouldBlur = activeIdx >= 0 && activeIdx !== index;
    const intensity = shouldBlur
      ? interpolate(selectionProgress.value, [0.5, 1], [0, 40], Extrapolation.CLAMP)
      : 0;
    return { intensity };
  });

  const cardFaceStyle = { flex: 1, overflow: 'hidden' as const, borderRadius: 24, backfaceVisibility: 'hidden' as const };

  const cardContentFront = (
    <Animated.View style={[cardFaceStyle, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, frontFaceAnimatedStyle]}>
      <CardGradient colors={card.colors} />
      <AnimatedBlurView
        tint="dark"
        animatedProps={blurAnimatedProps}
        pointerEvents="none"
        style={{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, zIndex: 15, backgroundColor: '#00000000', borderRadius: 24, borderCurve: 'continuous' }}
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 20, gap: 20, zIndex: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: '400', color: '#FFFFFF' }}>{card.name}</Text>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {card.tags.map((tag) => (
              <Pill key={tag} text={tag} />
            ))}
          </View>
          <Text style={{ fontSize: 14, lineHeight: 18, color: '#FFFFFFCC' }}>{card.description}</Text>
        </View>
      </View>
    </Animated.View>
  );

  const cardContentBack = (
    <Animated.View style={[cardFaceStyle, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, backFaceAnimatedStyle]}>
      <CardGradient colors={card.colors} />
      <AnimatedBlurView
        tint="dark"
        animatedProps={blurAnimatedProps}
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 20, gap: 20, zIndex: 10, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '400', color: '#FFFFFF' }}>{card.name}</Text>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {card.tags.map((tag) => (
              <Pill key={tag} text={tag} />
            ))}
          </View>
          <Text style={{ fontSize: 14, lineHeight: 18, color: '#FFFFFFCC' }}>{card.description}</Text>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: PAGE_PX,
          right: PAGE_PX,
          height: height * 0.7,
          zIndex: 11 + index,
        },
        animatedStyle,
      ]}
    >
      <GestureDetector gesture={Gesture.Race(dragYGesture, dragXGesture, tapGesture)}>
        {/* <Link href="/create-new-card" asChild>
          <Link.Trigger>
            <Pressable onPress={() => { }} style={{ flex: 1 }} android_ripple={null}>
            </Pressable>
          </Link.Trigger>
          <Link.Menu>
            <Link.MenuAction
              title="Delete"
              icon="trash"
              destructive
              onPress={() => scheduleOnRN(onDelete, card)}
            />
          </Link.Menu>
        </Link> */}
        <View style={{ flex: 1 }}>
          {cardContentFront}
          {cardContentBack}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
