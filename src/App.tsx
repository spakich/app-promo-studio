import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardPage } from './pages/Dashboard';
import { EditorPage } from './pages/Editor';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
