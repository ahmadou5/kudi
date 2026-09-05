import React from 'react';

export const AdminHeader: React.FC = () => {
  return (
    <header style={{
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      padding: '16px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(9, 10, 15, 0.8)',
      backdropFilter: 'blur(12px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: '#fff'
        }}>
          K
        </div>
        <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>Kudi Ops & Admin</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{
          fontSize: '12px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: 'rgba(139, 92, 246, 0.2)',
          color: '#a78bfa',
          border: '1px solid rgba(139, 92, 246, 0.3)'
        }}>
          Track A: Self-Custody Active
        </span>
        <span style={{
          fontSize: '12px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: 'rgba(16, 185, 129, 0.2)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        }}>
          Monad Metropolis Hackathon
        </span>
      </div>
    </header>
  );
};
