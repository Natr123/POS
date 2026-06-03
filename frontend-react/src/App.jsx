import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  LayoutGrid, Ticket as TicketIcon, Wallet, RefreshCw, ChevronRight,
  X, Check, Printer, Search, ArrowUpRight, ArrowDownLeft, AlertCircle, FileText, Trash2
} from 'lucide-react';

const API_URL = `http://${window.location.hostname}:8000`;

function App() {
  const [activeTab, setActiveTab] = useState('events');
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState(null);
  const [events, setEvents] = useState([]);
  const [odds, setOdds] = useState({});
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Selection Slip State
  const [selections, setSelections] = useState([]);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [stake, setStake] = useState('');

  useEffect(() => {
    fetchSports();
    fetchBalance();
  }, []);

  useEffect(() => {
    if (selectedSport) fetchEvents(selectedSport);
  }, [selectedSport]);

  useEffect(() => {
    if (activeTab === 'tickets') fetchHistory();
    if (activeTab === 'caja') {
        fetchBalance();
        fetchTransactions();
    }
  }, [activeTab]);

  const fetchSports = async () => {
    try {
      const res = await axios.get(`${API_URL}/sports`);
      setSports(res.data);
      if (res.data.length > 0 && !selectedSport) setSelectedSport(res.data[0].key);
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
    // Check if event already in slip
    if (selections.find(s => s.event_id === selection.event_id)) {
        // Replace or ignore? Usually in betting apps you replace with new market from same game
        setSelections(prev => prev.filter(s => s.event_id !== selection.event_id).concat(selection));
    } else {
        setSelections(prev => [...prev, selection]);
    }
  };

  const removeFromSlip = (id) => {
    setSelections(prev => prev.filter(s => s.event_id !== id));
  };

  const placeBet = async () => {
    if (!stake || parseFloat(stake) <= 0) return;
    try {
      const res = await axios.post(`${API_URL}/bets`, {
        selections: selections,
        total_odds: parseFloat(totalOdds),
        stake: parseFloat(stake)
      });
      setSelections([]);
      setStake('');
      setShowConfirmModal(false);
      setShowSlipModal(false);
      fetchBalance();
      window.open(`${API_URL}/bets/${res.data.ticket_id}/pdf`, '_blank');
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al apostar');
    }
  };

  const handleSettle = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/settle`);
      fetchBalance();
      fetchTransactions();
      alert('Liquidación completada');
    } catch (e) { alert('Error en liquidación'); }
    setLoading(false);
  };

  const handleReprint = (ticket_id) => {
      window.open(`${API_URL}/bets/${ticket_id}/pdf`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#070707] text-gray-100 font-sans pb-28 selection:bg-blue-600/30 antialiased overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4">
        <header className="py-4 md:py-6 flex justify-between items-center sticky top-0 bg-[#070707]/90 backdrop-blur-xl z-50">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <LayoutGrid className="text-white" size={22} />
                </div>
                <div>
                    <h1 className="text-xl font-black tracking-tighter uppercase leading-none italic">SPORT<span className="text-blue-500">POS</span></h1>
                    <div className="text-[8px] font-bold text-gray-600 tracking-[0.3em] mt-0.5">ULTIMATE EDITION</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => axios.post(`${API_URL}/refresh`).then(() => fetchEvents(selectedSport))}
                    className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5 active:scale-90"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin text-blue-500' : 'text-gray-400'} />
                </button>
                <div className="bg-green-500/10 border border-green-500/20 px-5 py-2.5 rounded-2xl">
                    <span className="text-green-500 font-mono font-black text-lg tracking-tighter italic">
                        ${balance.toLocaleString(undefined, {minimumFractionDigits:2})}
                    </span>
                </div>
            </div>
        </header>

        <main>
            {activeTab === 'events' && (
                <div className="space-y-6">
                    <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                        {sports.map(s => (
                            <button
                                key={s.key}
                                onClick={() => setSelectedSport(s.key)}
                                className={`px-6 py-3 rounded-2xl text-xs font-black transition-all border whitespace-nowrap shadow-sm ${
                                    selectedSport === s.key
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-blue-600/30 scale-105'
                                    : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10'
                                }`}
                            >
                                {s.title}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-30">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 border-4 border-blue-600/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <span className="font-black text-xs tracking-widest uppercase">Escaneando Cuotas en Vivo</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {events.map(ev => (
                                <div key={ev.id} className="bg-[#121212] rounded-[2.5rem] p-6 border border-white/5 shadow-2xl relative overflow-hidden group hover:border-blue-600/20 transition-all duration-500">
                                    <div className="flex justify-between items-center mb-5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse shadow-glow"></span>
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{ev.sport_title}</span>
                                        </div>
                                        <span className="text-[10px] font-mono bg-blue-500/10 px-2 py-0.5 rounded-full text-blue-400 border border-blue-500/10">
                                            {new Date(ev.commence_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>

                                    <div className="flex flex-col items-center mb-8 gap-1">
                                        <div className="text-center font-black text-base uppercase tracking-tight text-white/90">{ev.home_team}</div>
                                        <div className="text-blue-600 font-black text-[10px] italic">VS</div>
                                        <div className="text-center font-black text-base uppercase tracking-tight text-white/90">{ev.away_team}</div>
                                    </div>

                                    <div className="space-y-4">
                                        {odds[ev.id]?.h2h && (
                                            <div className="grid grid-cols-3 gap-2">
                                                <OddBtn label="1" val={odds[ev.id].h2h.home} active={selections.find(s => s.event_id === ev.id && s.selection === 'ML: '+ev.home_team)} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, market: 'ML', selection: 'ML: '+ev.home_team, odds: odds[ev.id].h2h.home})} />
                                                <OddBtn label="X" val={odds[ev.id].h2h.draw} active={selections.find(s => s.event_id === ev.id && s.selection === 'ML: Draw')} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, market: 'ML', selection: 'ML: Draw', odds: odds[ev.id].h2h.draw})} />
                                                <OddBtn label="2" val={odds[ev.id].h2h.away} active={selections.find(s => s.event_id === ev.id && s.selection === 'ML: '+ev.away_team)} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, market: 'ML', selection: 'ML: '+ev.away_team, odds: odds[ev.id].h2h.away})} />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            {odds[ev.id]?.spreads && (
                                                <div className="space-y-2">
                                                    <OddBtn label={'H '+ (odds[ev.id].spreads.home_point > 0 ? '+' : '') + odds[ev.id].spreads.home_point} val={odds[ev.id].spreads.home_price} sub={ev.home_team} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, market: 'SPR', selection: ev.home_team + ' ' + odds[ev.id].spreads.home_point, odds: odds[ev.id].spreads.home_price})} />
                                                    <OddBtn label={'H '+ (odds[ev.id].spreads.away_point > 0 ? '+' : '') + odds[ev.id].spreads.away_point} val={odds[ev.id].spreads.away_price} sub={ev.away_team} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, market: 'SPR', selection: ev.away_team + ' ' + odds[ev.id].spreads.away_point, odds: odds[ev.id].spreads.away_price})} />
                                                </div>
                                            )}
                                            {odds[ev.id]?.totals && (
                                                <div className="space-y-2">
                                                    <OddBtn label={'O ' + odds[ev.id].totals.point} val={odds[ev.id].totals.over_price} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, market: 'TOT', selection: 'Over ' + odds[ev.id].totals.point, odds: odds[ev.id].totals.over_price})} />
                                                    <OddBtn label={'U ' + odds[ev.id].totals.point} val={odds[ev.id].totals.under_price} onClick={() => addToSlip({event_id: ev.id, event_name: `${ev.home_team} vs ${ev.away_team}`, market: 'TOT', selection: 'Under ' + odds[ev.id].totals.point, odds: odds[ev.id].totals.under_price})} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'tickets' && (
                <div className="animate-in slide-in-from-right duration-500 max-w-lg mx-auto">
                    <h2 className="text-2xl font-black mb-8 italic tracking-tighter">ULTIMAS JUGADAS</h2>
                    <div className="space-y-4">
                        {history.map(bet => (
                            <div key={bet.id} className="bg-[#121212] p-6 rounded-[2.5rem] border border-white/5 flex flex-col gap-4 shadow-xl group">
                                <div className="flex justify-between items-start">
                                    <div className="text-[10px] font-black text-gray-600 tracking-widest flex items-center gap-3 uppercase">
                                        #{bet.ticket_id}
                                        <button onClick={() => handleReprint(bet.ticket_id)} className="p-2 bg-blue-600/10 text-blue-500 rounded-full hover:bg-blue-600 hover:text-white transition-all">
                                            <Printer size={12}/>
                                        </button>
                                    </div>
                                    <div className={`text-[8px] font-black px-3 py-1 rounded-full ${
                                        bet.status === 'won' ? 'bg-green-500/10 text-green-500' :
                                        bet.status === 'lost' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-gray-500'
                                    }`}>
                                        {bet.status.toUpperCase()}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {bet.selections.map((s, idx) => (
                                        <div key={idx} className="border-l-2 border-blue-600/20 pl-3">
                                            <div className="text-xs font-bold">{s.event_name}</div>
                                            <div className="text-[10px] font-black text-blue-500 uppercase">{s.selection} <span className="text-gray-600 italic">@ {s.odds}</span></div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between items-end border-t border-white/5 pt-4">
                                    <div>
                                        <div className="text-[8px] text-gray-600 font-bold uppercase">Cuota Total</div>
                                        <div className="text-lg font-black italic">x{bet.total_odds.toFixed(2)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[8px] text-gray-600 font-bold uppercase">Apuesta: ${bet.stake}</div>
                                        <div className="text-xl font-black text-blue-500 tracking-tighter">${bet.potential_payout}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'caja' && (
                <div className="animate-in slide-in-from-right duration-500 max-w-lg mx-auto">
                    <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-[3rem] p-10 mb-10 shadow-2xl shadow-blue-600/30 relative overflow-hidden group border border-white/10">
                        <div className="absolute -right-10 -top-10 w-56 h-56 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-all duration-1000"></div>
                        <div className="relative z-10">
                            <span className="text-white/40 text-[10px] font-black tracking-[0.4em] mb-3 block uppercase text-center">Saldo Disponible</span>
                            <div className="text-5xl md:text-6xl font-black mb-10 tracking-tighter font-mono italic text-white text-center shadow-lg uppercase leading-none">
                                ${balance.toLocaleString(undefined, {minimumFractionDigits:2})}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={handleSettle} className="bg-white text-blue-800 py-4 rounded-3xl font-black text-xs active:scale-90 transition-all shadow-xl uppercase tracking-widest hover:bg-blue-50">Settle</button>
                                <button onClick={() => {
                                    const a = prompt('Monto del depósito:');
                                    if(a) axios.post(`${API_URL}/deposit?amount=${a}`).then(fetchBalance);
                                }} className="bg-black/20 text-white py-4 rounded-3xl font-black text-xs border border-white/10 backdrop-blur-md active:scale-90 transition-all uppercase tracking-widest hover:bg-black/30">Carga</button>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-[10px] font-black mb-6 flex items-center gap-4 text-gray-600 uppercase tracking-[0.2em]">
                        Flujo de Caja
                        <div className="h-px bg-white/5 flex-1"></div>
                    </h3>
                    <div className="bg-[#111] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                        {transactions.map(tx => (
                            <div key={tx.id} className="p-5 border-b border-white/5 flex items-center justify-between last:border-0 hover:bg-white/[0.01] transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {tx.amount > 0 ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-black text-gray-200 leading-tight truncate max-w-[180px]">{tx.description}</div>
                                        <div className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter mt-0.5">{new Date(tx.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className={`font-mono font-black text-lg italic ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>

        {/* Floating Slip Button */}
        {selections.length > 0 && activeTab === 'events' && (
            <button
                onClick={() => setShowSlipModal(true)}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-4 rounded-full font-black shadow-2xl shadow-blue-600/50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-500 z-40 active:scale-95"
            >
                <div className="bg-white text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">{selections.length}</div>
                REVISAR JUGADA
                <div className="text-blue-200 font-mono italic text-sm">x{totalOdds}</div>
            </button>
        )}

        {/* Selection Slip Modal */}
        {showSlipModal && (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[60] flex items-end animate-in fade-in duration-300">
                <div className="w-full max-w-xl mx-auto bg-[#121212] rounded-t-[3.5rem] p-10 border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-500">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                            <h2 className="text-3xl font-black tracking-tighter uppercase italic">Tu Cupón</h2>
                        </div>
                        <button onClick={() => setShowSlipModal(false)} className="p-4 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X size={24}/></button>
                    </div>

                    <div className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-3 mb-10">
                        {selections.map(s => (
                            <div key={s.event_id} className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex justify-between items-center">
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="text-gray-500 text-[9px] font-black mb-1 uppercase tracking-widest">{s.event_name}</div>
                                    <div className="text-lg font-black text-white uppercase italic truncate">{s.selection}</div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-2xl font-black italic tracking-tighter font-mono text-blue-500">x{s.odds}</div>
                                    <button onClick={() => removeFromSlip(s.event_id)} className="text-gray-700 hover:text-red-500 transition-colors p-2"><Trash2 size={20}/></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-end mb-10 px-6">
                        <div className="text-gray-500 font-black text-xs uppercase tracking-widest">Cuota Acumulada</div>
                        <div className="text-5xl font-black italic tracking-tighter font-mono text-blue-500 leading-none">x{totalOdds}</div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setSelections([])} className="flex-1 py-6 bg-white/5 rounded-3xl font-black text-gray-500 uppercase tracking-widest border border-white/5">Limpiar</button>
                        <button onClick={() => setShowConfirmModal(true)} className="flex-[2] py-6 bg-blue-600 rounded-3xl font-black text-xl tracking-tight shadow-2xl shadow-blue-600/40 uppercase italic active:scale-95 transition-all">Siguiente</button>
                    </div>
                </div>
            </div>
        )}

        {/* Double Confirmation Modal */}
        {showConfirmModal && (
            <div className="fixed inset-0 bg-blue-600/20 backdrop-blur-md z-[70] flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="w-full max-w-sm bg-[#121212] rounded-[3rem] p-10 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-500">
                    <div className="text-center mb-10">
                        <div className="bg-blue-600/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <TicketIcon className="text-blue-500" size={40}/>
                        </div>
                        <h3 className="text-2xl font-black tracking-tighter italic uppercase">Confirmar Apuesta</h3>
                        <p className="text-gray-500 text-xs mt-2 uppercase tracking-widest">¿Deseas emitir este ticket?</p>
                    </div>

                    <div className="space-y-3 mb-10 border-y border-white/5 py-8">
                         <div className="flex justify-between text-xs font-black uppercase text-gray-500">
                            <span>Partidos:</span>
                            <span className="text-white">{selections.length}</span>
                         </div>
                         <div className="flex justify-between text-xs font-black uppercase text-gray-500">
                            <span>Cuota:</span>
                            <span className="text-blue-500">x{totalOdds}</span>
                         </div>
                         <div className="mt-8">
                            <label className="text-[9px] font-black text-gray-600 block mb-2 tracking-[0.2em]">INGRESE MONTO ($)</label>
                            <input
                                autoFocus
                                type="number"
                                value={stake}
                                onChange={(e) => setStake(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-3xl font-black font-mono text-center text-blue-500 focus:border-blue-600 transition-all outline-none"
                                placeholder="0.00"
                            />
                         </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black text-gray-600">Volver</button>
                        <button onClick={placeBet} className="flex-[2] py-5 bg-blue-600 rounded-2xl font-black text-lg active:scale-95 transition-all shadow-xl shadow-blue-600/30 uppercase italic">Confirmar</button>
                    </div>
                </div>
            </div>
        )}

        {/* Navigation Bar */}
        <nav className="fixed bottom-6 left-6 right-6 flex justify-center z-40 pointer-events-none">
            <div className="bg-[#1a1a1a]/90 backdrop-blur-2xl border border-white/5 rounded-[2rem] px-3 py-2 flex gap-1 shadow-2xl shadow-black pointer-events-auto">
                <NavBtn icon={<LayoutGrid />} active={activeTab === 'events'} label="JUGAR" onClick={() => setActiveTab('events')} />
                <NavBtn icon={<TicketIcon />} active={activeTab === 'tickets'} label="TICKETS" onClick={() => setActiveTab('tickets')} />
                <NavBtn icon={<Wallet />} active={activeTab === 'caja'} label="MI CAJA" onClick={() => setActiveTab('caja')} />
            </div>
        </nav>
      </div>
    </div>
  );
}

function OddBtn({ label, val, sub, active, onClick }) {
    if (!val) return <div className="bg-white/[0.01] border border-white/[0.02] rounded-2xl h-12 flex items-center justify-center opacity-5"><span className="text-[10px] font-black">-</span></div>;
    return (
        <button onClick={onClick} className={`w-full border rounded-2xl p-3 flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all group overflow-hidden relative ${
            active ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/30' : 'bg-white/5 border-white/5 hover:border-blue-600/30'
        }`}>
            {sub && <div className={`text-[6px] font-black absolute top-1 left-2 tracking-tighter truncate w-[85%] text-left uppercase ${active ? 'text-white/40' : 'text-gray-700'}`}>{sub}</div>}
            <div className={`text-[8px] font-black tracking-widest uppercase ${active ? 'text-white/60' : 'text-gray-500'}`}>{label}</div>
            <div className={`text-base font-black font-mono tracking-tighter italic ${active ? 'text-white scale-110' : 'text-white/90'}`}>{val}</div>
        </button>
    );
}

function NavBtn({ icon, active, label, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center px-6 py-2.5 rounded-[1.5rem] transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 scale-105' : 'text-gray-500 hover:bg-white/5'}`}>
        <div className="mb-0.5">{React.cloneElement(icon, { size: 18, strokeWidth: active ? 3 : 2 })}</div>
        <span className="text-[7px] font-black tracking-widest">{label}</span>
    </button>
  );
}

export default App;
