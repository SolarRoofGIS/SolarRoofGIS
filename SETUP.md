# Menjalankan SolarRoofGIS di komputer sendiri

Panduan untuk anggota tim. Kode ada di repo ini, tetapi data bangunan (±700 MB) terlalu besar untuk Git dan dibagikan lewat Google Drive. Alurnya: siapkan database PostGIS, impor dua GeoPackage dengan QGIS, lalu jalankan backend dan frontend.

Waktu: ±30–60 menit, sebagian besar menunggu unduhan dan impor.

## 1. Yang perlu dipasang

| Program | Versi | Catatan |
| --- | --- | --- |
| Git | apa saja | untuk clone repo |
| Node.js | 20 atau lebih baru (LTS) | sudah termasuk `npm` |
| PostgreSQL | 16 atau lebih baru | pgAdmin ikut terpasang dari installer |
| PostGIS | 3.x | di Windows: setelah PostgreSQL terpasang, buka **Stack Builder** → pilih server → *Spatial Extensions* → **PostGIS Bundle** |
| QGIS | 3.x (LTR) | untuk impor GeoPackage |

Catat **port** dan **password** user `postgres` saat memasang PostgreSQL. Port bawaan di Windows biasanya `5432`.

## 2. Ambil kode dan data

```bash
git clone <url repo>
cd SolarRoofGIS
```

Unduh dari folder Google Drive tim: `<link Google Drive>`

| File | Ukuran | Isi |
| --- | --- | --- |
| `bangunan_google.gpkg` | ±700 MB | 2.667.022 poligon bangunan (Google Open Buildings) |
| `batas_bogor_big.gpkg` | ±0,5 MB | batas Kota Bogor dan Kabupaten Bogor (BIG) |

Simpan keduanya di folder `data_bogor/`. Folder ini diabaikan Git, kecuali `data_bogor/photovoltaic/` (raster Global Solar Atlas) yang sudah ikut di repo.

## 3. Buat database di pgAdmin

1. Buka pgAdmin dan sambungkan ke server lokal.
2. Klik kanan **Databases** → **Create** → **Database…**, isi nama **`SolarRoofGIS`** (huruf besar-kecil persis), lalu **Save**.
3. Klik kanan database `SolarRoofGIS` → **Query Tool**, lalu jalankan:

   ```sql
   CREATE EXTENSION postgis;
   SELECT postgis_version();
   ```

   Kalau baris kedua menampilkan versi (misalnya `3.5 USE_GEOS=1 …`), PostGIS siap. Kalau muncul *extension "postgis" is not available*, PostGIS belum terpasang (lihat langkah 1).

## 4. Impor data dengan QGIS

### 4a. Sambungkan QGIS ke database

Di panel **Browser**, klik kanan **PostgreSQL** → **New Connection…**

- Name: `SolarRoofGIS`
- Host: `localhost`, Port: port PostgreSQL Anda, Database: `SolarRoofGIS`
- Authentication → Basic: user `postgres` dan password Anda
- Klik **Test Connection**, lalu **OK**.

### 4b. Impor kedua layer

1. Tarik `data_bogor/bangunan_google.gpkg` dan `data_bogor/batas_bogor_big.gpkg` ke peta.
2. Buka **Processing Toolbox** (Ctrl+Alt+T), cari **Export to PostgreSQL**.
3. Jalankan dua kali dengan isian berikut. Nama tabel dan kolom **harus persis**, karena backend mencarinya dengan nama ini:

| Isian | Bangunan | Batas wilayah |
| --- | --- | --- |
| Layer to export | `bangunan_google` | `batas_administrasi` |
| Database (connection name) | `SolarRoofGIS` | `SolarRoofGIS` |
| Schema | `public` | `public` |
| Table to export to | **`bogor_buildings`** | **`batas_bogor`** |
| Primary key field | **`id`** | **`id`** |
| Geometry column | **`geom`** | **`geom`** |
| Overwrite existing table | ✔ | ✔ |
| Create spatial index | ✔ | ✔ |
| Convert field names to lowercase | ✔ | ✔ |
| Create single-part geometries instead of multi-part | **✘ (jangan dicentang)** | **✘** |

Impor bangunan bisa memakan 10–30 menit. Biarkan sampai selesai.

<details>
<summary>Alternatif lebih cepat: ogr2ogr dari OSGeo4W Shell (ikut terpasang dengan QGIS)</summary>

Jalankan dari folder `data_bogor`, ganti port dan password:

```bash
ogr2ogr -f PostgreSQL "PG:host=localhost port=5432 dbname=SolarRoofGIS user=postgres password=PASSWORD_ANDA" bangunan_google.gpkg bangunan_google -nln bogor_buildings -lco GEOMETRY_NAME=geom -lco FID=id -nlt MULTIPOLYGON -overwrite --config PG_USE_COPY YES
```

