import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout           from './components/Layout';
import Home             from './pages/Home';
import Player           from './pages/Player';
import History          from './pages/History';
import Favorites        from './pages/Favorites';
import ContinueWatching from './pages/ContinueWatching';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index                    element={<Home />} />
          <Route path="history"           element={<History />} />
          <Route path="favorites"         element={<Favorites />} />
          <Route path="continue-watching" element={<ContinueWatching />} />
          <Route path="watch/:id"         element={<Player />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}