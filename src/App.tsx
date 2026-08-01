import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardPage } from './pages/Dashboard';
import { EditorPage } from './pages/Editor';
import { MagicPage } from './pages/Magic';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/magic" element={<MagicPage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
