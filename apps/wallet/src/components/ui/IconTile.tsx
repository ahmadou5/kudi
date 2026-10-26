import React, { ComponentType } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { readableInk, shade } from '../../lib/theme';

export type GlyphComponent = ComponentType<any>;

const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};

interface IconTileProps {
  Icon: GlyphComponent;
  /** Glyph name for icon fonts (MaterialCommunityIcons, Ionicons, …). */
  name?: string;
  /** Base color of the tile — normally `palette.primary` so it tracks the accent. */
  color: string;
  size?: number;
  radius?: number;
  glyphSize?: number;
  glyphColor?: string;
  style?: ViewStyle;
}

/**
 * Soft-3D icon tile: vertical gradient body, top highlight sheen, hairline
 * rim and a colored drop shadow so the glyph reads as a raised object.
 */
export function IconTile({
  Icon,
  name,
  color,
  size = 40,
  radius = 13,
  glyphSize = 19,
  glyphColor,
  style
}: IconTileProps) {
  const ink = glyphColor || readableInk(color);

  return (
    <View
      style={[
        styles.shadow,
        {
          width: size,
          height: size,
          borderRadius: radius,
          shadowColor: shade(color, -0.3)
        },
        style
      ]}
    >
      <View style={[styles.body, { borderRadius: radius }]}>
        <LinearGradient
          colors={[shade(color, 0.22), color, shade(color, -0.24)]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={[ABSOLUTE_FILL, { borderRadius: radius }]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={[ABSOLUTE_FILL, { borderRadius: radius }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.rim,
            { borderRadius: radius, borderColor: 'rgba(255,255,255,0.30)' }
          ]}
        />
        <View style={styles.center}>
          <Icon name={name} size={glyphSize} color={ink} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6
  },
  body: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#64748B'
  },
  rim: {
    ...ABSOLUTE_FILL,
    borderWidth: StyleSheet.hairlineWidth
  },
  center: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
