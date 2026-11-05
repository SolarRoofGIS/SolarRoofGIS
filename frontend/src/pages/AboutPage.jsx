import React from 'react';
import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 selection:bg-blue-100 selection:text-blue-900">
      
      {/* 1. HERO SECTION - Product Identity First */}
      <section className="relative w-full max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-32 md:pb-40 flex flex-col lg:flex-row items-center gap-16">
        
        {/* Typography & Copy */}
        <div className="flex-1 space-y-8 z-10">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-semibold tracking-wide text-slate-600 uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Kawasan Bogor Raya
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Pemetaan Presisi <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500">
              Potensi Energi Surya.
            </span>
          </h1>
          
          <p className="text-lg text-slate-600 max-w-xl leading-relaxed">
            Platform WebGIS untuk menganalisis kelayakan teknis dan simulasi finansial instalasi PLTS Atap secara interaktif, berbasis data geospasial aktual.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <Link 
              to="/" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-all focus:outline-none focus:ring-4 focus:ring-slate-200 shadow-sm"
            >
              Mulai Analisis Area
            </Link>
            <a 
              href="#features" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all focus:outline-none focus:ring-4 focus:ring-slate-100"
            >
              Pelajari Cara Kerja
            </a>
          </div>
        </div>

        {/* Hero Visual: UI Abstraction SVG */}
        <div className="flex-1 w-full relative group">
          {/* Subtle glow strictly constrained to the component */}
          <div className="absolute inset-0 bg-blue-500 opacity-5 blur-3xl rounded-full transition-opacity group-hover:opacity-10"></div>
          
          <svg viewBox="0 0 600 420" className="relative w-full h-auto drop-shadow-2xl rounded-xl border border-slate-200/80 bg-white overflow-hidden">
            {/* Window Header */}
            <path d="M0 12C0 5.373 5.373 0 12 0H588C594.627 0 600 5.373 600 12V36H0V12Z" fill="#F8FAFC" className="border-b border-slate-100"/>
            <circle cx="20" cy="18" r="4.5" fill="#E2E8F0"/>
            <circle cx="36" cy="18" r="4.5" fill="#E2E8F0"/>
            <circle cx="52" cy="18" r="4.5" fill="#E2E8F0"/>
            
            {/* Map Background Simulation */}
            <rect x="0" y="36" width="600" height="384" fill="#F1F5F9"/>
            <path d="M100 36V420 M200 36V420 M300 36V420 M400 36V420 M500 36V420" stroke="#E2E8F0" strokeWidth="1"/>
            <path d="M0 136H600 M0 236H600 M0 336H600" stroke="#E2E8F0" strokeWidth="1"/>
            
            {/* Drawn Polygon */}
            <path d="M180 160 L320 200 L290 310 L150 250 Z" fill="rgba(37, 99, 235, 0.15)" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round"/>
            <circle cx="180" cy="160" r="3.5" fill="#ffffff" stroke="#2563EB" strokeWidth="2"/>
            <circle cx="320" cy="200" r="3.5" fill="#ffffff" stroke="#2563EB" strokeWidth="2"/>
            <circle cx="290" cy="310" r="3.5" fill="#ffffff" stroke="#2563EB" strokeWidth="2"/>
            <circle cx="150" cy="250" r="3.5" fill="#ffffff" stroke="#2563EB" strokeWidth="2"/>
            
            {/* Sidebar Data Panel Mockup */}
            <rect x="420" y="56" width="160" height="344" rx="8" fill="#FFFFFF" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.02))" stroke="#E2E8F0" strokeWidth="1"/>
            <rect x="436" y="76" width="70" height="6" rx="3" fill="#94A3B8"/>
            <rect x="436" y="96" width="128" height="40" rx="4" fill="#F8FAFC" stroke="#F1F5F9" strokeWidth="1"/>
            <rect x="444" y="106" width="40" height="4" rx="2" fill="#CBD5E1"/>
            <rect x="444" y="118" width="60" height="6" rx="3" fill="#0F172A"/>
            
            <rect x="436" y="148" width="128" height="40" rx="4" fill="#F8FAFC" stroke="#F1F5F9" strokeWidth="1"/>
            <rect x="444" y="158" width="40" height="4" rx="2" fill="#CBD5E1"/>
            <rect x="444" y="170" width="80" height="6" rx="3" fill="#0F172A"/>

            <rect x="436" y="200" width="128" height="80" rx="4" fill="#F8FAFC" stroke="#F1F5F9" strokeWidth="1"/>
            <path d="M444 260 L470 230 L500 240 L550 215" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
            <rect x="436" y="292" width="128" height="28" rx="4" fill="#2563EB"/>
          </svg>
        </div>
      </section>

      <hr className="border-slate-200/60 max-w-7xl mx-auto" />

      {/* 2. CAPABILITIES SECTION - Editorial Layout */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="mb-20 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Kemampuan Inti Sistem
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Dirancang dengan kapabilitas spasial dan perhitungan algoritmis untuk menyajikan data operasional secara instan, tanpa konfigurasi rumit.
          </p>
        </div>

        <div className="flex flex-col gap-24">
          
          {/* Feature 1 */}
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
            <div className="flex-1 space-y-5 order-2 md:order-1">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Pemetaan Geospasial Interaktif</h3>
              <p className="text-slate-600 leading-relaxed">
                Tentukan target bangunan melalui fitur pencarian lokasi, lalu manfaatkan perangkat gambar spasial (Polygon, Edit, Delete) secara presisi di atas citra satelit resolusi tinggi untuk memisahkan area efektif atap dari bayangan.
              </p>
            </div>
            <div className="flex-1 order-1 md:order-2 w-full bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden aspect-[4/3] flex items-center justify-center">
              {/* Minimalist Graphic representing mapping */}
              <svg viewBox="0 0 400 300" className="w-full h-full text-slate-300">
                <pattern id="grid1" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                </pattern>
                <rect width="400" height="300" fill="url(#grid1)" />
                <path d="M120 100 L240 80 L280 200 L140 180 Z" fill="rgba(37,99,235,0.1)" stroke="#2563EB" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="280" cy="200" r="4" fill="#2563EB" />
                <circle cx="140" cy="180" r="4" fill="#2563EB" />
                <path d="M280 200 L320 250" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                <rect x="300" y="240" width="40" height="20" rx="4" fill="#2563EB" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
            
            {/* Feature 2 */}
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Kalkulasi Potensi Energi</h3>
              <p className="text-slate-600 leading-relaxed text-sm lg:text-base">
                Sistem membaca data geometri (*m²*) secara *real-time* dan memprosesnya untuk mengestimasi kapasitas daya (kWp) serta proyeksi produksi listrik tahunan, mengacu pada parameter efisiensi jenis panel (Monocrystalline/Polycrystalline).
              </p>
            </div>

            {/* Feature 3 */}
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Analisis Kelayakan Finansial</h3>
              <p className="text-slate-600 leading-relaxed text-sm lg:text-base">
                Dapatkan rincian *Capital Expenditure* (CAPEX) instan. Platform menyajikan matriks penghematan bulanan, titik impas operasional (BEP), grafik arus kas 25 tahun, hingga fungsi ekspor dokumen ke format GeoJSON dan PDF Report.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS - Minimalist Workflow */}
      <section className="bg-slate-900 text-slate-50 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold tracking-tight mb-16">Alur Kerja Sistem</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            
            {/* Step 1 */}
            <div className="relative pt-6">
              <div className="hidden md:block absolute top-0 left-0 w-full h-[1px] bg-slate-800"></div>
              <div className="absolute top-0 left-0 w-12 h-[2px] bg-blue-500"></div>
              <span className="text-xs font-bold text-blue-500 tracking-[0.2em] mb-4 block">01</span>
              <h3 className="text-lg font-bold text-white mb-3">Identifikasi Lokasi</h3>
              <p className="text-slate-400 text-sm leading-relaxed pr-4">
                Navigasikan peta atau gunakan antarmuka pencarian Nominatim untuk menemukan atap bangunan target di area evaluasi.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative pt-6">
              <div className="hidden md:block absolute top-0 left-0 w-full h-[1px] bg-slate-800"></div>
              <div className="absolute top-0 left-0 w-12 h-[2px] bg-blue-500"></div>
              <span className="text-xs font-bold text-blue-500 tracking-[0.2em] mb-4 block">02</span>
              <h3 className="text-lg font-bold text-white mb-3">Definisikan Area</h3>
              <p className="text-slate-400 text-sm leading-relaxed pr-4">
                Gunakan kursor untuk menggambar batasan bentuk atap Polygon. Mesin spasial akan mengkalkulasi luas m<sup>2</sup> secara otomatis.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative pt-6">
              <div className="hidden md:block absolute top-0 left-0 w-full h-[1px] bg-slate-800"></div>
              <div className="absolute top-0 left-0 w-12 h-[2px] bg-blue-500"></div>
              <span className="text-xs font-bold text-blue-500 tracking-[0.2em] mb-4 block">03</span>
              <h3 className="text-lg font-bold text-white mb-3">Evaluasi Laporan</h3>
              <p className="text-slate-400 text-sm leading-relaxed pr-4">
                Ubah parameter finansial pada panel, tinjau simulasi grafik ROI, dan unduh data geometri GeoJSON beserta laporan manajemen PDF.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. FOOTER - Clean & Informative */}
      <footer className="bg-white border-t border-slate-200 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row justify-between gap-16 lg:gap-8">
          
          <div className="max-w-sm">
            <div className="flex items-center gap-2 font-bold text-xl text-slate-900 mb-4">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 12h3v8h14v-8h3L12 2z"/>
              </svg>
              <span>SolarRoof<span className="text-blue-600">GIS</span></span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Membangun masa depan transisi energi berkelanjutan melalui analitik geospasial presisi.
            </p>
            <p className="text-xs text-slate-400">
              &copy; 2026 SolarRoofGIS Project. All rights reserved.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 text-sm">
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Proyek Akademik</h4>
              <ul className="space-y-3 text-slate-600">
                <li>Teknologi Rekayasa Perangkat Lunak</li>
                <li>Sekolah Vokasi</li>
                <li>IPB University</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Teknologi</h4>
              <ul className="space-y-3 text-slate-600">
                <li>React & Tailwind</li>
                <li>Leaflet & Geoman</li>
                <li>Turf.js Spasial</li>
                <li>PostGIS Backend</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Tim Pengembang</h4>
              <ul className="space-y-3 text-slate-600">
                <li>Alif Al Fitrah</li>
                <li>Muhammad Nuno Sabil</li>
                <li>Muhammad Dhiya Ulhaq</li>
                <li>Rizal Hadi Musthofani</li>
              </ul>
            </div>
          </div>

        </div>
      </footer>
      
    </div>
  );
}