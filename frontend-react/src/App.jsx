import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutGrid, Ticket, Wallet, RefreshCw, ChevronRight, X, Check } from 'lucide-react';

const API_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('events');
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState(null);
  const [events, setEvents] = useState([]);
  const [odds, setOdds] = useState({});
  const [betSlip, setBetSlip] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSports();
    fetchBalance();
  }, []);

  useEffect(() => {
    if (selectedSport) {
      fetchEvents(selectedSport);
    }
  }, [selectedSport]);

  const fetchSports = async () => {
    const res = await axios.get(`${API_URL}/sports`);
    setSports(res.data);
    if (res.data.length > 0 && !selectedSport) setSelectedSport(res.data[0].key);
  };

  const fetchBalance = async () => {
    const res = await axios.get(`${API_URL}/balance`);
    setBalance(res.data.balance);
  };

  const fetchEvents = async (sportKey) => {
    setLoading(true);
    const res = await axios.get(`${API_URL}/events?sport_key=${sportKey}`);
    setEvents(res.data);

    // Fetch odds for each event
    const oddsMap = {};
    await Promise.all(res.data.map(async (ev) => {
      try {
        const oRes = await axios.get(`${API_URL}/odds/${ev.id}`);
        oddsMap[ev.id] = oRes.data;
      } catch (e) {}
    }));
    setOdds(oddsMap);
    setLoading(false);
  };

  const placeBet = async (stake) => {
    try {
      await axios.post(`${API_URL}/bets`, {
        event_id: betSlip.id,
        selection: betSlip.sel,
        odds: betSlip.price,
        stake: parseFloat(stake)
      });
      setBetSlip(null);
      fetchBalance();
      alert('Apuesta Realizada');
    } catch (e) {
      alert('Error al apostar');
    }
  };

  return (
    <div className="min-h-screen bg-dark text-white font-sans pb-20">
      <header className="p-4 bg-card border-b border-gray-800 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-primary">SportPOS Pro</h1>
        <div className="bg-gray-900 px-3 py-1 rounded-full text-sm font-mono text-green-400 border border-green-900">
          ${balance.toFixed(2)}
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {activeTab === 'events' && (
          <div>
            <div className="flex gap-2 overflow-x-auto mb-6 pb-2 no-scrollbar">
              {sports.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSelectedSport(s.key)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${selectedSport === s.key ? 'bg-primary text-white' : 'bg-card text-gray-400 border border-gray-800'}`}
                >
                  {s.title}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center p-20 animate-spin"><RefreshCw size={32} /></div>
            ) : (
              <div className="space-y-4">
                {events.map(ev => (
                  <div key={ev.id} className="bg-card rounded-xl p-4 border border-gray-800">
                    <div className="text-xs text-gray-500 mb-2 flex justify-between">
                      <span>{ev.sport_title}</span>
                      <span>{new Date(ev.commence_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="text-center font-bold text-lg mb-4">
                      {ev.home_team} vs {ev.away_team}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <OddButton label="1" price={odds[ev.id]?.home_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, sel: ev.home_team, price: odds[ev.id]?.home_price})} />
                      <OddButton label="X" price={odds[ev.id]?.draw_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, sel: 'Draw', price: odds[ev.id]?.draw_price})} />
                      <OddButton label="2" price={odds[ev.id]?.away_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, sel: ev.away_team, price: odds[ev.id]?.away_price})} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tickets' && <div className="p-10 text-center text-gray-500">Módulo de Historial en React...</div>}
        {activeTab === 'caja' && <div className="p-10 text-center text-gray-500">Módulo de Caja en React...</div>}
      </main>

      {betSlip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end">
          <div className="w-full bg-card rounded-t-3xl p-6 border-t border-gray-700 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Ticket de Apuesta</h2>
              <button onClick={() => setBetSlip(null)} className="p-2 bg-gray-800 rounded-full"><X size={20}/></button>
            </div>
            <div className="mb-4">
              <div className="text-gray-400 text-sm">{betSlip.name}</div>
              <div className="text-lg font-bold">{betSlip.sel} @ {betSlip.price}</div>
            </div>
            <div className="flex gap-4 mb-6">
              {[10, 20, 50, 100].map(v => (
                <button key={v} onClick={() => placeBet(v)} className="flex-1 py-3 bg-gray-800 rounded-xl font-bold text-primary active:bg-primary active:text-white transition-all">
                  ${v}
                </button>
              ))}
            </div>
            <button onClick={() => placeBet(prompt('Monto personalizado'))} className="w-full py-4 bg-primary rounded-xl font-black text-xl shadow-lg shadow-primary/20">
              CONFIRMAR
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 w-full bg-card border-t border-gray-800 flex justify-around p-3 z-10">
        <NavBtn icon={<LayoutGrid />} active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
        <NavBtn icon={<Ticket />} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />
        <NavBtn icon={<Wallet />} active={activeTab === 'caja'} onClick={() => setActiveTab('caja')} />
      </nav>
    </div>
  );
}

function OddButton({ label, price, onClick }) {
  if (!price) return <div className="bg-gray-900/50 rounded-lg py-3 border border-gray-800 opacity-30"></div>;
  return (
    <button onClick={onClick} className="bg-gray-800 rounded-lg py-3 border border-gray-800 active:bg-primary active:border-primary transition-all">
      <div className="text-[10px] text-gray-500 uppercase font-bold">{label}</div>
      <div className="text-lg font-mono font-bold">{price}</div>
    </button>
  );
}

function NavBtn({ icon, active, onClick }) {
  return (
    <button onClick={onClick} className={`p-3 rounded-2xl transition-all ${active ? 'bg-primary text-white' : 'text-gray-500'}`}>
      {React.cloneElement(icon, { size: 24 })}
    </button>
  );
}

export default App;
