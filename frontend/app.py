import streamlit as st
import requests
import pandas as pd

API_URL = "http://localhost:8000"

st.set_page_config(page_title="Sports Betting POS", layout="wide")

st.title("⚽ POS Apuestas Deportivas")

menu = ["Eventos", "Apuestas Realizadas", "Liquidación (Settle)", "Caja / Tickets"]
choice = st.sidebar.selectbox("Menú", menu)

if choice == "Eventos":
    st.header("Próximos Eventos")

    try:
        events = requests.get(f"{API_URL}/events").json()

        if not events:
            st.warning("No hay eventos disponibles en este momento.")

        for event in events:
            with st.container():
                col1, col2, col3 = st.columns([3, 2, 1])

                odds_response = requests.get(f"{API_URL}/odds/{event['id']}")
                if odds_response.status_code == 200:
                    odds_data = odds_response.json()

                    col1.subheader(f"{event['home_team']} vs {event['away_team']}")
                    col1.write(f"Deporte: {event['sport_title']} | Inicio: {event['commence_time']}")

                    with col2:
                        st.write("**Cuotas:**")
                        c1, c2, c3 = st.columns(3)
                        home_btn = c1.button(f"Local: {odds_data['home_price']}", key=f"h_{event['id']}")
                        draw_btn = False
                        if odds_data['draw_price']:
                            draw_btn = c2.button(f"Empate: {odds_data['draw_price']}", key=f"d_{event['id']}")
                        away_btn = c3.button(f"Visita: {odds_data['away_price']}", key=f"a_{event['id']}")

                    selection = None
                    price = 0
                    if home_btn:
                        selection = event['home_team']
                        price = odds_data['home_price']
                    elif draw_btn:
                        selection = "Draw"
                        price = odds_data['draw_price']
                    elif away_btn:
                        selection = event['away_team']
                        price = odds_data['away_price']

                    if selection:
                        st.session_state['bet_slip'] = {
                            "event_id": event['id'],
                            "event_name": f"{event['home_team']} vs {event['away_team']}",
                            "selection": selection,
                            "odds": price
                        }

    except Exception as e:
        st.error(f"Error al conectar con el backend: {e}")

    # Sidebar Bet Slip
    st.sidebar.header("Ticket de Apuesta")
    if 'bet_slip' in st.session_state:
        slip = st.session_state['bet_slip']
        st.sidebar.write(f"**Evento:** {slip['event_name']}")
        st.sidebar.write(f"**Selección:** {slip['selection']}")
        st.sidebar.write(f"**Cuota:** {slip['odds']}")

        stake = st.sidebar.number_input("Monto a apostar", min_value=1.0, value=10.0)
        potential = stake * slip['odds']
        st.sidebar.write(f"**Premio Potencial:** {potential:.2f}")

        if st.sidebar.button("Confirmar Apuesta"):
            payload = {
                "event_id": slip['event_id'],
                "selection": slip['selection'],
                "odds": slip['odds'],
                "stake": stake
            }
            res = requests.post(f"{API_URL}/bets", json=payload)
            if res.status_code == 200:
                st.sidebar.success(f"Apuesta realizada! Ticket: {res.json()['ticket_id']}")
                del st.session_state['bet_slip']
                st.rerun()
            else:
                st.sidebar.error("Error al procesar apuesta")
    else:
        st.sidebar.write("Seleccione una cuota para comenzar.")

elif choice == "Apuestas Realizadas":
    st.header("Historial de Apuestas")
    bets = requests.get(f"{API_URL}/bets").json()
    if bets:
        df = pd.DataFrame(bets)
        st.dataframe(df)
    else:
        st.write("No hay apuestas registradas.")

elif choice == "Liquidación (Settle)":
    st.header("Settle de Apuestas")
    st.write("Esto consultará los resultados oficiales y pagará las apuestas ganadoras.")
    if st.button("Ejecutar Liquidación"):
        res = requests.post(f"{API_URL}/settle")
        if res.status_code == 200:
            st.success("Liquidación completada!")
        else:
            st.error("Error al liquidar")

elif choice == "Caja / Tickets":
    st.header("Gestión de Caja")

    balance_data = requests.get(f"{API_URL}/balance").json()
    st.metric("Balance Actual", f"${balance_data['balance']:.2f}")

    with st.expander("Realizar Depósito"):
        dep_amount = st.number_input("Monto", min_value=0.0)
        if st.button("Depositar"):
            requests.post(f"{API_URL}/deposit?amount={dep_amount}")
            st.rerun()

    st.divider()
    st.subheader("Buscador de Tickets")
    ticket_id_input = st.text_input("Ingrese ID del Ticket")
    if st.button("Buscar Ticket"):
        res = requests.get(f"{API_URL}/bets/ticket/{ticket_id_input}")
        if res.status_code == 200:
            bet = res.json()
            st.write(f"**Ticket:** {bet['ticket_id']}")
            st.write(f"**Evento:** {bet['event_id']}")
            st.write(f"**Selección:** {bet['selection']}")
            st.write(f"**Monto:** {bet['stake']}")
            st.write(f"**Estado:** {bet['status']}")
            if bet['status'] == 'won':
                st.success(f"PREMIO: {bet['potential_payout']}")
        else:
            st.error("Ticket no encontrado")

    st.divider()
    st.subheader("Transacciones")
    transactions = requests.get(f"{API_URL}/transactions").json()
    if transactions:
        st.table(pd.DataFrame(transactions))
