import IonIcon from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { BottomCardDeck } from './card-deck';
import {
  APPLE_SPRING_CONFIG,
  DECK_HEIGHT,
  DECK_RADIUS,
  DECK_SWIPE_THRESHOLD,
  DECK_VELOCITY_THRESHOLD,
  EASING,
  NAV_HEADER_HEIGHT,
  PAGE_PX,
  PEEK_PER_CARD_EXPANDED,
  THUMB_VISIBLE_HEIGHT,
} from './constants';
import { INITIAL_CARDS } from './data';
import { HorizontalScrollCards } from './horizontal-scroll-cards';
import type { Card } from './types';

export default function CreateNewCardPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [cards, setCards] = useState<Card[]>(INITIAL_CARDS);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const isDraggingSV = useSharedValue(0);
  const [isDeckExpanded, setIsDeckExpanded] = useState(false);

  // holds the progress of the deck expansion
  const expansionProgress = useSharedValue(0);

  const [activeSelectedCard, setActiveSelectedCard] = useState<Card | null>(null);
  const selectionProgress = useSharedValue(0);
  const activeIndexSV = useSharedValue(-1);
  // SV stands for "Shared Value" in Reanimated, so this holds the shared value for the page Y offset.
  const pageYOffsetSV = useSharedValue(0);

  const scrollOffsetSV = useSharedValue(0);
  const maxScrollOffsetSV = useSharedValue(0);
  const scrollOffsetAtStart = useSharedValue(0);

  const deckTopY = height - DECK_HEIGHT;
  const navHeaderHeight = insets.top + NAV_HEADER_HEIGHT;
  const expandedDeckHeight = height - navHeaderHeight;
  const deckTravelDistance = expandedDeckHeight - DECK_HEIGHT;

  useEffect(() => {
    const count = selectedCards.length;
    const lastCardBottom = count > 0
      ? (count - 1) * PEEK_PER_CARD_EXPANDED - THUMB_VISIBLE_HEIGHT + height * 0.7
      : 0;
    const visibleArea = expandedDeckHeight - 12; // paddingTop: 12
    maxScrollOffsetSV.value = Math.max(0, lastCardBottom - visibleArea);
  }, [selectedCards.length, height, expandedDeckHeight, maxScrollOffsetSV]);

  const expandDeck = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDeckExpanded(true);
    expansionProgress.value = withTiming(1, { duration: 600, easing: EASING });
  }, [expansionProgress]);

  const gestureStartExpanded = useSharedValue(0);

  const deckGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-10, 10])
      .onStart(() => {
        gestureStartExpanded.value = expansionProgress.value > 0.5 ? 1 : 0;
        scrollOffsetAtStart.value = scrollOffsetSV.value;
      })
      .onUpdate((e) => {
        if (selectionProgress.value > 0.5) return;
        const wasExpanded = gestureStartExpanded.value > 0.5;
        if (wasExpanded) {
          // rawOffset = where the scroll would land based on gesture translation
          const rawOffset = scrollOffsetAtStart.value - e.translationY;
          if (rawOffset < 0) {
            // Dragged down past zero-scroll → start closing the deck
            scrollOffsetSV.value = 0;
            expansionProgress.value = 1 + rawOffset / deckTravelDistance;
          } else {
            // Scrolling within content bounds
            scrollOffsetSV.value = Math.min(rawOffset, maxScrollOffsetSV.value);
            expansionProgress.value = 1;
          }
        } else {
          expansionProgress.value = -e.translationY / deckTravelDistance;
        }
      })
      .onEnd((e) => {
        if (selectionProgress.value > 0.5) {
          selectionProgress.value = withTiming(0, { duration: 400, easing: EASING }, (finished) => {
            if (finished) {
              activeIndexSV.value = -1;
              scheduleOnRN(setActiveSelectedCard, null);
            }
          });
          return;
        }

        const wasExpanded = gestureStartExpanded.value > 0.5;
        if (wasExpanded) {
          const rawOffset = scrollOffsetAtStart.value - e.translationY;
          if (rawOffset < 0) {
            // User dragged down past zero → check close threshold
            const overDrag = -rawOffset;
            const passedThreshold = overDrag > DECK_SWIPE_THRESHOLD;
            const passVelocity = e.velocityY > DECK_VELOCITY_THRESHOLD;
            if (passedThreshold || passVelocity) {
              scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
              scrollOffsetSV.value = withTiming(0, { duration: 400, easing: EASING });
              expansionProgress.value = withTiming(0, { duration: 400, easing: EASING }, (finished) => {
                if (finished) scheduleOnRN(setIsDeckExpanded, false);
              });
            } else {
              // Snap back to open at top
              scrollOffsetSV.value = withSpring(0, APPLE_SPRING_CONFIG);
              expansionProgress.value = withSpring(1, APPLE_SPRING_CONFIG);
            }
          } else {
            // Scrolled within bounds → continue with momentum
            scrollOffsetSV.value = withDecay({
              velocity: -e.velocityY,
              deceleration: 0.998,
              clamp: [0, maxScrollOffsetSV.value],
            });
            expansionProgress.value = withSpring(1, APPLE_SPRING_CONFIG);
          }
        } else {
          const passedThreshold = e.translationY < -DECK_SWIPE_THRESHOLD;
          const passVelocity = e.velocityY < -DECK_VELOCITY_THRESHOLD;
          if (passedThreshold || passVelocity) {
            scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
            // open the deck
            expansionProgress.value = withSpring(1, APPLE_SPRING_CONFIG, (finished) => {
              if (finished) scheduleOnRN(setIsDeckExpanded, true);
            });
          } else {
            // close the deck
            expansionProgress.value = withTiming(0, { duration: 400, easing: EASING });
          }
        }
      });

    const tap = Gesture.Tap().onEnd(() => {
      if (expansionProgress.value < 0.5) {
        scheduleOnRN(expandDeck);
      }
    });

    return Gesture.Race(pan, tap);
  }, [expansionProgress, gestureStartExpanded, expandDeck, deckTravelDistance, selectionProgress, activeIndexSV, scrollOffsetSV, scrollOffsetAtStart, maxScrollOffsetSV]);

  const scrollCardsAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - expansionProgress.value,
      transform: [{ translateY: interpolate(expansionProgress.value, [0, 1], [0, -80]) }],
      zIndex: isDraggingSV.value > 0 ? 100 : 1,
    }
  });

  const deckContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(expansionProgress.value, [0, 1], [deckTravelDistance, 0]) }],
    zIndex: isDraggingSV.value > 0 ? 1 : 100,
  }));

  const handleDeleteCard = useCallback((card: Card) => {
    setSelectedCards((prev) => prev.filter((c) => c.name !== card.name));
    setCards((prev) => [...prev, card]);
  }, []);

  const handleRemoveCard = useCallback((card: Card) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCards((prev) => prev.filter((c) => c.name !== card.name));
    setSelectedCards(p => [...p, card]);
  }, []);

  const handlePress = useCallback((card: Card) => {
    if (activeSelectedCard) {
      // closing active card
      selectionProgress.value = withTiming(0, { duration: 500, easing: EASING }, (finished) => {
        if (finished) {
          activeIndexSV.value = -1;
          scheduleOnRN(setActiveSelectedCard, null);
        }
      });
    } else {
      activeIndexSV.value = selectedCards.findIndex((c) => c.name === card.name);
      selectionProgress.value = withSpring(1, APPLE_SPRING_CONFIG);
      setActiveSelectedCard(card);
    }
  }, [activeSelectedCard, selectionProgress, activeIndexSV, selectedCards]);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: PAGE_PX,
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          zIndex: 50,
          height: NAV_HEADER_HEIGHT,
          backgroundColor: 'transparent',
        }}
      >
        <Pressable onPress={() => router.back()}>
          <IonIcon name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <GestureDetector gesture={deckGesture}>
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              {
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                pointerEvents: isDeckExpanded ? 'none' : 'auto',
              },
              scrollCardsAnimatedStyle,
            ]}
          >
            <HorizontalScrollCards
              cards={cards}
              onRemoveCard={handleRemoveCard}
              deckTopY={deckTopY}
              isDraggingSV={isDraggingSV}
            />
          </Animated.View>

          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                top: navHeaderHeight,
                height: expandedDeckHeight,
                overflow: 'visible',
                paddingTop: 12,
                borderTopLeftRadius: DECK_RADIUS,
                borderTopRightRadius: DECK_RADIUS,
              },
              deckContainerAnimatedStyle,
            ]}
          >
            <View style={{ flex: 1 }}>
              <BottomCardDeck
                selectedCards={selectedCards}
                expanded={isDeckExpanded}
                expansionProgress={expansionProgress}
                selectionProgress={selectionProgress}
                activeCardName={activeSelectedCard?.name ?? null}
                activeIndexSV={activeIndexSV}
                handlePress={handlePress}
                expandDeck={expandDeck}
                onDeleteCard={handleDeleteCard}
                scrollOffsetSV={scrollOffsetSV}
              />
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}
