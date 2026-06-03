# POS para Apuestas Deportivas

Este proyecto es un Punto de Venta (POS) para apuestas deportivas.

## Estructura
- `backend/`: API construida con FastAPI y SQLAlchemy (SQLite).
- `frontend/`: Interfaz de usuario construida con Streamlit.

## Requisitos
- Python 3.10+
- Dependencias listadas en `requirements.txt`

## Ejecución

### 1. Backend
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend
```bash
streamlit run frontend/app.py --server.port 8501
```

## Módulos
- **Eventos:** Visualización de eventos deportivos activos.
- **Cuotas:** Integración con The Odds API (actualmente con mock data para demostración).
- **Apuestas:** Creación de tickets de apuestas y validación.
- **Caja:** Gestión de flujo de efectivo y balance del POS.
- **Tickets:** Historial de apuestas realizadas con ID de ticket único.
