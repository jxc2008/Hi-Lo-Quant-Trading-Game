import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { gameListStyles } from '../../styles/global';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL } from '../../utils/config';

// Constants
const REFRESH_INTERVAL = 5000; // 5 seconds
const COUNTDOWN_INTERVAL = 1000; // 1 second
const MIN_USERNAME_LENGTH = 3;

export default function GameList() {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [roomCodes, setRoomCodes] = useState({});
  const [isPrivate, setIsPrivate] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [handleNotSet, setHandleNotSet] = useState('');
  const [roomIsFull, setRoomIsFull] = useState('');
  const [handleTaken, setHandleTaken] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [usernameLengthError, setUsernameLengthError] = useState('');

  const router = useRouter();

  useEffect(() => {
    fetchRooms();
  }, []);

  // Auto-refresh interval setup
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchRooms();
          return 5; // Reset countdown after refresh
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/rooms`);
      setRooms(response.data);

      const roomCodeMap = {};
      response.data.forEach((room: any) => {
        roomCodeMap[room._id] = room.room_code;
      });
      setRoomCodes(roomCodeMap);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch rooms');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openJoinModal = useCallback((room: any) => {
    setSelectedRoom(room);
    setIsJoinModalVisible(true);
    setPasswordError('');
    setHandleNotSet('');
    setRoomIsFull('');
    setHandleTaken('');
    setUsernameLengthError('');
    setIsPrivate(room.isPrivate);
  }, []);

  const resetErrorStates = useCallback(() => {
    setPasswordError('');
    setHandleNotSet('');
    setRoomIsFull('');
    setHandleTaken('');
    setUsernameLengthError('');
  }, []);

  const joinRoom = useCallback(async () => {
    resetErrorStates();

    if (!username.trim()) {
      setHandleNotSet('Username is required');
      return;
    }

    if (username.length < MIN_USERNAME_LENGTH) {
      setUsernameLengthError(`Username must be at least ${MIN_USERNAME_LENGTH} characters long`);
      return;
    }

    const roomCode = roomCodes[selectedRoom._id];

    try {
      const response = await axios.post(`${API_BASE_URL}/join-room`, {
        roomCode,
        username: username.trim(),
        password: selectedRoom.isPrivate ? password : null,
      });

      Alert.alert('Success', 'Successfully joined the room!');
      setIsJoinModalVisible(false);
      setUsername('');
      setPassword('');
      fetchRooms();

      router.push({
        pathname: '/waiting',
        params: {
          roomName: selectedRoom.room_name,
          roomId: response.data.roomId,
          username: username.trim(),
          num_players: response.data.num_players,
          player_list: response.data.player_list,
          host_username: response.data.host_username,
          room_code: roomCode,
        }
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to join room';
      
      if (errorMessage.includes('Invalid password')) {
        setPasswordError('Invalid password');
      } else if (errorMessage.includes('Room is full')) {
        setRoomIsFull('Room is full');
      } else if (errorMessage.includes('Username already taken')) {
        setHandleTaken('Username already taken in this room');
      } else if (errorMessage.includes('Username must be at least')) {
        setUsernameLengthError(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  }, [username, password, selectedRoom, roomCodes, resetErrorStates, fetchRooms, router]);

  // Auto-refresh interval setup
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchRooms();
          return 5; // Reset countdown after refresh
        }
        return prev - 1;
      });
    }, COUNTDOWN_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const renderGameItem = ({ item }: { item: any }) => (
    <View style={gameListStyles.gameItem}>
      <View style={gameListStyles.gameDetails}>
        <Text style={gameListStyles.gameName}>{item.name}</Text>
        <Text style={gameListStyles.gameInfo}>
          {item.players?.length ?? 0}/10 players {item.isPrivate && '🔒'}
        </Text>
      </View>
      <View style={gameListStyles.buttonContainer}>
        {/* Spectate button to the LEFT, with spacing to the right */}
        <TouchableOpacity
          onPress={() => {
            // If the room object has gameData, pass it; otherwise, assume the game hasn't started.
            const started = item.gameData ? 'true' : 'false';
            router.push({
              pathname: '/spectator' as any,
              params: {
                roomId: item._id,
                started: started,
                ...(item.gameData ? { gameData: item.gameData } : {}),
              },
            });
          }}
          style={[gameListStyles.joinButton, { marginRight: 10, backgroundColor: '#6B7280' }]}
        >
          <Ionicons name="eye-outline" size={20} color="#fff" />
        </TouchableOpacity>
        {/* Join button to the RIGHT */}
        <TouchableOpacity onPress={() => openJoinModal(item)} style={gameListStyles.joinButton}>
          <Text style={gameListStyles.joinButtonText}>Join</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={gameListStyles.container}>
      <Text style={gameListStyles.title}>Ongoing Games</Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginVertical: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            fetchRooms();
            setCountdown(5); // Reset countdown on manual refresh
          }}
          style={gameListStyles.refreshButton}
        >
          <Text style={gameListStyles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
        <Text style={gameListStyles.countdownText}>Auto refresh in: {countdown}s</Text>
      </View>

      {isLoading ? (
        <Text style={gameListStyles.loadingText}>Loading rooms...</Text>
      ) : rooms.length === 0 ? (
        <View style={gameListStyles.noGamesContainer}>
          <Text style={gameListStyles.noGamesText}>No ongoing games. Create one right now to start!</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item: any) => item._id}
          renderItem={renderGameItem}
          style={gameListStyles.list}
          contentContainerStyle={gameListStyles.listContent}
        />
      )}

      {/* Join Modal */}
      <Modal transparent visible={isJoinModalVisible} animationType="fade">
        <View style={gameListStyles.overlay}>
          <View style={gameListStyles.modalContainer}>
            <Text style={gameListStyles.modalTitle}>Join Room</Text>
            <>
              <TextInput
                style={gameListStyles.input}
                placeholder="Enter your username"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
              />
              {handleNotSet && <Text style={gameListStyles.errorText}>{handleNotSet}</Text>}
              {handleTaken && <Text style={gameListStyles.errorText}>{handleTaken}</Text>}
              {usernameLengthError && <Text style={gameListStyles.errorText}>{usernameLengthError}</Text>}
            </>
            {isPrivate && (
              <>
                <TextInput
                  style={gameListStyles.input}
                  placeholder="Enter password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                {passwordError && <Text style={gameListStyles.errorText}>{passwordError}</Text>}
              </>
            )}
            <View style={gameListStyles.buttonContainer}>
              {roomIsFull && <Text style={gameListStyles.errorText}>{roomIsFull}</Text>}
              <TouchableOpacity onPress={() => setIsJoinModalVisible(false)} style={gameListStyles.cancelButton}>
                <Text style={gameListStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={joinRoom} style={gameListStyles.submitButton}>
                <Text style={gameListStyles.buttonText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
