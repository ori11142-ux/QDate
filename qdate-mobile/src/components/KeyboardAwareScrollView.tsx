import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  ScrollViewProps,
  TextInput,
  View,
} from 'react-native';

import { spacing } from '../theme';

type Props = ScrollViewProps & {
  /** Breathing room kept between the focused input and the top of the keyboard. */
  extraScrollOffset?: number;
};

/**
 * A ScrollView that keeps the focused text input visible above the on-screen
 * keyboard.
 *
 * We deliberately avoid KeyboardAvoidingView: it's unreliable under Android
 * edge-to-edge (see ChatScreen — it leaves a dead gap and doesn't lift inputs).
 * Instead we read the keyboard height straight from the Keyboard events,
 * reserve that much scrollable space at the bottom, and scroll the currently
 * focused input above the keyboard the moment it appears.
 */
export function KeyboardAwareScrollView({
  children,
  extraScrollOffset = spacing.xl,
  contentContainerStyle,
  ...rest
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const kbHeight = useRef(0);
  const [spacerHeight, setSpacerHeight] = useState(0);

  const scrollFocusedIntoView = useCallback(() => {
    // The focused native input, if any — no per-input wiring needed.
    const focused: any = TextInput.State.currentlyFocusedInput?.();
    const scroller = scrollRef.current;
    if (!focused || !scroller || typeof focused.measureInWindow !== 'function') return;
    focused.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      if (typeof y !== 'number' || typeof h !== 'number') return;
      const windowH = Dimensions.get('window').height;
      const keyboardTop = windowH - kbHeight.current - extraScrollOffset;
      const inputBottom = y + h;
      if (inputBottom > keyboardTop) {
        scroller.scrollTo({ y: scrollY.current + (inputBottom - keyboardTop), animated: true });
      }
    });
  }, [extraScrollOffset]);

  useEffect(() => {
    // iOS reports "will" before the animation; Android only fires "did".
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      kbHeight.current = e.endCoordinates?.height ?? 0;
      setSpacerHeight(kbHeight.current);
      // Wait for the spacer to lay out so there's room to scroll into.
      setTimeout(scrollFocusedIntoView, Platform.OS === 'ios' ? 0 : 60);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      kbHeight.current = 0;
      setSpacerHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollFocusedIntoView]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...rest}
      ref={scrollRef}
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
        rest.onScroll?.(e);
      }}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
      {/* Reserves room so a low input can scroll clear of the keyboard. */}
      <View style={{ height: spacerHeight }} />
    </ScrollView>
  );
}
