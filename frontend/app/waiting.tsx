import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSocket } from '../utils/socket';
import { T } from '../styles/global';

// Constants
const MIN_PLAYERS = 4;
const DOTS_ANIMATION_INTERVAL = 500;

interface Player {
  username: string;
}

interface WaitingRoomProps {
  currentPlayers?: Player[];
  minPlayers?: number;
}

export default function WaitingRoom({ currentPlayers = [], minPlayers = MIN_PLAYERS }: WaitingRoomProps) {
  const { roomName, roomId, username, num_players, player_list, host_username, room_code } = useLocalSearchParams();
  const [dots, setDots] = useState('.');
  const [players, setPlayers] = useState<string[]>(
    Array.isArray(player_list) ? player_list : player_list.split(",")
  );
  const [isHost, setIsHost] = useState(username === host_username);
  const router = useRouter();

  const pulseAnim = useState(new Animated.Value(0.4))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Socket connection and event handlers
  useEffect(() => {
    const socket = getSocket();
    const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId as string;
    const usernameStr = Array.isArray(username) ? username[0] : username as string;

    // Emit immediately (queued if not yet connected, sent on connect)
    socket.emit('join_room', { roomId: roomIdStr, username: usernameStr });

    // Re-join on reconnect (covers network drops and pre-existing connections)
    const handleConnect = () =>
      socket.emit('join_room', { roomId: roomIdStr, username: usernameStr });

    const handlePlayerJoined = (data: any) => {
      setPlayers((prevPlayers) => [...prevPlayers, data.username]);
    };

    const handlePlayerLeft = (data: any) => {
      setPlayers((prevPlayers) => prevPlayers.filter((player) => player !== data.username));
    };

    const handleStartGame = (data: any) => {
      const { roomId, gameData } = data;
      try {
        router.push({
          pathname: '/game',
          params: { roomId, username, gameData: JSON.stringify(gameData) },
        });
      } catch (error) {
        console.error('Failed to parse gameData:', error);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);
    socket.on('start_game', handleStartGame);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_left', handlePlayerLeft);
      socket.off('start_game', handleStartGame);
    };
  }, [roomId, username, router]);

  // Cleanup handler
  useEffect(() => {
    const socket = getSocket();

    const handleExit = () => {
      socket.emit('leave_game', { username, roomId });
      navigator.sendBeacon(
        "https://hi-lo-backend.onrender.com/disconnect",
        JSON.stringify({ roomId, username })
      );
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      handleExit();
    };

    const handlePopState = () => {
      handleExit();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      handleExit();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [roomId, username]);

  // Dots animation for loading text
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length < 3 ? prev + '.' : '.'));
    }, DOTS_ANIMATION_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const playersNeeded = Math.max(0, minPlayers - Number(players.length));

  const handleStartGame = useCallback(() => {
    const socket = getSocket();
    socket.emit('start_game', { roomId });
  }, [roomId]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>HI-LO TRADING TERMINAL</Text>
        <Animated.View style={[styles.liveIndicator, { opacity: pulseAnim }]} />
        <Text style={styles.liveText}>WAITING</Text>
      </View>

      <View style={styles.content}>
        {/* Room header */}
        <View style={styles.roomHeader}>
          <Text style={styles.roomLabel}>// ROOM</Text>
          <Text style={styles.roomName}>{roomName || 'TRADING ROOM'}</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeLabel}>ACCESS CODE</Text>
            <Text style={styles.codeValue}>{room_code}</Text>
          </View>
        </View>

        {/* Status line */}
        <View style={styles.statusBlock}>
          <Animated.View style={[styles.statusDot, { opacity: pulseAnim }]} />
          <Text style={styles.statusText}>
            {playersNeeded > 0
              ? `WAITING FOR ${playersNeeded} MORE PLAYER${playersNeeded !== 1 ? 'S' : ''}${dots}`
              : `READY TO START${dots}`}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min((players.length / minPlayers) * 100, 100)}%` as any }]} />
        </View>
        <Text style={styles.progressLabel}>{players.length} / {minPlayers} PLAYERS</Text>

        {/* Player list */}
        <View style={styles.playersPanel}>
          <Text style={styles.playersPanelTitle}>// CONNECTED PLAYERS</Text>
          <View style={styles.playersList}>
            {players.length > 0 ? (
              players.map((item, index) => (
                <View key={index} style={[styles.playerRow, item === username && styles.playerRowSelf]}>
                  <View style={[styles.playerDot, item === username && styles.playerDotSelf]} />
                  <Text style={[styles.playerName, item === username && styles.playerNameSelf]}>
                    {item}{item === username ? ' (you)' : ''}
                  </Text>
                  {index === 0 && <Text style={styles.hostBadge}>HOST</Text>}
                </View>
              ))
            ) : (
              <Text style={styles.noPlayersText}>NO PLAYERS CONNECTED</Text>
            )}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, minPlayers - players.length) }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.playerRowEmpty}>
                <View style={styles.playerDotEmpty} />
                <Text style={styles.playerNameEmpty}>WAITING{dots}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Start button (host only, when ready) */}
        {players.length >= minPlayers && isHost && (
          <TouchableOpacity style={styles.startButton} onPress={handleStartGame} activeOpacity={0.7}>
            <Text style={styles.startButtonText}>▶ START GAME</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  topBarText: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
    flex: 1,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.amber,
    marginRight: 6,
  },
  liveText: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.amber,
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  roomHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  roomLabel: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textDim,
    letterSpacing: 2,
    marginBottom: 4,
  },
  roomName: {
    fontFamily: T.mono,
    fontSize: 22,
    color: T.textPri,
    letterSpacing: 3,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  codeBlock: {
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: T.surface,
  },
  codeLabel: {
    fontFamily: T.mono,
    fontSize: 9,
    color: T.textDim,
    letterSpacing: 2,
    marginBottom: 3,
  },
  codeValue: {
    fontFamily: T.mono,
    fontSize: 20,
    color: T.amber,
    letterSpacing: 6,
    fontWeight: 'bold',
  },
  statusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: T.amber,
  },
  statusText: {
    fontFamily: T.mono,
    fontSize: 12,
    color: T.amber,
    letterSpacing: 1,
  },
  progressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: T.border,
    marginBottom: 6,
  },
  progressFill: {
    height: 2,
    backgroundColor: T.green,
  },
  progressLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 1,
    marginBottom: 24,
    alignSelf: 'flex-end',
  },
  playersPanel: {
    width: '100%',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 24,
  },
  playersPanelTitle: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  playersList: {
    padding: 10,
    gap: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 2,
    gap: 8,
  },
  playerRowSelf: {
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  playerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.textSec,
  },
  playerDotSelf: {
    backgroundColor: T.green,
  },
  playerName: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textSec,
    flex: 1,
  },
  playerNameSelf: {
    color: T.green,
  },
  hostBadge: {
    fontFamily: T.mono,
    fontSize: 9,
    color: T.amber,
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: T.amber,
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 1,
  },
  playerRowEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  playerDotEmpty: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.textDim,
    opacity: 0.3,
  },
  playerNameEmpty: {
    fontFamily: T.mono,
    fontSize: 12,
    color: T.textDim,
    opacity: 0.4,
  },
  noPlayersText: {
    fontFamily: T.mono,
    fontSize: 12,
    color: T.textDim,
    textAlign: 'center',
    paddingVertical: 16,
    letterSpacing: 1,
  },
  startButton: {
    width: '100%',
    backgroundColor: T.green,
    paddingVertical: 14,
    borderRadius: 2,
    alignItems: 'center',
  },
  startButtonText: {
    fontFamily: T.mono,
    fontSize: 14,
    fontWeight: 'bold',
    color: T.bg,
    letterSpacing: 3,
  },
});
