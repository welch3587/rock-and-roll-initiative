import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, TextInput, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';

let app;
let db = null;
try {
  // firebaseConfig.js is gitignored - copy firebaseConfig.template.js to firebaseConfig.js and fill in your values
  const config = require('./firebaseConfig').default || require('./firebaseConfig');
  app = initializeApp(config);
  db = getFirestore(app);
  console.log('Firebase initialized successfully');
} catch (e) {
  console.log('Firebase config not found - running in local-only mode. Copy firebaseConfig.template.js to firebaseConfig.js');
}

const diceOptions = ['d4', 'd6', 'd8', 'd10', 'd12', 'd14', 'd16', 'd20', 'd100'];

const RockAndRollInitiative = () => {
  const [players, setPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerMod, setNewPlayerMod] = useState('0');
  const [selectedDie, setSelectedDie] = useState('d20');
  const [rolls, setRolls] = useState([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [orderMode, setOrderMode] = useState('sorted'); // 'sorted' or 'cyclic'
  const [sessionNotes, setSessionNotes] = useState('');
  const [currentScreen, setCurrentScreen] = useState('home'); // 'home', 'help', 'setup', 'tracker', 'campaign'
  const [campaignId, setCampaignId] = useState(null);
  const [isConnectedToCampaign, setIsConnectedToCampaign] = useState(false);

  const loadData = async () => {
    try {
      const savedPlayers = await AsyncStorage.getItem('players');
      if (savedPlayers) {
        const parsed = JSON.parse(savedPlayers);
        setPlayers(parsed);
        setCurrentTurnIndex(0);
      }
    } catch (e) {
      console.log('Error loading data');
    }
  };

  const saveData = async (dataToSave) => {
    try {
      await AsyncStorage.setItem('players', JSON.stringify(dataToSave || players));
    } catch (e) {
      console.log('Error saving data');
    }
  };

  // Load and auto-save data
  useEffect(() => {
    const loadAllData = async () => {
      await loadData();
      try {
        const savedNotes = await AsyncStorage.getItem('sessionNotes');
        if (savedNotes !== null) setSessionNotes(savedNotes);
        const savedDie = await AsyncStorage.getItem('selectedDie');
        if (savedDie) setSelectedDie(savedDie);
        const savedMode = await AsyncStorage.getItem('orderMode');
        if (savedMode && ['sorted', 'cyclic'].includes(savedMode)) setOrderMode(savedMode);
      } catch (e) {
        console.log('Error loading extra data');
      }
    };
    loadAllData();
  }, []);

  useEffect(() => {
    saveData(players);
  }, [players]);

  useEffect(() => {
    const saveNotes = async () => {
      try {
        await AsyncStorage.setItem('sessionNotes', sessionNotes);
      } catch (e) {}
    };
    if (sessionNotes !== '') saveNotes(); // Avoid initial empty save
  }, [sessionNotes]);

  useEffect(() => {
    AsyncStorage.setItem('selectedDie', selectedDie).catch(() => {});
    AsyncStorage.setItem('orderMode', orderMode).catch(() => {});
  }, [selectedDie, orderMode]);

  // Real-time Firebase sync for campaign (bi-directional)
  useEffect(() => {
    if (!campaignId || !db || !isConnectedToCampaign) return;

    const campaignRef = doc(db, 'campaigns', campaignId);

    const unsubscribe = onSnapshot(campaignRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.players) setPlayers(data.players);
        if (data.sessionNotes !== undefined) setSessionNotes(data.sessionNotes);
        if (data.currentTurnIndex !== undefined) setCurrentTurnIndex(data.currentTurnIndex);
        if (data.orderMode) setOrderMode(data.orderMode);
      } else {
        // Create initial document if it doesn't exist
        setDoc(campaignRef, {
          players: [],
          sessionNotes: sessionNotes || '',
          currentTurnIndex: 0,
          orderMode: orderMode || 'sorted',
          createdAt: serverTimestamp()
        });
      }
    });

    return () => unsubscribe();
  }, [campaignId, db, isConnectedToCampaign]);

  // Save local changes to Firebase when in a campaign
  useEffect(() => {
    if (!campaignId || !db || !isConnectedToCampaign) return;

    const campaignRef = doc(db, 'campaigns', campaignId);

    setDoc(campaignRef, {
      players,
      sessionNotes,
      currentTurnIndex,
      orderMode,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(console.error);
  }, [players, sessionNotes, currentTurnIndex, orderMode, campaignId, db, isConnectedToCampaign]);

  const rollDice = (faces) => {
    return Math.floor(Math.random() * faces) + 1;
  };

  const getDiceFaces = (die) => {
    const match = die.match(/d(\d+)/);
    return match ? parseInt(match[1]) : 20;
  };

  const rollInitiative = (playerIndex = null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    let newRolls = [...rolls];
    const playersToRoll = playerIndex !== null ? [players[playerIndex]] : [...players];
    let updatedPlayers = [...players];

    playersToRoll.forEach((player, idx) => {
      const actualIndex = playerIndex !== null ? playerIndex : players.findIndex(p => p.name === player.name);
      const faces = getDiceFaces(selectedDie);
      const roll = rollDice(faces);
      const mod = parseInt(player.mod || 0);
      const total = roll + mod;

      // Critical / fumble funny events (as discussed)
      if (roll === faces && faces >= 20) {
        const crits = [
          "NAT 20! Legendary performance — the crowd loses their minds! 🎸🔥",
          "CRITICAL HIT! The bard's solo brings down the house. Shots on the house! 🍺",
          "Epic success! Inspiration for the whole band — advantage on next roll!"
        ];
        const event = crits[Math.floor(Math.random() * crits.length)];
        Alert.alert("🎤 CRITICAL SUCCESS! 🎤", event);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (roll === 1) {
        const fumbles = [
          "Natural 1... Stage dive fail. Take a shot! 🍺😵",
          "FUMBLE! The amp blows. The tavern laughs at you.",
          "Critical miss! The dragon laughs last. Better luck next round."
        ];
        const event = fumbles[Math.floor(Math.random() * fumbles.length)];
        Alert.alert("💥 CRITICAL FUMBLE! 💥", event);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      const rollEntry = {
        player: player.name,
        die: selectedDie,
        roll,
        mod,
        total,
        timestamp: new Date().toLocaleTimeString()
      };
      newRolls.push(rollEntry);

      // Update player roll
      if (actualIndex !== -1) {
        updatedPlayers[actualIndex] = { ...updatedPlayers[actualIndex], roll: total };
      }
    });

    setRolls(newRolls.slice(-10)); // Keep last 10 rolls

    // Re-sort based on new rolls
    sortTurnOrder(updatedPlayers);
    saveData(updatedPlayers); // Ensure save
  };

  const sortTurnOrder = (updatedPlayers) => {
    // Sort descending by roll (highest first), stable for ties
    let sorted = [...updatedPlayers].sort((a, b) => (b.roll || 0) - (a.roll || 0));

    if (orderMode === 'cyclic' && sorted.length > 0) {
      // For cyclic: rotate so current highest initiative starts the round
      const maxRoll = Math.max(...sorted.map(p => p.roll || 0));
      const highestIndex = sorted.findIndex(p => (p.roll || 0) === maxRoll);
      const rotated = [...sorted.slice(highestIndex), ...sorted.slice(0, highestIndex)];
      setPlayers(rotated);
    } else {
      setPlayers(sorted);
    }
    setCurrentTurnIndex(0);
  };

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newP = {
      name: newPlayerName,
      mod: parseInt(newPlayerMod) || 0,
      roll: null
    };
    const updated = [...players, newP];
    setPlayers(updated);
    setNewPlayerName('');
    setNewPlayerMod('0');
  };

  const deletePlayer = (index) => {
    if (players.length === 0) return;
    const updated = players.filter((_, i) => i !== index);
    setPlayers(updated);
    setCurrentTurnIndex(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Player Removed', `${players[index]?.name || 'Player'} removed from initiative.`);
  };

  const nextTurn = () => {
    if (players.length === 0) return;
    setCurrentTurnIndex((prev) => (prev + 1) % players.length);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const resetInitiative = () => {
    const resetPlayers = players.map(p => ({ ...p, roll: null }));
    setPlayers(resetPlayers);
    setCurrentTurnIndex(0);
    setRolls([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const jamBreak = () => {
    const events = [
      "Air Guitar Solo! 🎸",
      "Crowd Goes Wild! Roll for Inspiration",
      "Stage Dive Fail - Sip & Laugh 🍺",
      "Epic Riff - Advantage on next roll!"
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    Alert.alert("🎸 Jam Break! 🎸", event, [{ text: 'Hell Yeah!', onPress: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) }]);
  };

  const newGig = () => {
    Alert.alert(
      "New Gig?",
      "Clear all players for a new group? Session notes will be kept.",
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'New Gig', 
          onPress: () => {
            setPlayers([]);
            setRolls([]);
            setCurrentTurnIndex(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {currentScreen === 'home' && <HomeScreen styles={styles} />}
      {currentScreen === 'help' && <HelpScreen styles={styles} />}
      {currentScreen === 'setup' && (
        <SetupScreen
          styles={styles}
          newPlayerName={newPlayerName}
          setNewPlayerName={setNewPlayerName}
          newPlayerMod={newPlayerMod}
          setNewPlayerMod={setNewPlayerMod}
          addPlayer={addPlayer}
          players={players}
          deletePlayer={deletePlayer}
          newGig={newGig}
          sessionNotes={sessionNotes}
          setSessionNotes={setSessionNotes}
        />
      )}
      {currentScreen === 'tracker' && (
        <TrackerScreen
          styles={styles}
          orderMode={orderMode}
          setOrderMode={setOrderMode}
          selectedDie={selectedDie}
          setSelectedDie={setSelectedDie}
          players={players}
          currentTurnIndex={currentTurnIndex}
          rollInitiative={rollInitiative}
          nextTurn={nextTurn}
          resetInitiative={resetInitiative}
          jamBreak={jamBreak}
          rolls={rolls}
          diceOptions={diceOptions}
          campaignId={campaignId}
          isConnectedToCampaign={isConnectedToCampaign}
        />
      )}
      {currentScreen === 'campaign' && (
        <CampaignScreen
          styles={styles}
          campaignId={campaignId}
          setCampaignId={setCampaignId}
          isConnectedToCampaign={isConnectedToCampaign}
          setIsConnectedToCampaign={setIsConnectedToCampaign}
          db={db}
        />
      )}
      <TabBar currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} styles={styles} />
    </View>
  );
};

// Stable screen components (defined outside to prevent remounting on every render — fixes input focus loss)
const HomeScreen = ({ styles }) => (
  <View style={styles.homeContainer}>
    <Text style={styles.doorEmoji}>🪨🚪🎸</Text>
    <Text style={styles.welcomeTitle}>Welcome to the Tavern</Text>
    <Text style={styles.welcomeText}>
      The band is ready. The crowd is rowdy.{'\n\n'}
      Tap the tabs below to:{'\n'}
      • View Help{'\n'}
      • Setup your Band & Notes{'\n'}
      • Roll Initiative and track turns
    </Text>
    <Text style={styles.welcomeSub}>Rock on — may your rolls be high and your jams legendary! 🎲🍺</Text>
  </View>
);

const HelpScreen = ({ styles }) => (
  <View style={styles.screenContainer}>
    <Text style={styles.sectionTitle}>How to Rock the Initiative</Text>
    <Text style={styles.helpText}>
      • Add band members with name and modifier in Setup.{'\n'}
      • Use "New Gig" to clear between groups.{'\n'}
      • In Tracker: Roll individual or all. Natural 20/1 trigger special events!{'\n'}
      • Current turn is highlighted in gold.{'\n'}
      • Jam Break for random chaos anytime.{'\n'}
      • Everything auto-saves. Use Session Notes for your campaign lore.{'\n\n'}
      Built for fast D&D / DCC sessions with rock & roll soul.
    </Text>
    <Text style={styles.helpFooter}>Shake phone or use dev menu for reload. Enjoy the gig!</Text>
  </View>
);

const SetupScreen = ({
  styles,
  newPlayerName,
  setNewPlayerName,
  newPlayerMod,
  setNewPlayerMod,
  addPlayer,
  players,
  deletePlayer,
  newGig,
  sessionNotes,
  setSessionNotes,
  campaignId,
  isConnectedToCampaign
}) => (
  <View style={styles.screenContainer}>
    <Text style={styles.sectionTitle}>Band Setup</Text>
    {isConnectedToCampaign && campaignId && (
      <Text style={styles.campaignBadge}>🌐 {campaignId} (Live)</Text>
    )}
    
    <View style={styles.addSection}>
      <Text style={styles.label}>Character / Band Member Name</Text>
      <TextInput 
        placeholder="e.g. Thunderaxe the Bard" 
        placeholderTextColor="#888"
        value={newPlayerName} 
        onChangeText={setNewPlayerName} 
        style={styles.input} 
      />
      <Text style={styles.label}>Initiative Modifier (+/-)</Text>
      <TextInput 
        placeholder="0" 
        placeholderTextColor="#888"
        value={newPlayerMod} 
        onChangeText={setNewPlayerMod} 
        keyboardType="numeric" 
        style={styles.input} 
      />
      <Button title="Add to Band" onPress={addPlayer} color="#ffcc00" />
    </View>

    <Text style={styles.sectionTitle}>Current Band ({players.length})</Text>
    {players.length === 0 ? (
      <Text style={styles.emptyState}>No members yet. Add some above!</Text>
    ) : (
      <FlatList
        data={players}
        renderItem={({item, index}) => (
          <View style={styles.playerRow}>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{item.name} (Mod: {item.mod})</Text>
            </View>
            <View style={styles.playerActions}>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deletePlayer(index)}>
                <Text style={styles.btnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        keyExtractor={(item, idx) => idx.toString()}
      />
    )}

    <Button title="New Gig (Clear Players)" onPress={newGig} color="#666" />

    <Text style={styles.sectionTitle}>Session Notes</Text>
    <TextInput 
      placeholder="Campaign notes, funny moments, setlist..." 
      value={sessionNotes} 
      onChangeText={setSessionNotes} 
      multiline 
      style={styles.notesInput} 
    />
  </View>
);

const TrackerScreen = ({
  styles,
  orderMode,
  setOrderMode,
  selectedDie,
  setSelectedDie,
  players,
  currentTurnIndex,
  rollInitiative,
  nextTurn,
  resetInitiative,
  jamBreak,
  rolls,
  diceOptions,
  campaignId,
  isConnectedToCampaign
}) => (
  <View style={styles.screenContainer}>
    <Text style={styles.sectionTitle}>Initiative Tracker — {orderMode.toUpperCase()} Mode</Text>
    {isConnectedToCampaign && campaignId && (
      <Text style={styles.campaignBadge}>🌐 {campaignId} (Live)</Text>
    )}
    
    <View style={styles.diceSelect}>
      <Text style={styles.label}>Die: </Text>
      {diceOptions.map(d => (
        <TouchableOpacity 
          key={d} 
          onPress={() => setSelectedDie(d)} 
          style={[styles.dieBtn, selectedDie === d && styles.selected]}
        >
          <Text style={styles.dieText}>{d}</Text>
        </TouchableOpacity>
      ))}
    </View>

    <View style={styles.modeToggle}>
      <Button 
        title={orderMode === 'sorted' ? '🔄 Cyclic' : '📋 Sorted'} 
        onPress={() => setOrderMode(orderMode === 'sorted' ? 'cyclic' : 'sorted')} 
      />
      <Button title="Reset Rolls" onPress={resetInitiative} color="#666" />
    </View>

    <Text style={styles.sectionTitle}>Band (sorted by roll)</Text>
    {players.length === 0 ? (
      <Text style={styles.emptyState}>Add band members in Setup tab first!</Text>
    ) : (
      <FlatList
        data={players}
        renderItem={({item, index}) => {
          const isCurrent = index === currentTurnIndex;
          return (
            <View style={[styles.playerRow, isCurrent && styles.currentTurn]}>
              <View style={styles.playerInfo}>
                <Text style={[styles.playerName, isCurrent && styles.currentTurnText]}>
                  {item.name}
                </Text>
                <Text style={styles.rollText}>
                  Mod: {item.mod} • Roll: {item.roll !== null && item.roll !== undefined ? item.roll : '—'}
                </Text>
              </View>
              <TouchableOpacity style={styles.rollBtn} onPress={() => rollInitiative(index)}>
                <Text style={styles.btnText}>Roll</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        keyExtractor={(item, idx) => idx.toString()}
        extraData={[currentTurnIndex, orderMode, selectedDie]}
      />
    )}

    <View style={styles.controls}>
      <Button title="🎲 Roll All" onPress={() => rollInitiative()} color="#ff6600" />
      <Button title="➡️ Next Turn" onPress={nextTurn} disabled={players.length === 0} />
      <Button title="🎸 Jam Break!" onPress={jamBreak} color="#ffcc00" />
    </View>

    <Text style={styles.sectionTitle}>Recent Activity</Text>
    <View style={styles.history}>
      {rolls.length > 0 ? rolls.slice(0, 5).map((r, i) => (
        <Text key={i} style={styles.historyText}>
          {r.player}: {r.die} = {r.total}
        </Text>
      )) : <Text style={styles.historyText}>Roll some dice to see action here...</Text>}
    </View>
  </View>
);

const CampaignScreen = ({
  styles,
  campaignId,
  setCampaignId,
  isConnectedToCampaign,
  setIsConnectedToCampaign,
  db
}) => {
  const [campaignCode, setCampaignCode] = useState('');

  const createCampaign = async () => {
    const code = campaignCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Error', 'Please enter a campaign code');
      return;
    }

    if (!db) {
      Alert.alert('Error', 'Firebase not configured');
      return;
    }

    const campaignRef = doc(db, 'campaigns', code);

    try {
      const snapshot = await getDoc(campaignRef);
      if (snapshot.exists()) {
        Alert.alert('Campaign Exists', `Campaign "${code}" already exists. Join it instead or choose a different ID.`);
        return;
      }

      await setDoc(campaignRef, {
        players: [],
        sessionNotes: '',
        currentTurnIndex: 0,
        orderMode: 'sorted',
        createdAt: serverTimestamp(),
        isLocked: false
      });

      setCampaignId(code);
      setIsConnectedToCampaign(true);
      setCampaignCode('');
      Alert.alert('Campaign Created', `Share this code with your band:\n\n${code}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create campaign. Check your connection.');
      console.error(error);
    }
  };

  const joinCampaign = () => {
    const code = campaignCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Error', 'Please enter a campaign code');
      return;
    }

    setCampaignId(code);
    setIsConnectedToCampaign(true);
    setCampaignCode('');
    Alert.alert('Joined Campaign', `Connected to ${code}\n\n(Real-time sync with Firebase is now active)`);
  };

  const leaveCampaign = () => {
    setCampaignId(null);
    setIsConnectedToCampaign(false);
    Alert.alert('Left Campaign', 'Back to local mode');
  };

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.sectionTitle}>Multiplayer Campaign</Text>
      
      {isConnectedToCampaign && campaignId ? (
        <View>
          <Text style={styles.label}>Current Campaign: {campaignId}</Text>
          <Text style={styles.helpText}>Everyone in this campaign sees the same player list, rolls, and notes in real-time.</Text>
          <Button title="Leave Campaign" onPress={leaveCampaign} color="#990000" />
        </View>
      ) : (
        <View>
          <Text style={styles.label}>Campaign ID</Text>
          <TextInput 
            placeholder="e.g. ROCKX7K2 (4-8 characters recommended)" 
            value={campaignCode} 
            onChangeText={setCampaignCode} 
            style={styles.input} 
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Button title="Create New Campaign" onPress={createCampaign} color="#ffcc00" />
          <Button title="Join Existing Campaign" onPress={joinCampaign} />
          <Text style={styles.helpText}>Note: If the campaign is locked with a password in the future, you will be prompted for it when joining.</Text>
        </View>
      )}
    </View>
  );
};

const TabBar = ({ currentScreen, setCurrentScreen, styles }) => (
  <View style={styles.tabBar}>
    {[
      { key: 'home', label: '🏠 Home', icon: '🏠' },
      { key: 'help', label: '❔ Help', icon: '❔' },
      { key: 'setup', label: '🎤 Setup', icon: '🎤' },
      { key: 'tracker', label: '🎲 Track', icon: '🎲' },
      { key: 'campaign', label: '🌐 Campaign', icon: '🌐' }
    ].map(tab => (
      <TouchableOpacity 
        key={tab.key}
        style={[styles.tabItem, currentScreen === tab.key && styles.activeTab]}
        onPress={() => setCurrentScreen(tab.key)}
      >
        <Text style={styles.tabIcon}>{tab.icon}</Text>
        <Text style={styles.tabLabel}>{tab.label.split(' ')[1]}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#1a0033', // Dark tavern rock aesthetic
    paddingBottom: 40 
  },
  title: { 
    fontSize: 26, 
    color: '#ffcc00', 
    textAlign: 'center', 
    marginBottom: 15, 
    fontWeight: 'bold' 
  },
  label: { color: '#ffddaa', marginBottom: 5, marginTop: 10, fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { 
    color: '#ffcc00', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginTop: 15, 
    marginBottom: 8 
  },
  addSection: { marginBottom: 20 },
  input: { 
    borderWidth: 2, 
    borderColor: '#ff6600', 
    padding: 12, 
    marginVertical: 6, 
    color: '#fff', 
    backgroundColor: '#330066', 
    borderRadius: 6,
    fontSize: 16 
  },
  notesInput: { 
    borderWidth: 2, 
    borderColor: '#666', 
    padding: 12, 
    marginVertical: 8, 
    color: '#ddd', 
    backgroundColor: '#220044', 
    borderRadius: 6, 
    height: 80, 
    textAlignVertical: 'top' 
  },
  playerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 12, 
    marginVertical: 4, 
    backgroundColor: '#220044', 
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#444' 
  },
  currentTurn: { 
    borderLeftColor: '#ffcc00', 
    backgroundColor: '#331100',
    borderWidth: 2,
    borderColor: '#ffaa00' 
  },
  playerInfo: { flex: 1 },
  playerName: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  currentTurnText: { 
    color: '#ffeeaa', 
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    textShadowColor: '#ffaa00'
  },
  rollText: { color: '#aaa', fontSize: 14, marginTop: 2 },
  playerActions: { 
    flexDirection: 'row' 
  },
  rollBtn: { 
    backgroundColor: '#ff6600', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 6,
    marginRight: 8
  },
  deleteBtn: { 
    backgroundColor: '#990000', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 6 
  },
  btnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  diceSelect: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 15
  },
  dieBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: '#333', 
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
    margin: 4
  },
  selected: { 
    backgroundColor: '#ff6600', 
    borderColor: '#ffcc00' 
  },
  dieText: { color: '#fff', fontWeight: 'bold' },
  modeToggle: { 
    flexDirection: 'row', 
    marginVertical: 10,
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  list: { 
    maxHeight: 280, 
    marginBottom: 15 
  },
  controls: { 
    flexDirection: 'column', 
    marginVertical: 10 
  },
  emptyState: { 
    color: '#888', 
    fontStyle: 'italic', 
    textAlign: 'center', 
    padding: 20,
    backgroundColor: '#220044',
    borderRadius: 8,
    marginBottom: 15 
  },
  campaignBadge: { 
    color: '#00ff88', 
    fontSize: 14, 
    fontWeight: 'bold', 
    textAlign: 'right', 
    marginBottom: 10,
    backgroundColor: '#003300',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-end'
  },
  history: { 
    backgroundColor: '#110022', 
    padding: 12, 
    borderRadius: 8, 
    maxHeight: 160,
    marginBottom: 15 
  },
  historyText: { 
    color: '#bbb', 
    fontSize: 13, 
    marginVertical: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  // New tabbed screen styles
  homeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f001a',
    padding: 30
  },
  doorEmoji: {
    fontSize: 80,
    marginBottom: 20
  },
  welcomeTitle: {
    fontSize: 32,
    color: '#ffcc00',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20
  },
  welcomeText: {
    color: '#ddd',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20
  },
  welcomeSub: {
    color: '#ffaa00',
    fontSize: 15,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  screenContainer: {
    flex: 1,
    padding: 15,
    paddingBottom: 80
  },
  helpText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 10
  },
  helpFooter: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic'
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#110022',
    borderTopWidth: 2,
    borderTopColor: '#ff6600',
    paddingVertical: 8,
    elevation: 10
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    padding: 6
  },
  activeTab: {
    backgroundColor: '#330044',
    borderRadius: 8
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 2
  },
  tabLabel: {
    color: '#ffddaa',
    fontSize: 11,
    fontWeight: 'bold'
  }
});

export default RockAndRollInitiative;
