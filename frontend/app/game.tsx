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
} from 'react-native';
import { MaterialIcons, FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { getSocket } from '../utils/socket';
import { PlayerRole } from './components/PlayerInfoPopup';

// Constants
const ROUND_DURATION = 300; // 5 minutes in seconds
const DEBUG_ROUND_DURATION = 10; // for debugging
const MIN_BID_ASK = 1;
const MAX_BID_ASK = 20;
const INITIAL_ASK = 21;
const INITIAL_BID = 0;
const HOMEPAGE_URL = "https://hilotrader.org";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFEDCC',
  },
  scrollContainer: {
    padding: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  cardContent: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 16,
  },
  infoValue: {
    marginLeft: 'auto',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
  },
  button: {
    backgroundColor: '#007BFF',
    borderRadius: 4,
    padding: 8,
  },
  secondaryButton: {
    backgroundColor: '#28a745',
    borderRadius: 4,
    padding: 8,
    marginVertical: 8,
    alignSelf: 'center',
    minWidth: '45%',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logContainer: {
    maxHeight: 100,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  leaveButton: {
    backgroundColor: '#DC3545',
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  leaveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  endModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  endModalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    maxWidth: '80%',
  },
  endModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  endModalMessage: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  endModalButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginTop: 20,
  },
  endModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

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
    coinFlip?: string 
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

  const { roomId, username, gameData } = useLocalSearchParams();
  const navigation = useNavigation();

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

      // Set game state
      setHost(finalData.host);
      setPlayerCount(finalData.player_count);
      setCurrentRound(finalData.current_round);
      setDices(finalData.dices);
      setCoin(finalData.coin);
      setMarketActive(finalData.market_active);
      setRoundActive(finalData.round_active);
      setFairValue(finalData.fair_value);

      // Process players data
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

      // Set current player info
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
    } catch (error) {
      console.error('Failed to parse gameData:', error);
    }
  }, [gameData, username]);

  // Socket event handlers
  useEffect(() => {
    const socket = getSocket();
    
    const handlePlayerLeft = (data: any) => {
      setGameLog((prevLog) => [...prevLog, `${data.username} has left the game.`]);

      setPlayers((prevPlayers) => {
        const updatedPlayers = prevPlayers.filter((player: any) => player.username !== data.username);

        // Handle host transfer or game end
        if (data.username === host) {
          if (data.newHost) {
            setHost(data.newHost);
            setGameLog((prevLog) => [...prevLog, `${data.newHost} is now the new host.`]);
          } else if (updatedPlayers.length < 4) {
            setGameLog((prevLog) => [...prevLog, `No new host assigned. Ending the game.`]);
            handleEndGame();
          }
        }

        // End game if not enough players
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

  useEffect(() => {
    const socket = getSocket();
    
    const handleHostUpdate = (data: any) => {
      setHost(data.newHost);
    };

    socket.on('update_host', handleHostUpdate);
    return () => socket.off('update_host', handleHostUpdate);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [gameLog]);

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
      const bidValue = parseInt(bidMatch[1], 10);
      handleBid(bidValue);
    } else if (askMatch) {
      const askValue = parseInt(askMatch[1], 10);
      handleAsk(askValue);
    } else if (trimmedInput === 'h') {
      handleHitBid();
    } else if (trimmedInput === 'l') {
      handleLiftAsk();
    } else {
      alert('Invalid input. Please use the correct format: b{amount}b, a{amount}a, h, or l.');
    }
    setUserInput('');
  }, [userInput]);

  const handleBid = useCallback((number: number) => {
    const socket = getSocket();
    if (isNaN(number) || number < MIN_BID_ASK || number > MAX_BID_ASK) {
      alert(`Invalid bid. It must be between ${MIN_BID_ASK} and ${MAX_BID_ASK}.`);
      return;
    }
    if (number >= currentAsk && currentAsk < INITIAL_ASK) {
      alert("Your bid is higher than or equal to the current ask.");
      return;
    }
    if (number <= currentBid) {
      alert('Your bid must be higher than the current bid.');
      return;
    }
    socket.emit("make_market", { roomId, playerName: username, action: "bid", number });
    setGameLog((prevLog) => [...prevLog, `You placed a bid for $${number}.`]);
    setCurrentBid(number);
    setBidAmount("");
  }, [roomId, username, currentAsk, currentBid]);

  const handleAsk = useCallback((number: number) => {
    if (isNaN(number) || number < MIN_BID_ASK || number > MAX_BID_ASK) {
      alert(`Invalid ask. It must be between ${MIN_BID_ASK} and ${MAX_BID_ASK}.`);
      return;
    }
    if (number <= currentBid && currentBid > INITIAL_BID) {
      alert("Your ask is lower than or equal to the current bid.");
      return;
    }
    if (number >= currentAsk) {
      alert('Your ask must be lower than the current ask.');
      return;
    }
    const socket = getSocket();
    socket.emit("make_market", { roomId, playerName: username, action: "ask", number });
    setGameLog((prevLog) => [...prevLog, `You placed an ask for $${number}.`]);
    setCurrentAsk(number);
    setAskAmount("");
  }, [roomId, username, currentBid, currentAsk]);

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

  // Market update handler
  useEffect(() => {
    const socket = getSocket();
    
    const handleMarketUpdate = (data: any) => {
      if (data.action === "hit") {
        setGameLog((prevLog) => [
          ...prevLog,
          `${data.playerName} has hit the bid! Sold to ${data.bidPlayer} for $${data.price}.`,
        ]);
        setCurrentBid(INITIAL_BID);
      } else if (data.action === "lift") {
        setGameLog((prevLog) => [
          ...prevLog,
          `${data.playerName} has lifted the ask! Bought from ${data.askPlayer} for $${data.price}.`,
        ]);
        setCurrentAsk(INITIAL_ASK);
      } else if (data.action === "ask") {
        setCurrentAsk(data.currentAsk);
        setGameLog((prevLog) => [...prevLog, data.logMessage]);
      } else if (data.action === "bid") {
        setCurrentBid(data.currentBid);
        setGameLog((prevLog) => [...prevLog, data.logMessage]);
      }
    };

    socket.on('market_update', handleMarketUpdate);
    return () => socket.off('market_update', handleMarketUpdate);
  }, []);

  // Game ended handler
  useEffect(() => {
    const socket = getSocket();
    
    const handleGameEnded = () => {
      window.location.href = HOMEPAGE_URL;
    };

    socket.on('game_ended', handleGameEnded);
    return () => socket.off('game_ended', handleGameEnded);
  }, []);

  // Round handlers
  useEffect(() => {
    const socket = getSocket();
    
    const handleStartRound = (data: any) => {
      try {
        const parsedData = JSON.parse(data.gameData);
        
        // Update game state
        setCurrentRound(parsedData.current_round);
        setHost(parsedData.host);
        setPlayerCount(parsedData.player_count);
        setDices(parsedData.dices);
        setCoin(parsedData.coin);
        setMarketActive(parsedData.market_active);
        setRoundActive(parsedData.round_active);
        setFairValue(parsedData.fair_value);
        setPlayers(parsedData.players || []);

        // Update current player info
        const currentPlayer = (parsedData.players || []).find((p: any) => p.username === username);
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
              coinFlip: currentPlayer.highLow || parsedData.coin,
            });
            setPlayerRole('insider');
          }
        }

        // Set up new round timing
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

  // Cleanup and exit handlers
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

  // Game control functions
  const handleLeaveGame = useCallback(() => {
    const socket = getSocket();
    if (window.confirm('Are you sure you want to leave the game?')) {
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Loading game data...</Text>
        </View>
      </SafeAreaView>
    );
  } else {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Stock Trading Game</Text>
          <View style={styles.gridContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Market Info</Text>
              <View style={styles.cardContent}>
                <View style={styles.infoRow}>
                  <MaterialIcons name="arrow-upward" size={20} color="green" />
                  <Text style={styles.infoText}>Highest Bid:</Text>
                  <Text style={styles.infoValue}>${currentBid}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="arrow-downward" size={20} color="red" />
                  <Text style={styles.infoText}>Lowest Ask:</Text>
                  <Text style={styles.infoValue}>${currentAsk}</Text>
                </View>
                <View style={styles.infoRow}>
                  <FontAwesome name="money" size={20} color="black" />
                  <Text style={styles.infoText}>Your Balance:</Text>
                  <Text style={styles.infoValue}>${playerBalance}</Text>
                </View>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Trade Gems</Text>
              <View style={styles.cardContent}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Bid Amount"
                    keyboardType="numeric"
                    value={bidAmount}
                    onChangeText={setBidAmount}
                  />
                  <TouchableOpacity style={styles.button} onPress={() => handleBid(parseInt(bidAmount))}>
                    <Text style={styles.buttonText}>Place Bid</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ask Amount"
                    keyboardType="numeric"
                    value={askAmount}
                    onChangeText={setAskAmount}
                  />
                  <TouchableOpacity style={styles.button} onPress={() => handleAsk(parseInt(askAmount))}>
                    <Text style={styles.buttonText}>Place Ask</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleHitBid}>
                    <Text style={styles.buttonText}>Hit the Bid!</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleLiftAsk}>
                    <Text style={styles.buttonText}>Lift the Ask!</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Player Info</Text>
              <View style={styles.cardContent}>
                <View style={styles.infoRow}>
                  <FontAwesome5 name="user" size={23} color="black" />
                  <Text style={styles.infoText}>Your Role:</Text>
                  <Text style={styles.infoValue}>{playerRole}</Text>
                </View>
                <View style={styles.infoRow}>
                  <FontAwesome name="file-text" size={20} color="black" />
                  <Text style={styles.infoText}>Trading Information:</Text>
                  <Text style={styles.infoValue}>
                    {playerRole === 'contractor' && playerInfo.contract
                      ? `${playerInfo.contract.type_of_action.toLowerCase()}, ${playerInfo.contract.number}`
                      : playerRole === 'insider'
                      ? (playerInfo.diceRoll !== undefined
                          ? `Dice Roll: ${playerInfo.diceRoll}`
                          : `Coin Flip: ${playerInfo.coinFlip}`)
                      : 'N/A'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <FontAwesome5 name="gem" size={25} color="black" />
                  <Text style={styles.infoText}>Round:</Text>
                  <Text style={styles.infoValue}>{currentRound}</Text>
                </View>
                <View style={styles.infoRow}>
                  <FontAwesome5 name="clock" size={27} color="black" />
                  <Text style={styles.infoText}>Time Left:</Text>
                  <Text style={styles.infoValue}>{timeLeft}s</Text>
                </View>
              </View>
            </View>
          </View>
          {(() => {
            const sortedPlayers = [...players].sort((a: any, b: any) => (b.cumulative_pnl || 0) - (a.cumulative_pnl || 0));
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Leaderboard</Text>
                <View style={styles.cardContent}>
                  {sortedPlayers.map((player: any, index: number) => (
                    <View key={index} style={styles.infoRow}>
                      <FontAwesome5 name="user" size={20} color="black" />
                      <Text style={styles.infoText}>{player.username}:</Text>
                      <Text style={styles.infoValue}>${player.cumulative_pnl}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Command Input</Text>
            <TextInput
              style={styles.input}
              placeholder="Type command (e.g., b10b, a15a, h, l)"
              value={userInput}
              onChangeText={setUserInput}
              onSubmitEditing={handleKeyInput}
            />
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Game Log</Text>
            <View style={styles.cardContent}>
              <ScrollView style={styles.logContainer} ref={scrollRef}>
                {gameLog.map((log, index) => (
                  <Text key={index}>{log}</Text>
                ))}
              </ScrollView>
            </View>
          </View>
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGame}>
            <Text style={styles.leaveButtonText}>Leave Game</Text>
          </TouchableOpacity>
        </ScrollView>
        {endRoundPopup && (
          <Modal
            transparent={true}
            visible={endRoundPopup}
            animationType="fade"
            onRequestClose={() => {}}
          >
            <View style={styles.endModalContainer}>
              <View style={styles.endModalContent}>
                <Text style={styles.endModalTitle}>End of Round {currentRound}!</Text>
                <Text style={styles.endModalMessage}>Fair Value: {fairValue}</Text>
                <Text style={styles.endModalMessage}>Round PnL:</Text>
                {players.map((p: any, index: number) => (
                  <Text key={index} style={styles.endModalMessage}>
                    {p.username}: {p.round_pnl}
                  </Text>
                ))}
                {username === host && (
                  <>
                    <TouchableOpacity style={styles.endModalButton} onPress={handleStartNextRound}>
                      <Text style={styles.endModalButtonText}>Start next round</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.endModalButton} onPress={handleEndGame}>
                      <Text style={styles.endModalButtonText}>End game</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>
        )}
        {newRoundPopup && (
          <Modal
            transparent={true}
            visible={newRoundPopup}
            animationType="fade"
            onRequestClose={() => setNewRoundPopup(false)}
          >
            <View style={styles.endModalContainer}>
              <View style={styles.endModalContent}>
                <Text style={styles.endModalTitle}>Round {currentRound} Started!</Text>
                <Text style={styles.endModalMessage}>
                  Your Role: {playerRole === 'contractor'
                    ? `${playerInfo.contract?.type_of_action}, ${playerInfo.contract?.number}`
                    : playerRole === 'insider'
                    ? (playerInfo.diceRoll !== undefined ? `Dice Roll: ${playerInfo.diceRoll}` : `Coin Flip: ${playerInfo.coinFlip}`)
                    : 'N/A'}
                </Text>
                <TouchableOpacity style={styles.endModalButton} onPress={() => setNewRoundPopup(false)}>
                  <Text style={styles.endModalButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    );
  }
}
