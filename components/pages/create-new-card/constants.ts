import { Easing } from 'react-native-reanimated';

export const EASING = Easing.bezier(0.215, 0.61, 0.355, 1.0);
export const EASING_QUAD = Easing.bezier(0.165, 0.84, 0.44, 1.0);
export const DECK_HEIGHT = 120;
export const THUMB_VISIBLE_HEIGHT = 20;
export const PEEK_PER_CARD = 26;
export const PEEK_PER_CARD_EXPANDED = 60;
export const SELECTED_CARD_TOP = 0;
export const DECK_VELOCITY_THRESHOLD = 100;
export const PAGE_PX = 16;
export const SWIPE_THRESHOLD = 120;
export const DECK_SWIPE_THRESHOLD = 180;
export const FLIP_DRAG_THRESHOLD = 80;
export const DECK_RADIUS = 30;
export const NAV_HEADER_HEIGHT = 56;

export const APPLE_SPRING_CONFIG = {
  damping: 17,
  stiffness: 170,
  mass: 1,
  overshootClamping: false,
};

export const APPLE_SPRING_CONFIG_QUICK = {
  damping: 15,
  stiffness: 180,
  mass: 1,
  overshootClamping: false,
};
