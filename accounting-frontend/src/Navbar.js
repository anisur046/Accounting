import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function Navbar({ onLogout }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-brand">Accounting App</div>
      <button className="navbar-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
        <span className="navbar-hamburger"></span>
        <span className="navbar-hamburger"></span>
        <span className="navbar-hamburger"></span>
      </button>
      <ul className={`navbar-links${open ? ' open' : ''}`} onClick={() => setOpen(false)}>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/customers">Customers</Link></li>
        <li><Link to="/transactions">Transactions</Link></li>
        <li><Link to="/reports">Reports</Link></li>
        <li><button onClick={onLogout} className="logout-btn">Logout</button></li>
      </ul>
      <style>{`
        .navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #2d3e50;
          color: #fff;
          padding: 12px 24px;
          position: relative;
        }
        .navbar-brand {
          font-weight: bold;
          font-size: 1.2rem;
        }
        .navbar-toggle {
          display: none;
          flex-direction: column;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
        }
        .navbar-hamburger {
          width: 24px;
          height: 3px;
          background: #fff;
          border-radius: 2px;
        }
        .navbar-links {
          display: flex;
          gap: 24px;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .navbar-links li a {
          color: #fff;
          text-decoration: none;
          font-size: 1rem;
          transition: color 0.2s;
        }
        .navbar-links li a:hover {
          color: #ffd700;
        }
        .logout-btn {
          background: #e74c3c;
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          margin-left: 10px;
          font-size: 1rem;
        }
        .logout-btn:hover {
          background: #c0392b;
        }
        @media (max-width: 700px) {
          .navbar-toggle {
            display: flex;
          }
          .navbar-links {
            position: absolute;
            top: 56px;
            left: 0;
            right: 0;
            background: #2d3e50;
            flex-direction: column;
            gap: 0;
            display: none;
            z-index: 10;
          }
          .navbar-links.open {
            display: flex;
          }
          .navbar-links li {
            border-bottom: 1px solid #3a4a5d;
            padding: 12px 0;
            text-align: center;
          }
        }
      `}</style>
    </nav>
  );
}

export default Navbar;
