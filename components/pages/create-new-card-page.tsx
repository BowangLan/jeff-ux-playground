import IonIcon from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  LinearTransition,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

const EASING = Easing.bezier(0.215, 0.61, 0.355, 1.0);
const EASING_QUAD = Easing.bezier(0.165, 0.84, 0.44, 1.0);
const DECK_HEIGHT = 120;
const THUMB_VISIBLE_HEIGHT = 20;
const PEEK_PER_CARD = 28;
const DECK_VELOCITY_THRESHOLD = 100;

export type Card = {
  name: string;
  tags: string[];
  description: string;
  colors: [string, string];
}

const Pill = ({ text }: { text: string }) => {
  return (
    <View style={{ backgroundColor: '#FFFFFF50', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
      <Text style={{ color: '#FFFFFFCC' }}>{text}</Text>
    </View>
  );
};

const PAGE_PX = 16;
const SWIPE_THRESHOLD = 120;
const DECK_SWIPE_THRESHOLD = 180;
const DECK_RADIUS = 30;
const NAV_HEADER_HEIGHT = 56;

const SwipableCard = ({
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
}) => {
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
      translateY.value = e.translationY;
      rotateX.value = interpolate(e.translationY, [30, 0, -30], [0.02, 0, -0.10]);
    })
    .onEnd((e) => {
      const passedThreshold = e.translationY > SWIPE_THRESHOLD;
      if (passedThreshold) {
        const measured = measure(cardRef);
        let targetTranslateY: number;

        if (measured) {
          // Slide card until its top edge is flush with the deck top edge,
          // so it disappears behind the deck (deck renders on top via zIndex).
          const delta = deckTopY - measured.pageY;
          targetTranslateY = translateY.value + delta;
        } else {
          targetTranslateY = translateY.value + 500;
        }

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
            borderRadius: 24,
            borderCurve: 'continuous',
            padding: 10,
            overflow: 'hidden',
            zIndex: 1000,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.12)',
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={card.colors}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 }}
        />

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
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
};

const HorizontalScrollCards = ({
  cards,
  onRemoveCard,
  deckTopY,
  isDraggingSV,
}: {
  cards: Card[];
  onRemoveCard: (card: Card) => void;
  deckTopY: number;
  isDraggingSV: SharedValue<number>;
}) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = width - PAGE_PX * 2;
  const snapInterval = cardWidth + PAGE_PX / 2;

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={snapInterval}
      snapToAlignment='start'
      decelerationRate={0.8}
      disableIntervalMomentum
      contentContainerStyle={{ paddingHorizontal: PAGE_PX, paddingTop: insets.top + NAV_HEADER_HEIGHT }}
    >
      {cards.map((card) => (
        <Animated.View
          key={card.name}
          layout={LinearTransition.duration(500).easing(EASING)}
          style={{ width: cardWidth, marginRight: PAGE_PX / 2, zIndex: 99 }}
        >
          <SwipableCard
            card={card}
            onRemove={onRemoveCard}
            inList
            deckTopY={deckTopY}
            isDraggingSV={isDraggingSV}
          />
        </Animated.View>
      ))}
    </Animated.ScrollView>
  );
};

const PEEK_PER_CARD_EXPANDED = 60; // more spacing between stacked cards when expanded
const SELECTED_CARD_TOP = 10; // px below deck container top when a card is selected

