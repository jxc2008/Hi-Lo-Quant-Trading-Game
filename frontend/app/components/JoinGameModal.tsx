import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { joinModalStyles } from '../../styles/global';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/config';
import { useRouter } from 'expo-router';

interface JoinGameModalProps {
  onClose: () => void;
}

export default function JoinGameModal({ onClose }: JoinGameModalProps) {
  const [code, setCode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [roomNotFound, setRoomNotFound] = useState('');
  const [handleNotSet, setHandleNotSet] = useState('');
  const [roomIsFull, setRoomIsFull] = useState('');
  const [handleTaken, setHandleTaken] = useState('');
  const [usernameLengthError, setUsernameLengthError] = useState('');

  const router = useRouter();

  const handleSubmit = async () => {
    if (!code) {
      setRoomNotFound('Room not found');
      setHandleNotSet('');
      setPasswordError('');
      setRoomIsFull('');
      setHandleTaken('');
      setUsernameLengthError("");
      return;
    }

    if (!handle) {
      setHandleNotSet('Username is required');
      setRoomNotFound('');
      setPasswordError('');
      setRoomIsFull('');
      setHandleTaken('');
      setUsernameLengthError("");
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/join-room`, {
        roomCode: code,
        username: handle,
        password: password || null,
      });

      Alert.alert('Success', 'Successfully joined the room!');
      onClose();
      router.push({
        pathname: '/waiting',
        params: {
          roomId: response.data.roomId,
          username: handle,
          num_players: response.data.num_players,
          player_list: response.data.player_list,
          host_username: response.data.host_username,
          room_code: response.data.room_code,
        }
      });

    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to join room';
      if (errorMessage === 'Invalid password') {
        setPasswordError('Incorrect password. Please try again.');
        setRoomNotFound('');
        setHandleNotSet('');
        setRoomIsFull('');
        setHandleTaken('');
        setUsernameLengthError("");
      } else if (errorMessage === 'Room not found') {
        setRoomNotFound('Room not found');
        setPasswordError('');
        setHandleNotSet('');
        setRoomIsFull('');
        setHandleTaken('');
        setUsernameLengthError("");
      } else if (errorMessage === 'Room is full') {
        setRoomIsFull('Room is full');
        setRoomNotFound('');
        setHandleNotSet('');
        setPasswordError('');
        setHandleTaken('');
        setUsernameLengthError("");
      } else if (errorMessage === 'Username taken') {
        setHandleTaken('Username already taken in this room');
        setRoomIsFull('');
        setRoomNotFound('');
        setHandleNotSet('');
        setPasswordError('');
        setUsernameLengthError("");
      } else if (errorMessage === "Username must be at least 3 characters long") {
        setUsernameLengthError("Username must be at least 3 characters long");
        setHandleTaken('');
        setRoomIsFull('');
        setRoomNotFound('');
        setHandleNotSet('');
        setPasswordError('');
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={joinModalStyles.overlay}>
        <View style={joinModalStyles.modalContainer}>
          {/* Title */}
          <Text style={joinModalStyles.title}>Join Game</Text>

          {/* Game Code Input */}

          {(
            <View style={joinModalStyles.inputContainer}>
            <Text style={joinModalStyles.label}>Game Code</Text>
            <TextInput
              style={joinModalStyles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Enter game code"
              placeholderTextColor="#9CA3AF"
            />
            {roomNotFound && (
                <Text style={joinModalStyles.errorText}>{roomNotFound}</Text>
            )}
            </View>
          )}

          {/* User Handle Input */}
          {(
            <View style={joinModalStyles.inputContainer}>
            <Text style={joinModalStyles.label}>Username</Text>
              <TextInput
                style={joinModalStyles.input}
                value={handle}
                onChangeText={setHandle}
                placeholder="Enter your username"
                placeholderTextColor="#9CA3AF"
              />
              {handleNotSet && (
                <Text style={joinModalStyles.errorText}>{handleNotSet}</Text>
              )}
              {handleTaken && (
                <Text style={joinModalStyles.errorText}>{handleTaken}</Text>
              )}
              {usernameLengthError && (
                <Text style={joinModalStyles.errorText}>{usernameLengthError}</Text>
              )}
            </View>
          )}
          

          {(
            <View style={joinModalStyles.inputContainer}>
            <Text style={joinModalStyles.label}>Password (if private)</Text>
              <TextInput
                style={joinModalStyles.input}
                placeholder="Enter password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              {passwordError && (
                <Text style={joinModalStyles.errorText}>{passwordError}</Text>
              )}
            </View>
          )}

          {/* Buttons */}
          <View style={joinModalStyles.buttonContainer}>
            {roomIsFull && (
                <Text style={joinModalStyles.errorText}>{roomIsFull}</Text>
            )}
            <TouchableOpacity onPress={onClose} style={joinModalStyles.cancelButton}>
              <Text style={joinModalStyles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={joinModalStyles.submitButton}>
              <Text style={joinModalStyles.buttonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
