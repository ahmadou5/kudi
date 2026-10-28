import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { useAppPalette, hexToRgba } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { formatUsdCompact, StatsBucket } from '../../utils/activityStats';

const CHART_HEIGHT = 168;
const PAD_TOP = 22; // room for the max-value label
const PAD_BOTTOM = 4; // x labels render outside the SVG
const GROUP_GAP = 4; // gap between the in/out pair
const MIN_BAR_W = 3;
const MAX_BAR_W = 12;
const BAR_RADIUS = 3;

/** Rounded-top-only rectangle path — crisp pill tops like the admin volume chart. */
function roundedTopPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z'
  ].join(' ');
}

interface InOutBarChartProps {
  data: StatsBucket[];
  /** Show x-axis labels under the bars (thinned for dense ranges). */
  showLabels?: boolean;
}

export function InOutBarChart({ data, showLabels = true }: InOutBarChartProps) {
  const palette = useAppPalette();
  const { width: windowWidth } = useWindowDimensions();
  const [chartWidth, setChartWidth] = useState(windowWidth - 64); // rough fallback before measure
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  };

  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.deposits, d.withdrawals)));
  const hasAnyVolume = data.some((d) => d.deposits > 0 || d.withdrawals > 0);

  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const slot = data.length > 0 ? chartWidth / data.length : chartWidth;
  const barWidth = Math.max(MIN_BAR_W, Math.min(MAX_BAR_W, (slot - GROUP_GAP) / 2 - 2));
  const groupWidth = barWidth * 2 + GROUP_GAP;

  const onBarPress = (idx: number) => {
    setActiveIdx((prev) => (prev === idx ? null : idx));
  };

  // Thin out x labels on dense ranges so they never collide.
  const labelStep = Math.max(1, Math.ceil(data.length / 7));
  const active = activeIdx !== null ? data[activeIdx] : null;

  return (
    <View style={styles.wrapper}>
      {/* Header: max label + legend */}
      <View style={styles.headerRow}>
        <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.4) }]}>
          Peak {formatUsdCompact(maxValue)}
        </Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: palette.success }]} />
            <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.55) }]}>In</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: palette.error }]} />
            <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.55) }]}>Out</Text>
          </View>
        </View>
      </View>

      {/* Tooltip */}
      {active && (
        <View style={[styles.tooltip, { backgroundColor: palette.text }]}>
          <Text style={[Typography.footnote, { color: palette.bg, fontWeight: '700' }]} numberOfLines={1}>
            {active.fullLabel}
          </Text>
          <Text style={[Typography.footnote, { color: palette.bg, opacity: 0.75, fontSize: 10 }]}>
            {active.deposits > 0 ? `In ${formatUsdCompact(active.deposits)}` : ''}
            {active.deposits > 0 && active.withdrawals > 0 ? ' · ' : ''}
            {active.withdrawals > 0 ? `Out ${formatUsdCompact(active.withdrawals)}` : ''}
            {!active.count ? 'No activity' : ''}
          </Text>
        </View>
      )}

      {/* Plot */}
      <View style={styles.plotArea} onLayout={onLayout}>
        {!hasAnyVolume ? (
          <View style={styles.emptyPlot}>
            <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.4) }]}>
              No activity in this range
            </Text>
          </View>
        ) : (
          <Pressable onPress={() => setActiveIdx(null)} style={StyleSheet.absoluteFill}>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              {/* Gridlines */}
              {[0.25, 0.5, 0.75, 1].map((p) => {
                const y = PAD_TOP + plotHeight - p * plotHeight;
                return (
                  <Line
                    key={p}
                    x1={0}
                    y1={y}
                    x2={chartWidth}
                    y2={y}
                    stroke={palette.text}
                    strokeOpacity={0.07}
                    strokeDasharray="3 4"
                  />
                );
              })}
              {/* Baseline */}
              <Line
                x1={0}
                y1={PAD_TOP + plotHeight}
                x2={chartWidth}
                y2={PAD_TOP + plotHeight}
                stroke={palette.text}
                strokeOpacity={0.15}
              />

              {data.map((d, i) => {
                const groupX = i * slot + (slot - groupWidth) / 2;
                const inH = (d.deposits / maxValue) * plotHeight;
                const outH = (d.withdrawals / maxValue) * plotHeight;
                const baseY = PAD_TOP + plotHeight;
                const isActive = activeIdx === i;

                return (
                  <React.Fragment key={d.key}>
                    {/* Tap target spanning the whole slot */}
                    <Rect
                      x={i * slot}
                      y={0}
                      width={slot}
                      height={CHART_HEIGHT}
                      fill="transparent"
                      onPress={() => onBarPress(i)}
                    />
                    {d.deposits > 0 && (
                      <Path
                        d={roundedTopPath(groupX, baseY - inH, barWidth, inH, BAR_RADIUS)}
                        fill={palette.success}
                        opacity={activeIdx === null || isActive ? 1 : 0.35}
                      />
                    )}
                    {d.withdrawals > 0 && (
                      <Path
                        d={roundedTopPath(groupX + barWidth + GROUP_GAP, baseY - outH, barWidth, outH, BAR_RADIUS)}
                        fill={palette.error}
                        opacity={activeIdx === null || isActive ? 1 : 0.35}
                      />
                    )}
                    {/* Active slot highlight */}
                    {isActive && (
                      <Rect
                        x={i * slot + 1}
                        y={PAD_TOP - 6}
                        width={slot - 2}
                        height={plotHeight + 6}
                        rx={8}
                        fill={palette.text}
                        fillOpacity={0.06}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>
          </Pressable>
        )}
      </View>

      {/* X-axis labels */}
      {showLabels && hasAnyVolume && (
        <View style={styles.labelsRow} pointerEvents="none">
          {data.map((d, i) => (
            <Text
              key={d.key}
              style={[
                Typography.footnote,
                styles.axisLabel,
                {
                  width: slot,
                  color:
                    activeIdx === i ? palette.text : hexToRgba(palette.text, 0.35),
                  fontWeight: activeIdx === i ? '700' : '400'
                }
              ]}
              numberOfLines={1}
            >
              {i % labelStep === 0 || activeIdx === i ? d.label : ' '}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  tooltip: {
    alignSelf: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 2,
    alignItems: 'center'
  },
  plotArea: {
    height: CHART_HEIGHT,
    width: '100%'
  },
  emptyPlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  labelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  axisLabel: {
    textAlign: 'center',
    fontSize: 10
  }
});
