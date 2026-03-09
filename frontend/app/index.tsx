import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Animated, ScrollView, Platform } from 'react-native';
import { Link, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { T } from '../styles/global';

import GameList from './components/GameList';
import JoinGameModal from './components/JoinGameModal';
import CreateRoomModal from './components/CreateRoomModal';

export default function Index() {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(20))[0];

  const navigation = useNavigation();

  const [fontsLoaded] = useFonts({
    'Orbitron': require('../assets/fonts/Orbitron-Bold.ttf'),
    'AlexBrush': require('../assets/fonts/AlexBrush-Regular.ttf'),
  });

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if ((e as any).preventDefault) {
        (e as any).preventDefault();
      }
    });

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    return unsubscribe;
  }, [navigation, fadeAnim, slideAnim]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Header bar */}
        <View style={styles.headerBar}>
          <Text style={styles.headerBarText}>HI-LO TRADING TERMINAL</Text>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>LIVE</Text>
        </View>

        {/* Title block */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleHiLo}>Hi-Lo</Text>
          <Text style={styles.titleSub}>STOCK MARKET GAME</Text>
          <View style={styles.titleDivider} />
        </View>

        {/* Intro */}
        <Text style={styles.introduction}>
          Read the{' '}
          <Text style={styles.linkText} onPress={() => navigation.navigate('rules' as never)}>rules</Text>
          {' '}before playing. Learn about the creators on the{' '}
          <Text style={styles.linkText} onPress={() => navigation.navigate('about' as never)}>about</Text> page.
        </Text>

        {/* Game list panel */}
        <View style={styles.panelContainer}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelLabel}>// ACTIVE ROOMS</Text>
          </View>
          <View style={styles.panelBody}>
            <GameList />
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.buttonJoin]}
            onPress={() => setShowJoinModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="enter-outline" size={18} color={T.green} style={styles.buttonIcon} />
            <Text style={[styles.buttonText, { color: T.green }]}>JOIN WITH CODE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonCreate]}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={18} color={T.blue} style={styles.buttonIcon} />
            <Text style={[styles.buttonText, { color: T.blue }]}>CREATE ROOM</Text>
          </TouchableOpacity>
        </View>

        {/* Nav */}
        <View style={styles.nav}>
          <Link href="/about" style={styles.navLink}>
            <Text style={styles.navLinkText}>ABOUT</Text>
          </Link>
          <Text style={styles.navDivider}>|</Text>
          <Link href="/rules" style={styles.navLink}>
            <Text style={styles.navLinkText}>RULES</Text>
          </Link>
        </View>

        {showJoinModal && (
          <JoinGameModal onClose={() => setShowJoinModal(false)} />
        )}

        {showCreateModal && (
          <CreateRoomModal onClose={() => setShowCreateModal(false)} />
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  contentContainer: {
    flexGrow: 1,
    minHeight: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 30,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    borderColor: T.border,
    paddingBottom: 10,
    marginBottom: 30,
  },
  headerBarText: {
    fontFamily: 'Orbitron',
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
    flex: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.green,
    marginRight: 5,
  },
  statusText: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.green,
    letterSpacing: 1,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  titleHiLo: {
    fontFamily: 'AlexBrush',
    fontSize: 80,
    color: T.textPri,
    textShadowColor: 'rgba(0, 255, 136, 0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    lineHeight: 90,
  },
  titleSub: {
    fontFamily: 'Orbitron',
    fontSize: 13,
    color: T.textSec,
    letterSpacing: 5,
    marginTop: -4,
  },
  titleDivider: {
    width: 60,
    height: 1,
    backgroundColor: T.green,
    marginTop: 14,
    opacity: 0.6,
  },
  introduction: {
    fontSize: 13,
    color: T.textSec,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
    fontFamily: T.mono,
    maxWidth: 480,
  },
  linkText: {
    color: T.green,
    textDecorationLine: 'underline',
  },
  panelContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  panelHeader: {
    backgroundColor: T.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  panelLabel: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textDim,
    letterSpacing: 1,
  },
  panelBody: {
    backgroundColor: T.bg,
    padding: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  button: {
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    paddingHorizontal: Platform.OS === 'web' ? 24 : 16,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonJoin: {
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
    borderColor: T.green,
  },
  buttonCreate: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderColor: T.blue,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: T.mono,
    letterSpacing: 1.5,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  navDivider: {
    color: T.textDim,
    fontSize: 12,
  },
  navLink: {
    marginHorizontal: 2,
  },
  navLinkText: {
    color: T.textDim,
    fontSize: 11,
    fontFamily: T.mono,
    letterSpacing: 2,
  },
});
