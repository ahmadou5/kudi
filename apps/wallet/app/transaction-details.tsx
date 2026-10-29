import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    Linking,
    Alert,
    Pressable
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
    Copy,
    CheckCircle2,
    ExternalLink,
    ArrowLeft,
    BadgeCheck,
    BadgeAlert,
    BadgeX
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { useAppPalette, hexToRgba } from '../src/lib/theme';
import { Typography } from '../src/constants/typography';
import { ChainLogo } from '../src/components/ui/ChainLogo';
import { CardBackgroundPattern } from '../src/components/ui/CardBackgroundPattern';
import { TransactionTrack } from '../src/components/ui/TransactionTrack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '../src/lib/haptics';
import { EnterSection } from '../src/lib/animations';
import { truncateHash } from '../src/utils/AddressUtils';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TransactionDetailsParams = {
    title?: string;
    subtitle?: string;
    amount?: string;
    secondaryAmount?: string;
    status?: string;
    date?: string;
    isDeposit?: string;
    chain?: string;
    tokenSymbol?: string;
    ref?: string;
    id?: string;
    txHash?: string;
};

export default function TransactionDetailsScreen() {
    const palette = useAppPalette();
    const insets = useSafeAreaInsets();
    const isDark = palette.scheme === 'dark';
    const params = useLocalSearchParams<TransactionDetailsParams>();

    const [copied, setCopied] = useState(false);
    const copyResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reducedMotion = useReducedMotion();
    const explorerScale = useSharedValue(1);

    const explorerBtnStyle = useAnimatedStyle(() => ({
        transform: [{ scale: explorerScale.value }]
    }));

    useEffect(() => {
        return () => {
            if (copyResetTimeout.current) clearTimeout(copyResetTimeout.current);
        };
    }, []);

    // Guard against opening this screen with no transaction data at all (stale deep link,
    // bad navigation state, etc.) — without this, every field below quietly falls back to a
    // placeholder and the user sees a convincing-looking "$0.00 SUCCESS" card for a
    // transaction that never happened.
    if (Object.keys(params).length === 0) {
        return (
            <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
                <View style={[styles.header, { borderBottomColor: palette.border }]}>
                    <Pressable
                        onPress={() => {
                            haptics.tap();
                            router.back();
                        }}
                        hitSlop={12}
                        style={({ pressed }) => [
                            styles.closeBtn,
                            { backgroundColor: palette.card, borderColor: palette.border },
                            pressed && { opacity: 0.6 }
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <ArrowLeft size={20} color={palette.text} />
                    </Pressable>
                    <Text style={[Typography.title3, { color: palette.text }]}>Transaction Details</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.notFoundContainer}>
                    <View style={[styles.notFoundIconCircle, { backgroundColor: palette.card, borderColor: palette.border }]}>
                        <BadgeAlert size={28} color={palette.textSecondary} />
                    </View>
                    <Text style={[Typography.title3, { color: palette.text, marginTop: 16 }]}>
                        Transaction not found
                    </Text>
                    <Text style={[Typography.footnote, { color: palette.textSecondary, marginTop: 6, textAlign: 'center' }]}>
                        We couldn't load details for this transaction. Go back and try opening it again.
                    </Text>
                </View>
            </View>
        );
    }

    // Parse passed params
    const title = params.title || 'Transaction Details';
    const subtitle = params.subtitle || '';
    const amount = params.amount || '$0.00';
    const secondaryAmount = params.secondaryAmount || '';
    const rawStatus = params.status || 'CONFIRMED';
    const isSuccess = ['SUCCESS', 'COMPLETED', 'CONFIRMED', 'DONE'].includes(rawStatus.toUpperCase());
    const isPending = ['PENDING', 'PROCESSING', 'BROADCAST'].includes(rawStatus.toUpperCase());
    const status = isSuccess ? 'CONFIRMED' : rawStatus.toUpperCase();

    const date = params.date || 'Recently';
    const isDeposit = params.isDeposit === 'true' || amount.startsWith('+');
    const chain = params.chain || '';
    const tokenSymbol = params.tokenSymbol || (amount.includes('AUSD') ? 'AUSD' : 'USDC');
    const txHash = params.txHash || (params.ref && (params.ref.startsWith('0x') || params.ref.length > 25) ? params.ref : '');
    const ref = txHash || params.ref || params.id || 'REF_UNKNOWN';

    // Logos resolution
    const isMonad = chain.toLowerCase().includes('monad') || tokenSymbol === 'AUSD' || title.toLowerCase().includes('ausd');
    const isSolana = chain.toLowerCase().includes('solana') || tokenSymbol === 'USDC' || subtitle.toLowerCase().includes('solana');

    let tokenLogo = require('../assets/logos/usdc.png');
    if (isMonad) {
        tokenLogo = require('../assets/logos/ausd.png');
    } else if (title.toLowerCase().includes('gtbank') || subtitle.toLowerCase().includes('gtbank')) {
        tokenLogo = require('../assets/logos/gtbank.png');
    } else if (title.toLowerCase().includes('zenith') || subtitle.toLowerCase().includes('zenith')) {
        tokenLogo = require('../assets/logos/zenith.png');
    }

    // Explorer link construction
    let explorerUrl: string | null = null;
    if (txHash) {
        if (isMonad) {
            explorerUrl = `https://testnet.monadexplorer.com/tx/${txHash}`;
        } else if (isSolana) {
            explorerUrl = `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
        }
    }

    const handleCopyRef = async () => {
        await Clipboard.setStringAsync(ref);
        haptics.impact('light');
        setCopied(true);
        copyResetTimeout.current = setTimeout(() => setCopied(false), 2500);
    };

    const handleOpenExplorer = () => {
        if (!explorerUrl) return;
        Linking.openURL(explorerUrl).catch((err) => {
            console.warn('Could not open explorer link:', err);
            Alert.alert('Unable to open link', 'Please check your connection and try again.');
        });
    };

    const statusBg = isSuccess
        ? hexToRgba(palette.success, 0.15)
        : isPending
            ? hexToRgba(palette.warning, 0.15)
            : hexToRgba(palette.error, 0.15);

    const statusColor = isSuccess
        ? palette.success
        : isPending
            ? palette.warning
            : palette.error;

    return (
        <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
            {/* Top Header Bar */}
            <View style={[styles.header]}>
                <Pressable
                    onPress={() => {
                        haptics.tap();
                        router.back();
                    }}
                    hitSlop={12}
                    style={({ pressed }) => [
                        styles.closeBtn,
                        { backgroundColor: palette.card, borderColor: palette.border },
                        pressed && { opacity: 0.6 }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <ArrowLeft size={20} color={palette.text} />
                </Pressable>
                <Text style={[Typography.title3, { color: palette.text }]}>Transaction Details</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Compact centered content — no scroll, fits the screen */}
            <View style={styles.content}>
                {/* Main Hero Card */}
                <EnterSection index={0}>
                    <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                        <CardBackgroundPattern
                            glowColor={hexToRgba(statusColor, isDark ? 0.12 : 0.08)}
                            isDarkOverride={isDark}
                        />
                        {/* Dual Token + Chain Badge Avatar */}
                        <View style={styles.avatarWrapper}>
                            <View style={[styles.tokenLogoCircle, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: palette.border }]}>
                                <Image source={tokenLogo} style={styles.tokenLogoImg} resizeMode="contain" />
                            </View>

                            {(isMonad || isSolana) && (
                                <View style={[styles.chainBadgeCircle, { backgroundColor: palette.card, borderColor: palette.card }]}>
                                    <ChainLogo chain={isMonad ? 'monad' : 'solana'} size={20} />
                                </View>
                            )}
                        </View>

                        {/* Amount Display */}
                        <Text
                            style={[
                                Typography.currencyDisplay,
                                styles.heroAmount,
                                { color: isDeposit ? palette.success : palette.text }
                            ]}
                        >
                            {amount}
                        </Text>

                        {!!secondaryAmount && (
                            <Text style={[Typography.currencySub, { color: palette.textSecondary, fontSize: 11 }]}>
                                {secondaryAmount}
                            </Text>
                        )}

                        {/* Status Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: hexToRgba(statusColor, 0.35) }]}>
                            {isSuccess && (<BadgeCheck size={15} color={statusColor} />)}
                            {isPending && (<BadgeAlert size={15} color={statusColor} />)}
                            {!isSuccess && !isPending && (<BadgeX size={15} color={statusColor} />)}
                            <Text style={[Typography.currencySub, { color: statusColor, fontSize: 12, letterSpacing: 0.6 }]}>
                                {status}
                            </Text>
                        </View>
                    </View>
                </EnterSection>

                {/* TRANSACTION STATUS TRACKER LINE - Only displayed for spend / outgoing transactions */}
                <EnterSection index={1}>
                    {!isDeposit && (
                        <View style={[styles.trackerCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                            <CardBackgroundPattern
                                glowColor={hexToRgba(statusColor, isDark ? 0.1 : 0.07)}
                                isDarkOverride={isDark}
                            />
                            <TransactionTrack
                                type={isSuccess ? 'success' : isPending ? 'pending' : 'failed'}
                                title="Status"
                                labels={
                                    isSuccess
                                        ? ['Requested', 'Processing', 'Completed']
                                        : isPending
                                            ? ['Requested', 'Processing', 'Pending']
                                            : ['Requested', 'Processing', 'Failed']
                                }
                                sublabels={
                                    isSuccess
                                        ? ['Submitted', 'Network', 'Finalized']
                                        : isPending
                                            ? ['Submitted', 'Network', 'Awaiting']
                                            : ['Submitted', 'Network', 'Rejected']
                                }
                            />
                        </View>
                    )}
                </EnterSection>

                {/* Info Rows Container */}
                <EnterSection index={2}>
                    <View style={[styles.detailsContainer, { backgroundColor: palette.card, borderColor: palette.border }]}>
                        <CardBackgroundPattern
                            glowColor={hexToRgba(statusColor, isDark ? 0.08 : 0.05)}
                            isDarkOverride={isDark}
                        />
                        <View style={styles.infoRow}>
                            <Text style={[Typography.currencySub, { color: palette.textSecondary, fontSize: 14 }]}>Type</Text>
                            <Text style={[Typography.bodyBold, { color: palette.text }]} numberOfLines={1}>
                                {title}
                            </Text>
                        </View>

                        <View style={[styles.divider, { backgroundColor: palette.border }]} />

                        <View style={styles.infoRow}>
                            <Text style={[Typography.currencySub, { color: palette.textSecondary, fontSize: 14 }]}>Network</Text>
                            <View style={styles.rowRightGroup}>
                                {(isMonad || isSolana) && <ChainLogo chain={isMonad ? 'monad' : 'solana'} size={16} />}
                                <Text style={[Typography.bodyBold, { color: palette.text }]} numberOfLines={1}>
                                    {isMonad ? 'Monad Testnet' : isSolana ? 'Solana Devnet' : 'Bank Payout (NGN)'}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: palette.border }]} />

                        <View style={styles.infoRow}>
                            <Text style={[Typography.currencySub, { color: palette.textSecondary, fontSize: 14 }]}>Asset</Text>
                            <Text style={[Typography.bodyBold, { color: palette.text }]}>
                                {tokenSymbol}
                            </Text>
                        </View>

                        <View style={[styles.divider, { backgroundColor: palette.border }]} />

                        <View style={styles.infoRow}>
                            <Text style={[Typography.currencySub, { color: palette.textSecondary, fontSize: 14 }]}>Date & Time</Text>
                            <Text style={[Typography.bodyBold, { color: palette.text }]} numberOfLines={1}>
                                {date}
                            </Text>
                        </View>

                        <View style={[styles.divider, { backgroundColor: palette.border }]} />

                        {/* Reference Row with Copy Button */}
                        <View style={styles.infoRowVertical}>
                            <View style={styles.refHeaderRow}>
                                <Text style={[Typography.currencySub, { color: palette.textSecondary, fontSize: 14 }]}>Reference</Text>
                                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                                    <Text style={[styles.refText, { color: palette.text }]} numberOfLines={1}>
                                        {truncateHash(ref)}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={handleCopyRef}
                                        activeOpacity={0.7}
                                        style={styles.copyBtn}
                                        accessibilityRole="button"
                                        accessibilityLabel={copied ? 'Reference copied' : 'Copy reference'}
                                    >
                                        {copied ? (
                                            <CheckCircle2 size={14} color={palette.success} />
                                        ) : (
                                            <Copy size={14} color={palette.textSecondary} />
                                        )}
                                        <Text style={[Typography.caption, { color: copied ? palette.success : palette.textSecondary, fontWeight: '600' }]}>
                                            {copied ? '' : ''}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                            </View>


                        </View>
                    </View>
                </EnterSection>
            </View >

            {/* Action Button: View on Block Explorer — pinned to the bottom */}
            {
                !!explorerUrl && (
                    <EnterSection index={3}>
                        <View style={[styles.explorerWrap, { paddingBottom: insets.bottom + 16 }]}>
                            <AnimatedPressable
                                onPress={handleOpenExplorer}
                                onPressIn={() => {
                                    if (reducedMotion) return;
                                    explorerScale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
                                }}
                                onPressOut={() => {
                                    if (reducedMotion) return;
                                    explorerScale.value = withSpring(1, { damping: 20, stiffness: 400 });
                                }}
                                style={[styles.explorerBtn, { backgroundColor: palette.text }, explorerBtnStyle]}
                                accessibilityRole="button"
                                accessibilityLabel={`View on ${isMonad ? 'Monad Explorer' : 'Solana Explorer'}`}
                            >
                                <ExternalLink size={18} color={palette.bg} />
                                <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                                    View on {isMonad ? 'Monad Explorer' : 'Solana Explorer'}
                                </Text>
                            </AnimatedPressable>
                        </View>
                    </EnterSection>
                )
            }
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 0
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    notFoundContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32
    },
    notFoundIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
        gap: 14
    },
    heroCard: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 20,
        alignItems: 'center',
        gap: 8,
        overflow: 'hidden'
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 4
    },
    tokenLogoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    tokenLogoImg: {
        width: 44,
        height: 44,
        borderRadius: 22
    },
    chainBadgeCircle: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center'
    },
    heroAmount: {
        marginTop: 4
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        marginTop: 6
    },
    trackerCard: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 16,
        overflow: 'hidden'
    },
    detailsContainer: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 16,
        gap: 10,
        overflow: 'hidden'
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    infoRowVertical: {
        gap: 6
    },
    refHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    rowRightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    divider: {
        height: StyleSheet.hairlineWidth
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    refText: {
        fontFamily: 'SpaceMono_400Regular',
        fontSize: 11,
        lineHeight: 15
    },
    explorerWrap: {
        paddingHorizontal: 20
    },
    explorerBtn: {
        height: 52,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8
    }
});

