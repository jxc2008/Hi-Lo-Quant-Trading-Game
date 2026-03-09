import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { MaterialIcons, FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { getSocket } from '../utils/socket';
import { PlayerRole } from './components/PlayerInfoPopup';
import { T } from '../styles/global';

// Constants
const ROUND_DURATION = 300;
const DEBUG_ROUND_DURATION = 10;
const MIN_BID_ASK = 1;
const MAX_BID_ASK = 20;
const INITIAL_ASK = 21;
const INITIAL_BID = 0;
const HOMEPAGE_URL = "https://hilotrader.org";

// Classify a log line for color-coding
function classifyLog(line: string): 'buy' | 'sell' | 'join' | 'system' | 'default' {
  const l = line.toLowerCase();
  if (l.includes('hit the bid') || l.includes('bought') || l.includes('place a bid')) return 'buy';
  if (l.includes('lifted the ask') || l.includes('sold') || l.includes('place an ask')) return 'sell';
  if (l.includes('has left') || l.includes('has joined') || l.includes('new host')) return 'join';
  if (l.includes('round') || l.includes('started') || l.includes('ended')) return 'system';
  return 'default';
}

export default function GamePage() {
  const [loading, setLoading] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [gameLog, setGameLog] = useState<string[]>([
    'Round has started! Place your bids and asks now.',
  ]);
  const scrollRef = useRef<ScrollView>(null);
  const [currentBid, setCurrentBid] = useState(INITIAL_BID);
  const [currentAsk, setCurrentAsk] = useState(INITIAL_ASK);
  const [playerBalance, setPlayerBalance] = useState(0);
  const [playerRole, setPlayerRole] = useState<PlayerRole>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [askAmount, setAskAmount] = useState('');
  const [endTime, setEndTime] = useState(Date.now() + DEBUG_ROUND_DURATION * 1000);
  const [timeLeft, setTimeLeft] = useState(DEBUG_ROUND_DURATION);
  const [endRoundPopup, setEndRoundPopup] = useState(false);
  const [playerInfo, setPlayerInfo] = useState<{
    contract: any;
    diceRoll?: number;
    coinFlip?: string;
  }>({ contract: null });
  const [host, setHost] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [dices, setDices] = useState<number[]>([]);
  const [coin, setCoin] = useState('');
  const [marketActive, setMarketActive] = useState(false);
  const [roundActive, setRoundActive] = useState(false);
  const [fairValue, setFairValue] = useState(0);
  const [players, setPlayers] = useState([]);
  const [newRoundPopup, setNewRoundPopup] = useState(false);

  // Flash animations
  const bidFlash = useRef(new Animated.Value(0)).current;
  const askFlash = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { roomId, username, gameData } = useLocalSearchParams();
  const navigation = useNavigation();

  const flashPrice = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: 500, useNativeDriver: false }),
    ]).start();
  }, []);

  // Parse and initialize game data
  useEffect(() => {
    if (!gameData) {
      console.error('gameData is undefined or null');
      setLoading(true);
      return;
    }

    try {
      const parsedGameData = JSON.parse(Array.isArray(gameData) ? gameData[0] : gameData);
      const finalData = typeof parsedGameData === 'string' ? JSON.parse(parsedGameData) : parsedGameData;

      setHost(finalData.host);
      setPlayerCount(finalData.player_count);
      setCurrentRound(finalData.current_round);
      setDices(finalData.dices);
      setCoin(finalData.coin);
      setMarketActive(finalData.market_active);
      setRoundActive(finalData.round_active);
      setFairValue(finalData.fair_value);

      const playersData = finalData.players.map((player: any) => ({
        username: player.username,
        status: player.status,
        lastActive: player.last_active,
        highLow: player.high_low,
        contract: player.contract,
        buyCount: player.buy_count,
        sellCount: player.sell_count,
        record: player.record,
        cumulativePnl: player.cumulative_pnl,
        roundPnl: player.round_pnl,
      }));

      setPlayers(playersData);

      const currentPlayer = playersData.find((p: any) => p.username === username);
      if (currentPlayer) {
        if (currentPlayer.contract && currentPlayer.contract.type_of_action) {
          setPlayerInfo({ contract: currentPlayer.contract });
          setPlayerRole('contractor');
        } else {
          const hasDiceRoll = currentPlayer.record.some((record: any) => record[0] === 'dice_roll');
          const diceRoll = hasDiceRoll ? currentPlayer.record.find((record: any) => record[0] === 'dice_roll')[1] : undefined;
          setPlayerInfo({
            contract: null,
            diceRoll: diceRoll,
            coinFlip: currentPlayer.highLow || finalData.coin,
          });
          setPlayerRole('insider');
        }
      } else {
        console.error('Current player not found in players list');
      }

      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch (error) {
      console.error('Failed to parse gameData:', error);
    }
  }, [gameData, username]);

  // Rejoin socket room on connect/reconnect
  useEffect(() => {
    const socket = getSocket();
    const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId as string;
    const usernameStr = Array.isArray(username) ? username[0] : username as string;

    const joinRoom = () =>
      socket.emit('join_room', { roomId: roomIdStr, username: usernameStr });

    if (socket.connected) joinRoom();
    socket.on('connect', joinRoom);
    return () => socket.off('connect', joinRoom);
  }, [roomId, username]);

  // Socket: player left
  useEffect(() => {
    const socket = getSocket();
    const handlePlayerLeft = (data: any) => {
      setGameLog((prevLog) => [...prevLog, `${data.username} has left the game.`]);
      setPlayers((prevPlayers) => {
        const updatedPlayers = prevPlayers.filter((player: any) => player.username !== data.username);
        if (data.username === host) {
          if (data.newHost) {
            setHost(data.newHost);
            setGameLog((prevLog) => [...prevLog, `${data.newHost} is now the new host.`]);
          } else if (updatedPlayers.length < 4) {
            setGameLog((prevLog) => [...prevLog, `No new host assigned. Ending the game.`]);
            handleEndGame();
          }
        }
        if (updatedPlayers.length < 4 && data.username === host) {
          setGameLog((prevLog) => [...prevLog, `Not enough players to continue the game. Ending the game.`]);
          handleEndGame();
        }
        return updatedPlayers;
      });
    };
    socket.on('player_left', handlePlayerLeft);
    return () => socket.off('player_left', handlePlayerLeft);
  }, [host]);

  // Socket: host update
  useEffect(() => {
    const socket = getSocket();
    const handleHostUpdate = (data: any) => { setHost(data.newHost); };
    socket.on('update_host', handleHostUpdate);
    return () => socket.off('update_host', handleHostUpdate);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [gameLog]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = Math.max(Math.floor((endTime - Date.now()) / 1000), 0);
      setTimeLeft(newTimeLeft);
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  // Input handlers
  const handleKeyInput = useCallback(() => {
    const trimmedInput = userInput.trim().toLowerCase();
    const bidMatch = trimmedInput.match(/^b(\d+)b$/);
    const askMatch = trimmedInput.match(/^a(\d+)a$/);
    if (bidMatch) {
      handleBid(parseInt(bidMatch[1], 10));
    } else if (askMatch) {
      handleAsk(parseInt(askMatch[1], 10));
    } else if (trimmedInput === 'h') {
      handleHitBid();
    } else if (trimmedInput === 'l') {
      handleLiftAsk();
    } else {
      alert('Invalid input. Use: b{n}b, a{n}a, h, or l');
    }
    setUserInput('');
  }, [userInput]);

  const handleBid = useCallback((number: number) => {
    const socket = getSocket();
    if (isNaN(number) || number < MIN_BID_ASK || number > MAX_BID_ASK) {
      alert(`Invalid bid. Must be between ${MIN_BID_ASK} and ${MAX_BID_ASK}.`);
      return;
    }
    if (number >= currentAsk && currentAsk < INITIAL_ASK) {
      alert("Bid is higher than or equal to the current ask.");
      return;
    }
    if (number <= currentBid) {
      alert('Bid must be higher than the current bid.');
      return;
    }
    socket.emit("make_market", { roomId, playerName: username, action: "bid", number });
    setGameLog((prevLog) => [...prevLog, `You placed a bid for $${number}.`]);
    setCurrentBid(number);
    flashPrice(bidFlash);
    setBidAmount("");
  }, [roomId, username, currentAsk, currentBid, flashPrice]);

  const handleAsk = useCallback((number: number) => {
    if (isNaN(number) || number < MIN_BID_ASK || number > MAX_BID_ASK) {
      alert(`Invalid ask. Must be between ${MIN_BID_ASK} and ${MAX_BID_ASK}.`);
      return;
    }
    if (number <= currentBid && currentBid > INITIAL_BID) {
      alert("Ask is lower than or equal to the current bid.");
      return;
    }
    if (number >= currentAsk) {
      alert('Ask must be lower than the current ask.');
      return;
    }
    const socket = getSocket();
    socket.emit("make_market", { roomId, playerName: username, action: "ask", number });
    setGameLog((prevLog) => [...prevLog, `You placed an ask for $${number}.`]);
    setCurrentAsk(number);
    flashPrice(askFlash);
    setAskAmount("");
  }, [roomId, username, currentBid, currentAsk, flashPrice]);

  const handleHitBid = useCallback(() => {
    const socket = getSocket();
    if (currentBid > INITIAL_BID) {
      socket.emit("take_market", { roomId, playerName: username, action: "hit" });
    } else {
      alert('No valid bid to hit.');
    }
  }, [roomId, username, currentBid]);

  const handleLiftAsk = useCallback(() => {
    const socket = getSocket();
    if (currentAsk < INITIAL_ASK) {
      socket.emit("take_market", { roomId, playerName: username, action: "lift" });
    } else {
      alert('No valid ask to lift.');
    }
  }, [roomId, username, currentAsk]);

  // Market update
  useEffect(() => {
    const socket = getSocket();
    const handleMarketUpdate = (data: any) => {
      if (data.action === "hit") {
        setGameLog((prevLog) => [...prevLog, `${data.playerName} has hit the bid! Sold to ${data.bidPlayer} for $${data.price}.`]);
        setCurrentBid(INITIAL_BID);
        flashPrice(bidFlash);
      } else if (data.action === "lift") {
        setGameLog((prevLog) => [...prevLog, `${data.playerName} has lifted the ask! Bought from ${data.askPlayer} for $${data.price}.`]);
        setCurrentAsk(INITIAL_ASK);
        flashPrice(askFlash);
      } else if (data.action === "ask") {
        setCurrentAsk(data.currentAsk);
        flashPrice(askFlash);
        setGameLog((prevLog) => [...prevLog, data.logMessage]);
      } else if (data.action === "bid") {
        setCurrentBid(data.currentBid);
        flashPrice(bidFlash);
        setGameLog((prevLog) => [...prevLog, data.logMessage]);
      }
    };
    socket.on('market_update', handleMarketUpdate);
    return () => socket.off('market_update', handleMarketUpdate);
  }, [flashPrice]);

  // Game ended
  useEffect(() => {
    const socket = getSocket();
    const handleGameEnded = () => { window.location.href = HOMEPAGE_URL; };
    socket.on('game_ended', handleGameEnded);
    return () => socket.off('game_ended', handleGameEnded);
  }, []);

  // Start round
  useEffect(() => {
    const socket = getSocket();
    const handleStartRound = (data: any) => {
      try {
        const parsedData = JSON.parse(data.gameData);
        setCurrentRound(parsedData.current_round);
        setHost(parsedData.host);
        setPlayerCount(parsedData.player_count);
        setDices(parsedData.dices);
        setCoin(parsedData.coin);
        setMarketActive(parsedData.market_active);
        setRoundActive(parsedData.round_active);
        setFairValue(parsedData.fair_value);
        setPlayers(parsedData.players || []);

        const currentPlayer = (parsedData.players || []).find((p: any) => p.username === username);
        if (currentPlayer) {
          if (currentPlayer.contract && currentPlayer.contract.type_of_action) {
            setPlayerInfo({ contract: currentPlayer.contract });
            setPlayerRole('contractor');
          } else {
            const hasDiceRoll = currentPlayer.record.some((record: any) => record[0] === 'dice_roll');
            const diceRoll = hasDiceRoll ? currentPlayer.record.find((record: any) => record[0] === 'dice_roll')[1] : undefined;
            setPlayerInfo({ contract: null, diceRoll, coinFlip: currentPlayer.highLow || parsedData.coin });
            setPlayerRole('insider');
          }
        }

        setEndTime(Date.now() + ROUND_DURATION * 1000);
        setTimeLeft(ROUND_DURATION);
        setEndRoundPopup(false);
        setNewRoundPopup(true);
      } catch (error) {
        console.error('Failed to parse start_round data:', error);
      }
    };
    socket.on('start_round', handleStartRound);
    return () => socket.off('start_round', handleStartRound);
  }, [username]);

  // End round
  useEffect(() => {
    const socket = getSocket();
    const handleEndRound = (data: any) => {
      try {
        const parsedData = JSON.parse(data.gameData);
        setPlayers(parsedData.players);
        setEndRoundPopup(true);
      } catch (error) {
        console.error('Failed to parse end_round data:', error);
      }
    };
    socket.on('end_round', handleEndRound);
    return () => socket.off('end_round', handleEndRound);
  }, []);

  // Cleanup
  useEffect(() => {
    const socket = getSocket();
    const handleExit = () => {
      socket.emit('leave_game', { username, roomId });
      navigator.sendBeacon("https://hi-lo-backend.onrender.com/disconnect", JSON.stringify({ roomId, username }));
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); handleExit(); };
    const handlePopState = () => { handleExit(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      handleExit();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [roomId, username]);

  const handleLeaveGame = useCallback(() => {
    const socket = getSocket();
    if (window.confirm('Leave the game?')) {
      socket.emit('leave_game', { username, roomId });
      window.location.href = HOMEPAGE_URL;
    }
  }, [username, roomId]);

  const handleStartNextRound = useCallback(() => {
    if (username === host) {
      const socket = getSocket();
      socket.emit('start_round', { roomId });
      setEndRoundPopup(false);
      setEndTime(Date.now() + DEBUG_ROUND_DURATION * 1000);
      setTimeLeft(DEBUG_ROUND_DURATION);
      setCurrentAsk(INITIAL_ASK);
      setCurrentBid(INITIAL_BID);
    }
  }, [username, host, roomId]);

  const handleEndGame = useCallback(() => {
    const socket = getSocket();
    socket.emit('end_game', { roomId });
    window.location.href = HOMEPAGE_URL;
  }, [roomId]);

  // Stepper helpers
  const stepBid = (dir: 1 | -1) => {
    const current = parseInt(bidAmount) || currentBid;
    const next = Math.min(MAX_BID_ASK, Math.max(MIN_BID_ASK, current + dir));
    setBidAmount(String(next));
  };
  const stepAsk = (dir: 1 | -1) => {
    const current = parseInt(askAmount) || currentAsk;
    const next = Math.min(MAX_BID_ASK, Math.max(MIN_BID_ASK, current + dir));
    setAskAmount(String(next));
  };

  // Format time
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={T.green} />
          <Text style={styles.loadingText}>INITIALIZING TERMINAL</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sortedPlayers = [...players].sort((a: any, b: any) => (b.cumulativePnl || 0) - (a.cumulativePnl || 0));

  const bidBg = bidFlash.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,255,136,0)', 'rgba(0,255,136,0.25)'] });
  const askBg = askFlash.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,59,92,0)', 'rgba(255,59,92,0.25)'] });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarLabel}>HI-LO TRADING TERMINAL</Text>
        <Text style={styles.topBarMid}>RND <Text style={styles.topBarValue}>{currentRound}</Text></Text>
        <View style={styles.topBarRight}>
          <View style={[styles.statusDot, { backgroundColor: roundActive ? T.green : T.textDim }]} />
          <Text style={[styles.topBarStatus, { color: roundActive ? T.green : T.textDim }]}>
            {roundActive ? 'LIVE' : 'IDLE'}
          </Text>
        </View>
      </View>

      <Animated.ScrollView
        ref={scrollRef as any}
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* ── MARKET INFO CARD ─────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// MARKET</Text>

          <View style={styles.marketRow}>
            <Animated.View style={[styles.priceBox, styles.priceBoxBid, { backgroundColor: bidBg }]}>
              <Text style={styles.priceBoxLabel}>BID</Text>
              <Text style={[styles.priceBoxValue, { color: T.green }]}>
                {currentBid > INITIAL_BID ? `$${currentBid}` : '—'}
              </Text>
            </Animated.View>

            <View style={styles.priceBoxDivider} />

            <Animated.View style={[styles.priceBox, styles.priceBoxAsk, { backgroundColor: askBg }]}>
              <Text style={styles.priceBoxLabel}>ASK</Text>
              <Text style={[styles.priceBoxValue, { color: T.red }]}>
                {currentAsk < INITIAL_ASK ? `$${currentAsk}` : '—'}
              </Text>
            </Animated.View>
          </View>

          <View style={styles.marketMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>BALANCE</Text>
              <Text style={[styles.metaValue, { color: playerBalance >= 0 ? T.green : T.red }]}>
                ${playerBalance}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>TIME</Text>
              <Text style={[styles.metaValue, { color: timeLeft < 30 ? T.red : T.textPri }]}>
                {formatTime(timeLeft)}
              </Text>
            </View>
          </View>

          {/* Timer bar */}
          <View style={styles.timerTrack}>
            <View style={[styles.timerFill, {
              width: `${(timeLeft / ROUND_DURATION) * 100}%` as any,
              backgroundColor: timeLeft < 30 ? T.red : T.green,
            }]} />
          </View>
        </View>

        {/* ── TRADING CARD ─────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// TRADE</Text>

          {/* Bid stepper */}
          <View style={styles.tradeRow}>
            <Text style={styles.tradeLabel}>BID</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={[styles.stepBtn, { borderColor: T.green }]} onPress={() => stepBid(-1)}>
                <Text style={[styles.stepBtnText, { color: T.green }]}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.stepInput, { borderColor: T.green }]}
                value={bidAmount}
                onChangeText={setBidAmount}
                keyboardType="numeric"
                placeholder={`${currentBid > INITIAL_BID ? currentBid : '—'}`}
                placeholderTextColor={T.textDim}
              />
              <TouchableOpacity style={[styles.stepBtn, { borderColor: T.green }]} onPress={() => stepBid(1)}>
                <Text style={[styles.stepBtnText, { color: T.green }]}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.tradeBtn, { borderColor: T.green, backgroundColor: 'rgba(0,255,136,0.08)' }]}
              onPress={() => handleBid(parseInt(bidAmount))}
            >
              <Text style={[styles.tradeBtnText, { color: T.green }]}>PLACE BID</Text>
            </TouchableOpacity>
          </View>

          {/* Ask stepper */}
          <View style={styles.tradeRow}>
            <Text style={styles.tradeLabel}>ASK</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={[styles.stepBtn, { borderColor: T.red }]} onPress={() => stepAsk(-1)}>
                <Text style={[styles.stepBtnText, { color: T.red }]}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.stepInput, { borderColor: T.red }]}
                value={askAmount}
                onChangeText={setAskAmount}
                keyboardType="numeric"
                placeholder={`${currentAsk < INITIAL_ASK ? currentAsk : '—'}`}
                placeholderTextColor={T.textDim}
              />
              <TouchableOpacity style={[styles.stepBtn, { borderColor: T.red }]} onPress={() => stepAsk(1)}>
                <Text style={[styles.stepBtnText, { color: T.red }]}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.tradeBtn, { borderColor: T.red, backgroundColor: 'rgba(255,59,92,0.08)' }]}
              onPress={() => handleAsk(parseInt(askAmount))}
            >
              <Text style={[styles.tradeBtnText, { color: T.red }]}>PLACE ASK</Text>
            </TouchableOpacity>
          </View>

          {/* Hit / Lift */}
          <View style={styles.hitLiftRow}>
            <TouchableOpacity
              style={[styles.hitLiftBtn, { borderColor: T.red, backgroundColor: 'rgba(255,59,92,0.12)' }]}
              onPress={handleHitBid}
            >
              <MaterialIcons name="arrow-downward" size={16} color={T.red} />
              <Text style={[styles.hitLiftText, { color: T.red }]}>
                HIT BID{currentBid > INITIAL_BID ? ` $${currentBid}` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.hitLiftBtn, { borderColor: T.green, backgroundColor: 'rgba(0,255,136,0.12)' }]}
              onPress={handleLiftAsk}
            >
              <MaterialIcons name="arrow-upward" size={16} color={T.green} />
              <Text style={[styles.hitLiftText, { color: T.green }]}>
                LIFT ASK{currentAsk < INITIAL_ASK ? ` $${currentAsk}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ROLE CARD ────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// YOUR POSITION</Text>
          <View style={[styles.roleBadge, playerRole === 'contractor' ? styles.roleBadgeContractor : styles.roleBadgeInsider]}>
            <Text style={[styles.roleBadgeIcon, playerRole === 'contractor' ? { color: T.amber } : { color: T.cyan }]}>
              {playerRole === 'contractor' ? '◆' : '●'}
            </Text>
            <Text style={[styles.roleBadgeText, playerRole === 'contractor' ? { color: T.amber } : { color: T.cyan }]}>
              {playerRole ? playerRole.toUpperCase() : 'UNKNOWN'}
            </Text>
          </View>

          <View style={styles.roleInfo}>
            {playerRole === 'contractor' && playerInfo.contract ? (
              <View style={styles.roleInfoRow}>
                <Text style={styles.roleInfoLabel}>ACTION</Text>
                <Text style={[styles.roleInfoValue, { color: T.amber }]}>
                  {playerInfo.contract.type_of_action?.toUpperCase()} @ {playerInfo.contract.number}
                </Text>
              </View>
            ) : playerRole === 'insider' ? (
              <>
                {playerInfo.diceRoll !== undefined && (
                  <View style={styles.roleInfoRow}>
                    <Text style={styles.roleInfoLabel}>DICE ROLL</Text>
                    <Text style={[styles.roleInfoValue, { color: T.cyan }]}>{playerInfo.diceRoll}</Text>
                  </View>
                )}
                {playerInfo.coinFlip && (
                  <View style={styles.roleInfoRow}>
                    <Text style={styles.roleInfoLabel}>COIN FLIP</Text>
                    <Text style={[styles.roleInfoValue, { color: T.cyan }]}>{playerInfo.coinFlip?.toUpperCase()}</Text>
                  </View>
                )}
              </>
            ) : null}
          </View>
        </View>

        {/* ── LEADERBOARD ──────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// LEADERBOARD</Text>
          {sortedPlayers.map((player: any, index: number) => (
            <View key={index} style={[styles.leaderRow, player.username === username && styles.leaderRowSelf]}>
              <Text style={styles.leaderRank}>#{index + 1}</Text>
              <Text style={[styles.leaderName, player.username === username && { color: T.textPri }]}>
                {player.username}
              </Text>
              <Text style={[styles.leaderPnl, { color: (player.cumulativePnl || 0) >= 0 ? T.green : T.red }]}>
                {(player.cumulativePnl || 0) >= 0 ? '+' : ''}${player.cumulativePnl || 0}
              </Text>
            </View>
          ))}
        </View>

        {/* ── COMMAND INPUT ────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// COMMAND</Text>
          <View style={styles.commandRow}>
            <Text style={styles.commandPrompt}>&gt;</Text>
            <TextInput
              style={styles.commandInput}
              placeholder="b10b · a15a · h · l"
              placeholderTextColor={T.textDim}
              value={userInput}
              onChangeText={setUserInput}
              onSubmitEditing={handleKeyInput}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.commandSubmit} onPress={handleKeyInput}>
              <Text style={styles.commandSubmitText}>↵</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── GAME LOG ─────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// LOG</Text>
          <ScrollView style={styles.logScroll} ref={scrollRef} nestedScrollEnabled>
            {gameLog.map((line, i) => {
              const type = classifyLog(line);
              const color =
                type === 'buy' ? T.green :
                type === 'sell' ? T.red :
                type === 'join' ? T.textDim :
                type === 'system' ? T.amber :
                T.textSec;
              const prefix = type === 'buy' ? '▲ ' : type === 'sell' ? '▼ ' : '· ';
              return (
                <Text key={i} style={[styles.logLine, { color }]}>
                  {prefix}{line}
                </Text>
              );
            })}
          </ScrollView>
        </View>

        {/* ── LEAVE GAME ───────────────────────────── */}
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGame}>
          <Text style={styles.leaveButtonText}>DISCONNECT</Text>
        </TouchableOpacity>

      </Animated.ScrollView>

      {/* ── END ROUND MODAL ──────────────────────── */}
      {endRoundPopup && (
        <Modal transparent visible animationType="fade" onRequestClose={() => {}}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalLabel}>// ROUND {currentRound} COMPLETE</Text>
              <View style={styles.modalDivider} />
              <Text style={styles.modalMeta}>FAIR VALUE: <Text style={{ color: T.amber }}>${fairValue}</Text></Text>
              <Text style={styles.modalSubLabel}>ROUND P&L</Text>
              {players.map((p: any, i: number) => (
                <View key={i} style={styles.modalPnlRow}>
                  <Text style={styles.modalPnlName}>{p.username}</Text>
                  <Text style={[styles.modalPnlValue, { color: (p.round_pnl || 0) >= 0 ? T.green : T.red }]}>
                    {(p.round_pnl || 0) >= 0 ? '+' : ''}${p.round_pnl || 0}
                  </Text>
                </View>
              ))}
              {username === host && (
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, { borderColor: T.green }]} onPress={handleStartNextRound}>
                    <Text style={[styles.modalBtnText, { color: T.green }]}>NEXT ROUND</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { borderColor: T.red }]} onPress={handleEndGame}>
                    <Text style={[styles.modalBtnText, { color: T.red }]}>END GAME</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* ── NEW ROUND MODAL ──────────────────────── */}
      {newRoundPopup && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setNewRoundPopup(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalLabel}>// ROUND {currentRound} STARTING</Text>
              <View style={styles.modalDivider} />
              <View style={[styles.roleBadge, playerRole === 'contractor' ? styles.roleBadgeContractor : styles.roleBadgeInsider]}>
                <Text style={[styles.roleBadgeIcon, playerRole === 'contractor' ? { color: T.amber } : { color: T.cyan }]}>
                  {playerRole === 'contractor' ? '◆' : '●'}
                </Text>
                <Text style={[styles.roleBadgeText, playerRole === 'contractor' ? { color: T.amber } : { color: T.cyan }]}>
                  {playerRole ? playerRole.toUpperCase() : ''}
                </Text>
              </View>
              <Text style={styles.modalMeta}>
                {playerRole === 'contractor'
                  ? `${playerInfo.contract?.type_of_action?.toUpperCase()} @ ${playerInfo.contract?.number}`
                  : playerRole === 'insider'
                  ? (playerInfo.diceRoll !== undefined ? `DICE: ${playerInfo.diceRoll}` : `COIN: ${playerInfo.coinFlip?.toUpperCase()}`)
                  : ''}
              </Text>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: T.green, marginTop: 16 }]} onPress={() => setNewRoundPopup(false)}>
                <Text style={[styles.modalBtnText, { color: T.green }]}>READY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: T.mono,
    fontSize: 12,
    color: T.textSec,
    letterSpacing: 3,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  topBarLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 1.5,
    flex: 1,
  },
  topBarMid: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textSec,
    letterSpacing: 1,
  },
  topBarValue: {
    color: T.textPri,
    fontWeight: 'bold',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topBarStatus: {
    fontFamily: T.mono,
    fontSize: 10,
    letterSpacing: 1,
  },

  scrollContainer: {
    padding: 12,
    gap: 10,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },

  // Card
  card: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 2,
    padding: 14,
  },
  cardLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
    marginBottom: 12,
  },

  // Market
  marketRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
  },
  priceBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  priceBoxBid: {
    borderColor: T.green,
  },
  priceBoxAsk: {
    borderColor: T.red,
  },
  priceBoxLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textSec,
    letterSpacing: 2,
    marginBottom: 6,
  },
  priceBoxValue: {
    fontFamily: T.mono,
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: -1,
  },
  priceBoxDivider: {
    width: 10,
  },
  marketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontFamily: T.mono,
    fontSize: 9,
    color: T.textDim,
    letterSpacing: 2,
    marginBottom: 2,
  },
  metaValue: {
    fontFamily: T.mono,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  timerTrack: {
    height: 2,
    backgroundColor: T.border,
    borderRadius: 1,
    overflow: 'hidden',
  },
  timerFill: {
    height: 2,
    borderRadius: 1,
  },

  // Trading
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  tradeLabel: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textSec,
    letterSpacing: 1,
    width: 30,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
  },
  stepBtnText: {
    fontFamily: T.mono,
    fontSize: 18,
    lineHeight: 20,
  },
  stepInput: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontFamily: T.mono,
    fontSize: 15,
    fontWeight: 'bold',
    color: T.textPri,
    backgroundColor: T.surface2,
  },
  tradeBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  tradeBtnText: {
    fontFamily: T.mono,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  hitLiftRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  hitLiftBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 2,
    gap: 6,
  },
  hitLiftText: {
    fontFamily: T.mono,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Role
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 2,
    gap: 8,
    marginBottom: 10,
  },
  roleBadgeContractor: {
    borderColor: T.amber,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  roleBadgeInsider: {
    borderColor: T.cyan,
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  roleBadgeIcon: {
    fontSize: 14,
  },
  roleBadgeText: {
    fontFamily: T.mono,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  roleInfo: {
    gap: 6,
  },
  roleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleInfoLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
    width: 70,
  },
  roleInfoValue: {
    fontFamily: T.mono,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Leaderboard
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: T.border,
    gap: 10,
  },
  leaderRowSelf: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  leaderRank: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textDim,
    width: 24,
  },
  leaderName: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textSec,
    flex: 1,
  },
  leaderPnl: {
    fontFamily: T.mono,
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Command
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commandPrompt: {
    fontFamily: T.mono,
    fontSize: 16,
    color: T.green,
    width: 16,
  },
  commandInput: {
    flex: 1,
    fontFamily: T.mono,
    fontSize: 14,
    color: T.textPri,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: T.surface2,
  },
  commandSubmit: {
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 2,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  commandSubmitText: {
    fontFamily: T.mono,
    fontSize: 16,
    color: T.textSec,
  },

  // Log
  logScroll: {
    maxHeight: 140,
  },
  logLine: {
    fontFamily: T.mono,
    fontSize: 12,
    lineHeight: 20,
    paddingVertical: 1,
  },

  // Leave
  leaveButton: {
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: T.red,
    borderRadius: 2,
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,92,0.06)',
  },
  leaveButtonText: {
    fontFamily: T.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: T.red,
    letterSpacing: 3,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '88%',
    maxWidth: 400,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 2,
    padding: 24,
  },
  modalLabel: {
    fontFamily: T.mono,
    fontSize: 12,
    color: T.textSec,
    letterSpacing: 2,
    marginBottom: 12,
  },
  modalDivider: {
    height: 1,
    backgroundColor: T.border,
    marginBottom: 14,
  },
  modalMeta: {
    fontFamily: T.mono,
    fontSize: 14,
    color: T.textSec,
    marginBottom: 14,
  },
  modalSubLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
    marginBottom: 8,
  },
  modalPnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  modalPnlName: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textSec,
  },
  modalPnlValue: {
    fontFamily: T.mono,
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
  },
  modalBtnText: {
    fontFamily: T.mono,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});
