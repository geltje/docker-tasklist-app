export default function MobileNav({ activeTab, onChangeTab }) {
  return (
    <div className="mobile-nav">
      <button
        className={activeTab === 'groups' ? 'active' : ''}
        onClick={() => onChangeTab('groups')}
      >
        Groups
      </button>
      <button
        className={activeTab === 'tasks' ? 'active' : ''}
        onClick={() => onChangeTab('tasks')}
      >
        Tasks
      </button>
      <button
        className={activeTab === 'logs' ? 'active' : ''}
        onClick={() => onChangeTab('logs')}
      >
        History
      </button>
    </div>
  );
}
