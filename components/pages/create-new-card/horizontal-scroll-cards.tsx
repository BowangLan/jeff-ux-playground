import { useWindowDimensions } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASING, NAV_HEADER_HEIGHT, PAGE_PX } from './constants';
import { SwipableCard } from './swipable-card';
import type { Card } from './types';

export function HorizontalScrollCards({
  cards,
  onRemoveCard,
  deckTopY,
  isDraggingSV,
}: {
  cards: Card[];
  onRemoveCard: (card: Card) => void;
  deckTopY: number;
  isDraggingSV: SharedValue<number>;
}) {
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
}
