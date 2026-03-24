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
import { useLocalSearchParams } from 'expo-router';
import { getSocket } from '../utils/socket';
import { API_BASE_URL } from '../utils/config';
import { T } from '../styles/global';

const HOMEPAGE_URL = "https://bachilo.com";
const INITIAL_ASK = 21;
const INITIAL_BID = 0;

// Classify a log line for color-coding
function classifyLog(line: string): 'buy' | 'sell' | 'join' | 'system' | 'default' {
  const l = line.toLowerCase();
  if (l.includes('hit the bid') || l.includes('bought') || l.includes('place a bid')) return 'buy';
  if (l.includes('lifted the ask') || l.includes('sold') || l.includes('place an ask')) return 'sell';
  if (l.includes('has left') || l.includes('has joined') || l.includes('new host')) return 'join';
  if (l.includes('round') || l.includes('started') || l.includes('ended')) return 'system';
  return 'default';
}

export default function AdminPage() {
  const { roomId, username, gameData } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);

  // Game state
  const [host, setHost] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [dices, setDices] = useState<number[]>([]);
  const [coin, setCoin] = useState('');
  const [marketActive, setMarketActive] = useState(false);
  const [roundActive, setRoundActive] = useState(false);
  const [fairValue, setFairValue] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [currentBid, setCurrentBid] = useState(INITIAL_BID);
  const [currentAsk, setCurrentAsk] = useState(INITIAL_ASK);
  const [bidPlayer, setBidPlayer] = useState('');
  const [askPlayer, setAskPlayer] = useState('');
  const [marketPaused, setMarketPaused] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const [endTime, setEndTime] = useState(0);

  // Settings
  const [settings, setSettings] = useState<{ round_duration?: number; max_rounds?: number }>({});
  const [settingsRoundDuration, setSettingsRoundDuration] = useState('');
  const [settingsMaxRounds, setSettingsMaxRounds] = useState('');

  // Role assignments
  const [roleAssignments, setRoleAssignments] = useState<{[username: string]: {role: string, action?: string, number?: string, value?: string}}>({});

  // Edit round
  const [editDice1, setEditDice1] = useState('');
  const [editDice2, setEditDice2] = useState('');
  const [editDice3, setEditDice3] = useState('');
  const [editCoin, setEditCoin] = useState<'high' | 'low'>('high');

  // Log
  const [gameLog, setGameLog] = useState<string[]>(['Admin panel initialized.']);
  const scrollRef = useRef<ScrollView>(null);

  // End round popup
  const [endRoundPopup, setEndRoundPopup] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Parse initial game data
  useEffect(() => {
    if (!gameData) {
      console.error('gameData is undefined or null');
      return;
    }

    try {
      const parsedGameData = JSON.parse(Array.isArray(gameData) ? gameData[0] : gameData);
      const finalData = typeof parsedGameData === 'string' ? JSON.parse(parsedGameData) : parsedGameData;

      setHost(finalData.host);
      setPlayerCount(finalData.player_count);
      setCurrentRound(finalData.current_round);
      setDices(finalData.dices || []);
      setCoin(finalData.coin || '');
      setMarketActive(finalData.market_active);
      setRoundActive(finalData.round_active);
      setFairValue(finalData.fair_value);
      setCurrentBid(finalData.current_bid || INITIAL_BID);
      setCurrentAsk(finalData.current_ask || INITIAL_ASK);
      setBidPlayer(finalData.bid_player || '');
      setAskPlayer(finalData.ask_player || '');
      setRoomCode(finalData.room_code || '');

      if (finalData.settings) {
        setSettings(finalData.settings);
        setSettingsRoundDuration(String(finalData.settings.round_duration || ''));
        setSettingsMaxRounds(String(finalData.settings.max_rounds || ''));
      }

      const playersData = (finalData.players || []).map((player: any) => ({
        username: player.username,
        highLow: player.high_low,
        contract: player.contract,
        buyCount: player.buy_count,
        sellCount: player.sell_count,
        record: player.record,
        cumulativePnl: player.cumulative_pnl,
        roundPnl: player.round_pnl,
      }));
      setPlayers(playersData);

      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch (error) {
      console.error('Failed to parse gameData:', error);
    }
  }, [gameData]);

  // Socket: join room
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

  // Socket: player joined/left
  useEffect(() => {
    const socket = getSocket();
    const handlePlayerJoined = (data: any) => {
      setGameLog(prev => [...prev, `${data.username} has joined the game.`]);
      setPlayerCount(prev => prev + 1);
    };
    const handlePlayerLeft = (data: any) => {
      setGameLog(prev => [...prev, `${data.username} has left the game.`]);
      setPlayers(prev => prev.filter((p: any) => p.username !== data.username));
      setPlayerCount(prev => Math.max(0, prev - 1));
    };
    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);
    return () => {
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_left', handlePlayerLeft);
    };
  }, []);

  // Socket: market update
  useEffect(() => {
    const socket = getSocket();
    const handleMarketUpdate = (data: any) => {
      if (data.action === 'hit') {
        setGameLog(prev => [...prev, `${data.playerName} hit the bid! Sold to ${data.bidPlayer} for $${data.price}.`]);
        setCurrentBid(INITIAL_BID);
        setBidPlayer('');
      } else if (data.action === 'lift') {
        setGameLog(prev => [...prev, `${data.playerName} lifted the ask! Bought from ${data.askPlayer} for $${data.price}.`]);
        setCurrentAsk(INITIAL_ASK);
        setAskPlayer('');
      } else if (data.action === 'ask') {
        setCurrentAsk(data.currentAsk);
        setAskPlayer(data.playerName || '');
        setGameLog(prev => [...prev, data.logMessage]);
      } else if (data.action === 'bid') {
        setCurrentBid(data.currentBid);
        setBidPlayer(data.playerName || '');
        setGameLog(prev => [...prev, data.logMessage]);
      }
    };
    socket.on('market_update', handleMarketUpdate);
    return () => socket.off('market_update', handleMarketUpdate);
  }, []);

  // Socket: market paused/resumed
  useEffect(() => {
    const socket = getSocket();
    const handlePaused = (data: any) => {
      setMarketPaused(true);
      if (data?.time_remaining !== undefined) {
        setTimeLeft(Math.ceil(data.time_remaining));
      }
      setGameLog(prev => [...prev, 'Market PAUSED by admin.']);
    };
    const handleResumed = (data: any) => {
      setMarketPaused(false);
      if (data?.time_remaining !== undefined) {
        setTimeLeft(Math.ceil(data.time_remaining));
        setEndTime(Date.now() + data.time_remaining * 1000);
      }
      setGameLog(prev => [...prev, 'Market RESUMED by admin.']);
    };
    socket.on('market_paused', handlePaused);
    socket.on('market_resumed', handleResumed);
    return () => {
      socket.off('market_paused', handlePaused);
      socket.off('market_resumed', handleResumed);
    };
  }, []);

  // Socket: start round
  useEffect(() => {
    const socket = getSocket();
    const handleStartRound = (data: any) => {
      try {
        const parsedData = JSON.parse(data.gameData);
        setCurrentRound(parsedData.current_round);
        setHost(parsedData.host);
        setPlayerCount(parsedData.player_count);
        setDices(parsedData.dices || []);
        setCoin(parsedData.coin || '');
        setMarketActive(parsedData.market_active);
        setRoundActive(parsedData.round_active);
        setFairValue(parsedData.fair_value);
        setCurrentBid(parsedData.current_bid || INITIAL_BID);
        setCurrentAsk(parsedData.current_ask || INITIAL_ASK);
        setBidPlayer(parsedData.bid_player || '');
        setAskPlayer(parsedData.ask_player || '');

        if (parsedData.settings) {
          setSettings(parsedData.settings);
          setSettingsRoundDuration(String(parsedData.settings.round_duration || ''));
          setSettingsMaxRounds(String(parsedData.settings.max_rounds || ''));
        }

        const playersData = (parsedData.players || []).map((player: any) => ({
          username: player.username,
          highLow: player.high_low,
          contract: player.contract,
          buyCount: player.buy_count,
          sellCount: player.sell_count,
          record: player.record,
          cumulativePnl: player.cumulative_pnl,
          roundPnl: player.round_pnl,
        }));
        setPlayers(playersData);

        const roundDuration = parsedData.settings?.round_duration || settings.round_duration || 300;
        setEndTime(Date.now() + roundDuration * 1000);
        setTimeLeft(roundDuration);

        setEndRoundPopup(false);
        setMarketPaused(false);
        setGameLog(prev => [...prev, `Round ${parsedData.current_round} started.`]);
      } catch (error) {
        console.error('Failed to parse start_round data:', error);
      }
    };
    socket.on('start_round', handleStartRound);
    return () => socket.off('start_round', handleStartRound);
  }, []);

  // Socket: end round
  useEffect(() => {
    const socket = getSocket();
    const handleEndRound = (data: any) => {
      try {
        const parsedData = JSON.parse(data.gameData);
        const playersData = (parsedData.players || []).map((player: any) => ({
          username: player.username,
          highLow: player.high_low,
          contract: player.contract,
          buyCount: player.buy_count,
          sellCount: player.sell_count,
          record: player.record,
          cumulativePnl: player.cumulative_pnl,
          roundPnl: player.round_pnl,
        }));
        setPlayers(playersData);
        setEndRoundPopup(true);
        setGameLog(prev => [...prev, `Round ${currentRound} ended. Fair value: $${fairValue}.`]);
      } catch (error) {
        console.error('Failed to parse end_round data:', error);
      }
    };
    socket.on('end_round', handleEndRound);
    return () => socket.off('end_round', handleEndRound);
  }, [currentRound, fairValue]);

  // Socket: game ended
  useEffect(() => {
    const socket = getSocket();
    const handleGameEnded = () => { window.location.href = HOMEPAGE_URL; };
    socket.on('game_ended', handleGameEnded);
    return () => socket.off('game_ended', handleGameEnded);
  }, []);

  // Socket: settings updated
  useEffect(() => {
    const socket = getSocket();
    const handleSettingsUpdated = (data: any) => {
      if (data.settings) {
        setSettings(data.settings);
        setSettingsRoundDuration(String(data.settings.round_duration || ''));
        setSettingsMaxRounds(String(data.settings.max_rounds || ''));
        setGameLog(prev => [...prev, 'Settings updated.']);
      }
    };
    socket.on('settings_updated', handleSettingsUpdated);
    return () => socket.off('settings_updated', handleSettingsUpdated);
  }, []);

  // Socket: host update
  useEffect(() => {
    const socket = getSocket();
    const handleHostUpdate = (data: any) => { setHost(data.newHost); };
    socket.on('update_host', handleHostUpdate);
    return () => socket.off('update_host', handleHostUpdate);
  }, []);

  // Timer tick
  useEffect(() => {
    if (marketPaused || !roundActive) return;
    const timer = setInterval(() => {
      const newTimeLeft = Math.max(Math.floor((endTime - Date.now()) / 1000), 0);
      setTimeLeft(newTimeLeft);
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime, marketPaused, roundActive]);

  // Auto-scroll log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [gameLog]);

  // Cleanup
  useEffect(() => {
    const socket = getSocket();
    const handleExit = () => {
      socket.emit('leave_game', { username, roomId });
      navigator.sendBeacon(`${API_BASE_URL}/disconnect`, JSON.stringify({ roomId, username }));
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

  // Actions
  const handlePauseMarket = useCallback(() => {
    const socket = getSocket();
    socket.emit('pause_market', { roomId });
  }, [roomId]);

  const handleResumeMarket = useCallback(() => {
    const socket = getSocket();
    socket.emit('resume_market', { roomId });
  }, [roomId]);

  const handleStartRound = useCallback(() => {
    const socket = getSocket();
    socket.emit('start_round', { roomId });
    setEndRoundPopup(false);
  }, [roomId]);

  const handleEndRound = useCallback(() => {
    const socket = getSocket();
    socket.emit('end_round', { roomId });
  }, [roomId]);

  const handleEndGame = useCallback(() => {
    const socket = getSocket();
    socket.emit('end_game', { roomId });
    window.location.href = HOMEPAGE_URL;
  }, [roomId]);

  const handleUpdateSettings = useCallback(() => {
    const socket = getSocket();
    const newSettings: any = {};
    if (settingsRoundDuration) newSettings.round_duration = parseInt(settingsRoundDuration, 10);
    if (settingsMaxRounds) newSettings.max_rounds = parseInt(settingsMaxRounds, 10);
    socket.emit('update_settings', { roomId, settings: newSettings });
  }, [roomId, settingsRoundDuration, settingsMaxRounds]);

  const handleApplyEditRound = useCallback(() => {
    const socket = getSocket();
    const payload: any = { roomId };
    const newDices: number[] = [];
    if (editDice1) newDices.push(parseInt(editDice1, 10));
    if (editDice2) newDices.push(parseInt(editDice2, 10));
    if (editDice3) newDices.push(parseInt(editDice3, 10));
    if (newDices.length > 0) payload.dices = newDices;
    payload.coin = editCoin;
    socket.emit('admin_edit_round', payload);
    setGameLog(prev => [...prev, 'Admin edit round applied.']);
  }, [roomId, editDice1, editDice2, editDice3, editCoin]);

  const updateRoleAssignment = (username: string, field: string, value: string) => {
    setRoleAssignments(prev => ({
      ...prev,
      [username]: { ...(prev[username] || { role: 'contractor' }), [field]: value }
    }));
  };

  const handleAssignRoles = useCallback(() => {
    const socket = getSocket();
    const assignments = Object.entries(roleAssignments).map(([username, data]) => {
      if (data.role === 'contractor') {
        return { username, role: 'contractor', action: data.action || 'long', number: parseInt(data.number || '1', 10) };
      } else if (data.role === 'dice') {
        return { username, role: 'dice', value: parseInt(data.value || '10', 10) };
      } else if (data.role === 'coin') {
        return { username, role: 'coin', value: data.value || 'high' };
      }
      return { username, role: data.role };
    });
    socket.emit('admin_assign_roles', { roomId, assignments });
    setGameLog(prev => [...prev, 'Roles reassigned by admin.']);
  }, [roomId, roleAssignments]);

  // Get player role description
  const getPlayerRoleDesc = (player: any): string => {
    if (player.contract && player.contract.type_of_action) {
      return `CONTRACTOR: ${player.contract.type_of_action.toUpperCase()} @ ${player.contract.number}`;
    }
    const hasDiceRoll = player.record?.some((r: any) => r[0] === 'dice_roll');
    if (hasDiceRoll) {
      const diceVal = player.record.find((r: any) => r[0] === 'dice_roll')[1];
      return `INSIDER: Dice Roll = ${diceVal}`;
    }
    if (player.highLow) {
      return `INSIDER: Coin Flip = ${player.highLow.toUpperCase()}`;
    }
    return 'UNKNOWN';
  };

  const sortedPlayers = [...players].sort((a: any, b: any) => (b.cumulativePnl || 0) - (a.cumulativePnl || 0));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={T.green} />
          <Text style={styles.loadingText}>INITIALIZING ADMIN TERMINAL</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarLabel}>HI-LO ADMIN TERMINAL</Text>
        <Text style={styles.topBarMid}>
          RND <Text style={styles.topBarValue}>{currentRound}</Text>
          {'  '}
          <Text style={[styles.topBarValue, { color: timeLeft < 30 ? T.red : T.textPri }]}>
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </Text>
        </Text>
        <View style={styles.topBarRight}>
          <View style={[styles.statusDot, { backgroundColor: roundActive ? (marketPaused ? T.amber : T.green) : T.textDim }]} />
          <Text style={[styles.topBarStatus, { color: roundActive ? (marketPaused ? T.amber : T.green) : T.textDim }]}>
            {roundActive ? (marketPaused ? 'PAUSED' : 'LIVE') : 'IDLE'}
          </Text>
        </View>
      </View>

      <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={styles.scrollContainer}>

        {/* ROOM INFO */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// ROOM INFO</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ROOM CODE</Text>
            <Text style={[styles.infoValue, { color: T.amber }]}>{roomCode || (Array.isArray(roomId) ? roomId[0] : roomId)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PLAYERS</Text>
            <Text style={styles.infoValue}>{players.length}</Text>
          </View>
        </View>

        {/* ROUND INFO */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// ROUND INFO</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>FAIR VALUE</Text>
            <Text style={[styles.infoValue, { color: T.green }]}>${fairValue}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>DICE</Text>
            <Text style={styles.infoValue}>[{dices.join(', ')}]</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>COIN</Text>
            <Text style={[styles.infoValue, { color: T.cyan }]}>{coin ? coin.toUpperCase() : '—'}</Text>
          </View>
        </View>

        {/* PLAYER ROLES */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// PLAYER ROLES</Text>
          {players.map((player: any, index: number) => (
            <View key={index} style={styles.playerRoleRow}>
              <Text style={styles.playerRoleName}>{player.username}</Text>
              <Text style={[styles.playerRoleDesc, {
                color: player.contract?.type_of_action ? T.amber : T.cyan
              }]}>
                {getPlayerRoleDesc(player)}
              </Text>
            </View>
          ))}
        </View>

        {/* ASSIGN ROLES */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// ASSIGN ROLES</Text>
          {players.map((player: any, index: number) => (
            <View key={index} style={{ marginBottom: 12, borderBottomWidth: 1, borderColor: T.border, paddingBottom: 10 }}>
              <Text style={[styles.playerRoleName, { marginBottom: 6, color: T.textPri }]}>{player.username}</Text>
              <View style={styles.editRow}>
                {['contractor', 'dice', 'coin'].map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.coinToggle, (roleAssignments[player.username]?.role === role) && styles.coinToggleActive]}
                    onPress={() => updateRoleAssignment(player.username, 'role', role)}
                  >
                    <Text style={[styles.coinToggleText, (roleAssignments[player.username]?.role === role) && { color: T.cyan }]}>
                      {role.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {roleAssignments[player.username]?.role === 'contractor' && (
                <View style={[styles.editRow, { marginTop: 6 }]}>
                  <TouchableOpacity
                    style={[styles.coinToggle, roleAssignments[player.username]?.action === 'long' && styles.coinToggleActive]}
                    onPress={() => updateRoleAssignment(player.username, 'action', 'long')}
                  >
                    <Text style={[styles.coinToggleText, roleAssignments[player.username]?.action === 'long' && { color: T.green }]}>LONG</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.coinToggle, roleAssignments[player.username]?.action === 'short' && styles.coinToggleActive]}
                    onPress={() => updateRoleAssignment(player.username, 'action', 'short')}
                  >
                    <Text style={[styles.coinToggleText, roleAssignments[player.username]?.action === 'short' && { color: T.red }]}>SHORT</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.editFieldInput}
                    value={roleAssignments[player.username]?.number || ''}
                    onChangeText={(v) => updateRoleAssignment(player.username, 'number', v)}
                    keyboardType="numeric"
                    placeholder="#"
                    placeholderTextColor={T.textDim}
                  />
                </View>
              )}
              {roleAssignments[player.username]?.role === 'dice' && (
                <View style={[styles.editRow, { marginTop: 6 }]}>
                  <Text style={styles.editFieldLabel}>DICE VALUE</Text>
                  <TextInput
                    style={styles.editFieldInput}
                    value={roleAssignments[player.username]?.value || ''}
                    onChangeText={(v) => updateRoleAssignment(player.username, 'value', v)}
                    keyboardType="numeric"
                    placeholder="1-20"
                    placeholderTextColor={T.textDim}
                  />
                </View>
              )}
              {roleAssignments[player.username]?.role === 'coin' && (
                <View style={[styles.editRow, { marginTop: 6 }]}>
                  <TouchableOpacity
                    style={[styles.coinToggle, roleAssignments[player.username]?.value === 'high' && styles.coinToggleActive]}
                    onPress={() => updateRoleAssignment(player.username, 'value', 'high')}
                  >
                    <Text style={[styles.coinToggleText, roleAssignments[player.username]?.value === 'high' && { color: T.green }]}>HIGH</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.coinToggle, roleAssignments[player.username]?.value === 'low' && styles.coinToggleActive]}
                    onPress={() => updateRoleAssignment(player.username, 'value', 'low')}
                  >
                    <Text style={[styles.coinToggleText, roleAssignments[player.username]?.value === 'low' && { color: T.red }]}>LOW</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: T.cyan, backgroundColor: 'rgba(6,182,212,0.08)', marginTop: 8 }]}
            onPress={handleAssignRoles}
          >
            <Text style={[styles.actionBtnText, { color: T.cyan }]}>APPLY ROLE ASSIGNMENTS</Text>
          </TouchableOpacity>
        </View>

        {/* MARKET */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// MARKET</Text>
          <View style={styles.marketRow}>
            <View style={[styles.marketSide, { borderColor: T.green }]}>
              <Text style={styles.marketSideLabel}>BID</Text>
              <Text style={[styles.marketSideValue, { color: T.green }]}>
                {currentBid > INITIAL_BID ? `$${currentBid}` : '—'}
              </Text>
              <Text style={styles.marketSidePlayer}>{bidPlayer || '—'}</Text>
            </View>
            <View style={styles.marketDivider} />
            <View style={[styles.marketSide, { borderColor: T.red }]}>
              <Text style={styles.marketSideLabel}>ASK</Text>
              <Text style={[styles.marketSideValue, { color: T.red }]}>
                {currentAsk < INITIAL_ASK ? `$${currentAsk}` : '—'}
              </Text>
              <Text style={styles.marketSidePlayer}>{askPlayer || '—'}</Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: T.amber, backgroundColor: 'rgba(245,158,11,0.08)' }]}
              onPress={handlePauseMarket}
            >
              <Text style={[styles.actionBtnText, { color: T.amber }]}>PAUSE MARKET</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: T.green, backgroundColor: 'rgba(0,255,136,0.08)' }]}
              onPress={handleResumeMarket}
            >
              <Text style={[styles.actionBtnText, { color: T.green }]}>RESUME MARKET</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CONTROLS */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// CONTROLS</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: T.green, backgroundColor: 'rgba(0,255,136,0.08)' }]}
              onPress={handleStartRound}
            >
              <Text style={[styles.actionBtnText, { color: T.green }]}>START NEXT ROUND</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: T.amber, backgroundColor: 'rgba(245,158,11,0.08)' }]}
              onPress={handleEndRound}
            >
              <Text style={[styles.actionBtnText, { color: T.amber }]}>END ROUND</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: T.red, backgroundColor: 'rgba(255,59,92,0.08)' }]}
              onPress={handleEndGame}
            >
              <Text style={[styles.actionBtnText, { color: T.red }]}>END GAME</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SETTINGS */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// SETTINGS</Text>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>ROUND DURATION (s)</Text>
            <TextInput
              style={styles.settingsInput}
              value={settingsRoundDuration}
              onChangeText={setSettingsRoundDuration}
              keyboardType="numeric"
              placeholder="300"
              placeholderTextColor={T.textDim}
            />
          </View>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>MAX ROUNDS</Text>
            <TextInput
              style={styles.settingsInput}
              value={settingsMaxRounds}
              onChangeText={setSettingsMaxRounds}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor={T.textDim}
            />
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: T.blue, backgroundColor: 'rgba(59,130,246,0.08)', marginTop: 8 }]}
            onPress={handleUpdateSettings}
          >
            <Text style={[styles.actionBtnText, { color: T.blue }]}>UPDATE SETTINGS</Text>
          </TouchableOpacity>
        </View>

        {/* EDIT ROUND */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// EDIT ROUND</Text>
          <View style={styles.editRow}>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>DICE 1</Text>
              <TextInput
                style={styles.editFieldInput}
                value={editDice1}
                onChangeText={setEditDice1}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={T.textDim}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>DICE 2</Text>
              <TextInput
                style={styles.editFieldInput}
                value={editDice2}
                onChangeText={setEditDice2}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={T.textDim}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>DICE 3</Text>
              <TextInput
                style={styles.editFieldInput}
                value={editDice3}
                onChangeText={setEditDice3}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={T.textDim}
              />
            </View>
          </View>
          <View style={styles.editRow}>
            <Text style={styles.editFieldLabel}>COIN</Text>
            <TouchableOpacity
              style={[styles.coinToggle, editCoin === 'high' && styles.coinToggleActive]}
              onPress={() => setEditCoin('high')}
            >
              <Text style={[styles.coinToggleText, editCoin === 'high' && { color: T.green }]}>HIGH</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.coinToggle, editCoin === 'low' && styles.coinToggleActive]}
              onPress={() => setEditCoin('low')}
            >
              <Text style={[styles.coinToggleText, editCoin === 'low' && { color: T.red }]}>LOW</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: T.amber, backgroundColor: 'rgba(245,158,11,0.08)', marginTop: 8 }]}
            onPress={handleApplyEditRound}
          >
            <Text style={[styles.actionBtnText, { color: T.amber }]}>APPLY CHANGES</Text>
          </TouchableOpacity>
        </View>

        {/* GAME LOG */}
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
              const prefix = type === 'buy' ? '>> ' : type === 'sell' ? '<< ' : ':: ';
              return (
                <Text key={i} style={[styles.logLine, { color }]}>
                  {prefix}{line}
                </Text>
              );
            })}
          </ScrollView>
        </View>

        {/* LEADERBOARD */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>// LEADERBOARD</Text>
          {sortedPlayers.map((player: any, index: number) => (
            <View key={index} style={styles.leaderRow}>
              <Text style={styles.leaderRank}>#{index + 1}</Text>
              <Text style={styles.leaderName}>{player.username}</Text>
              <Text style={[styles.leaderPnl, { color: (player.cumulativePnl || 0) >= 0 ? T.green : T.red }]}>
                {(player.cumulativePnl || 0) >= 0 ? '+' : ''}${player.cumulativePnl || 0}
              </Text>
            </View>
          ))}
        </View>

      </Animated.ScrollView>

      {/* END ROUND MODAL */}
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
                  <Text style={[styles.modalPnlValue, { color: (p.roundPnl || 0) >= 0 ? T.green : T.red }]}>
                    {(p.roundPnl || 0) >= 0 ? '+' : ''}${p.roundPnl || 0}
                  </Text>
                </View>
              ))}
              <View style={styles.modalDivider} />
              <Text style={styles.modalSubLabel}>NEXT ROUND SETTINGS</Text>
              <View style={[styles.settingsRow, { marginBottom: 8 }]}>
                <Text style={[styles.settingsLabel, { color: T.textSec }]}>DURATION (s)</Text>
                <TextInput
                  style={styles.settingsInput}
                  value={settingsRoundDuration}
                  onChangeText={setSettingsRoundDuration}
                  keyboardType="numeric"
                  placeholder="300"
                  placeholderTextColor={T.textDim}
                />
              </View>
              <View style={[styles.settingsRow, { marginBottom: 12 }]}>
                <Text style={[styles.settingsLabel, { color: T.textSec }]}>MAX ROUNDS</Text>
                <TextInput
                  style={styles.settingsInput}
                  value={settingsMaxRounds}
                  onChangeText={setSettingsMaxRounds}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor={T.textDim}
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, { borderColor: T.green }]} onPress={() => {
                  handleUpdateSettings();
                  handleStartRound();
                }}>
                  <Text style={[styles.modalBtnText, { color: T.green }]}>NEXT ROUND</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { borderColor: T.red }]} onPress={handleEndGame}>
                  <Text style={[styles.modalBtnText, { color: T.red }]}>END GAME</Text>
                </TouchableOpacity>
              </View>
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
    maxWidth: 800,
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

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textDim,
    letterSpacing: 1.5,
  },
  infoValue: {
    fontFamily: T.mono,
    fontSize: 14,
    color: T.textPri,
    fontWeight: 'bold',
  },

  // Player roles
  playerRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: T.border,
    gap: 10,
  },
  playerRoleName: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textSec,
    width: 100,
  },
  playerRoleDesc: {
    fontFamily: T.mono,
    fontSize: 12,
    flex: 1,
  },

  // Market
  marketRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
  },
  marketSide: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  marketSideLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textSec,
    letterSpacing: 2,
    marginBottom: 4,
  },
  marketSideValue: {
    fontFamily: T.mono,
    fontSize: 24,
    fontWeight: 'bold',
  },
  marketSidePlayer: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    marginTop: 4,
  },
  marketDivider: {
    width: 10,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    flex: 1,
    minWidth: 100,
  },
  actionBtnText: {
    fontFamily: T.mono,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Settings
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  settingsLabel: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textSec,
    letterSpacing: 1,
    flex: 1,
  },
  settingsInput: {
    width: 80,
    height: 32,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 2,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontFamily: T.mono,
    fontSize: 14,
    fontWeight: 'bold',
    color: T.textPri,
    backgroundColor: T.surface2,
  },

  // Edit round
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  editField: {
    flex: 1,
    alignItems: 'center',
  },
  editFieldLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 1,
    marginBottom: 4,
  },
  editFieldInput: {
    width: '100%',
    height: 32,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 2,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontFamily: T.mono,
    fontSize: 14,
    fontWeight: 'bold',
    color: T.textPri,
    backgroundColor: T.surface2,
  },
  coinToggle: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 2,
    backgroundColor: T.surface2,
  },
  coinToggleActive: {
    borderColor: T.cyan,
    backgroundColor: 'rgba(6,182,212,0.1)',
  },
  coinToggleText: {
    fontFamily: T.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: T.textSec,
    letterSpacing: 1,
  },

  // Log
  logScroll: {
    maxHeight: 180,
  },
  logLine: {
    fontFamily: T.mono,
    fontSize: 12,
    lineHeight: 20,
    paddingVertical: 1,
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '88%',
    maxWidth: 500,
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