const DeckCard = ({
  card,
  index,
  count,
  expansionProgress,
  selectionProgress,
  isActive,
  isAfter,
  handlePress,
}: {
  card: Card;
  index: number;
  count: number;
  expansionProgress: SharedValue<number>;
  selectionProgress: SharedValue<number>;
  isActive: boolean;
  isAfter: boolean;
  handlePress: (card: Card) => void;
}) => {
  const { height } = useWindowDimensions();
  const peekHeightCollapsed = THUMB_VISIBLE_HEIGHT - index * PEEK_PER_CARD;
  const peekHeightExpanded = THUMB_VISIBLE_HEIGHT - index * PEEK_PER_CARD_EXPANDED;
  const collapsedTop = -peekHeightCollapsed;
  const expandedTop = -peekHeightExpanded;

  const animatedStyle = useAnimatedStyle(() => {
    const expandedTranslateY = interpolate(expansionProgress.value, [0, 1], [collapsedTop, expandedTop]);
    const expandedScaleX = interpolate(expansionProgress.value, [0, 1], [0.95, 1]);

    // Each card type targets a different resting position when selection is active
    let targetTranslateY;
    if (isActive) {
      targetTranslateY = SELECTED_CARD_TOP;
    } else if (isAfter) {
      targetTranslateY = height - index * PEEK_PER_CARD_EXPANDED;
    } else {
      targetTranslateY = expandedTranslateY;
    }
    const targetOpacity = isActive ? 1 : isAfter ? 0 : 0.4;

    const translateY = interpolate(selectionProgress.value, [0, 1], [expandedTranslateY, targetTranslateY]);
    const scaleX = interpolate(selectionProgress.value, [0, 1], [expandedScaleX, isActive ? 1 : expandedScaleX]);
    const opacity = interpolate(selectionProgress.value, [0.5, 1], [1, targetOpacity]);
    const zIndex = 11 + index;

    return { transform: [{ translateY }, { scaleX }], opacity, zIndex };
  });

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: isActive || isAfter ? 0 : interpolate(selectionProgress.value, [0, 1], [0, 0.55]),
  }));

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
      <Pressable style={{ flex: 1 }} onPress={() => handlePress(card)}>
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
      </Pressable>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' }, overlayStyle]}
      />
    </Animated.View>
  );
};

const CardDeck = ({
  selectedCards,
  expanded,
  expansionProgress,
  selectionProgress,
  activeCardName,
  handlePress,
}: {
  selectedCards: Card[];
  expanded?: boolean;
  expansionProgress: SharedValue<number>;
  selectionProgress: SharedValue<number>;
  activeCardName: string | null;
  handlePress: (card: Card) => void;
}) => {
  const count = selectedCards.length;
  const activeIndex = activeCardName ? selectedCards.findIndex((c) => c.name === activeCardName) : -1;

  return (
    <View style={{ flex: expanded ? 1 : undefined, height: expanded ? undefined : DECK_HEIGHT, overflow: 'visible' }}>
      {selectedCards.map((card, i) => (
        <DeckCard
          key={card.name}
          card={card}
          index={i}
          count={count}
          expansionProgress={expansionProgress}
          selectionProgress={selectionProgress}
          isActive={i === activeIndex}
          isAfter={activeIndex >= 0 && i > activeIndex}
          handlePress={handlePress}
        />
      ))}

      <View
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          borderTopEndRadius: DECK_RADIUS,
          borderTopStartRadius: DECK_RADIUS,
        }}
      />
    </View>
  );
};

