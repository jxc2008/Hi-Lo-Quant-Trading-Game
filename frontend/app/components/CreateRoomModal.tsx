import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, Modal, Alert } from 'react-native';
import { crmStyles } from '../../styles/global';
import axios from "axios";
import { useRouter } from 'expo-router';

import { API_BASE_URL } from '../../utils/config';

// Constants
const MIN_USERNAME_LENGTH = 3;

interface CreateRoomModalProps {
  onClose: () => void;
}

export default function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameLengthError, setUsernameLengthError] = useState('');
  const [roomNameError, setRoomNameError] = useState('');

  const router = useRouter();

  const handleSubmit = useCallback(async () => {
    // Reset error states
    setUsernameLengthError('');
    setRoomNameError('');

    if (!roomName.trim()) {
      Alert.alert('Error', 'Room name is required');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    if (username.length < MIN_USERNAME_LENGTH) {
      setUsernameLengthError(`Username must be at least ${MIN_USERNAME_LENGTH} characters long`);
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/create-room`, {
        room_name: roomName.trim(),
        password: isPrivate ? password : null,
        isPrivate,
        username: username.trim(),
        is_admin: isAdmin,
      });

      Alert.alert('Success', 'Room created successfully');
      onClose();
      
      router.push({
        pathname: '/waiting',
        params: {
          roomName,
          roomId: response.data.roomId,
          username: username.trim(),
          num_players: response.data.num_players,
          player_list: response.data.player_list,
          host_username: username.trim(),
          room_code: response.data.room_code,
          is_admin: isAdmin ? 'true' : 'false',
        }
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to create room';
      
      if (errorMessage.includes("Username must be at least")) {
        setUsernameLengthError(errorMessage);
      } else if (errorMessage.includes("Room with this name already exists")) {
        setRoomNameError('Room with this name already exists');
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  }, [roomName, username, password, isPrivate, isAdmin, onClose, router]);

  return (
    <Modal transparent animationType="fade">
      <View style={crmStyles.overlay}>
        <View style={crmStyles.modalContainer}>
          <Text style={crmStyles.title}>Create Room</Text>

          {/* Room Name */}
          <View style={crmStyles.inputContainer}>
            <Text style={crmStyles.label}>Room Name</Text>
            <TextInput
              style={crmStyles.input}
              value={roomName}
              onChangeText={setRoomName}
              placeholder="Enter room name"
              placeholderTextColor="#9CA3AF"
            />
            {roomNameError && (
              <Text style={crmStyles.errorText}>{roomNameError}</Text>
            )}
          </View>

          {/* Username */}
          <View style={crmStyles.inputContainer}>
            <Text style={crmStyles.label}>Username</Text>
            <TextInput
              style={crmStyles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor="#9CA3AF"
            />
            {usernameLengthError && (
              <Text style={crmStyles.errorText}>{usernameLengthError}</Text>
            )}
          </View>

          {/* Private Room Toggle */}
          <View style={crmStyles.switchContainer}>
            <Text style={crmStyles.label}>Private Room</Text>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              thumbColor={isPrivate ? '#4B5563' : '#9CA3AF'}
              trackColor={{ false: '#6B7280', true: '#1F2937' }}
            />
          </View>

          {/* Admin Toggle */}
          <View style={crmStyles.switchContainer}>
            <Text style={crmStyles.label}>Join as Admin (Director)</Text>
            <Switch
              value={isAdmin}
              onValueChange={setIsAdmin}
              thumbColor={isAdmin ? '#4B5563' : '#9CA3AF'}
              trackColor={{ false: '#6B7280', true: '#1F2937' }}
            />
          </View>

          {/* Password (only if private room is selected) */}
          {isPrivate && (
            <View style={crmStyles.inputContainer}>
              <Text style={crmStyles.label}>Password</Text>
              <TextInput
                style={crmStyles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
            </View>
          )}

          {/* Buttons */}
          <View style={crmStyles.buttonContainer}>
            <TouchableOpacity onPress={onClose} style={crmStyles.cancelButton}>
              <Text style={crmStyles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={crmStyles.submitButton}>
              <Text style={crmStyles.buttonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
