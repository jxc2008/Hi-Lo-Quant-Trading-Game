import React, { useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { T } from '../../styles/global';

export const TUTORIAL_STEPS = [
  {
    title: '// WELCOME TO THE TERMINAL',
    body: 'This is the Hi-Lo Quant Trading Game.\n\nEach round, players are secretly assigned roles and must trade to profit. The market closes when time runs out and the fair value is revealed.\n\nThis tutorial walks you through each section of the screen.',
  },
  {
    title: '// YOUR POSITION',
    body: 'The YOUR POSITION card shows your secret role for this round.\n\n◆ CONTRACTOR — You must fulfill a trade obligation (e.g. LONG @ 3 means you need to buy at least 3 times). Failure costs you $100.\n\n● INSIDER — You know a piece of private info: either a dice value or the coin flip (HIGH = highest dice wins, LOW = lowest wins). Use this edge to trade profitably.',
  },
  {
    title: '// MARKET',
    body: 'The MARKET card shows the live bid and ask.\n\nBID (green) — the highest price anyone is currently willing to buy at.\nASK (red) — the lowest price anyone is currently willing to sell at.\n\nBALANCE tracks your P&L this session. TIME shows how long is left in the round.',
  },
  {
    title: '// TRADE',
    body: 'Use the TRADE card to interact with the market.\n\nPLACE BID — offer to buy at your chosen price (must beat current bid).\nPLACE ASK — offer to sell at your chosen price (must beat current ask).\n\nHIT BID — immediately sell to whoever placed the bid.\nLIFT ASK — immediately buy from whoever placed the ask.\n\nUse + / − steppers or type a number directly.',
  },
  {
    title: '// LEADERBOARD',
    body: 'The LEADERBOARD shows cumulative P&L for all players.\n\nP&L is calculated at the end of each round:\n· Each trade is settled against the revealed fair value.\n· Failing your contractor obligation deducts $100.\n· Insiders with good information have an edge — use it.',
  },
  {
    title: '// COMMAND SHORTCUTS',
    body: 'Power users can use the COMMAND input for fast actions:\n\nb10b — place a bid at $10\na15a — place an ask at $15\nh — hit the current bid\nl — lift the current ask\n\nPress Enter or ↵ to submit. Good luck.',
  },
];

interface TutorialModalProps {
  step: number | null;
  onNext: () => void;
  onSkip: () => void;
}

export default function TutorialModal({ step, onNext, onSkip }: TutorialModalProps) {
  if (step === null) return null;

  const current = TUTORIAL_STEPS[step];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.counter}>{step + 1}/{TUTORIAL_STEPS.length}</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.body}>{current.body}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { borderColor: T.textDim }]} onPress={onSkip}>
              <Text style={[styles.btnText, { color: T.textDim }]}>SKIP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { borderColor: T.green }]} onPress={onNext}>
              <Text style={[styles.btnText, { color: T.green }]}>
                {step >= TUTORIAL_STEPS.length - 1 ? 'DONE' : 'NEXT →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: T.border,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textDim,
    letterSpacing: 1.5,
    flex: 1,
  },
  counter: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: T.border,
    marginVertical: 12,
  },
  body: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textSec,
    lineHeight: 20,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: T.mono,
    fontSize: 12,
    letterSpacing: 1,
  },
});
