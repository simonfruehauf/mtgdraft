import { useState } from 'react';
import type { ScryfallSet, ScryfallCard, BoosterType, DraftSettings } from './types';
import { SetSelector } from './components/SetSelector';
import { DraftPick } from './components/DraftPick';
import { SealedOpener } from './components/SealedOpener';
import { DraftComplete } from './components/DraftComplete';
import { Lobby } from './components/Multiplayer/Lobby';
import { MultiplayerDraft } from './components/Multiplayer/MultiplayerDraft';
import { generateDraftBoosters } from './services/boosterGenerator';
import { hostDraftManager } from './services/HostDraftManager';
import type { MultiPlayer } from './types/multiplayer';
import './index.css';

type AppScreen = 'home' | 'draft' | 'sealed' | 'lobby' | 'multiplayer-draft';

function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [draftSettings, setDraftSettings] = useState<DraftSettings | null>(null);
  const [multiplayerRoomId, setMultiplayerRoomId] = useState('');
  const [showDraftComplete, setShowDraftComplete] = useState(false);
  const [finalPicks, setFinalPicks] = useState<ScryfallCard[]>([]);

  function handleSetSelect(_set: ScryfallSet, _boosterType: BoosterType, settings: DraftSettings) {
    setDraftSettings(settings);

    // Route based on mode
    if (settings.draftMode === 'sealed') {
      setScreen('sealed');
    } else if (settings.draftMode === 'multiplayer') {
      setScreen('lobby');
    } else {
      setScreen('draft');
    }
  }

  async function handleLobbyStart(roomId: string, players: MultiPlayer[]) {
    if (!draftSettings) return;

    try {
      const boosters = await generateDraftBoosters(
        draftSettings.setCode,
        draftSettings.boosterType,
        draftSettings.numberOfPacks,
        players.length
      );

      const packsForServer: ScryfallCard[][][] = [];
      for (let i = 0; i < players.length; i++) {
        packsForServer.push([]);
      }

      for (let packIdx = 0; packIdx < boosters.length; packIdx++) {
        const packRound = boosters[packIdx];
        for (let playerIdx = 0; playerIdx < packRound.length; playerIdx++) {
          packsForServer[playerIdx].push(packRound[playerIdx].cards);
        }
      }

      hostDraftManager.startDraft(packsForServer);
      handleMultiplayerGameStart(roomId, players);
    } catch (err) {
      console.error("Failed to generate multiplayer packs", err);
      alert("Failed to generate packs. Check console.");
    }
  }

  function handleMultiplayerGameStart(roomId: string, _players: MultiPlayer[]) {
    setMultiplayerRoomId(roomId);
    setScreen('multiplayer-draft');
  }

  function handleDraftComplete(picks: ScryfallCard[]) {
    setFinalPicks(picks);
    setShowDraftComplete(true);
  }

  function handleCloseDraftComplete() {
    setShowDraftComplete(false);
    setScreen('home');
    setDraftSettings(null);
    setFinalPicks([]);
  }



  function handleBackToHome() {
    setScreen('home');
    setDraftSettings(null);
    setShowDraftComplete(false);
    setFinalPicks([]);
  }

  return (
    <div className="app">
      <header className="header">
        <a
          href="#"
          className="logo"
          onClick={(e) => { e.preventDefault(); handleBackToHome(); }}
        >
          MTG Draft Simulator
        </a>
        {screen !== 'home' && (
          <button className="btn btn-ghost" onClick={handleBackToHome}>
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
                Draft Magic: The Gathering sets against AI bots, or open packs in sealed mode.
              </p>
            </div>
            <SetSelector onSelect={handleSetSelect} />
          </div>
        )}

        {screen === 'draft' && draftSettings && (
          <div className="container">
            <DraftPick
              settings={draftSettings}
              onComplete={handleDraftComplete}
              onBack={handleBackToHome}
            />
          </div>
        )}

        {screen === 'sealed' && draftSettings && (
          <SealedOpener
            settings={draftSettings}
            onBack={handleBackToHome}
          />
        )}

        {screen === 'lobby' && draftSettings && (
          <div className="container">
            <Lobby
              settings={draftSettings}
              onHostStart={handleLobbyStart}
              onGameStart={handleMultiplayerGameStart}
              onBack={handleBackToHome}
            />
          </div>
        )}

        {screen === 'multiplayer-draft' && draftSettings && (
          <div className="container">
            <MultiplayerDraft
              roomId={multiplayerRoomId}
              onComplete={handleDraftComplete}
            />
          </div>
        )}

        {showDraftComplete && draftSettings && (
          <DraftComplete
            picks={finalPicks}
            setName={draftSettings.setName}
            onNewDraft={handleCloseDraftComplete}
            onExport={() => {
              // Simple export to clipboard
              const lines = ['Deck'];
              finalPicks.forEach(card => {
                lines.push(`1 ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`);
              });
              navigator.clipboard.writeText(lines.join('\n'));
              alert('Deck copied to clipboard!');
            }}
          />
        )}

      </main>
    </div>
  );
}

export default App;
