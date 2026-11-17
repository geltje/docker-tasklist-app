import { useState } from 'react';

export default function TaskCard({
  task,
  members,
  comments,
  onToggleComplete,
  onToggleChecklistItem,
  onSaveEdit,
  onDelete,
  onAddComment
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const isOverdue = task.due_date && !task.is_completed && new Date(task.due_date) < new Date();
  const doneCount = task.type === 'checklist' ? task.content.filter((i) => i.done).length : 0;

  const startEdit = () => {
    setEditData({
      title: task.title,
      content: task.type === 'note' ? task.content.text : [...task.content],
      priority: task.priority,
      category: task.category,
      dueDate: task.due_date ? task.due_date.slice(0, 16) : '',
      assignedTo: task.assigned_to || '',
      repeatInterval: task.repeat_interval
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    const formattedContent = task.type === 'note' ? { text: editData.content } : editData.content;
    await onSaveEdit(task.id, { ...editData, content: formattedContent });
    setIsEditing(false);
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await onAddComment(task.id, commentText.trim());
    setCommentText('');
  };

  return (
    <div className={`card task-card ${task.is_completed ? 'completed' : ''}`}>
      {isEditing ? (
        <div>
          <input
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
          />
          <div className="row">
            <select
              value={editData.priority}
              onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              value={editData.assignedTo}
              onChange={(e) => setEditData({ ...editData, assignedTo: e.target.value })}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.username}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <input
              value={editData.category}
              onChange={(e) => setEditData({ ...editData, category: e.target.value })}
            />
            <input
              type="datetime-local"
              value={editData.dueDate}
              onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
            />
          </div>
          {task.type === 'note' ? (
            <textarea
              rows="3"
              value={editData.content}
              onChange={(e) => setEditData({ ...editData, content: e.target.value })}
            />
          ) : (
            <div>
              {editData.content.map((item, i) => (
                <input
                  key={i}
                  value={item.text}
                  onChange={(e) => {
                    const copy = [...editData.content];
                    copy[i] = { ...copy[i], text: e.target.value };
                    setEditData({ ...editData, content: copy });
                  }}
                />
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setEditData({
                    ...editData,
                    content: [...editData.content, { text: '', done: false }]
                  })
                }
              >
                + Add Item
              </button>
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-sm" onClick={handleSave}>
              Save
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="row" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
            <span className={`badge prio-${task.priority}`}>{task.priority}</span>
            <span className="badge tag">{task.category}</span>
            {task.repeat_interval !== 'none' && (
              <span className="badge repeat-badge">Repeats {task.repeat_interval}</span>
            )}
            {task.assigned_to_name && <span className="badge">@{task.assigned_to_name}</span>}
          </div>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h4 style={{ margin: 0, textDecoration: task.is_completed ? 'line-through' : 'none' }}>
              {task.title}
            </h4>
            <div className="row">
              <button className="btn btn-sm" onClick={() => onToggleComplete(task)}>
                {task.is_completed ? 'Reopen' : 'Done'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={startEdit}>
                Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(task.id)}>
                ×
              </button>
            </div>
          </div>

          {task.due_date && (
            <div className={`meta ${isOverdue ? 'overdue' : ''}`} style={{ marginTop: 4 }}>
              Due: {new Date(task.due_date).toLocaleString()} {isOverdue && '(OVERDUE)'}
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            {task.type === 'note' ? (
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{task.content.text}</p>
            ) : (
              <div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(doneCount / (task.content.length || 1)) * 100}%` }}
                  />
                </div>
                {task.content.map((item, idx) => (
                  <div key={idx} className="checklist-row">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => onToggleChecklistItem(task, idx)}
                    />
                    <span style={{ textDecoration: item.done ? 'line-through' : 'none' }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {task.is_completed && (
            <div className="meta" style={{ marginTop: 10 }}>
              Completed by <strong>{task.completed_by_name}</strong> on{' '}
              {new Date(task.completed_at).toLocaleString()}
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowComments(!showComments)}
            >
              Comments ({comments.length})
            </button>

            {showComments && (
              <div className="comment-box">
                {comments.map((c) => (
                  <div key={c.id} className="comment-item">
                    <strong>{c.username}:</strong> {c.comment}
                  </div>
                ))}
                <form className="row" style={{ marginTop: 8 }} onSubmit={handleCommentSubmit}>
                  <input
                    style={{ marginBottom: 0 }}
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button className="btn btn-sm">Send</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
