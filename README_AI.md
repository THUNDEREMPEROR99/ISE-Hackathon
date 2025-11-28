# Local AI model (GGUF) and secure proxy

If you want to run a local AI model (for example the GGUF model at `mradermacher/Phi_mts_dialogue_clinical_note_ALLERGY-i1-GGUF` on Hugging Face) and keep your HF key private, follow these steps.

1) Prepare the repo `server/` proxy (already included)

```powershell
cd server
npm install
# Copy `.env.example` to `.env` and set HF_API_KEY=hf_xxx if you plan to use Hugging Face as fallback
# or set LOCAL_AI_URL to your local model server URL if running a local model web UI.
node index.js
```

The proxy will listen on `http://localhost:3001` by default and exposes:
- `POST /api/ai` — forwards to a local model server (if available) or to Hugging Face using the server-side key.
- `GET /api/openfoodfacts/:barcode` — fetches product data from OpenFoodFacts (no key required).

2) Download the GGUF model (example using `huggingface_hub` Python helper)

Install Python and the huggingface hub package, then run:

```powershell
pip install huggingface_hub
python - <<'PY'
from huggingface_hub import hf_hub_download
hf_hub_download(repo_id="mradermacher/Phi_mts_dialogue_clinical_note_ALLERGY-i1-GGUF", filename="Phi_mts_dialogue_clinical_note_ALLERGY-i1.gguf", cache_dir="./server/models/Phi_allergy")
print('Downloaded to server/models/Phi_allergy')
PY
```

Note: large model files may require `git-lfs` or an authenticated HF account. If the model is public, `hf_hub_download` should work without authentication for downloads allowed by the repo.

3) Run a local model web UI that supports GGUF (recommended: text-generation-webui / oobabooga)

Example (text-generation-webui):

```powershell
# from a separate folder
git clone https://github.com/oobabooga/text-generation-webui
cd text-generation-webui
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# copy the GGUF into the webui models folder, e.g. models/Phi_allergy/<files>
python server.py --model-dir "path\to\models"
```

4) Point the proxy to your local UI

Edit `server/.env` (or set environment var) and set `LOCAL_AI_URL` to the URL exposed by your local web UI (for example `http://127.0.0.1:5001`). The proxy will prefer the local model and only use Hugging Face if the local model isn't reachable and `HF_API_KEY` is set.

5) Use the app

Start the frontend (`npm run dev`) and the server proxy (`node server/index.js`), then visit the Chatbot page. The frontend calls `/api/ai` which is proxied to your local model or Hugging Face.

If you want, I can add a small script to automate the model download step (requires you to have an HF token for private or LFS-hosted assets). Would you like me to add that script? Or should I proceed to wire OpenFoodFacts lookups into `foodAnalysisService.ts` next?