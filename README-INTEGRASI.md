## Konfigurasi lokal
Buat file `.env` di folder yang sama dengan `package.json`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Jalankan Backend di terminal terpisah, lalu dari folder Frontend jalankan:

```bash
npm install
npm run dev
```
