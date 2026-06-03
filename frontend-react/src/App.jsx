import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LayoutGrid, Ticket, Wallet, RefreshCw, ChevronRight,
  X, Check, Printer, Search, ArrowUpRight, ArrowDownLeft, AlertCircle
} from 'lucide-react';

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
  const [history, setHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [printTicketData, setPrintTicketData] = useState(null);

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

  const placeBet = async (stake) => {
    if (!stake || stake <= 0) return;
    try {
      const res = await axios.post(`${API_URL}/bets`, {
        event_id: betSlip.id,
        event_name: betSlip.name,
        selection: betSlip.market + ': ' + betSlip.sel,
        odds: betSlip.price,
        stake: parseFloat(stake)
      });
      setPrintTicketData(res.data);
      setBetSlip(null);
      fetchBalance();
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

  const handlePrint = () => {
    window.print();
    // Use a small timeout to clear the state after print dialog opens
    setTimeout(() => setPrintTicketData(null), 100);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans pb-24 selection:bg-primary/30 antialiased">
      {/* Printable Area - Hidden on Screen */}
      {printTicketData && (
        <div id="printable-ticket" className="bg-white text-black font-mono p-4 w-[80mm]">
            <div className="text-center border-b border-black pb-2 mb-2">
                <h2 className="text-lg font-bold">SPORTPOS PRO</h2>
                <div className="text-[10px]">{new Date(printTicketData.created_at).toLocaleString()}</div>
                <div className="text-[10px]">TICKET: {printTicketData.ticket_id}</div>
            </div>
            <div className="text-xs mb-4">
                <div className="font-bold mb-1 uppercase text-center">{printTicketData.event_name}</div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                    <span>SELECCIÓN:</span>
                    <span className="font-bold">{printTicketData.selection}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 py-1">
                    <span>CUOTA:</span>
                    <span className="font-bold">x{printTicketData.odds}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 py-1">
                    <span>APUESTA:</span>
                    <span className="font-bold">${printTicketData.stake.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2">
                    <span>PREMIO:</span>
                    <span>${printTicketData.potential_payout.toFixed(2)}</span>
                </div>
            </div>
            <div className="text-center text-[8px] uppercase border-t border-black pt-2">
                ¡Gracias por su apuesta!<br/>Conserve su ticket para cobrar.
            </div>
        </div>
      )}

      {/* Screen View */}
      <div className="max-w-4xl mx-auto px-4">
        <header className="py-6 flex justify-between items-center sticky top-0 bg-[#0a0a0a] z-50">
            <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <LayoutGrid className="text-white" size={24} />
                </div>
                <span className="text-2xl font-black tracking-tighter">SPORT<span className="text-blue-600">POS</span></span>
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={() => axios.post(`${API_URL}/refresh`).then(() => fetchEvents(selectedSport))}
                    className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5 active:scale-95"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin text-blue-500' : 'text-gray-400'} />
                </button>
                <div className="bg-green-500/10 border border-green-500/20 px-6 py-2 rounded-2xl">
                    <span className="text-green-500 font-mono font-black text-xl tracking-tighter italic">
                        ${balance.toLocaleString(undefined, {minimumFractionDigits:2})}
                    </span>
                </div>
            </div>
        </header>

        <main>
            {activeTab === 'events' && (
                <div className="space-y-6">
                    {/* Horizontal Sports Selector */}
                    <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                        {sports.map(s => (
                            <button
                                key={s.key}
                                onClick={() => setSelectedSport(s.key)}
                                className={`px-6 py-3 rounded-2xl text-sm font-black transition-all border whitespace-nowrap ${
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
                            <RefreshCw size={48} className="animate-spin text-blue-600" />
                            <span className="font-black text-xs tracking-widest uppercase">Consultando Cuotas</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {events.map(ev => (
                                <div key={ev.id} className="bg-[#141414] rounded-[2rem] p-6 border border-white/5 shadow-2xl">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{ev.sport_title}</span>
                                        </div>
                                        <span className="text-[10px] font-mono bg-white/5 px-3 py-1 rounded-full text-blue-400 border border-white/5">
                                            {new Date(ev.commence_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>

                                    <h3 className="text-center font-black text-lg mb-8 tracking-tight">
                                        {ev.home_team} <span className="text-blue-600/40 mx-2 italic font-serif">vs</span> {ev.away_team}
                                    </h3>

                                    <div className="space-y-6">
                                        {/* Moneyline */}
                                        {odds[ev.id]?.h2h && (
                                            <div className="grid grid-cols-3 gap-2">
                                                <MarketBtn label="LOCAL" val={odds[ev.id].h2h.home} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'ML', sel: ev.home_team, price: odds[ev.id].h2h.home})} />
                                                <MarketBtn label="X" val={odds[ev.id].h2h.draw} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'ML', sel: 'Draw', price: odds[ev.id].h2h.draw})} />
                                                <MarketBtn label="VISITA" val={odds[ev.id].h2h.away} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'ML', sel: ev.away_team, price: odds[ev.id].h2h.away})} />
                                            </div>
                                        )}
                                        {/* Spreads & Totals */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {odds[ev.id]?.spreads && (
                                                <div className="space-y-2">
                                                    <MarketBtn label={odds[ev.id].spreads.home_point > 0 ? '+' + odds[ev.id].spreads.home_point : odds[ev.id].spreads.home_point} val={odds[ev.id].spreads.home_price} sub={ev.home_team} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'SPR', sel: ev.home_team + ' ' + odds[ev.id].spreads.home_point, price: odds[ev.id].spreads.home_price})} />
                                                    <MarketBtn label={odds[ev.id].spreads.away_point > 0 ? '+' + odds[ev.id].spreads.away_point : odds[ev.id].spreads.away_point} val={odds[ev.id].spreads.away_price} sub={ev.away_team} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'SPR', sel: ev.away_team + ' ' + odds[ev.id].spreads.away_point, price: odds[ev.id].spreads.away_price})} />
                                                </div>
                                            )}
                                            {odds[ev.id]?.totals && (
                                                <div className="space-y-2">
                                                    <MarketBtn label={'O ' + odds[ev.id].totals.point} val={odds[ev.id].totals.over_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'TOT', sel: 'Over ' + odds[ev.id].totals.point, price: odds[ev.id].totals.over_price})} />
                                                    <MarketBtn label={'U ' + odds[ev.id].totals.point} val={odds[ev.id].totals.under_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'TOT', sel: 'Under ' + odds[ev.id].totals.point, price: odds[ev.id].totals.under_price})} />
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
                    <h2 className="text-3xl font-black mb-8">HISTORIAL</h2>
                    <div className="space-y-4">
                        {history.map(bet => (
                            <div key={bet.id} className="bg-[#141414] p-6 rounded-3xl border border-white/5 flex justify-between items-center shadow-xl">
                                <div>
                                    <div className="text-[10px] font-black text-gray-600 mb-1 tracking-tighter">ID: {bet.ticket_id}</div>
                                    <div className="font-bold text-base leading-tight mb-1">{bet.event_name}</div>
                                    <div className="text-xs font-black text-blue-500 uppercase tracking-wide">{bet.selection} <span className="text-gray-600">@</span> {bet.odds}</div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-[10px] font-black px-3 py-1 rounded-full inline-block mb-2 ${
                                        bet.status === 'won' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                        bet.status === 'lost' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white/5 text-gray-500 border border-white/5'
                                    }`}>
                                        {bet.status.toUpperCase()}
                                    </div>
                                    <div className="font-mono font-black text-lg tracking-tighter leading-none">${bet.stake}</div>
                                    <div className="text-[10px] font-bold text-gray-600 mt-1">PAGO: ${bet.potential_payout}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'caja' && (
                <div className="animate-in slide-in-from-right duration-500 max-w-lg mx-auto">
                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2.5rem] p-10 mb-8 shadow-2xl shadow-blue-600/30 relative overflow-hidden group">
                        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                        <div className="relative z-10">
                            <span className="text-white/60 text-xs font-black tracking-[0.2em] mb-2 block uppercase">Balance Disponible</span>
                            <div className="text-5xl font-black mb-10 tracking-tighter font-mono italic">${balance.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={handleSettle} className="bg-white text-blue-700 py-4 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl">LIQUIDAR</button>
                                <button onClick={() => {
                                    const a = prompt('Monto del depósito:');
                                    if(a) axios.post(`${API_URL}/deposit?amount=${a}`).then(fetchBalance);
                                }} className="bg-black/20 text-white py-4 rounded-2xl font-black text-sm border border-white/10 backdrop-blur-md active:scale-95 transition-all">DEPOSITAR</button>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                        ÚLTIMOS MOVIMIENTOS
                        <div className="h-px bg-white/5 flex-1"></div>
                    </h3>
                    <div className="bg-[#111] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
                        {transactions.map(tx => (
                            <div key={tx.id} className="p-5 border-b border-white/5 flex items-center justify-between last:border-0 hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {tx.amount > 0 ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-gray-200">{tx.description}</div>
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{new Date(tx.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className={`font-mono font-black text-lg italic ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
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
            <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60] flex items-end animate-in fade-in duration-300">
                <div className="w-full max-w-xl mx-auto bg-[#141414] rounded-t-[3rem] p-10 border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-500">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-8 bg-blue-600 rounded-full shadow-lg shadow-blue-600/50"></div>
                            <h2 className="text-3xl font-black tracking-tighter">TICKET</h2>
                        </div>
                        <button onClick={() => setBetSlip(null)} className="p-4 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X size={24}/></button>
                    </div>

                    <div className="bg-white/5 rounded-[2rem] p-8 mb-10 border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Ticket size={80}/></div>
                        <div className="text-gray-500 text-[10px] font-black mb-2 uppercase tracking-widest">{betSlip.name}</div>
                        <div className="text-blue-500 text-xs font-black tracking-[0.3em] mb-2">{betSlip.market}</div>
                        <div className="flex justify-between items-end gap-4">
                            <div className="text-2xl font-black text-white uppercase leading-none">{betSlip.sel}</div>
                            <div className="text-4xl font-black italic tracking-tighter font-mono text-blue-500">x{betSlip.price}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-10">
                        {[10, 20, 50, 100].map(v => (
                            <button key={v} onClick={() => placeBet(v)} className="py-5 bg-white/5 rounded-2xl font-black text-base border border-white/5 hover:bg-blue-600 hover:text-white hover:scale-105 active:scale-95 transition-all shadow-lg">
                                ${v}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => { const v = prompt('Monto:'); if(v) placeBet(v); }}
                        className="w-full py-6 bg-blue-600 rounded-3xl font-black text-2xl tracking-tight shadow-2xl shadow-blue-600/40 hover:bg-blue-500 active:scale-95 transition-all uppercase italic"
                    >
                        Confirmar Apuesta
                    </button>
                </div>
            </div>
        )}

        {/* Print Modal Overlay */}
        {printTicketData && (
            <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6 no-print">
                <div className="bg-white text-black p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm font-mono text-sm mb-10 border-4 border-blue-600 scale-105">
                     {/* Static visual representation in browser before printing */}
                     <div className="text-center border-b border-black pb-4 mb-4">
                        <h2 className="text-2xl font-black italic">SPORTPOS</h2>
                        <div className="text-xs">{new Date().toLocaleString()}</div>
                     </div>
                     <div className="space-y-3 mb-6">
                        <div className="font-black text-center text-base uppercase leading-tight">{printTicketData.event_name}</div>
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                            <span>OPCIÓN:</span>
                            <span className="font-bold uppercase">{printTicketData.selection}</span>
                        </div>
                        <div className="flex justify-between text-xl font-black pt-2 text-blue-600">
                            <span>PREMIO:</span>
                            <span>${printTicketData.potential_payout.toFixed(2)}</span>
                        </div>
                     </div>
                     <div className="text-center text-[10px] font-bold opacity-50 uppercase tracking-widest italic">Ticket: {printTicketData.ticket_id}</div>
                </div>
                <div className="flex gap-4 w-full max-w-sm">
                    <button onClick={handlePrint} className="flex-1 py-5 bg-blue-600 rounded-2xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-blue-600/30">
                        <Printer size={24}/> IMPRIMIR
                    </button>
                    <button onClick={() => setPrintTicketData(null)} className="flex-1 py-5 bg-white/10 rounded-2xl font-black text-lg active:scale-95 transition-all border border-white/10">CERRAR</button>
                </div>
            </div>
        )}

        {/* Navigation Bar */}
        <nav className="fixed bottom-6 left-6 right-6 flex justify-center z-50 pointer-events-none">
            <div className="bg-[#1a1a1a]/80 backdrop-blur-2xl border border-white/5 rounded-3xl px-3 py-2 flex gap-1 shadow-2xl shadow-black/50 pointer-events-auto">
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
    if (!val) return <div className="bg-white/[0.02] border border-white/5 rounded-2xl h-16 flex items-center justify-center opacity-10"><span className="text-[10px] font-black">-</span></div>;
    return (
        <button onClick={onClick} className="w-full bg-white/5 border border-white/5 hover:border-blue-600/50 hover:bg-blue-600/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all group overflow-hidden relative">
            {sub && <div className="text-[7px] font-black text-gray-600 absolute top-1 left-2 tracking-tighter truncate w-3/4 text-left group-hover:text-blue-500/50 transition-colors uppercase">{sub}</div>}
            <div className="text-[9px] font-black text-gray-500 tracking-[0.2em] group-hover:text-blue-400 transition-colors uppercase">{label}</div>
            <div className="text-xl font-black font-mono tracking-tighter group-hover:scale-110 transition-transform italic">{val}</div>
        </button>
    );
}

function NavBtn({ icon, active, label, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center px-6 py-2 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>
        <div className="mb-0.5">{React.cloneElement(icon, { size: 18, strokeWidth: active ? 3 : 2 })}</div>
        <span className="text-[8px] font-black tracking-widest">{label}</span>
    </button>
  );
}

export default App;
