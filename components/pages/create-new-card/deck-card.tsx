import { BlurView } from 'expo-blur';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
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
  EASING,
  EASING_QUAD,
  PAGE_PX,
  PEEK_PER_CARD,
  PEEK_PER_CARD_EXPANDED,
  SELECTED_CARD_TOP,
  THUMB_VISIBLE_HEIGHT,
} from './constants';
import { Pill } from './pill';
import type { Card } from './types';

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
}) {
  const isActive = activeIndex !== null && activeIndex === index;
  const { height } = useWindowDimensions();
  const peekHeightCollapsed = THUMB_VISIBLE_HEIGHT - index * PEEK_PER_CARD;
  const peekHeightExpanded = THUMB_VISIBLE_HEIGHT - index * PEEK_PER_CARD_EXPANDED;
  const collapsedTop = -peekHeightCollapsed;
  const expandedTop = -peekHeightExpanded;
  const dragOffsetY = useSharedValue(0);
  const mountProgress = useSharedValue(0);

  useEffect(() => {
    mountProgress.value = withTiming(1, { duration: 500, easing: EASING_QUAD });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const expandedTranslateY = interpolate(expansionProgress.value, [0, 1], [collapsedTop, expandedTop]);
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
    const targetOpacity = isActiveNow ? 1 : 0.2;

    const mountOffset = interpolate(mountProgress.value, [0, 1], [30, 0]);
    const translateY = interpolate(selectionProgress.value, [0, 1], [expandedTranslateY, targetTranslateY]) + dragOffsetY.value + mountOffset;
    const scaleX = interpolate(selectionProgress.value, [0, 1], [expandedScaleX, isActiveNow ? 1 : expandedScaleX]);
    const opacity = interpolate(selectionProgress.value, [0.5, 1], [1, targetOpacity]) * mountProgress.value;
    const rotateX = interpolate(dragOffsetY.value, [-30, 0, 80], [-0.02, 0, 0.08]);

    return {
      transform: [
        { perspective: 1200 },
        { translateY },
        { scaleX },
        { rotateX: `${rotateX}rad` as const },
      ],
      opacity,
    };
  });

  const dragGesture = Gesture.Pan()
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
      <GestureDetector gesture={Gesture.Race(dragGesture, tapGesture)}>
        <Link href="/create-new-card" asChild>
          <Link.Trigger>
            <Pressable onPress={() => { }} style={{ flex: 1 }} android_ripple={null}>
              <Animated.View style={{ flex: 1, overflow: 'hidden', borderRadius: 24 }}>
                <CardGradient colors={card.colors} />
                <AnimatedBlurView
                  tint="dark"
                  animatedProps={blurAnimatedProps}
                  // intensity={40}
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
                {/* <Animated.View
                  pointerEvents="none"
                  style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' }, overlayStyle]}
                /> */}
              </Animated.View>
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
        </Link>
      </GestureDetector>
    </Animated.View>
  );
}
