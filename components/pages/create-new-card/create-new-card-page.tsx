import IonIcon from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { CardDeck } from './card-deck';
import {
  APPLE_SPRING_CONFIG,
  DECK_HEIGHT,
  DECK_RADIUS,
  DECK_SWIPE_THRESHOLD,
  DECK_VELOCITY_THRESHOLD,
  EASING,
  NAV_HEADER_HEIGHT,
  PAGE_PX,
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
  const expansionProgress = useSharedValue(0);

  const [activeSelectedCard, setActiveSelectedCard] = useState<Card | null>(null);
  const selectionProgress = useSharedValue(0);

  const deckTopY = height - DECK_HEIGHT;
  const navHeaderHeight = insets.top + NAV_HEADER_HEIGHT;
  const expandedDeckHeight = height - navHeaderHeight;
  const deckTravelDistance = expandedDeckHeight - DECK_HEIGHT;

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
      })
      .onUpdate((e) => {
        if (selectionProgress.value > 0.5) return;
        const wasExpanded = gestureStartExpanded.value > 0.5;
        if (wasExpanded) {
          const progress = Math.min(1, Math.max(0, 1 - e.translationY / deckTravelDistance));
          expansionProgress.value = progress;
        } else {
          const progress = Math.min(1, Math.max(0, -e.translationY / deckTravelDistance));
          expansionProgress.value = progress;
        }
      })
      .onEnd((e) => {
        if (selectionProgress.value > 0.5) {
          selectionProgress.value = withTiming(0, { duration: 400, easing: EASING }, (finished) => {
            if (finished) scheduleOnRN(setActiveSelectedCard, null);
          });
          return;
        }
        const DURATION = 600;

        const wasExpanded = gestureStartExpanded.value > 0.5;
        if (wasExpanded) {
          const passedThreshold = e.translationY > DECK_SWIPE_THRESHOLD;
          const passVelocity = e.velocityY > DECK_VELOCITY_THRESHOLD;
          if (passedThreshold || (passVelocity && e.translationY > 0)) {
            scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
            expansionProgress.value = withTiming(0, { duration: DURATION, easing: EASING }, (finished) => {
              if (finished) scheduleOnRN(setIsDeckExpanded, false);
            });
          } else {
            expansionProgress.value = withSpring(1, APPLE_SPRING_CONFIG);
          }
        } else {
          const passedThreshold = e.translationY < -DECK_SWIPE_THRESHOLD;
          const passVelocity = e.velocityY < -DECK_VELOCITY_THRESHOLD;
          if (passedThreshold || passVelocity) {
            scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
            expansionProgress.value = withSpring(1, APPLE_SPRING_CONFIG, (finished) => {
              if (finished) scheduleOnRN(setIsDeckExpanded, true);
            });
          } else {
            expansionProgress.value = withTiming(0, { duration: DURATION, easing: EASING });
          }
        }
      });

    const tap = Gesture.Tap().onEnd(() => {
      if (expansionProgress.value < 0.5) {
        scheduleOnRN(expandDeck);
      }
    });

    return Gesture.Race(pan, tap);
  }, [expansionProgress, gestureStartExpanded, expandDeck, deckTravelDistance, selectionProgress]);

  const scrollCardsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - expansionProgress.value,
    transform: [{ translateY: interpolate(expansionProgress.value, [0, 1], [0, -80]) }],
    zIndex: isDraggingSV.value > 0 ? 100 : 1,
  }));

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
    const duration = 500;
    if (activeSelectedCard) {
      selectionProgress.value = withTiming(0, { duration, easing: EASING }, (finished) => {
        if (finished) scheduleOnRN(setActiveSelectedCard, null);
      });
    } else {
      selectionProgress.value = withSpring(1, APPLE_SPRING_CONFIG);
      setActiveSelectedCard(card);
    }
  }, [activeSelectedCard, selectionProgress]);

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

      <GestureDetector gesture={deckGesture}>
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
            <CardDeck
              selectedCards={selectedCards}
              expanded={isDeckExpanded}
              expansionProgress={expansionProgress}
              selectionProgress={selectionProgress}
              activeCardName={activeSelectedCard?.name ?? null}
              handlePress={handlePress}
              expandDeck={expandDeck}
              onDeleteCard={handleDeleteCard}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
