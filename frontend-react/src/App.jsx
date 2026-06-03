import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LayoutGrid, Ticket, Wallet, RefreshCw, ChevronRight,
  X, Check, Printer, Search, ArrowUpRight, ArrowDownLeft, AlertCircle, FileText
} from 'lucide-react';

// Dynamic API URL
const API_URL = `http://${window.location.hostname}:8000`;

function App() {
  const [activeTab, setActiveTab] = useState('events');
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState(null);
  const [events, setEvents] = useState([]);
  const [odds, setOdds] = useState({});
  const [betSlip, setBetSlip] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(null); // ticket_id
  const [customStake, setCustomStake] = useState('');

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

  const placeBet = async (stakeValue) => {
    const finalStake = parseFloat(stakeValue || customStake);
    if (!finalStake || finalStake <= 0) return;
    try {
      const res = await axios.post(`${API_URL}/bets`, {
        event_id: betSlip.id,
        event_name: betSlip.name,
        selection: betSlip.market + ': ' + betSlip.sel,
        odds: betSlip.price,
        stake: finalStake
      });
      setBetSlip(null);
      setCustomStake('');
      fetchBalance();
      // Open PDF in new tab
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
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans pb-24 selection:bg-blue-500/30 antialiased overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4">
        <header className="py-4 md:py-6 flex justify-between items-center sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-lg z-50">
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                    <LayoutGrid className="text-white" size={20} />
                </div>
                <span className="text-xl font-black tracking-tighter uppercase italic">SPORT<span className="text-blue-600">POS</span></span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => axios.post(`${API_URL}/refresh`).then(() => fetchEvents(selectedSport))}
                    className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/5 active:scale-95"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin text-blue-500' : 'text-gray-400'} />
                </button>
                <div className="bg-green-500/10 border border-green-500/20 px-5 py-2 rounded-xl">
                    <span className="text-green-500 font-mono font-black text-lg tracking-tighter italic">
                        ${balance.toLocaleString(undefined, {minimumFractionDigits:2})}
                    </span>
                </div>
            </div>
        </header>

        <main>
            {activeTab === 'events' && (
                <div className="space-y-6">
                    <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
                        {sports.map(s => (
                            <button
                                key={s.key}
                                onClick={() => setSelectedSport(s.key)}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all border whitespace-nowrap ${
                                    selectedSport === s.key
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-600/30 scale-105'
                                    : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10'
                                }`}
                            >
                                {s.title}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-30">
                            <RefreshCw size={40} className="animate-spin text-blue-600" />
                            <span className="font-black text-[10px] tracking-widest uppercase">Actualizando Datos...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {events.map(ev => (
                                <div key={ev.id} className="bg-[#141414] rounded-3xl p-5 border border-white/5 shadow-2xl relative overflow-hidden group">
                                    <div className="flex justify-between items-center mb-4 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.1em]">{ev.sport_title}</span>
                                        </div>
                                        <span className="text-[9px] font-mono bg-white/5 px-2 py-0.5 rounded-full text-blue-400 border border-white/5">
                                            {new Date(ev.commence_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>

                                    <h3 className="text-center font-black text-sm mb-6 tracking-tight px-4 leading-tight relative z-10 uppercase italic">
                                        {ev.home_team} <span className="text-blue-600/30 mx-0.5">vs</span> {ev.away_team}
                                    </h3>

                                    <div className="space-y-4 relative z-10">
                                        {odds[ev.id]?.h2h && (
                                            <div className="grid grid-cols-3 gap-1.5">
                                                <MarketBtn label="1" val={odds[ev.id].h2h.home} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'ML', sel: ev.home_team, price: odds[ev.id].h2h.home})} />
                                                <MarketBtn label="X" val={odds[ev.id].h2h.draw} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'ML', sel: 'Draw', price: odds[ev.id].h2h.draw})} />
                                                <MarketBtn label="2" val={odds[ev.id].h2h.away} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'ML', sel: ev.away_team, price: odds[ev.id].h2h.away})} />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {odds[ev.id]?.spreads && (
                                                <div className="space-y-1.5">
                                                    <MarketBtn label={odds[ev.id].spreads.home_point > 0 ? '+' + odds[ev.id].spreads.home_point : odds[ev.id].spreads.home_point} val={odds[ev.id].spreads.home_price} sub={ev.home_team} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'SPR', sel: ev.home_team + ' ' + odds[ev.id].spreads.home_point, price: odds[ev.id].spreads.home_price})} />
                                                    <MarketBtn label={odds[ev.id].spreads.away_point > 0 ? '+' + odds[ev.id].spreads.away_point : odds[ev.id].spreads.away_point} val={odds[ev.id].spreads.away_price} sub={ev.away_team} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'SPR', sel: ev.away_team + ' ' + odds[ev.id].spreads.away_point, price: odds[ev.id].spreads.away_price})} />
                                                </div>
                                            )}
                                            {odds[ev.id]?.totals && (
                                                <div className="space-y-1.5">
                                                    <MarketBtn label={'O ' + odds[ev.id].totals.point} val={odds[ev.id].totals.over_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'TOT', sel: 'Over ' + odds[ev.id].totals.point, price: odds[ev.id].totals.over_price})} />
                                                    <MarketBtn label={'U ' + odds[ev.id].totals.point} val={odds[ev.id].totals.under_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'TOT', sel: 'Under ' + odds[ev.id].totals.point, price: odds[ev.id].totals.under_price})} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute -right-4 -bottom-4 bg-white/[0.01] rounded-full w-24 h-24 group-hover:scale-150 transition-all duration-700"></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'tickets' && (
                <div className="animate-in slide-in-from-right duration-500 max-w-lg mx-auto">
                    <h2 className="text-2xl font-black mb-8 italic tracking-tighter">HISTORIAL DE TICKETS</h2>
                    <div className="space-y-3">
                        {history.map(bet => (
                            <div key={bet.id} className="bg-[#141414] p-5 rounded-[2rem] border border-white/5 flex justify-between items-center shadow-xl group">
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="text-[9px] font-black text-gray-600 mb-1 tracking-tighter flex items-center gap-2 uppercase">
                                        ID: {bet.ticket_id}
                                        <button onClick={() => handleReprint(bet.ticket_id)} className="p-1 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100">
                                            <Printer size={12}/>
                                        </button>
                                    </div>
                                    <div className="font-bold text-sm truncate leading-tight mb-0.5">{bet.event_name}</div>
                                    <div className="text-[10px] font-black text-blue-500 uppercase tracking-wide">{bet.selection} <span className="text-gray-600 italic">@ {bet.odds}</span></div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-[8px] font-black px-2.5 py-0.5 rounded-full inline-block mb-1.5 ${
                                        bet.status === 'won' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                        bet.status === 'lost' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white/5 text-gray-500 border border-white/5'
                                    }`}>
                                        {bet.status.toUpperCase()}
                                    </div>
                                    <div className="font-mono font-black text-base tracking-tighter leading-none">${bet.stake}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'caja' && (
                <div className="animate-in slide-in-from-right duration-500 max-w-lg mx-auto">
                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2.5rem] p-8 md:p-10 mb-8 shadow-2xl shadow-blue-600/30 relative overflow-hidden group border border-white/10">
                        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                        <div className="relative z-10 text-center">
                            <span className="text-white/50 text-[10px] font-black tracking-[0.2em] mb-2 block uppercase">Balance Disponible</span>
                            <div className="text-4xl md:text-5xl font-black mb-8 tracking-tighter font-mono italic text-white shadow-sm">${balance.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handleSettle} className="bg-white text-blue-700 py-3.5 rounded-2xl font-black text-xs active:scale-95 transition-all shadow-xl uppercase tracking-widest">Liquidar</button>
                                <button onClick={() => {
                                    const a = prompt('Monto del depósito:');
                                    if(a) axios.post(`${API_URL}/deposit?amount=${a}`).then(fetchBalance);
                                }} className="bg-black/20 text-white py-3.5 rounded-2xl font-black text-xs border border-white/10 backdrop-blur-md active:scale-95 transition-all uppercase tracking-widest">Carga</button>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-xs font-black mb-5 flex items-center gap-3 text-gray-500 uppercase tracking-widest">
                        Transacciones Recientes
                        <div className="h-px bg-white/5 flex-1"></div>
                    </h3>
                    <div className="bg-[#111] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
                        {transactions.map(tx => (
                            <div key={tx.id} className="p-4 border-b border-white/5 flex items-center justify-between last:border-0 hover:bg-white/[0.01] transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {tx.amount > 0 ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-black text-gray-200 leading-tight truncate max-w-[180px]">{tx.description}</div>
                                        <div className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">{new Date(tx.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className={`font-mono font-black text-sm italic ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>

        {/* Bet Slip Modal */}
        {betSlip && (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[60] flex items-end animate-in fade-in duration-300">
                <div className="w-full max-w-xl mx-auto bg-[#141414] rounded-t-[3rem] p-8 md:p-10 border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-500">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full shadow-lg shadow-blue-600/50"></div>
                            <h2 className="text-2xl font-black tracking-tighter uppercase italic">Nueva Apuesta</h2>
                        </div>
                        <button onClick={() => setBetSlip(null)} className="p-2.5 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X size={20}/></button>
                    </div>

                    <div className="bg-white/5 rounded-3xl p-6 mb-6 border border-white/5 relative overflow-hidden">
                        <div className="text-gray-500 text-[9px] font-black mb-1.5 uppercase tracking-[0.2em]">{betSlip.name}</div>
                        <div className="text-blue-500 text-[10px] font-black tracking-[0.3em] mb-2">{betSlip.market}</div>
                        <div className="flex justify-between items-end gap-4">
                            <div className="text-xl font-black text-white uppercase leading-tight max-w-[65%] italic">{betSlip.sel}</div>
                            <div className="text-3xl font-black italic tracking-tighter font-mono text-blue-500">x{betSlip.price}</div>
                        </div>
                    </div>

                    {/* Manual Stake Input */}
                    <div className="mb-6">
                        <div className="flex items-center bg-white/5 rounded-2xl p-4 border border-white/10 focus-within:border-blue-600/50 transition-all">
                            <span className="text-gray-500 font-bold mr-3">$</span>
                            <input
                                type="number"
                                value={customStake}
                                onChange={(e) => setCustomStake(e.target.value)}
                                placeholder="Monto manual..."
                                className="bg-transparent border-none outline-none w-full font-black text-xl text-white placeholder:text-gray-700"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-8">
                        {[10, 20, 50, 100].map(v => (
                            <button key={v} onClick={() => placeBet(v)} className="py-4 bg-white/5 rounded-2xl font-black text-sm border border-white/5 hover:bg-blue-600 active:bg-blue-600 active:text-white transition-all shadow-lg">
                                ${v}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => placeBet()}
                        className="w-full py-5 bg-blue-600 rounded-3xl font-black text-xl tracking-tight shadow-2xl shadow-blue-600/40 active:scale-95 transition-all uppercase italic"
                    >
                        Emitir Ticket
                    </button>
                </div>
            </div>
        )}

        {/* Navigation Bar */}
        <nav className="fixed bottom-4 left-4 right-4 flex justify-center z-50 pointer-events-none">
            <div className="bg-[#1a1a1a]/90 backdrop-blur-3xl border border-white/5 rounded-2xl px-2 py-1.5 flex gap-1 shadow-2xl shadow-black pointer-events-auto">
                <NavBtn icon={<LayoutGrid />} active={activeTab === 'events'} label="EVENTOS" onClick={() => setActiveTab('events')} />
                <NavBtn icon={<Ticket />} active={activeTab === 'tickets'} label="HISTORIAL" onClick={() => setActiveTab('tickets')} />
                <NavBtn icon={<Wallet />} active={activeTab === 'caja'} label="CAJA" onClick={() => setActiveTab('caja')} />
            </div>
        </nav>
      </div>
    </div>
  );
}

function MarketBtn({ label, val, sub, onClick }) {
    if (!val) return <div className="bg-white/[0.01] border border-white/[0.02] rounded-xl h-11 flex items-center justify-center opacity-10"><span className="text-[10px] font-black">-</span></div>;
    return (
        <button onClick={onClick} className="w-full bg-white/5 border border-white/5 hover:border-blue-600/30 active:bg-blue-600/10 rounded-xl p-2.5 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all group overflow-hidden relative">
            {sub && <div className="text-[6px] font-black text-gray-700 absolute top-1 left-2 tracking-tighter truncate w-[85%] text-left group-hover:text-blue-500/40 transition-colors uppercase">{sub}</div>}
            <div className="text-[8px] font-black text-gray-500 tracking-[0.1em] group-hover:text-blue-400 transition-colors uppercase">{label}</div>
            <div className="text-base font-black font-mono tracking-tighter group-hover:scale-105 transition-transform italic text-white/90">{val}</div>
        </button>
    );
}

function NavBtn({ icon, active, label, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center px-4 py-2.5 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 scale-105' : 'text-gray-500 hover:bg-white/5'}`}>
        <div className="mb-0.5">{React.cloneElement(icon, { size: 16, strokeWidth: active ? 3 : 2 })}</div>
        <span className="text-[7px] font-black tracking-widest">{label}</span>
    </button>
  );
}

export default App;
