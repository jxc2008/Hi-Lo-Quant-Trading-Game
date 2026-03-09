import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Button } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSocket } from '../utils/socket';

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

  // Socket connection and event handlers
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      socket.emit('join_room', { roomId, username });
    };

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
    socket.emit('start_round', { roomId });
  }, [roomId]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Trading Game</Text>
        <Text style={styles.joinCode}>Room Code: {room_code}</Text>
        <View style={styles.content}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>
              {playersNeeded > 0
                ? `Waiting for ${playersNeeded} more player${playersNeeded !== 1 ? 's' : ''} to start the game${dots}`
                : `Game is ready to start${dots}`
              }
            </Text>
          </View>
          <View style={styles.playersContainer}>
            <Text style={styles.playersTitle}>Current Players:</Text>
            {players.length > 0 ? (
              players.map((item, index) => (
                <View key={index} style={styles.badge}>
                  <Text style={styles.badgeText}>{item}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noPlayersText}>No players have joined yet.</Text>
            )}
          </View>
          {players.length >= minPlayers && isHost && (
            <Button title="Start Game" onPress={handleStartGame} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff', // Light blue background
  },
  card: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
    color: '#1e3a8a', // Dark blue text
  },
  joinCode: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    color: '#3b82f6', // Blue text
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    color: '#374151', // Gray text
  },
  playersContainer: {
    marginTop: 16,
  },
  playersTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151', // Gray text
  },
  playersList: {
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: '#e2e8f0', // Light gray background
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
  },
  badgeText: {
    fontSize: 14,
    color: '#1e293b', // Dark gray text
  },
  noPlayersText: {
    fontSize: 14,
    color: '#64748b', // Light gray text
    textAlign: 'center',
  },
});