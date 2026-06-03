import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  LayoutGrid, Ticket as TicketIcon, Wallet, RefreshCw, ChevronRight,
  X, Check, Printer, Search, ArrowUpRight, ArrowDownLeft, AlertCircle, Trash2,
  ChevronDown, Menu
} from 'lucide-react';

const API_URL = `http://${window.location.hostname}:8000`;

function App() {
  const [activeTab, setActiveTab] = useState('events');
  const [sportsStructure, setSportsStructure] = useState({});
  const [selectedSportKey, setSelectedSportKey] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [events, setEvents] = useState([]);
  const [odds, setOdds] = useState({});
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [selections, setSelections] = useState([]);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [stake, setStake] = useState('');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  useEffect(() => {
    fetchSports();
    fetchBalance();
  }, []);

  useEffect(() => {
    if (selectedSportKey) fetchEvents(selectedSportKey);
  }, [selectedSportKey]);

  useEffect(() => {
    if (activeTab === 'tickets') fetchHistory();
    if (activeTab === 'caja') { fetchBalance(); fetchTransactions(); }
  }, [activeTab]);

  const fetchSports = async () => {
    try {
      const res = await axios.get(`${API_URL}/sports`);
      setSportsStructure(res.data);
      const firstCat = Object.keys(res.data)[0];
      setSelectedCategory(firstCat);
      setSelectedSportKey(res.data[firstCat][0][0]);
    } catch (e) {}
  };

  const fetchBalance = async () => {
    try {
      const res = await axios.get(`${API_URL}/balance`);
      setBalance(res.data.balance);
    } catch (e) {}
  };

  const fetchEvents = async (sportKey) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/events?sport_key=${sportKey}`);
      setEvents(res.data);
      const oddsMap = {};
      await Promise.all(res.data.map(async (ev) => {
        try {
          const oRes = await axios.get(`${API_URL}/odds/${ev.id}`);
          oddsMap[ev.id] = oRes.data;
        } catch (e) {}
      }));
      setOdds(oddsMap);
    } catch (e) {}
    setLoading(false);
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/bets`);
      setHistory(res.data);
    } catch (e) {}
  };

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${API_URL}/transactions`);
      setTransactions(res.data);
    } catch (e) {}
  };

  const totalOdds = useMemo(() => {
    return selections.reduce((acc, curr) => acc * curr.odds, 1).toFixed(2);
  }, [selections]);

  const addToSlip = (selection) => {
    if (selections.find(s => s.event_id === selection.event_id)) {
        setSelections(prev => prev.filter(s => s.event_id !== selection.event_id).concat(selection));
    } else {
        setSelections(prev => [...prev, selection]);
    }
  };

  const placeBet = async () => {
    if (!stake || parseFloat(stake) <= 0) return;
    try {
      const res = await axios.post(`${API_URL}/bets`, {
        selections: selections,
        total_odds: parseFloat(totalOdds),
        stake: parseFloat(stake)
      });
      setSelections([]); setStake(''); setShowConfirmModal(false); setShowSlipModal(false);
      fetchBalance();
      window.open(`${API_URL}/bets/${res.data.ticket_id}/pdf`, '_blank');
    } catch (e) { alert('Error al apostar'); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans pb-32 selection:bg-blue-600/30 antialiased overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4">

        {/* Header */}
        <header className="py-4 md:py-6 flex justify-between items-center sticky top-0 bg-[#050505]/95 backdrop-blur-xl z-50 border-b border-white/[0.03]">
            <div className="flex items-center gap-3">
                <button onClick={() => setShowCategoryMenu(true)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 border border-white/5 transition-all">
                    <Menu size={22} className="text-blue-500" />
                </button>
                <span className="text-xl font-black tracking-tight uppercase italic leading-none">SPORT<span className="text-blue-500">POS</span></span>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={() => axios.post(`${API_URL}/refresh`).then(() => fetchEvents(selectedSportKey))} className="p-2.5 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5">
                    <RefreshCw size={18} className={loading ? 'animate-spin text-blue-500' : 'text-gray-400'} />
                </button>
                <div className="bg-green-500/10 border border-green-500/20 px-5 py-2 rounded-2xl">
                    <span className="text-green-500 font-mono font-black text-lg tracking-tighter italic">
                        ${balance.toLocaleString(undefined, {minimumFractionDigits:2})}
                    </span>
                </div>
            </div>
        </header>

        <main className="mt-6">
            {activeTab === 'events' && (
                <div className="space-y-6">
                    {/* Horizontal League Selector based on Category */}
                    {selectedCategory && (
                        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                            {sportsStructure[selectedCategory].map(([key, name]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedSportKey(key)}
                                    className={`px-6 py-3 rounded-2xl text-xs font-black transition-all border whitespace-nowrap ${
                                        selectedSportKey === key
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-600/30 scale-105'
                                        : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 opacity-20"><RefreshCw size={48} className="animate-spin text-blue-500 mb-4" /><span className="text-[10px] font-black uppercase tracking-widest">Cargando Líneas...</span></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {events.map(ev => (
                                <div key={ev.id} className="bg-[#111] rounded-[2.5rem] p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full shadow-glow"></span>
                                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{ev.sport_title}</span>
                                        </div>
                                        <span className="text-[9px] font-mono text-blue-400 bg-blue-600/5 px-2.5 py-0.5 rounded-full border border-blue-600/10">
                                            {new Date(ev.commence_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <div className="text-center space-y-1 mb-8">
                                        <div className="font-black text-sm uppercase tracking-tight text-white/90">{ev.home_team}</div>
                                        <div className="text-blue-600/40 text-[9px] font-black italic">VERSUS</div>
                                        <div className="font-black text-sm uppercase tracking-tight text-white/90">{ev.away_team}</div>
                                    </div>
                                    <div className="space-y-4">
                                        {odds[ev.id]?.h2h && (
                                            <div className="grid grid-cols-3 gap-2">
                                                <OddBtn label="1" val={odds[ev.id].h2h.home} active={selections.find(s => s.event_id === ev.id && s.selection === 'ML: '+ev.home_team)} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, selection: 'ML: '+ev.home_team, odds: odds[ev.id].h2h.home})} />
                                                <OddBtn label="X" val={odds[ev.id].h2h.draw} active={selections.find(s => s.event_id === ev.id && s.selection === 'ML: Draw')} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, selection: 'ML: Draw', odds: odds[ev.id].h2h.draw})} />
                                                <OddBtn label="2" val={odds[ev.id].h2h.away} active={selections.find(s => s.event_id === ev.id && s.selection === 'ML: '+ev.away_team)} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, selection: 'ML: '+ev.away_team, odds: odds[ev.id].h2h.away})} />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            {odds[ev.id]?.spreads && (
                                                <div className="space-y-2">
                                                    <OddBtn label={'H '+ (odds[ev.id].spreads.home_point > 0 ? '+' : '') + odds[ev.id].spreads.home_point} val={odds[ev.id].spreads.home_price} sub={ev.home_team} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, selection: ev.home_team + ' ' + odds[ev.id].spreads.home_point, odds: odds[ev.id].spreads.home_price})} />
                                                    <OddBtn label={'H '+ (odds[ev.id].spreads.away_point > 0 ? '+' : '') + odds[ev.id].spreads.away_point} val={odds[ev.id].spreads.away_price} sub={ev.away_team} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, selection: ev.away_team + ' ' + odds[ev.id].spreads.away_point, odds: odds[ev.id].spreads.away_price})} />
                                                </div>
                                            )}
                                            {odds[ev.id]?.totals && (
                                                <div className="space-y-2">
                                                    <OddBtn label={'O ' + odds[ev.id].totals.point} val={odds[ev.id].totals.over_price} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, selection: 'Over ' + odds[ev.id].totals.point, odds: odds[ev.id].totals.over_price})} />
                                                    <OddBtn label={'U ' + odds[ev.id].totals.point} val={odds[ev.id].totals.under_price} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, selection: 'Under ' + odds[ev.id].totals.point, odds: odds[ev.id].totals.under_price})} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {events.length === 0 && <div className="col-span-full py-32 text-center text-gray-700 font-black italic tracking-widest border border-dashed border-white/5 rounded-[3rem]">No hay eventos activos en esta liga.</div>}
                        </div>
                    )}
                </div>
            )}

            {/* Other tabs skeleton (History, Caja) */}
            {activeTab === 'tickets' && <div className="animate-in slide-in-from-right duration-300">
                <h2 className="text-2xl font-black mb-6 italic tracking-tighter">ÚLTIMAS JUGADAS</h2>
                <div className="space-y-4">
                    {history.map(bet => (
                        <div key={bet.id} className="bg-[#111] p-6 rounded-[2.5rem] border border-white/5 flex flex-col gap-4 shadow-xl">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-gray-600">ID: {bet.ticket_id}</span>
                                <button onClick={() => handleReprint(bet.ticket_id)} className="p-2 bg-blue-600/10 text-blue-500 rounded-full hover:bg-blue-600 hover:text-white transition-all"><Printer size={14}/></button>
                            </div>
                            <div className="space-y-2">
                                {bet.selections.map((s, i) => <div key={i} className="text-xs border-l border-blue-600 pl-3 py-0.5"><div className="font-bold">{s.event_name}</div><div className="text-blue-500 font-black uppercase text-[10px]">{s.selection} @ {s.odds}</div></div>)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>}

            {activeTab === 'caja' && <div className="p-10 text-center opacity-30">Módulo Caja Activado.</div>}
        </main>

        {/* Category Drawer/Menu */}
        {showCategoryMenu && (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[100] p-8 animate-in fade-in duration-300 overflow-y-auto">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-3xl font-black tracking-tighter uppercase italic">DEPORTES</h2>
                    <button onClick={() => setShowCategoryMenu(false)} className="p-4 bg-white/5 rounded-full"><X size={24}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.keys(sportsStructure).map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setSelectedCategory(cat); setSelectedSportKey(sportsStructure[cat][0][0]); setShowCategoryMenu(false); }}
                            className={`p-6 rounded-[2rem] border text-left flex justify-between items-center transition-all ${
                                selectedCategory === cat ? 'bg-blue-600 border-blue-600 text-white shadow-glow' : 'bg-white/5 border-white/5 text-gray-400'
                            }`}
                        >
                            <span className="text-lg font-black">{cat}</span>
                            <ChevronRight size={20} className="opacity-30" />
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Floating Slip Button */}
        {selections.length > 0 && activeTab === 'events' && (
            <button
                onClick={() => setShowSlipModal(true)}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-5 rounded-full font-black shadow-glow flex items-center gap-4 animate-in slide-in-from-bottom duration-500 active:scale-90 z-40"
            >
                <div className="bg-white text-blue-600 w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg">{selections.length}</div>
                REVISAR JUGADA
                <div className="bg-black/20 px-3 py-1 rounded-full text-xs font-mono">x{totalOdds}</div>
            </button>
        )}

        {/* Confirmation Flow (Simplified for space) */}
        {showSlipModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-end animate-in fade-in duration-300">
                <div className="w-full max-w-xl mx-auto bg-[#121212] rounded-t-[3.5rem] p-10 border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-500">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black italic tracking-tighter">CUPÓN DE APUESTAS</h2>
                        <button onClick={() => setShowSlipModal(false)} className="p-3 bg-white/5 rounded-full"><X size={20}/></button>
                    </div>
                    <div className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-3 mb-8">
                        {selections.map(s => (
                            <div key={s.event_id} className="bg-white/5 p-5 rounded-3xl border border-white/5 flex justify-between items-center group">
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="text-[8px] font-black text-gray-600 mb-1 uppercase">{s.event_name}</div>
                                    <div className="text-base font-black text-white italic truncate uppercase">{s.selection}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-xl font-black font-mono text-blue-500 italic">x{s.odds}</div>
                                    <button onClick={() => setSelections(prev => prev.filter(x => x.event_id !== s.event_id))} className="text-gray-700 hover:text-red-500"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-blue-600/10 p-6 rounded-3xl border border-blue-600/20 mb-8 flex justify-between items-center">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">CUOTA TOTAL ACUMULADA</span>
                        <span className="text-4xl font-black italic font-mono text-blue-500 tracking-tighter leading-none">x{totalOdds}</span>
                    </div>
                    <div className="space-y-4">
                        <input type="number" value={stake} onChange={e => setStake(e.target.value)} placeholder="MONTO DE APUESTA ($)" className="w-full bg-white/5 border border-white/10 rounded-3xl p-5 text-2xl font-black font-mono text-center text-white focus:border-blue-600 outline-none transition-all" />
                        <button onClick={placeBet} className="w-full py-6 bg-blue-600 rounded-3xl font-black text-2xl shadow-glow active:scale-95 transition-all uppercase italic">Confirmar Apuesta</button>
                    </div>
                </div>
            </div>
        )}

        {/* Navbar */}
        <nav className="fixed bottom-6 left-6 right-6 flex justify-center z-50 pointer-events-none">
            <div className="bg-[#1a1a1a]/90 backdrop-blur-2xl border border-white/5 rounded-3xl p-2 flex gap-1 shadow-black/50 shadow-2xl pointer-events-auto">
                <NavBtn icon={<LayoutGrid />} active={activeTab === 'events'} label="JUGAR" onClick={() => setActiveTab('events')} />
                <NavBtn icon={<TicketIcon />} active={activeTab === 'tickets'} label="HISTORIAL" onClick={() => setActiveTab('tickets')} />
                <NavBtn icon={<Wallet />} active={activeTab === 'caja'} label="CAJA" onClick={() => setActiveTab('caja')} />
            </div>
        </nav>
      </div>
    </div>
  );
}

function OddBtn({ label, val, sub, active, onClick }) {
    if (!val) return <div className="bg-white/[0.01] border border-white/[0.02] rounded-2xl h-11 flex items-center justify-center opacity-5"><span className="text-[10px] font-black">-</span></div>;
    return (
        <button onClick={onClick} className={`w-full border rounded-2xl p-3 flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all relative overflow-hidden ${
            active ? 'bg-blue-600 border-blue-600 shadow-glow' : 'bg-white/5 border-white/5 hover:border-blue-600/30'
        }`}>
            {sub && <div className={`text-[6px] font-black absolute top-1 left-2 tracking-tighter truncate w-[85%] text-left uppercase ${active ? 'text-white/40' : 'text-gray-700'}`}>{sub}</div>}
            <div className={`text-[8px] font-black tracking-widest uppercase ${active ? 'text-white/60' : 'text-gray-500'}`}>{label}</div>
            <div className={`text-base font-black font-mono tracking-tighter italic ${active ? 'text-white scale-110' : 'text-white/90'}`}>{val}</div>
        </button>
    );
}

function NavBtn({ icon, active, label, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center px-6 py-2.5 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-glow scale-105' : 'text-gray-500 hover:bg-white/5'}`}>
        <div className="mb-0.5">{React.cloneElement(icon, { size: 18, strokeWidth: active ? 3 : 2 })}</div>
        <span className="text-[7px] font-black tracking-widest">{label}</span>
    </button>
  );
}

export default App;
