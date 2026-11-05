import React, { useState } from 'react';

// Data statis (mock-up Frontend) untuk relasi Kecamatan & Kelurahan + Koordinatnya
const DATA_WILAYAH = {
  "bogor-tengah": {
    name: "Bogor Tengah",
    kelurahan: [
      { id: "pabaton", name: "Pabaton", coords: [-6.5888, 106.7946] },
      { id: "cibogor", name: "Cibogor", coords: [-6.5925, 106.7892] },
      { id: "gudang", name: "Gudang", coords: [-6.6023, 106.8021] }
    ]
  },
  "bogor-utara": {
    name: "Bogor Utara",
    kelurahan: [
      { id: "bantarjati", name: "Bantarjati", coords: [-6.5750, 106.8085] },
      { id: "tegal-gundil", name: "Tegal Gundil", coords: [-6.5765, 106.8123] }
    ]
  },
  "bogor-selatan": {
    name: "Bogor Selatan",
    kelurahan: [
      { id: "bondongan", name: "Bondongan", coords: [-6.6111, 106.7972] },
      { id: "empang", name: "Empang", coords: [-6.6067, 106.7933] }
    ]
  },
  "bogor-timur": {
    name: "Bogor Timur",
    kelurahan: [
      { id: "baranangsiang", name: "Baranangsiang", coords: [-6.6053, 106.8081] },
      { id: "katulampa", name: "Katulampa", coords: [-6.6214, 106.8351] }
    ]
  },
  "bogor-barat": {
    name: "Bogor Barat",
    kelurahan: [
      { id: "bubulak", name: "Bubulak", coords: [-6.5714, 106.7577] },
      { id: "loji", name: "Loji", coords: [-6.5833, 106.7725] }
    ]
  },
  "tanah-sareal": {
    name: "Tanah Sareal",
    kelurahan: [
      { id: "kedung-badak", name: "Kedung Badak", coords: [-6.5594, 106.7925] },
      { id: "kencana", name: "Kencana", coords: [-6.5411, 106.7864] }
    ]
  }
};

// Tangkap props dari App.js
export default function SidebarLeft({ activeBasemap, onBasemapChange, onLocationSelect, activeTool, setActiveTool }) { 
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isAreaOpen, setIsAreaOpen] = useState(true);
  const [isBasemapOpen, setIsBasemapOpen] = useState(true);

  // State untuk Cascading Dropdown
  const [selectedKec, setSelectedKec] = useState('bogor-tengah');
  const [selectedKel, setSelectedKel] = useState('pabaton');

  // Handle saat Kecamatan diganti
  const handleKecamatanChange = (e) => {
    const kec = e.target.value;
    setSelectedKec(kec);
    // Otomatis ubah kelurahan ke item pertama dari kecamatan baru
    setSelectedKel(DATA_WILAYAH[kec].kelurahan[0].id);
  };

  // Handle saat tombol Terapkan diklik
  const handleTerapkan = () => {
    // Cari data koordinat kelurahan yang dipilih
    const activeKelData = DATA_WILAYAH[selectedKec].kelurahan.find(k => k.id === selectedKel);
    if (activeKelData && onLocationSelect) {
      onLocationSelect(activeKelData.coords); // Memicu flyTo di peta
    }
  };

  return (
    <aside className="absolute top-4 left-4 z-[1000] w-72 flex flex-col gap-3 max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
      
      {/* CARD 1: Filter Wilayah */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden text-sm">
        <button 
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="w-full px-4 py-3 flex items-center justify-between font-bold text-gray-800 bg-white hover:bg-gray-50 transition-colors"
        >
          <span>Filter Wilayah</span>
          <span className="text-gray-400 text-xs">{isFilterOpen ? '▲' : '▼'}</span>
        </button>

        {isFilterOpen && (
          <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-gray-100">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kecamatan</label>
              <select 
                value={selectedKec}
                onChange={handleKecamatanChange}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Object.entries(DATA_WILAYAH).map(([key, data]) => (
                  <option key={key} value={key}>{data.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Desa / Kelurahan</label>
              <select 
                value={selectedKel}
                onChange={(e) => setSelectedKel(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {/* Looping kelurahan secara dinamis berdasarkan kecamatan terpilih */}
                {DATA_WILAYAH[selectedKec].kelurahan.map(kel => (
                  <option key={kel.id} value={kel.id}>{kel.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={handleTerapkan}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-sm transition-colors mt-1"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      {/* CARD 2: Area Analisis */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden text-sm">
        <button 
          onClick={() => setIsAreaOpen(!isAreaOpen)}
          className="w-full px-4 py-3 flex items-center justify-between font-bold text-gray-800 bg-white hover:bg-gray-50 transition-colors"
        >
          <span>Area Analisis</span>
          <span className="text-gray-400 text-xs">{isAreaOpen ? '▲' : '▼'}</span>
        </button>

        {isAreaOpen && (
          <div className="p-3 border-t border-gray-100">
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setActiveTool('select')} className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition-all ${activeTool === 'select' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
                <span className="text-[10px]">Select</span>
              </button>
              <button onClick={() => setActiveTool('draw')} className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition-all ${activeTool === 'draw' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                <span className="text-[10px]">Draw</span>
              </button>
              <button onClick={() => setActiveTool('edit')} className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition-all ${activeTool === 'edit' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                <span className="text-[10px]">Edit</span>
              </button>
              <button onClick={() => setActiveTool('delete')} className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition-all ${activeTool === 'delete' ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                <span className="text-[10px]">Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CARD 3: Basemap & Legenda */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden text-sm">
        <button 
          onClick={() => setIsBasemapOpen(!isBasemapOpen)}
          className="w-full px-4 py-3 flex items-center justify-between font-bold text-gray-800 bg-white hover:bg-gray-50 transition-colors"
        >
          <span>Basemap & Legenda</span>
          <span className="text-gray-400 text-xs">{isBasemapOpen ? '▲' : '▼'}</span>
        </button>

        {isBasemapOpen && (
          <div className="p-4 border-t border-gray-100 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input 
                  type="radio" 
                  name="basemap" 
                  value="osm"
                  className="text-blue-600 focus:ring-blue-500" 
                  checked={activeBasemap === 'osm'}
                  onChange={(e) => onBasemapChange(e.target.value)}
                />
                <span>OpenStreetMap</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input 
                  type="radio" 
                  name="basemap" 
                  value="satelite"
                  className="text-blue-600 focus:ring-blue-500" 
                  checked={activeBasemap === 'satelite'}
                  onChange={(e) => onBasemapChange(e.target.value)}
                />
                <span>Satelit (Label)</span>
              </label>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Potensi Surya Atap</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-3 bg-yellow-400 rounded-sm flex-shrink-0"></div>
                  <div><p className="text-xs font-medium text-gray-800 leading-none">Rendah</p><p className="text-[10px] text-gray-400">&lt; 800 kWh / m² / tahun</p></div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-3 bg-orange-500 rounded-sm flex-shrink-0"></div>
                  <div><p className="text-xs font-medium text-gray-800 leading-none">Sedang</p><p className="text-[10px] text-gray-400">800 - 1200 kWh / m² / tahun</p></div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-3 bg-red-600 rounded-sm flex-shrink-0"></div>
                  <div><p className="text-xs font-medium text-gray-800 leading-none">Tinggi</p><p className="text-[10px] text-gray-400">&gt; 1200 kWh / m² / tahun</p></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </aside>
  );
}