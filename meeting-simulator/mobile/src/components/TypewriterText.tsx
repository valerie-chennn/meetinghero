import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

import { renderMentionText } from '../utils/text';

export function TypewriterText({
  text,
  userName,
  style,
  onDone,
}: {
  text: string;
  userName?: string | null;
  style?: StyleProp<TextStyle>;
  onDone?: () => void;
}) {
  const content = useMemo(() => renderMentionText(text, userName), [text, userName]);
  const [visibleCount, setVisibleCount] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    setVisibleCount(0);
    doneRef.current = false;

    const step = Math.max(18, Math.min(60, 1800 / Math.max(content.length, 1)));
    const timer = setInterval(() => {
      setVisibleCount((prev) => {
        const next = Math.min(content.length, prev + 1);
        if (next >= content.length) {
          clearInterval(timer);
        }
        return next;
      });
    }, step);

    return () => clearInterval(timer);
  }, [content]);

  useEffect(() => {
    if (!doneRef.current && visibleCount >= content.length) {
      doneRef.current = true;
      onDone?.();
    }
  }, [content.length, onDone, visibleCount]);

  return <Text style={style}>{content.slice(0, visibleCount)}</Text>;
}
