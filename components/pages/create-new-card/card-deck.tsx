import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { Card } from './types';
import { DECK_HEIGHT, DECK_RADIUS } from './constants';
import { DeckCard } from './deck-card';

export function CardDeck({
  selectedCards,
  expanded,
  expansionProgress,
  selectionProgress,
  activeCardName,
  handlePress,
  expandDeck,
  onDeleteCard,
}: {
  selectedCards: Card[];
  expanded?: boolean;
  expansionProgress: SharedValue<number>;
  selectionProgress: SharedValue<number>;
  activeCardName: string | null;
  handlePress: (card: Card) => void;
  expandDeck: () => void;
  onDeleteCard: (card: Card) => void;
}) {
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
          expandDeck={expandDeck}
          onDelete={onDeleteCard}
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
}
