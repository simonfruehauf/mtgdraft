import { useState } from 'react';
import type { ScryfallSet, ScryfallCard, BoosterType, DraftSettings } from './types';
import { SetSelector } from './components/SetSelector';
import { DraftSetup } from './components/DraftSetup';
import { DraftPick } from './components/DraftPick';
import { SealedOpener } from './components/SealedOpener';
import { DeckBuilder } from './components/DeckBuilder';
import { Lobby } from './components/Multiplayer/Lobby';
import { MultiplayerDraft } from './components/Multiplayer/MultiplayerDraft';
import { generateDraftBoosters } from './services/boosterGenerator';
import { hostDraftManager } from './services/HostDraftManager';
import type { MultiPlayer } from './types/multiplayer';
import './index.css';

type AppScreen = 'home' | 'setup' | 'draft' | 'sealed' | 'deckbuilder' | 'lobby' | 'multiplayer-draft';

function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [selectedSet, setSelectedSet] = useState<ScryfallSet | null>(null);
  const [selectedBoosterType, setSelectedBoosterType] = useState<BoosterType>('draft');
  const [draftSettings, setDraftSettings] = useState<DraftSettings | null>(null);
  const [draftPicks, setDraftPicks] = useState<ScryfallCard[]>([]);

  function handleSetSelect(set: ScryfallSet, boosterType: BoosterType) {
    setSelectedSet(set);
    setSelectedBoosterType(boosterType);
    setScreen('setup');
  }

  function handleDraftStart(settings: DraftSettings) {
    setDraftSettings(settings);
    // Route to appropriate screen based on mode
    if (settings.draftMode === 'sealed') {
      setScreen('sealed');
    } else if (settings.draftMode === 'multiplayer') {
      setScreen('lobby');
    } else {
      setScreen('draft');
    }
  }

  // Multiplayer Handlers
  async function handleLobbyStart(roomId: string, players: MultiPlayer[]) {
    // This is called when the HOST clicks "Start Draft"
    // We generate packs and emit them to the server
    if (!draftSettings) return;

    try {
      // 1. Generate packs
      const boosters = await generateDraftBoosters(
        draftSettings.setCode,
        draftSettings.boosterType,
        draftSettings.numberOfPacks,
        players.length // Generate for real player count
      );

      // 2. Convert to format expected by server/client (3D array: [player][pack][cards])
      // generateDraftBoosters returns [packIndex][playerIndex] -> booster
      // We need to re-orient? 
      // Server expects: [playerIndex][packIndex] -> Cards[]

      const packsForServer: ScryfallCard[][][] = [];
      for (let pLength = 0; pLength < players.length; pLength++) {
        packsForServer.push([]);
      }

      // boosters is array of Packs (which are array of Boosters)
      // boosters[packIndex][playerIndex]

      for (let packIdx = 0; packIdx < boosters.length; packIdx++) {
        const packRound = boosters[packIdx];
        for (let playerIdx = 0; playerIdx < packRound.length; playerIdx++) {
          packsForServer[playerIdx].push(packRound[playerIdx].cards);
        }
      }

      // 3. Start Draft locally (which broadcasts to peers)
      hostDraftManager.startDraft(packsForServer);

      // For Host, we trigger the game start immediately
      handleMultiplayerGameStart(roomId, players);

    } catch (err) {
      console.error("Failed to generate multiplayer packs", err);
      alert("Failed to generate packs. Check console.");
    }
  }

  const [multiplayerRoomId, setMultiplayerRoomId] = useState('');

  function handleMultiplayerGameStart(roomId: string, _players: MultiPlayer[]) {
    // Called when Lobby receives confirmed start from server
    setMultiplayerRoomId(roomId);
    setScreen('multiplayer-draft');
  }

  function handleDraftComplete(picks: ScryfallCard[]) {
    setDraftPicks(picks);
    setScreen('deckbuilder');
  }

  function handleBackToHome() {
    setScreen('home');
    setSelectedSet(null);
    setDraftSettings(null);
    setDraftPicks([]);
  }

  function handleBackToSetup() {
    setScreen('setup');
  }

  function handleBackToDraft() {
    // Go back to appropriate screen based on mode
    if (draftSettings?.draftMode === 'sealed') {
      setScreen('sealed');
    } else {
      setScreen('draft');
    }
  }

  return (
    <div className="app">
      <header className="header">
        <a href="#" className="logo" onClick={(e) => { e.preventDefault(); handleBackToHome(); }}>
          <span>⚔️</span>
          MTG Draft Simulator
        </a>
        {screen !== 'home' && (
          <button className="btn btn-secondary" onClick={handleBackToHome}>
            New Draft
          </button>
        )}
      </header>

      <main className="main">
        {screen === 'home' && (
          <div className="container">
            <div className="home-hero fade-in">
              <h1>MTG Draft Simulator</h1>
              <p>
                Draft Magic: The Gathering sets against bots, or open packs in Box Brawl mode.
                Supports Play Boosters, Draft Boosters, and Set Boosters.
              </p>
            </div>
            <SetSelector onSelect={handleSetSelect} />
          </div>
        )}

        {screen === 'setup' && selectedSet && (
          <DraftSetup
            set={selectedSet}
            boosterType={selectedBoosterType}
            onStart={handleDraftStart}
            onBack={handleBackToHome}
          />
        )}

        {screen === 'draft' && draftSettings && (
          <div className="container">
            <DraftPick
              settings={draftSettings}
              onComplete={handleDraftComplete}
              onBack={handleBackToSetup}
            />
          </div>
        )}

        {screen === 'sealed' && draftSettings && (
          <SealedOpener
            settings={draftSettings}
            onComplete={handleDraftComplete}
            onBack={handleBackToSetup}
          />
        )}

        {screen === 'lobby' && draftSettings && (
          <div className="container">
            <Lobby
              settings={draftSettings}
              onHostStart={handleLobbyStart}
              onGameStart={handleMultiplayerGameStart}
              onBack={handleBackToSetup}
            />
          </div>
        )}

        {screen === 'multiplayer-draft' && draftSettings && (
          <div className="container">
            <MultiplayerDraft
              settings={draftSettings}
              roomId={multiplayerRoomId}
              onComplete={handleDraftComplete}
            />
          </div>
        )}

        {screen === 'deckbuilder' && draftSettings && (
          <DeckBuilder
            picks={draftPicks}
            setName={draftSettings.setName}
            onBack={handleBackToDraft}
          />
        )}
      </main>
    </div>
  );
}

export default App;
