import { useState } from 'react';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Words } from './screens/Words';
import { Settings } from './screens/Settings';

type Screen = { name: 'home' } | { name: 'session'; mode: 'full' | 'extra' } | { name: 'words' } | { name: 'settings' };

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  if (screen.name === 'session') {
    return <Session mode={screen.mode} onExit={() => setScreen({ name: 'home' })} />;
  }
  if (screen.name === 'words') {
    return <Words onBack={() => setScreen({ name: 'home' })} />;
  }
  if (screen.name === 'settings') {
    return <Settings onBack={() => setScreen({ name: 'home' })} />;
  }

  return (
    <Home
      onStartSession={() => setScreen({ name: 'session', mode: 'full' })}
      onExtraReviews={() => setScreen({ name: 'session', mode: 'extra' })}
      onOpenWords={() => setScreen({ name: 'words' })}
      onOpenSettings={() => setScreen({ name: 'settings' })}
    />
  );
}

export default App;
