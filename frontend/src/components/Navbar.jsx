import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LogoAsli from '../assets/logo.png'; // Pastikan ekstensi sesuai file aslimu (png/svg)

export default function Navbar({ onSearch }) {
  const [query, setQuery] = useState('');
  const location = useLocation(); // Untuk mengecek kita sedang di halaman mana

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}, Bogor`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        onSearch([parseFloat(lat), parseFloat(lon)]);
      } else {
        alert('Lokasi tidak ditemukan! Coba kata kunci lain.');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 z-[3000] relative shadow-sm">
      {/* KIRI: Logo & Menu */}
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center">
          <img src={LogoAsli} alt="SolarRoofGIS Logo" className="h-8 w-auto" />
        </Link>
        <nav className="flex gap-5 text-sm font-bold">
          <Link 
            to="/" 
            className={`pb-1 border-b-2 transition-colors ${location.pathname === '/' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-900'}`}
          >
            Map
          </Link>
          <Link 
            to="/tentang" 
            className={`pb-1 border-b-2 transition-colors ${location.pathname === '/tentang' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-900'}`}
          >
            Tentang
          </Link>
        </nav>
      </div>

      {/* KANAN: Search Bar (Sembunyikan jika di halaman Tentang) */}
      {location.pathname === '/' && (
        <form onSubmit={handleSearch} className="relative w-80">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Cari alamat atau area..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
        </form>
      )}
    </header>
  );
}