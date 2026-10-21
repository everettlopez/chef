import { NavLink, Outlet } from 'react-router'

export function AppLayout() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Virtual Pantry</span>
        <nav>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/pantry">Pantry</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
