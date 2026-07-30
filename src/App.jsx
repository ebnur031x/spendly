import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import BudgetSettings from './pages/BudgetSettings'
import DailyDeepDive from './pages/DailyDeepDive'
import DailySpend from './pages/DailySpend'
import BucketDetail from './pages/BucketDetail'
import GroceriesDeepDive from './pages/GroceriesDeepDive'
import Commitments from './pages/Commitments'
import AllTransactions from './pages/AllTransactions'
import Savings from './pages/Savings'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'

// Shared shell for signed-in screens: top nav + page + bottom nav.
// Navbar carries the theme toggle on desktop. Mobile's toggle lives inline
// in Dashboard's own header instead of floating globally here — every page
// has a different top-right layout (search icon, back-link, nothing), so a
// single fixed-position overlay would collide with whatever a given page
// already puts there (it did, with Dashboard's search button). Dashboard is
// one BottomNav tap away from anywhere, so this stays reliably collision-free.
function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Navbar />
      {children}
      <BottomNav />
    </ProtectedRoute>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/budget-settings" element={<Protected><BudgetSettings /></Protected>} />
          <Route path="/budget-settings/daily-deep-dive" element={<Protected><DailyDeepDive /></Protected>} />
          <Route path="/daily" element={<Protected><DailySpend /></Protected>} />
          <Route path="/groceries" element={<Protected><BucketDetail bucketKey="groceries" /></Protected>} />
          <Route path="/groceries/deep-dive" element={<Protected><GroceriesDeepDive /></Protected>} />
          <Route path="/bills" element={<Protected><BucketDetail bucketKey="bills" /></Protected>} />
          <Route path="/commitments" element={<Protected><Commitments /></Protected>} />
          <Route path="/transactions" element={<Protected><AllTransactions /></Protected>} />
          <Route path="/savings" element={<Protected><Savings /></Protected>} />

          {/* Back-compat: the old Expenses route is now Daily Spend */}
          <Route path="/expenses" element={<Navigate to="/daily" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
