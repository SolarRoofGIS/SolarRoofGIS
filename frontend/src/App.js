import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import SidebarLeft from './components/SidebarLeft';
import SidebarRight from './components/SidebarRight';
import FinancialReportModal from './components/FinancialReportModal';
import MapView from './map/MapView';
import AboutPage from './pages/AboutPage';
import './App.css';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [basemap, setBasemap] = useState('osm');
  const [searchPosition, setSearchPosition] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [simulationData, setSimulationData] = useState(null);
  const [activeTool, setActiveTool] = useState('select');

  return (
    <Router>
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-100">
        <Navbar onSearch={setSearchPosition} />
        
        <Routes>
          {/* HALAMAN UTAMA: MAP */}
          <Route path="/" element={
            <main className="flex-1 relative w-full h-full min-h-0">
              <div className="absolute inset-0 w-full h-full z-0">
                <MapView 
                  activeBasemap={basemap} 
                  searchPosition={searchPosition} 
                  activeTool={activeTool} 
                  onPolygonDrawn={setSelectedBuilding} 
                />
              </div>

              <SidebarLeft 
                activeBasemap={basemap} 
                onBasemapChange={setBasemap} 
                onLocationSelect={setSearchPosition}
                activeTool={activeTool}
                setActiveTool={setActiveTool} 
              />
              
              <SidebarRight 
                buildingData={selectedBuilding} 
                setBuildingData={setSelectedBuilding}
                onShowModal={(data) => {
                  setSimulationData(data);
                  setIsModalOpen(true);
                }} 
              />
            </main>
          } />

          {/* HALAMAN LANDING PAGE */}
          <Route path="/tentang" element={<AboutPage />} />
        </Routes>

        {/* MODAL (Hanya muncul jika isModalOpen true) */}
        {isModalOpen && (
          <FinancialReportModal data={simulationData} onClose={() => setIsModalOpen(false)} />
        )}
      </div>
    </Router>
  );
}

export default App;