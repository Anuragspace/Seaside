import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Hero from './components/Hero';
import RoomPage from './pages/RoomPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Hero />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
    </Routes>
  );
}

export default App;