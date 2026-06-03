# Sports Betting POS Pro 🚀

Sistema de Punto de Venta (POS) de alto rendimiento para apuestas deportivas.

## 🛠️ Tecnologías
- **Backend:** FastAPI (Asíncrono, HTTPX)
- **Frontend Moderno:** React + Tailwind CSS (Optimizado para móvil)
- **Frontend Legacy:** Streamlit
- **DB:** SQLite (SQLAlchemy)

## 🚀 Instrucciones de Ejecución

### 1. Configurar el Backend
Desde la raíz del proyecto:
```bash
# Instalar dependencias de Python
pip install -r requirements.txt

# Iniciar el servidor backend
# El API estará disponible en http://localhost:8000
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 2. Ejecutar la Versión React (Recomendada)
Esta es la versión rápida y moderna:
```bash
# Entrar a la carpeta del frontend
cd frontend-react

# Instalar dependencias (Node.js requerido)
npm install

# Iniciar el servidor de desarrollo
# La interfaz estará disponible en http://localhost:5173 (generalmente)
npm run dev
```

### 3. Ejecutar la Versión Streamlit (Opcional)
Si prefieres usar la versión básica de Streamlit:
```bash
streamlit run frontend/app.py --server.port 8501
```

## ✨ Características
- **Velocidad:** Backend asíncrono para actualizaciones de cuotas instantáneas.
- **Multi-Deporte:** Soporte para La Liga, NBA, NFL, MLB, NHL y más.
- **Touch-Friendly:** Interfaz diseñada para dispositivos táctiles y móviles.
- **Gestión Total:** Módulos de eventos, apuestas, tickets y caja integrados.
