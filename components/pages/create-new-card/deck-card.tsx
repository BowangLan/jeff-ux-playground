import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { APPLE_SPRING_CONFIG, EASING, PAGE_PX, PEEK_PER_CARD, PEEK_PER_CARD_EXPANDED, SELECTED_CARD_TOP, THUMB_VISIBLE_HEIGHT } from './constants';
import { Pill } from './pill';
import type { Card } from './types';

export function DeckCard({
  card,
  index,
  count,
  expansionProgress,
  selectionProgress,
  isActive,
  isAfter,
  handlePress,
  expandDeck,
  onDelete,
}: {
  card: Card;
  index: number;
  count: number;
  expansionProgress: SharedValue<number>;
  selectionProgress: SharedValue<number>;
  isActive: boolean;
  isAfter: boolean;
  handlePress: (card: Card) => void;
  expandDeck: () => void;
  onDelete: (card: Card) => void;
}) {
  const { height } = useWindowDimensions();
  const peekHeightCollapsed = THUMB_VISIBLE_HEIGHT - index * PEEK_PER_CARD;
  const peekHeightExpanded = THUMB_VISIBLE_HEIGHT - index * PEEK_PER_CARD_EXPANDED;
  const collapsedTop = -peekHeightCollapsed;
  const expandedTop = -peekHeightExpanded;
  const dragOffsetY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const expandedTranslateY = interpolate(expansionProgress.value, [0, 1], [collapsedTop, expandedTop]);
    const expandedScaleX = interpolate(expansionProgress.value, [0, 1], [0.95, 1]);

    let targetTranslateY;
    if (isActive) {
      targetTranslateY = SELECTED_CARD_TOP;
    } else if (isAfter) {
      targetTranslateY = height - index * PEEK_PER_CARD_EXPANDED;
    } else {
      targetTranslateY = SELECTED_CARD_TOP;
    }
    const targetOpacity = isActive ? 1 : 0;

    const translateY = interpolate(selectionProgress.value, [0, 1], [expandedTranslateY, targetTranslateY]) + dragOffsetY.value;
    const scaleX = interpolate(selectionProgress.value, [0, 1], [expandedScaleX, isActive ? 1 : expandedScaleX]);
    const opacity = interpolate(selectionProgress.value, [0.5, 1], [1, targetOpacity]);
    const zIndex = 11 + index;

    return { transform: [{ translateY }, { scaleX }], opacity, zIndex };
  });

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: isActive || isAfter ? 0 : interpolate(selectionProgress.value, [0, 1], [0, 0.55]),
  }));

  const dragGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .enabled(isActive)
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

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        {
          position: 'absolute',
          left: PAGE_PX,
          right: PAGE_PX,
          height: height * 0.7,
          borderRadius: 14,
          overflow: 'hidden',
        },
        animatedStyle,
      ]}
    >
      <GestureDetector gesture={Gesture.Race(dragGesture, tapGesture)}>
        <Link href="/create-new-card" asChild>
          <Link.Trigger>
            <Pressable onPress={() => { }} style={{ flex: 1 }}>
              <Animated.View style={{ flex: 1 }}>
                <LinearGradient colors={card.colors} style={{ flex: 1 }} />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 16, gap: 16 }}>
                  <Text style={{ fontSize: 24, fontWeight: '400', color: '#FFFFFF' }}>{card.name}</Text>
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {card.tags.map((tag) => (
                        <Pill key={tag} text={tag} />
                      ))}
                    </View>
                    <Text style={{ fontSize: 14, lineHeight: 18, color: '#FFFFFFCC' }}>{card.description}</Text>
                  </View>
                </View>
                <Animated.View
                  pointerEvents="none"
                  style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' }, overlayStyle]}
                />
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
