export default function ActivityLog({ logs, isHiddenMobile }) {
  return (
    <div className={isHiddenMobile ? 'hide-mobile' : ''}>
      <div className="card">
        <h3>Completion Log</h3>
        {logs.length === 0 ? (
          <p className="meta">No activity recorded yet.</p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              style={{ borderBottom: '1px solid #f1f5f9', padding: '8px 0', fontSize: '0.86rem' }}
            >
              <strong>{log.username}</strong> completed <em>{log.task_title}</em>
              <div className="meta">{new Date(log.completed_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
