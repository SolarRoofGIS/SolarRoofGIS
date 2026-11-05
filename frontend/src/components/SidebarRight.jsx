import React, { useState } from 'react';

export default function SidebarRight({ buildingData, setBuildingData, onShowModal }) {
  const [viewMode, setViewMode] = useState('hasil');
  const [tagihan, setTagihan] = useState('1.500.000');
  const [jenisPanel, setJenisPanel] = useState('0.20'); // Default Mono 20%

  // Fungsi auto-format titik untuk input rupiah
  const handleTagihanChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setTagihan(value ? parseInt(value, 10).toLocaleString('id-ID') : '');
  };

  // --- LOGIKA KALKULATOR DINAMIS ---
  let simulasi = null;
  if (buildingData) {
    const luasArea = buildingData.luasArea || 0; 
    const efisiensi = parseFloat(jenisPanel);
    
    const luasEfektif = luasArea * 0.8; 
    const kapasitas = luasEfektif * efisiensi;
    const produksiTahunan = kapasitas * 4 * 365;
    const investasi = kapasitas * 15000000;
    
    // Hitung penghematan berdasarkan input (Asumsi Tarif PLN Rp 1.444/kWh)
    const tagihanAngka = parseFloat(tagihan.replace(/[^0-9]/g, '')) || 0;
    const nilaiProduksiBulanan = (produksiTahunan / 12) * 1444;
    const penghematanBulanan = tagihanAngka > 0 ? Math.min(nilaiProduksiBulanan, tagihanAngka) : nilaiProduksiBulanan;
    const payback = penghematanBulanan > 0 ? investasi / (penghematanBulanan * 12) : 0;

simulasi = {
      polygonGeoJSON: buildingData.polygonGeoJSON,
      luasArea: luasArea.toLocaleString('id-ID', {minimumFractionDigits:1, maximumFractionDigits:1}),
      luasAtapEfektif: luasEfektif.toLocaleString('id-ID', {minimumFractionDigits:1, maximumFractionDigits:1}),
      potensiDaya: kapasitas.toLocaleString('id-ID', {minimumFractionDigits:1, maximumFractionDigits:1}),
      produksiTahunan: produksiTahunan.toLocaleString('id-ID', {maximumFractionDigits:0}),
      estimasiInvestasi: "Rp " + investasi.toLocaleString('id-ID'),
      paybackPeriod: payback.toLocaleString('id-ID', {minimumFractionDigits:1, maximumFractionDigits:1}),
      raw: {
        tagihan: tagihanAngka,
        kapasitas,
        investasi,
        penghematanBln: penghematanBulanan,
        payback,
        reduksiKarbon: produksiTahunan * 0.87 / 1000
      }
    };
  }

  // JIKA TIDAK ADA BANGUNAN, SIDEBAR KANAN HILANG SEPENUHNYA
  if (!buildingData) {
    return null;
  }

  return (
    <aside className="absolute top-4 right-4 z-[1000] w-[340px] flex flex-col gap-3 max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden text-sm">
        
        <button className="w-full px-5 py-4 flex items-center justify-between font-bold text-gray-900 bg-white hover:bg-gray-50 transition-colors border-b border-gray-100">
          <span className="text-base">{viewMode === 'hasil' ? 'Hasil Analisis' : 'Input Data Pengguna'}</span>
          <span className="text-gray-400 text-xs">▲</span>
        </button>

        <div className="px-5 py-4 flex items-start gap-3 bg-white border-b border-gray-100">
          <div className="mt-0.5"><svg className="w-5 h-5 text-gray-800" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg></div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">Analisis Atap Terpilih</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Hitung Potensi Surya pada Area Terpilih</p>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4 bg-white">
          {viewMode === 'hasil' && (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-100"><span className="text-gray-600">Luas Area</span><span className="font-bold text-gray-900">{simulasi.luasArea} m²</span></div>
                <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-100"><span className="text-gray-600">Luas Atap Efektif</span><span className="font-bold text-gray-900">{simulasi.luasAtapEfektif} m²</span></div>
                <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-100"><span className="text-gray-600">Potensi Daya</span><span className="font-bold text-gray-900">{simulasi.potensiDaya} kWp</span></div>
                <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-100"><span className="text-gray-600">Produksi Tahunan</span><span className="font-bold text-gray-900">{simulasi.produksiTahunan} kWh/thn</span></div>
                <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-100"><span className="text-gray-600">Estimasi Investasi</span><span className="font-bold text-gray-900">{simulasi.estimasiInvestasi}</span></div>
                <div className="flex justify-between items-center text-xs pb-1"><span className="text-gray-600">Payback Period</span><span className="font-bold text-gray-900">{simulasi.paybackPeriod} tahun</span></div>
              </div>
              <button onClick={() => setViewMode('input')} className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors">Lanjut ke Simulasi</button>
            </>
          )}

          {viewMode === 'input' && (
            <>
              <div className="flex flex-col gap-3 mb-2">
                <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-100"><span className="text-gray-600">Luas Area</span><span className="font-bold text-gray-900">{simulasi.luasArea} m²</span></div>
                <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-100"><span className="text-gray-600">Luas Atap Efektif</span><span className="font-bold text-gray-900">{simulasi.luasAtapEfektif} m²</span></div>
                <div className="flex justify-between items-center text-xs pb-1"><span className="text-gray-600">Potensi Daya</span><span className="font-bold text-gray-900">{simulasi.potensiDaya} kWp</span></div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Rata-rata Tagihan Bulanan (Rp)</label>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                    <span className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-r border-gray-300 font-medium">RP</span>
                    <input type="text" placeholder="Contoh: 1.500.000" value={tagihan} onChange={handleTagihanChange} className="w-full px-3 py-2 text-xs focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Jenis Panel Surya</label>
                  <select value={jenisPanel} onChange={(e) => setJenisPanel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700">
                    <option value="0.20">Monocrystalline (Efisiensi 20%)</option>
                    <option value="0.15">Polycrystalline (Efisiensi 15%)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <button onClick={() => onShowModal(simulasi)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm">
                  Hitung Simulasi Finansial
                </button>
                <button onClick={() => setViewMode('hasil')} className="w-full py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-sm transition-colors">
                  Kembali
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}