```bash
ogr2ogr -f PostgreSQL "PG:host=localhost port=5432 dbname=SolarRoofGIS user=postgres password=PASSWORD_ANDA" batas_bogor_big.gpkg batas_administrasi -nln batas_bogor -lco GEOMETRY_NAME=geom -lco FID=id -nlt MULTIPOLYGON -overwrite
```

</details>

### 4c. Cek hasil impor

Di Query Tool pgAdmin:

```sql
SELECT count(*) FROM public.bogor_buildings;   -- harus 2667022
SELECT wadmkk FROM public.batas_bogor;          -- harus 2 baris: Bogor dan Kota Bogor
SELECT f_table_name, srid, type FROM geometry_columns;  -- 4326, MULTIPOLYGON
ANALYZE public.bogor_buildings;
ANALYZE public.batas_bogor;
```

## 5. Jalankan backend

```bash
cd backend
cp .env.example .env
```

Di Windows (Command Prompt) gunakan `copy .env.example .env`. Lalu buka `backend/.env` dan sesuaikan:

```ini
DB_PORT=5432          # port PostgreSQL Anda (contoh di repo memakai 5433)
DB_PASSWORD=...       # password user postgres
```

File `.env` tidak ikut ke Git, jadi password tidak akan ter-commit. Setelah itu:

```bash
npm install
npm run dev
```

Buka <http://localhost:5000/api/health>. Hasilnya harus berisi `"ok": true`.

Saat pertama kali dijalankan, backend membangun tile peta zoom jauh di latar belakang. Pemuatan pertama peta bisa lambat 1–2 menit, setelah itu cepat.

## 6. Jalankan frontend

Di terminal kedua (backend tetap berjalan):

```bash
cd frontend
npm install
npm start
```

Browser terbuka di <http://localhost:3000>. Peta membutuhkan browser dengan WebGL2 (Chrome, Edge, Firefox, Safari versi baru).

## 7. Memulihkan database production (Neon)

Production memakai database Neon. Ada dua cara memulihkannya bila data rusak atau terhapus.

**Kejadian kurang dari 6 jam yang lalu.** Neon menyimpan riwayat 6 jam. Di Neon Console, buka project `solarroofgis` → *Branches* → branch `main` → *Restore*, lalu pilih waktu sebelum kejadian. Aplikasi langsung memakai data hasil restore.

**Lebih dari 6 jam, atau dari awal.** Salin tabel dari database lokal (langkah 3–4) ke Neon. Ambil *connection string* Neon tanpa *pooler* (Neon Console → *Connect*, matikan *Connection pooling*) dan simpan sebagai `NEON_URL` di terminal saja, jangan di file yang ikut Git.

```bash
pg_dump -Fc --no-owner -h localhost -p 5432 -U postgres -t public.bogor_buildings -t public.batas_bogor SolarRoofGIS > solarroofgis.dump
psql "$NEON_URL" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
pg_restore --no-owner --clean --if-exists -d "$NEON_URL" solarroofgis.dump
psql "$NEON_URL" -c "ANALYZE public.bogor_buildings; ANALYZE public.batas_bogor; TRUNCATE public.api_cache;"
```

Sesuaikan `-p` dan `-U` dengan database lokal Anda. `TRUNCATE public.api_cache` membuang tile ringkasan dan statistik lama. Setelah itu jalankan ulang workflow *Warm cache after deploy* (GitHub → *Actions* → *Re-run jobs*) atau push commit baru, lalu cek:

- <https://solarroofgis.vercel.app/api/health> berisi `"ok": true`;
- <https://solarroofgis.vercel.app/api/stats> menunjukkan 2.666.592 bangunan.

## Masalah yang sering muncul

| Gejala | Penyebab dan solusi |
| --- | --- |
| `/api/health` → `password authentication failed` | `DB_PASSWORD` di `backend/.env` salah. |
| `/api/health` → `ECONNREFUSED` atau timeout | `DB_PORT` tidak sesuai, atau layanan PostgreSQL belum berjalan. |
| `/api/health` → `"ok": false` | Tabel `bogor_buildings` tidak ditemukan. Cek nama tabel dan schema `public` di langkah 4b. |
| Atap gambar berlabel "Wilayah belum diketahui", garis batas dan overlay surya tidak muncul | Tabel `batas_bogor` belum diimpor atau namanya berbeda. Menggambar dan menganalisis atap tetap bisa dicoba tanpa tabel ini. |
| Error `column "id"` / `column "geom" does not exist` | Primary key atau kolom geometri tidak bernama `id` / `geom` saat impor. Impor ulang dengan *Overwrite*. |
| Halaman peta: "Peta tidak dapat ditampilkan" | Browser atau driver grafis tidak mendukung WebGL2. Aktifkan *hardware acceleration* atau coba browser lain. |
| Frontend tampil tetapi data kosong | Backend tidak berjalan di port 5000. Pastikan `npm run dev` di folder `backend` aktif. |
