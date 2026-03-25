import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Link } from 'expo-router';
import { useFonts } from 'expo-font';
import { T } from '../styles/global';
import TutorialModal, { TUTORIAL_STEPS } from './components/TutorialModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FadeInOnScroll: React.FC<{ children: React.ReactNode; scrollY: Animated.Value }> = ({ children, scrollY }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [viewTop, setViewTop] = useState<number | null>(null);

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      if (viewTop !== null && value + SCREEN_HEIGHT - 80 >= viewTop) {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, viewTop, fadeAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim }} onLayout={e => setViewTop(e.nativeEvent.layout.y)}>
      {children}
    </Animated.View>
  );
};

const SECTIONS = [
  {
    tag: '// 01',
    label: 'OVERVIEW',
    body: 'Every round, a hidden stock price is generated from dice rolls and a coin flip. Players trade the stock using bids and asks. When the round ends, the true price is revealed and P&L is settled.',
    stats: [
      { label: 'PLAYERS', value: '4 – 10' },
      { label: 'ROUND TIME', value: '5 MIN' },
      { label: 'PRICE RANGE', value: '$1 – $20' },
    ],
  },
  {
    tag: '// 02',
    label: 'PRICE GENERATION',
    body: 'The fair value is determined by two mechanisms operating in secret.',
    bullets: [
      { key: 'DICE', desc: '2 twenty-sided dice are rolled (3 dice for 8+ players). Each roll is a candidate price.' },
      { key: 'COIN FLIP', desc: 'HEADS → fair value = highest roll. TAILS → fair value = lowest roll.' },
      { key: 'SECRECY', desc: 'No single player sees the full picture. Information is distributed.' },
    ],
  },
  {
    tag: '// 03',
    label: 'PLAYER ROLES',
    body: 'Each round, every player is assigned one of four roles.',
    bullets: [
      { key: 'DICE HOLDER', desc: 'Knows one dice value. Two players receive this role (one per die).' },
      { key: 'COIN HOLDER', desc: 'Knows the coin flip result: HIGH or LOW. One player receives this role.' },
      { key: 'CONTRACTOR', desc: 'Assigned a trade obligation (e.g. LONG @ 3 = buy 3+ times). Failing costs $100.' },
      { key: 'MARKET MAKER', desc: 'No private info. Must read the market and infer fair value from price action.' },
    ],
  },
  {
    tag: '// 04',
    label: 'TRADING MECHANICS',
    body: 'The market runs on a continuous double auction.',
    bullets: [
      { key: 'BID', desc: 'The highest price a buyer will pay. New bids must strictly exceed the current bid.' },
      { key: 'ASK', desc: 'The lowest price a seller will accept. New asks must undercut the current ask.' },
      { key: 'LIFT ASK', desc: 'Buy immediately at the standing ask price. Clears the ask.' },
      { key: 'HIT BID', desc: 'Sell immediately at the standing bid price. Clears the bid.' },
    ],
  },
  {
    tag: '// 05',
    label: 'PROFIT & LOSS',
    body: 'At round end, the fair value is revealed and all trades are settled.',
    bullets: [
      { key: 'LONG', desc: 'Each unit bought is worth (fair value − purchase price).' },
      { key: 'SHORT', desc: 'Each unit sold is worth (sale price − fair value).' },
      { key: 'PENALTY', desc: 'Failing to meet a contract obligation deducts $100 from round P&L.' },
      { key: 'LEADERBOARD', desc: 'P&L accumulates across rounds. Highest total at game end wins.' },
    ],
    example: ['Fair value = $15', 'Bought at $12  →  +$3', 'Sold at $18  →  +$3', 'Contract missed  →  −$100'],
  },
  {
    tag: '// 06',
    label: 'WINNING',
    body: 'Profits and losses accumulate across all rounds. The player with the highest cumulative P&L when the game ends wins. Use your private information wisely, manage your contract obligations, and read the market.',
    bullets: [
      { key: 'EDGE', desc: 'Private info is your advantage. Use it without revealing what you know.' },
      { key: 'DEDUCTION', desc: 'Watch others\' bids and asks — they reveal information about their role.' },
      { key: 'DISCIPLINE', desc: 'Always fulfill your contract. A $100 penalty wipes out multiple good trades.' },
    ],
  },
];

