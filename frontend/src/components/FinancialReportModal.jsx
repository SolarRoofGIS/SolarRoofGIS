
import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function FinancialReportModal({ data, onClose }) {
  // Referensi elemen modal untuk di-convert ke PDF
  const modalRef = useRef(null);

  if (!data) return null;

  const { luasArea, potensiDaya, raw, polygonGeoJSON } = data;

  const tagihanStr = Math.round(raw.tagihan).toLocaleString('id-ID');
  const investasiStr = Math.round(raw.investasi).toLocaleString('id-ID');
  const penghematanStr = Math.round(raw.penghematanBln).toLocaleString('id-ID');
  const bepStr = raw.payback.toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const karbonStr = raw.reduksiKarbon.toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  const biayaPanel = Math.round(raw.investasi * 0.85).toLocaleString('id-ID');
  const biayaBos = Math.round(raw.investasi * 0.15).toLocaleString('id-ID');

  // --- 1. FUNGSI DOWNLOAD GEOJSON ---
  const handleExportGeoJSON = () => {
    // Pastikan polygon asli tersedia
    if (
      !polygonGeoJSON ||
      !polygonGeoJSON.geometry ||
      !polygonGeoJSON.geometry.coordinates
    ) {
      alert(
        "Polygon area tidak tersedia. Silakan gambar atau pilih area terlebih dahulu."
      );
      return;
    }

    // Siapkan geometri asli dan atribut hasil analisis
    const exportData = {
      type: "Feature",
      properties: {
        luas_area_m2: Number(luasArea),
        potensi_daya_kwp: Number(potensiDaya),
        estimasi_investasi_rp: raw.investasi,
        tagihan_bulanan_rp: raw.tagihan,
        estimasi_penghematan_bulanan_rp: raw.penghematanBln,
        payback_period_tahun: raw.payback,
        reduksi_emisi_ton_co2_per_tahun: raw.reduksiKarbon
      },
      geometry: polygonGeoJSON.geometry
    };

    const blob = new Blob(
      [JSON.stringify(exportData, null, 2)],
      { type: "application/geo+json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `SolarRoofGIS-Area-${Math.round(parseFloat(luasArea))}m2.geojson`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Bersihkan URL sementara setelah proses download dimulai
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // --- 2. FUNGSI DOWNLOAD PDF REPORT ---
const handleDownloadPDF = async () => {
    const element = modalRef.current;
    if (!element) return;

    const actionButtons = element.querySelector('.modal-actions');
    const originalDisplay = actionButtons ? actionButtons.style.display : '';
    
    // Simpan style asli
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalMaxHeight = element.style.maxHeight;

    try {
      if (actionButtons) actionButtons.style.display = 'none';
      
      // Paksa ukuran elemen merenggang sebelum difoto agar text tidak terjepit
      element.style.width = '1100px';
      element.style.maxWidth = 'none';
      element.style.maxHeight = 'none';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        windowWidth: 1200 // Paksa simulasi lebar layar
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
      pdf.save(`Laporan-Finansial-SolarRoofGIS-${Math.round(parseFloat(luasArea))}m2.pdf`);
    } catch (error) {
      console.error("Gagal mendownload PDF:", error);
      alert("Terjadi kesalahan saat mencetak PDF.");
    } finally {
      // Kembalikan style dan tombol seperti semula
      if (actionButtons) actionButtons.style.display = originalDisplay;
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.maxHeight = originalMaxHeight;
    }
  };

  // --- LOGIKA DATA GRAFIK CHART.JS ---
  const tahunLabels = [];
  const dataTanpaPLTS = [];
  const dataDenganPLTS = [];

  const tagihanTahunan = raw.tagihan * 12;
  const penghematanTahunan = raw.penghematanBln * 12;
  const tagihanSisaDenganPLTS = tagihanTahunan - penghematanTahunan;

  for (let i = 0; i <= 25; i++) {
    tahunLabels.push(`Tahun ${i}`);
    dataTanpaPLTS.push(tagihanTahunan * i);
    dataDenganPLTS.push(raw.investasi + (tagihanSisaDenganPLTS * i));
  }

  const chartData = {
    labels: tahunLabels,
    datasets: [
      {
        label: 'Tanpa PLTS',
        data: dataTanpaPLTS,
        borderColor: '#9ca3af',
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      },
      {
        label: 'Dengan PLTS',
        data: dataDenganPLTS,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += 'Rp ' + Math.round(context.parsed.y).toLocaleString('id-ID');
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 6, font: { size: 10 } }
      },
      y: {
        border: { display: false },
        grid: { color: '#f3f4f6' },
        ticks: {
          font: { size: 10 },
          callback: function(value) {
            if (value === 0) return 'Rp 0';
            return 'Rp ' + (value / 1000000).toLocaleString('id-ID') + ' Jt';
          }
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
      >

        {/* HEADER */}
        <div className="p-6 pb-5 relative border-b border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-1.5">
            Laporan Simulasi Finansial & ROI
          </h2>

          <p className="text-sm text-gray-600 font-medium flex items-center gap-2">
            <span>
              Atap Terpilih: <span className="font-bold text-gray-800">{luasArea} m²</span>
            </span>
            <span className="text-gray-300">•</span>
            <span>
              Kapasitas: <span className="font-bold text-gray-800">{potensiDaya} kWp</span>
            </span>
            <span className="text-gray-300">•</span>
            <span>
              Tagihan PLN: <span className="font-bold text-gray-800">Rp {tagihanStr}/bulan</span>
            </span>
          </p>
        </div>

{/* 4 CARD RINGKASAN */}
        <div className="px-6 pt-5 grid grid-cols-4 gap-5 flex-shrink-0">
          <div className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white">
            <p className="text-[10px] text-gray-500 font-bold mb-1.5 uppercase tracking-wide">
              Estimasi Biaya Awal
            </p>
            {/* Hapus truncate, ganti dengan leading-normal */}
            <p className="text-xl font-extrabold text-gray-900 leading-normal">
              Rp {investasiStr}
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white">
            <p className="text-[10px] text-gray-500 font-bold mb-1.5 uppercase tracking-wide">
              Est. Penghematan/Bln
            </p>
            <p className="text-xl font-extrabold text-green-600 leading-normal">
              Rp {penghematanStr}
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white">
            <p className="text-[10px] text-gray-500 font-bold mb-1.5 uppercase tracking-wide">
              Titik Impas (BEP)
            </p>
            <p className="text-xl font-extrabold text-gray-900 leading-normal">
              {bepStr} <span className="text-sm font-semibold text-gray-500">Tahun</span>
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 shadow-sm bg-green-50/50">
            <p className="text-[10px] text-green-700 font-bold mb-1.5 uppercase tracking-wide">
              Reduksi Emisi Karbon
            </p>
            <p className="text-xl font-extrabold text-green-600 flex items-baseline gap-1.5 leading-normal">
              <svg className="w-5 h-5 self-center" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
              {karbonStr}
              <span className="text-sm font-semibold text-green-700/70">Ton CO₂/thn</span>
            </p>
          </div>
        </div>

        {/* CHART & RINCIAN DETAIL */}
        <div className="px-6 py-6 grid grid-cols-2 gap-6 flex-1 bg-white min-h-0">
          <div className="border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col relative overflow-hidden h-full">
            <div className="flex justify-between items-start mb-4 flex-shrink-0">
              <h3 className="font-bold text-gray-900 text-sm">
                Proyeksi Kumulatif Biaya Listrik
              </h3>

              <div className="flex flex-col gap-1.5 text-[10px] text-gray-500 font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-gray-400"></div>
                  Tanpa PLTS
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-blue-600"></div>
                  Dengan PLTS
                </div>
              </div>
            </div>

            <div className="flex-1 w-full min-h-0 relative">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col justify-between h-full">
            <div>
              <h3 className="font-bold text-gray-900 text-sm mb-4">
                Rincian Komponen & Garansi
              </h3>

              <div className="flex flex-col gap-3.5 text-sm">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                  <span className="flex items-center gap-2.5 text-gray-600">
                    <span className="text-yellow-500">☀️</span>
                    Modul Panel & Inverter
                  </span>
                  <span className="font-semibold text-gray-900">Rp {biayaPanel}</span>
                </div>

                <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                  <span className="flex items-center gap-2.5 text-gray-600">
                    <span className="text-blue-500">🔧</span>
                    BOS & Biaya Instalasi
                  </span>
                  <span className="font-semibold text-gray-900">Rp {biayaBos}</span>
                </div>

                <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                  <span className="flex items-center gap-2.5 text-gray-600">
                    <span className="text-green-500">🛡️</span>
                    Garansi Performa Panel
                  </span>
                  <span className="font-semibold text-gray-900">25 Tahun</span>
                </div>

                <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                  <span className="flex items-center gap-2.5 text-gray-600">
                    <span className="text-blue-400">⚡</span>
                    Garansi Inverter
                  </span>
                  <span className="font-semibold text-gray-900">10 Tahun</span>
                </div>
              </div>
            </div>

            <div className="mt-5 bg-blue-50 p-4 rounded-xl flex justify-between items-center border border-blue-100/50">
              <span className="font-bold text-blue-900 text-sm">
                Total Estimasi Biaya (CAPEX)
              </span>
              <span className="font-extrabold text-blue-700 text-xl">
                Rp {investasiStr}
              </span>
            </div>
          </div>
        </div>

        {/* TOMBOL BAWAH */}
        <div className="modal-actions px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-2xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-100 transition shadow-sm"
          >
            &lt; Ubah Parameter
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleExportGeoJSON}
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-800 font-bold rounded-lg text-sm hover:bg-gray-100 transition shadow-sm"
            >
              Export GeoJSON
            </button>

            <button
              onClick={handleDownloadPDF}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg text-sm hover:bg-blue-700 transition shadow-md"
            >
              Download PDF Report
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
