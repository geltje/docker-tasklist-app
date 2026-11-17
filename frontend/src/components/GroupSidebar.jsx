import { useState } from 'react';

export default function GroupSidebar({
  groups,
  activeGroup,
  members,
  onSelectGroup,
  onCreateGroup,
  onJoinGroup,
  isHiddenMobile
}) {
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await onCreateGroup(newGroupName);
    setNewGroupName('');
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    await onJoinGroup(inviteCodeInput);
    setInviteCodeInput('');
  };

  return (
    <div className={isHiddenMobile ? 'hide-mobile' : ''}>
      <div className="card">
        <h3>Groups</h3>
        {groups.map((g) => (
          <div
            key={g.id}
            className={`group-item ${activeGroup?.id === g.id ? 'active' : ''}`}
            onClick={() => onSelectGroup(g)}
          >
            <span>{g.name}</span>
            <span className="badge tag">#{g.invite_code}</span>
          </div>
        ))}
        <hr style={{ borderColor: '#f1f5f9', margin: '14px 0' }} />
        <form onSubmit={handleCreate}>
          <input
            placeholder="New group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <button className="btn btn-sm" style={{ width: '100%' }}>
            Create Group
          </button>
        </form>
        <form onSubmit={handleJoin} style={{ marginTop: 10 }}>
          <input
            placeholder="Invite code"
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
          />
          <button className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
            Join via Code
          </button>
        </form>
      </div>

      {activeGroup && (
        <div className="card">
          <h3>Members & Stats</h3>
          {members.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="row">
                <div className="avatar" style={{ background: m.avatar_color }}>
                  {m.username[0].toUpperCase()}
                </div>
                <span>{m.username}</span>
              </div>
              <span className="badge repeat-badge">{m.completed_count} done</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
