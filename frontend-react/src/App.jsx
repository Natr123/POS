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
  const [printTicket, setPrintTicket] = useState(null);

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
      setPrintTicket(res.data);
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
    setPrintTicket(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-24 selection:bg-primary/30">
      {printTicket && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-4 print:p-0 print:static print:bg-white print:text-black">
          <div id="printable-ticket" className="bg-white text-black p-8 rounded-lg shadow-2xl w-full max-w-sm font-mono text-sm print:shadow-none print:w-full">
            <div className="text-center border-b border-dashed border-black pb-4 mb-4">
              <h2 className="text-xl font-bold uppercase tracking-widest">SportPOS Pro</h2>
              <p>Ticket No: {printTicket.ticket_id}</p>
              <p>{new Date(printTicket.created_at).toLocaleString()}</p>
            </div>
            <div className="space-y-2 mb-4">
              <p className="font-bold">{printTicket.event_name}</p>
              <div className="flex justify-between">
                <span className="font-bold">{printTicket.selection}</span>
              </div>
              <div className="flex justify-between">
                <span>Cuota:</span>
                <span className="font-bold">x{printTicket.odds}</span>
              </div>
            </div>
            <div className="border-t border-dashed border-black pt-4 space-y-1">
              <div className="flex justify-between text-lg">
                <span>Apuesta:</span>
                <span className="font-bold">${printTicket.stake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl border-t border-black mt-2 pt-2">
                <span>Premio:</span>
                <span className="font-black">${printTicket.potential_payout.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-center mt-8 text-[10px] uppercase">
              <p>Gracias por su apuesta</p>
              <p>Conserve este ticket</p>
            </div>
          </div>
          <div className="mt-8 flex gap-4 print:hidden">
            <button onClick={handlePrint} className="bg-primary px-8 py-4 rounded-2xl font-bold flex items-center gap-2">
              <Printer size={20}/> IMPRIMIR
            </button>
            <button onClick={() => setPrintTicket(null)} className="bg-gray-800 px-8 py-4 rounded-2xl font-bold">
              CERRAR
            </button>
          </div>
        </div>
      )}

      <header className="p-4 bg-[#111] border-b border-white/5 flex justify-between items-center sticky top-0 z-40 backdrop-blur-md bg-opacity-80">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
             <LayoutGrid size={18} className="text-white"/>
           </div>
           <h1 className="text-lg font-black tracking-tighter italic">SPORT<span className="text-primary">POS</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => axios.post(`${API_URL}/refresh`).then(() => fetchEvents(selectedSport))} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <RefreshCw size={18} className={loading ? 'animate-spin text-primary' : 'text-gray-400'}/>
          </button>
          <div className="bg-green-500/10 px-4 py-1.5 rounded-full border border-green-500/20">
            <span className="text-green-500 font-mono font-bold text-sm">${balance.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {activeTab === 'events' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex gap-2 overflow-x-auto mb-6 pb-2 no-scrollbar scroll-smooth">
              {sports.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSelectedSport(s.key)}
                  className={`px-5 py-2.5 rounded-xl whitespace-nowrap text-sm font-bold transition-all ${selectedSport === s.key ? 'bg-primary text-white shadow-lg shadow-primary/25 scale-105' : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10'}`}
                >
                  {s.title}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-50">
                <RefreshCw size={40} className="animate-spin text-primary"/>
                <span className="text-xs font-bold tracking-widest text-gray-500">CARGANDO CUOTAS...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map(ev => (
                  <div key={ev.id} className="bg-[#111] rounded-2xl p-5 border border-white/5 shadow-xl">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black bg-white/5 px-2 py-1 rounded text-gray-400 uppercase tracking-tighter">{ev.sport_title}</span>
                      <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-1 rounded">{new Date(ev.commence_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4 mb-6">
                      <div className="flex-1 text-right font-bold text-sm">{ev.home_team}</div>
                      <div className="text-gray-600 font-black text-xs italic">VS</div>
                      <div className="flex-1 text-left font-bold text-sm">{ev.away_team}</div>
                    </div>

                    {/* Market Tabs/Sections */}
                    <div className="space-y-4">
                        {odds[ev.id]?.h2h && (
                            <div>
                                <div className="text-[8px] font-bold text-gray-600 mb-2 tracking-widest">LÍNEA DE DINERO</div>
                                <div className="grid grid-cols-3 gap-3">
                                    <OddBtn label="LOCAL" price={odds[ev.id].h2h.home} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'Moneyline', sel: ev.home_team, price: odds[ev.id].h2h.home})} />
                                    <OddBtn label="EMPATE" price={odds[ev.id].h2h.draw} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'Moneyline', sel: 'Draw', price: odds[ev.id].h2h.draw})} />
                                    <OddBtn label="VISITA" price={odds[ev.id].h2h.away} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'Moneyline', sel: ev.away_team, price: odds[ev.id].h2h.away})} />
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            {odds[ev.id]?.spreads && (
                                <div>
                                    <div className="text-[8px] font-bold text-gray-600 mb-2 tracking-widest">HÁNDICAP</div>
                                    <div className="space-y-2">
                                        <OddBtn label={odds[ev.id].spreads.home_name + ' ' + odds[ev.id].spreads.home_point} price={odds[ev.id].spreads.home_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'Handicap', sel: odds[ev.id].spreads.home_name + ' ' + odds[ev.id].spreads.home_point, price: odds[ev.id].spreads.home_price})} />
                                        <OddBtn label={odds[ev.id].spreads.away_name + ' ' + odds[ev.id].spreads.away_point} price={odds[ev.id].spreads.away_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'Handicap', sel: odds[ev.id].spreads.away_name + ' ' + odds[ev.id].spreads.away_point, price: odds[ev.id].spreads.away_price})} />
                                    </div>
                                </div>
                            )}
                            {odds[ev.id]?.totals && (
                                <div>
                                    <div className="text-[8px] font-bold text-gray-600 mb-2 tracking-widest">MÁS/MENOS</div>
                                    <div className="space-y-2">
                                        <OddBtn label={'MÁS DE ' + odds[ev.id].totals.point} price={odds[ev.id].totals.over_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'Over', sel: 'Over ' + odds[ev.id].totals.point, price: odds[ev.id].totals.over_price})} />
                                        <OddBtn label={'MENOS DE ' + odds[ev.id].totals.point} price={odds[ev.id].totals.under_price} onClick={() => setBetSlip({id: ev.id, name: `${ev.home_team} vs ${ev.away_team}`, market: 'Under', sel: 'Under ' + odds[ev.id].totals.point, price: odds[ev.id].totals.under_price})} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                  </div>
                ))}
                {events.length === 0 && <div className="text-center p-20 text-gray-600 font-bold italic">No hay eventos próximos.</div>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tickets' && (
            <div className="animate-in slide-in-from-right duration-300">
                <h2 className="text-2xl font-black mb-6">HISTORIAL</h2>
                <div className="space-y-3">
                    {history.map(bet => (
                        <div key={bet.id} className="bg-[#111] p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                            <div>
                                <div className="text-[10px] font-bold text-gray-500 mb-1">TICKET: {bet.ticket_id}</div>
                                <div className="font-bold text-sm">{bet.event_name}</div>
                                <div className="text-xs text-primary font-bold">{bet.selection} @ {bet.odds}</div>
                            </div>
                            <div className="text-right">
                                <div className={`text-[10px] font-black px-2 py-0.5 rounded inline-block mb-1 ${
                                    bet.status === 'won' ? 'bg-green-500/20 text-green-500' :
                                    bet.status === 'lost' ? 'bg-red-500/20 text-red-500' : 'bg-gray-500/20 text-gray-500'
                                }`}>
                                    {bet.status.toUpperCase()}
                                </div>
                                <div className="font-mono font-bold text-sm">${bet.stake} → <span className="text-primary">${bet.potential_payout}</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'caja' && (
            <div className="animate-in slide-in-from-right duration-300">
                <div className="bg-primary rounded-3xl p-8 mb-6 shadow-2xl shadow-primary/20 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">BALANCE TOTAL</div>
                    <div className="text-4xl font-black mb-6 font-mono">${balance.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                    <div className="flex gap-3">
                        <button onClick={handleSettle} className="flex-1 bg-white text-primary py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                             LIQUIDAR
                        </button>
                        <button onClick={() => {
                            const a = prompt('Monto a depositar');
                            if(a) axios.post(`${API_URL}/deposit?amount=${a}`).then(fetchBalance);
                        }} className="flex-1 bg-black/20 text-white py-3 rounded-xl font-bold text-sm border border-white/10">
                            DEPOSITAR
                        </button>
                    </div>
                </div>

                <h3 className="text-lg font-black mb-4">TRANSACCIONES</h3>
                <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                    {transactions.map(tx => (
                        <div key={tx.id} className="p-4 border-b border-white/5 flex items-center justify-between last:border-0">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {tx.amount > 0 ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}
                                </div>
                                <div>
                                    <div className="text-xs font-bold">{tx.description}</div>
                                    <div className="text-[10px] text-gray-500">{new Date(tx.timestamp).toLocaleString()}</div>
                                </div>
                            </div>
                            <div className={`font-mono font-bold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-end">
          <div className="w-full bg-[#111] rounded-t-[2.5rem] p-8 border-t border-white/10 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                 <h2 className="text-2xl font-black tracking-tighter">NUEVA APUESTA</h2>
              </div>
              <button onClick={() => setBetSlip(null)} className="p-3 bg-white/5 rounded-full"><X size={20}/></button>
            </div>

            <div className="bg-white/5 p-6 rounded-3xl mb-8 border border-white/5">
              <div className="text-gray-500 text-xs font-bold mb-2 uppercase">{betSlip.name}</div>
              <div className="text-[10px] font-bold text-primary tracking-widest mb-1">{betSlip.market.toUpperCase()}</div>
              <div className="flex justify-between items-end">
                <div className="text-xl font-black text-white uppercase">{betSlip.sel}</div>
                <div className="text-2xl font-mono font-black text-primary">x{betSlip.price}</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-8">
              {[10, 20, 50, 100].map(v => (
                <button key={v} onClick={() => placeBet(v)} className="py-4 bg-white/5 rounded-2xl font-black text-sm border border-white/5 active:bg-primary active:scale-95 transition-all">
                  ${v}
                </button>
              ))}
            </div>

            <button
                onClick={() => {
                    const val = prompt('Monto personalizado:');
                    if(val) placeBet(val);
                }}
                className="w-full py-5 bg-primary rounded-2xl font-black text-xl shadow-2xl shadow-primary/40 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              CONFIRMAR APUESTA
            </button>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="fixed bottom-6 left-4 right-4 bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] flex justify-around p-2 z-40 shadow-2xl">
        <NavBtn icon={<LayoutGrid />} active={activeTab === 'events'} label="EVENTOS" onClick={() => setActiveTab('events')} />
        <NavBtn icon={<Ticket />} active={activeTab === 'tickets'} label="TICKETS" onClick={() => setActiveTab('tickets')} />
        <NavBtn icon={<Wallet />} active={activeTab === 'caja'} label="CAJA" onClick={() => setActiveTab('caja')} />
      </nav>
    </div>
  );
}

function OddBtn({ label, price, onClick }) {
  if (!price) return <div className="bg-white/2 rounded-xl py-4 border border-white/5 opacity-10 flex items-center justify-center"><span className="text-[8px] text-gray-700 font-bold tracking-widest">-</span></div>;
  return (
    <button onClick={onClick} className="group bg-white/5 rounded-xl py-4 border border-white/5 active:bg-primary active:border-primary transition-all flex flex-col items-center gap-1 hover:bg-white/10 overflow-hidden">
      <div className="text-[8px] text-gray-500 font-black tracking-widest group-active:text-white/70 px-1 truncate w-full text-center">{label}</div>
      <div className="text-lg font-mono font-black group-active:scale-110 transition-transform">{price}</div>
    </button>
  );
}

function NavBtn({ icon, active, label, onClick }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center py-2 transition-all ${active ? 'text-primary' : 'text-gray-500'}`}>
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-primary/10' : ''}`}>
        {React.cloneElement(icon, { size: 20, strokeWidth: active ? 3 : 2 })}
      </div>
      <span className="text-[8px] font-black mt-1 tracking-tighter">{label}</span>
    </button>
  );
}

export default App;
