import { useState } from 'react';

export default function TaskForm({ members, onCreateTask, onClose }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('note');
  const [noteText, setNoteText] = useState('');
  const [checklistItems, setChecklistItems] = useState(['']);
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('General');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [repeatInterval, setRepeatInterval] = useState('none');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const content =
      type === 'note'
        ? { text: noteText }
        : checklistItems.filter((i) => i.trim()).map((text) => ({ text, done: false }));

    await onCreateTask({
      title,
      type,
      content,
      priority,
      category,
      dueDate: dueDate || null,
      assignedTo: assignedTo || null,
      repeatInterval
    });

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
      <input
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="row">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="note">Free-form Note</option>
          <option value="checklist">Checklist</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div className="row">
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              Assign: {m.username}
            </option>
          ))}
        </select>
        <select value={repeatInterval} onChange={(e) => setRepeatInterval(e.target.value)}>
          <option value="none">No Repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div className="row">
        <input
          placeholder="Category (e.g. Groceries, Chores)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      {type === 'note' ? (
        <textarea
          rows="3"
          placeholder="Write note details..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />
      ) : (
        <div>
          {checklistItems.map((item, idx) => (
            <input
              key={idx}
              placeholder={`Step ${idx + 1}`}
              value={item}
              onChange={(e) => {
                const copy = [...checklistItems];
                copy[idx] = e.target.value;
                setChecklistItems(copy);
              }}
            />
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginBottom: 10 }}
            onClick={() => setChecklistItems([...checklistItems, ''])}
          >
            + Add Checklist Item
          </button>
        </div>
      )}
      <button className="btn" style={{ width: '100%' }}>
        Save Task
      </button>
    </form>
  );
}
