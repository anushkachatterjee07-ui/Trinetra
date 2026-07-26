import { CommandCenter } from './components/CommandCenter';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.18),transparent_18%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.12),transparent_20%),linear-gradient(180deg,#020712_0%,#05080f_100%)]">
        <CommandCenter />
      </div>
    </div>
  );
}

export default App;
