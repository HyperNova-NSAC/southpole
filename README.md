# Lunar Skyline

A simple page on top of NASA Horizons, Moon Trek, and LROC QuickMap. Phase 0 is the shared setup. The three tracks branch after this lands on `main`.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest
```

```bash
cd web
npm install
npm run dev
```

```bash
uvicorn server.app:app --reload
```

The page is at http://localhost:5173. It shows the example sentence for Shackleton rim. `/api` is proxied to the server on port 8000. The server in this phase only answers `/api/health`.

## Elevation file

`dem/LDEM_80S_80MPP_ADJ.TIF` is downloaded locally and is not committed (about 181 MB). See `dem/provenance.json` for the URL. Fetch it again with:

```bash
curl -L -o dem/LDEM_80S_80MPP_ADJ.TIF \
  https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF
```