export default function Rules() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);

  const [fontsLoaded] = useFonts({
    'Orbitron': require('../assets/fonts/Orbitron-Bold.ttf'),
  });

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const handleTutorialNext = useCallback(() => {
    setTutorialStep(prev => {
      if (prev === null) return null;
      if (prev >= TUTORIAL_STEPS.length - 1) {
        try { window.localStorage.setItem('hiloTutorialSeen', '1'); } catch {}
        return null;
      }
      return prev + 1;
    });
  }, []);

  const handleTutorialSkip = useCallback(() => {
    try { window.localStorage.setItem('hiloTutorialSeen', '1'); } catch {}
    setTutorialStep(null);
  }, []);

  const launchTutorial = useCallback(() => setTutorialStep(0), []);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarBrand}>HI-LO TRADING TERMINAL</Text>
          <Text style={styles.topBarSection}>// RULES</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          onScroll={e => scrollY.setValue(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
        >
          <View style={styles.inner}>

            {/* Page header */}
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>GAME RULES</Text>
              <Text style={styles.pageSubtitle}>QUANTITATIVE TRADING SIMULATION</Text>
              <View style={styles.titleAccent} />
              <Text style={styles.pageDesc}>
                A real-time multiplayer market game where information asymmetry drives profit.
                Each player holds one piece of a puzzle — use it.
              </Text>
            </View>

            {/* Sections */}
            {SECTIONS.map((section, i) => (
              <FadeInOnScroll key={section.tag} scrollY={scrollY}>
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTag}>{section.tag}</Text>
                    <Text style={styles.sectionLabel}>{section.label}</Text>
                  </View>

                  <Text style={styles.sectionBody}>{section.body}</Text>

                  {section.bullets && (
                    <View style={styles.bulletList}>
                      {section.bullets.map(b => (
                        <View key={b.key} style={styles.bulletRow}>
                          <Text style={styles.bulletKey}>{b.key}</Text>
                          <Text style={styles.bulletDesc}>{b.desc}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {section.stats && (
                    <View style={styles.statsRow}>
                      {section.stats.map(s => (
                        <View key={s.label} style={styles.statBox}>
                          <Text style={styles.statValue}>{s.value}</Text>
                          <Text style={styles.statLabel}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {section.example && (
                    <View style={styles.exampleBlock}>
                      <Text style={styles.exampleLabel}>// EXAMPLE</Text>
                      {section.example.map((line, li) => (
                        <Text
                          key={li}
                          style={[styles.exampleLine, line.startsWith('Contract') && { color: T.red }]}
                        >
                          {line}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </FadeInOnScroll>
            ))}

            {/* Footer actions */}
            <FadeInOnScroll scrollY={scrollY}>
              <View style={styles.footer}>
                <TouchableOpacity style={styles.tutorialBtn} onPress={launchTutorial}>
                  <Text style={styles.tutorialBtnText}>▶  LAUNCH GAME TUTORIAL</Text>
                </TouchableOpacity>
                <Link href="/" style={styles.backLink}>
                  <Text style={styles.backLinkText}>← BACK TO TERMINAL</Text>
                </Link>
              </View>
            </FadeInOnScroll>

          </View>
        </ScrollView>
      </Animated.View>

      <TutorialModal step={tutorialStep} onNext={handleTutorialNext} onSkip={handleTutorialSkip} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  topBarBrand: {
    fontFamily: 'Orbitron',
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
  },
  topBarSection: {
    fontFamily: 'Orbitron',
    fontSize: 10,
    color: T.green,
    letterSpacing: 2,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  inner: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
  },

  // Page header
  pageHeader: {
    paddingVertical: 48,
    borderBottomWidth: 1,
    borderColor: T.border,
    marginBottom: 8,
  },
  pageTitle: {
    fontFamily: 'Orbitron',
    fontSize: 32,
    color: T.textPri,
    letterSpacing: 6,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontFamily: 'Orbitron',
    fontSize: 11,
    color: T.textDim,
    letterSpacing: 3,
    marginBottom: 16,
  },
  titleAccent: {
    width: 40,
    height: 2,
    backgroundColor: T.green,
    marginBottom: 20,
  },
  pageDesc: {
    fontFamily: T.mono,
    fontSize: 14,
    color: T.textSec,
    lineHeight: 22,
    maxWidth: 560,
  },

  // Sections
  section: {
    borderBottomWidth: 1,
    borderColor: T.border,
    paddingVertical: 36,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 16,
  },
  sectionTag: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textDim,
    letterSpacing: 1,
  },
  sectionLabel: {
    fontFamily: 'Orbitron',
    fontSize: 13,
    color: T.textPri,
    letterSpacing: 3,
  },
  sectionBody: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textSec,
    lineHeight: 21,
    marginBottom: 20,
  },

  // Bullets
  bulletList: {
    gap: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: T.border,
    gap: 16,
    alignItems: 'flex-start',
  },
  bulletKey: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.amber,
    letterSpacing: 1,
    width: 100,
    flexShrink: 0,
    marginTop: 1,
  },
  bulletDesc: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textSec,
    lineHeight: 20,
    flex: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Orbitron',
    fontSize: 18,
    color: T.green,
    letterSpacing: 2,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
  },

  // Example block
  exampleBlock: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderLeftWidth: 2,
    borderLeftColor: T.amber,
    padding: 16,
    marginTop: 16,
    gap: 6,
  },
  exampleLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
    marginBottom: 8,
  },
  exampleLine: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textSec,
    lineHeight: 20,
  },

  // Footer
  footer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 16,
  },
  tutorialBtn: {
    borderWidth: 1,
    borderColor: T.green,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0,255,136,0.05)',
  },
  tutorialBtnText: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.green,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  backLink: {
    paddingVertical: 10,
  },
  backLinkText: {
    fontFamily: T.mono,
    fontSize: 12,
    color: T.textDim,
    letterSpacing: 2,
  },
});