const INITIAL_CARDS: Card[] = [
  {
    name: 'Sleep Pod',
    tags: ['Technology', 'Sleep', 'Pod'],
    description: 'A sleep pod is a device that allows you to sleep in a pod. It is a small, portable device that you can take with you wherever you go. It is a great way to get a good night\'s sleep on the go.',
    colors: ['#3C5BD7', '#123AAF'],
  },
  {
    name: 'Mindful Moments',
    tags: ['Mindfulness', 'Calm', 'Focus'],
    description: 'Practice staying present in the moment with guided mindfulness techniques to help reduce anxiety and stress.',
    colors: ['#76C893', '#245953'],
  },
  {
    name: 'Gratitude Journal',
    tags: ['Gratitude', 'Wellbeing', 'Journaling'],
    description: 'Keep track of things you are grateful for each day to boost positivity and overall emotional wellness.',
    colors: ['#F9D331', '#F47340'],
  },
  {
    name: 'Deep Breathing',
    tags: ['Relaxation', 'Breathing', 'Anxiety'],
    description: 'Relax with simple deep breathing exercises designed to soothe your nervous system and ease tension.',
    colors: ['#3CA4A4', '#125D98'],
  },
  {
    name: 'Sleep Routine',
    tags: ['Sleep', 'Rest', 'Self-care'],
    description: 'Create a healthy nightly routine to improve your sleep quality and support your mental resilience.',
    colors: ['#8FBFE0', '#30475E'],
  },
  {
    name: 'Mood Tracker',
    tags: ['Mood', 'Awareness', 'Habits'],
    description: 'Track your mood every day to increase self-awareness and discover patterns in emotional wellbeing.',
    colors: ['#F15BB5', '#FF9A8B'],
  },
];

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
    setIsDeckExpanded(true);
    expansionProgress.value = withTiming(1, { duration: 400, easing: EASING });
  }, [expansionProgress]);

  const gestureStartExpanded = useSharedValue(0);

  const deckGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-10, 10])
      .onStart(() => {
        gestureStartExpanded.value = expansionProgress.value > 0.5 ? 1 : 0;
      })
      .onUpdate((e) => {
        const wasExpanded = gestureStartExpanded.value > 0.5;
        // 1:1 — deck moves exactly the distance of the user's finger
        if (wasExpanded) {
          const progress = Math.min(1, Math.max(0, 1 - e.translationY / deckTravelDistance));
          expansionProgress.value = progress;
        } else {
          const progress = Math.min(1, Math.max(0, -e.translationY / deckTravelDistance));
          expansionProgress.value = progress;
        }
      })
      .onEnd((e) => {
        const wasExpanded = gestureStartExpanded.value > 0.5;
        if (wasExpanded) {
          const passedThreshold = e.translationY > DECK_SWIPE_THRESHOLD;
          const passVelocity = e.velocityY > DECK_VELOCITY_THRESHOLD;
          if (passedThreshold || passVelocity) {
            expansionProgress.value = withTiming(0, { duration: 600, easing: EASING }, (finished) => {
              if (finished) scheduleOnRN(setIsDeckExpanded, false);
            });
          } else {
            expansionProgress.value = withTiming(1, { duration: 600, easing: EASING });
          }
        } else {
          const passedThreshold = e.translationY < -DECK_SWIPE_THRESHOLD;
          const passVelocity = e.velocityY < -DECK_VELOCITY_THRESHOLD;
          if (passedThreshold || passVelocity) {
            expansionProgress.value = withTiming(1, { duration: 600, easing: EASING }, (finished) => {
              if (finished) scheduleOnRN(setIsDeckExpanded, true);
            });
          } else {
            expansionProgress.value = withTiming(0, { duration: 600, easing: EASING });
          }
        }
      });

    const tap = Gesture.Tap().onEnd(() => {
      if (expansionProgress.value < 0.5) {
        scheduleOnRN(expandDeck);
      }
    });

    return Gesture.Race(pan, tap);
  }, [expansionProgress, gestureStartExpanded, expandDeck, deckTravelDistance]);

  const scrollCardsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - expansionProgress.value,
    transform: [{ translateY: interpolate(expansionProgress.value, [0, 1], [0, -80]) }],
    zIndex: isDraggingSV.value > 0 ? 100 : 1,
  }));

  const deckContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(expansionProgress.value, [0, 1], [deckTravelDistance, 0]) }],
    zIndex: isDraggingSV.value > 0 ? 1 : 100,
  }));

  const handleRemoveCard = useCallback((card: Card) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCards((prev) => prev.filter((c) => c.name !== card.name));
    setSelectedCards(p => [...p, card]);
  }, []);

  const handlePress = useCallback((card: Card) => {
    if (expansionProgress.value < 0.5) return;
    const duration = 500;
    if (activeSelectedCard) {
      selectionProgress.value = withTiming(0, { duration, easing: EASING }, (finished) => {
        if (finished) scheduleOnRN(setActiveSelectedCard, null);
      });
    } else {
      selectionProgress.value = withTiming(1, { duration, easing: EASING });
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
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
