import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { DraftProvider, useDraft } from './context/DraftContext';
import { SetSelector } from './components/SetSelector';
import { DraftPick } from './components/DraftPick';
import { SealedOpener } from './components/SealedOpener';
import { DraftComplete } from './components/DraftComplete';
import { Lobby } from './components/Multiplayer/Lobby';
import { MultiplayerDraft } from './components/Multiplayer/MultiplayerDraft';
import { DraftLogList } from './components/DraftLog/DraftLogList';
import { DraftLogViewer } from './components/DraftLog/DraftLogViewer';
import type { ScryfallSet, BoosterType, DraftSettings, ScryfallCard } from './types';
import { generateDraftBoosters } from './services/boosterGenerator';
import { hostDraftManager } from './services/HostDraftManager';
import type { MultiPlayer } from './types/multiplayer';
import './index.css';

function AppContent() {
  const navigate = useNavigate();
  const { draftSettings, startDraft, endDraft } = useDraft();

  function handleSetSelect(_set: ScryfallSet, _boosterType: BoosterType, settings: DraftSettings) {
    startDraft(settings);

    if (settings.draftMode === 'sealed') {
      navigate('/sealed');
    } else if (settings.draftMode === 'multiplayer') {
      navigate('/lobby');
    } else {
      navigate('/draft');
    }
  }

  function handleBackToHome() {
    endDraft();
    navigate('/');
  }

  // Wrappers to handle context/navigation logic
  const DraftRoute = () => {
    if (!draftSettings) return <Navigate to="/" />;

    // TODO: Refactor DraftPick to use context directly later
    // For now, adaptable wrapper
    return (
      <div className="container">
        <DraftPick
          settings={draftSettings}
          onComplete={(picks) => {
            // We can save picks to context here if needed, 
            // but DraftPick will eventually do it itself
            navigate('/complete', { state: { picks, settings: draftSettings } });
          }}
          onBack={handleBackToHome}
        />
      </div>
    );
  };

  const SealedRoute = () => {
    if (!draftSettings) return <Navigate to="/" />;
    return (
      <SealedOpener
        settings={draftSettings}
        onBack={handleBackToHome}
      />
    );
  };

  const LobbyRoute = () => {
    if (!draftSettings) return <Navigate to="/" />;

    const handleLobbyStart = async (roomId: string, players: MultiPlayer[]) => {
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
        navigate(`/multiplayer/${roomId}`);
      } catch (err) {
        console.error("Failed to generate multiplayer packs", err);
        alert("Failed to generate packs. Check console.");
      }
    };

    return (
      <div className="container">
        <Lobby
          settings={draftSettings}
          onHostStart={handleLobbyStart}
          onGameStart={(roomId) => navigate(`/multiplayer/${roomId}`)}
          onBack={handleBackToHome}
        />
      </div>
    );
  };

  const MultiplayerGameRoute = () => {
    // Params handled inside component effectively via props in existing code, 
    // but here we might need to extract params if we change MultiplayerDraft
    // For now, we need to pass roomId.
    // Let's rely on the component parsing URL or context? 
    // Actually MultiplayerDraft takes roomId as prop.
    // We can use useParams.
    // But wait, the existing code passed it via state.

    // Simplification: We'll assume the URL has the ID.
    // const { roomId } = useParams();
    // But we need to update MultiplayerDraft to take it from params or we pass it here.
    // Let's just use window.location for now or better, a wrapper.

    // Actually, let's keep it simple.
    // We will render it with a wrapper that gets the ID.
    const path = window.location.pathname;
    const roomId = path.split('/').pop() || '';

    return (
      <div className="container">
        <MultiplayerDraft
          roomId={roomId}
          onComplete={(picks) => navigate('/complete', { state: { picks, settings: draftSettings } })}
        />
      </div>
    );
  };

  // Custom Complete Page wrapper to read state
  const CompleteRoute = () => {
    // This is a bit hacky, but robust for now.
    // In a real app we'd use useLocation() state.
    // We'll leave it as a placeholder until we refactor DraftComplete fully.
    // Actually, let's allow passing props via location state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = (window.history.state as any)?.usr || {};
    const picks = state.picks as ScryfallCard[];
    const settings = state.settings as DraftSettings;

    if (!picks || !settings) return <Navigate to="/" />;

    return (
      <DraftComplete
        picks={picks}
        setName={settings.setName}
        onNewDraft={handleBackToHome}
        onRedoDraft={() => {
          // Restart with same settings
          startDraft(settings);
          navigate('/draft');
        }}
        onExport={() => {
          const lines = ['Deck'];
          picks.forEach(card => {
            lines.push(`1 ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`);
          });
          navigator.clipboard.writeText(lines.join('\n'));
          alert('Deck copied to clipboard!');
        }}
      />
    );
  };

  return (
    <div className="app">
      <header className="header">
        <a href="/" className="logo" onClick={(e) => { e.preventDefault(); handleBackToHome(); }}>
          MTG Draft Simulator
        </a>
        <div className="nav-links">
          <button className="btn btn-ghost" onClick={() => navigate('/draft/logs')}>History</button>
          {draftSettings && (
            <button className="btn btn-ghost" onClick={handleBackToHome}>
              New Draft
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={
            <div className="container">
              <div className="home-hero fade-in">
                <h1>MTG Draft Simulator</h1>
                <p>
                  Draft Magic: The Gathering sets against AI bots, or open packs in sealed mode.
                </p>
              </div>
              <SetSelector onSelect={handleSetSelect} />
            </div>
          } />
          <Route path="/draft" element={<DraftRoute />} />
          <Route path="/sealed" element={<SealedRoute />} />
          <Route path="/lobby" element={<LobbyRoute />} />
          <Route path="/multiplayer/:roomId" element={<MultiplayerGameRoute />} />
          <Route path="/complete" element={<CompleteRoute />} />
          <Route path="/draft/logs" element={<DraftLogList />} />
          <Route path="/draft/log/:id" element={<DraftLogViewer />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DraftProvider>
      <AppContent />
    </DraftProvider>
  );
}
