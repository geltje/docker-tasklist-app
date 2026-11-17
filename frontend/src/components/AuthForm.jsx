import { useState } from 'react';

export default function AuthForm({ apiUrl, onAuthSuccess }) {
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? '/login' : '/register';
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Authentication failed');
    onAuthSuccess(data);
  };

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: 70 }}>
      <div className="card">
        <h2>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit}>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="btn" style={{ width: '100%' }}>
            {authMode === 'login' ? 'Sign In' : 'Register'}
          </button>
        </form>
        <p className="meta" style={{ textAlign: 'center', marginTop: 14 }}>
          {authMode === 'login' ? "Don't have an account? " : 'Already registered? '}
          <a
            href="#switch"
            onClick={(e) => {
              e.preventDefault();
              setAuthMode(authMode === 'login' ? 'register' : 'login');
            }}
          >
            {authMode === 'login' ? 'Sign Up' : 'Log In'}
          </a>
        </p>
      </div>
    </div>
  );
}
