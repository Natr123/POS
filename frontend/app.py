import streamlit as st
import requests
import pandas as pd
from datetime import datetime

API_URL = "http://localhost:8000"

st.set_page_config(page_title="SportPOS Mobile", layout="wide", initial_sidebar_state="collapsed")

# Custom CSS for Mobile optimization
st.markdown("""
<style>
    .stButton button {
        width: 100%;
        height: 3em;
        font-size: 1.2rem !important;
        margin-bottom: 0.5rem;
    }
    .event-card {
        padding: 1rem;
        border: 1px solid #ccc;
        border-radius: 10px;
        margin-bottom: 1rem;
        background-color: #f9f9f9;
    }
    .sport-tab {
        font-weight: bold;
        text-align: center;
    }
    [data-testid="stMetricValue"] {
        font-size: 1.5rem;
    }
    .main .block-container {
        padding-top: 2rem;
        padding-left: 1rem;
        padding-right: 1rem;
    }
</style>
""", unsafe_allow_html=True)

# Tabs for main navigation
tab1, tab2, tab3 = st.tabs(["🔥 Eventos", "📋 Tickets", "💰 Caja"])

with tab1:
    # Sport selection
    try:
        sports = requests.get(f"{API_URL}/sports").json()
        if sports:
            sport_titles = [s['title'] for s in sports]
            selected_sport_title = st.selectbox("Seleccionar Liga/Deporte", sport_titles)
            selected_sport_key = next(s['key'] for s in sports if s['title'] == selected_sport_title)

            # Refresh button
            if st.button("🔄 Actualizar Cuotas"):
                requests.post(f"{API_URL}/refresh")
                st.rerun()

            st.divider()

            events = requests.get(f"{API_URL}/events?sport_key={selected_sport_key}").json()

            if not events:
                st.info("No hay eventos activos para esta liga.")

            for event in events:
                with st.container():
                    st.markdown(f"### {event['home_team']} vs {event['away_team']}")
                    st.caption(f"🕒 {event['commence_time']}")

                    odds_res = requests.get(f"{API_URL}/odds/{event['id']}")
                    if odds_res.status_code == 200:
                        odds = odds_res.json()
                        col1, col2, col3 = st.columns(3)

                        if col1.button(f"🏠 Local\n{odds['home_price']}", key=f"h_{event['id']}"):
                            st.session_state['bet_slip'] = {"id": event['id'], "name": f"{event['home_team']} vs {event['away_team']}", "sel": event['home_team'], "price": odds['home_price']}

                        if odds['draw_price']:
                            if col2.button(f"🤝 Empate\n{odds['draw_price']}", key=f"d_{event['id']}"):
                                st.session_state['bet_slip'] = {"id": event['id'], "name": f"{event['home_team']} vs {event['away_team']}", "sel": "Draw", "price": odds['draw_price']}

                        if col3.button(f"🚀 Visita\n{odds['away_price']}", key=f"a_{event['id']}"):
                            st.session_state['bet_slip'] = {"id": event['id'], "name": f"{event['home_team']} vs {event['away_team']}", "sel": event['away_team'], "price": odds['away_price']}
                    st.divider()

    except Exception as e:
        st.error(f"Error: {e}")

    # Floating Bet Slip (bottom or sidebar)
    if 'bet_slip' in st.session_state:
        with st.sidebar:
            st.header("🎟️ Ticket")
            slip = st.session_state['bet_slip']
            st.write(f"**{slip['name']}**")
            st.write(f"Selección: `{slip['sel']}` @ {slip['price']}")

            stake = st.number_input("Monto $", min_value=1, value=10, step=5)
            st.write(f"**Premio: ${stake * slip['price']:.2f}**")

            col_a, col_b = st.columns(2)
            if col_a.button("✅ Confirmar"):
                payload = {"event_id": slip['id'], "selection": slip['sel'], "odds": slip['price'], "stake": stake}
                res = requests.post(f"{API_URL}/bets", json=payload)
                if res.status_code == 200:
                    st.success(f"¡Éxito! ID: {res.json()['ticket_id']}")
                    del st.session_state['bet_slip']
                    st.rerun()
            if col_b.button("❌ Cancelar"):
                del st.session_state['bet_slip']
                st.rerun()

with tab2:
    st.header("Historial de Apuestas")
    if st.button("🔄 Refrescar"): st.rerun()

    bets_res = requests.get(f"{API_URL}/bets").json()
    if bets_res:
        for bet in reversed(bets_res):
            status_color = "green" if bet['status'] == 'won' else "red" if bet['status'] == 'lost' else "gray"
            with st.expander(f"Ticket: {bet['ticket_id']} - {bet['status'].upper()}"):
                st.write(f"Evento: {bet['event_id']}")
                st.write(f"Selección: {bet['selection']} @ {bet['odds']}")
                st.write(f"Apuesta: ${bet['stake']} | Premio: ${bet['potential_payout']}")
                st.write(f"Fecha: {bet['created_at']}")
    else:
        st.info("No hay apuestas.")

with tab3:
    st.header("Gestión de Caja")
    balance = requests.get(f"{API_URL}/balance").json()
    st.metric("Efectivo en Caja", f"${balance['balance']:.2f}")

    col1, col2 = st.columns(2)
    with col1:
        if st.button("📥 Settle (Pagar Ganadores)"):
            requests.post(f"{API_URL}/settle")
            st.success("Liquidación completada")
            st.rerun()

    with col2:
        with st.popover("➕ Depósito"):
            amt = st.number_input("Monto", min_value=0.0)
            if st.button("Depositar"):
                requests.post(f"{API_URL}/deposit?amount={amt}")
                st.rerun()

    st.divider()
    st.subheader("Últimos Movimientos")
    txs = requests.get(f"{API_URL}/transactions").json()
    if txs:
        df = pd.DataFrame(txs)
        st.dataframe(df.sort_values('timestamp', ascending=False), use_container_width=True)
