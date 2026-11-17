import { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import AuthForm from './components/AuthForm';
import GroupSidebar from './components/GroupSidebar';
import TaskForm from './components/TaskForm';
import TaskCard from './components/TaskCard';
import ActivityLog from './components/ActivityLog';
import MobileNav from './components/MobileNav';

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const API = `${BASE_URL}/api`;

export default function App() {
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

    const [groups, setGroups] = useState([]);
    const [activeGroup, setActiveGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [comments, setComments] = useState([]);
    const [logs, setLogs] = useState([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [mobileTab, setMobileTab] = useState('tasks');
    const [showCreateForm, setShowCreateForm] = useState(false);

    const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
    };

    const handleAuthSuccess = (data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
    };

    const logout = () => {
        localStorage.clear();
        setToken('');
        setUser(null);
        setActiveGroup(null);
    };

    const fetchGroups = async () => {
        if (!token) return;
        const res = await fetch(`${API}/groups`, { headers: authHeaders });
        if (res.status === 401 || res.status === 403) return logout();
        const data = await res.json();
        setGroups(data);
        if (data.length > 0 && !activeGroup) setActiveGroup(data[0]);
    };

    const fetchWorkspace = async () => {
        if (!activeGroup || !token) return;
        const res = await fetch(`${API}/groups/${activeGroup.id}/workspace`, { headers: authHeaders });
        const data = await res.json();
        setMembers(data.members || []);
        setComments(data.comments || []);
        setLogs(data.logs || []);
        setTasks(
            (data.tasks || []).map((t) => ({
                ...t,
                content: typeof t.content === 'string' ? JSON.parse(t.content) : t.content
            }))
        );
    };

    useEffect(() => {
        fetchGroups();
    }, [token]);

    useEffect(() => {
        if (!activeGroup) return;
        fetchWorkspace();

        const socket = io(BASE_URL);
        socket.emit('join_group', activeGroup.id);
        socket.on('group_updated', () => fetchWorkspace());

        return () => {
            socket.emit('leave_group', activeGroup.id);
            socket.disconnect();
        };
    }, [activeGroup]);

    const createGroup = async (name) => {
        const res = await fetch(`${API}/groups`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ name })
        });
        const group = await res.json();
        await fetchGroups();
        setActiveGroup(group);
        setMobileTab('tasks');
    };

    const joinGroup = async (inviteCode) => {
        const res = await fetch(`${API}/groups/join`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ inviteCode })
        });
        if (!res.ok) return alert('Invalid invite code');
        const group = await res.json();
        await fetchGroups();
        setActiveGroup(group);
        setMobileTab('tasks');
    };

    const createTask = async (taskPayload) => {
        await fetch(`${API}/tasks`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ groupId: activeGroup.id, ...taskPayload })
        });
    };

    const saveTaskEdit = async (taskId, updatedFields) => {
        await fetch(`${API}/tasks/${taskId}`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({ groupId: activeGroup.id, ...updatedFields })
        });
    };

    const toggleChecklistItem = async (task, idx) => {
        const updated = task.content.map((item, i) => (i === idx ? { ...item, done: !item.done } : item));
        await saveTaskEdit(task.id, {
            title: task.title,
            content: updated,
            priority: task.priority,
            category: task.category,
            dueDate: task.due_date,
            assignedTo: task.assigned_to,
            repeatInterval: task.repeat_interval
        });

        if (updated.length > 0 && updated.every((i) => i.done) && !task.is_completed) {
            await toggleTaskComplete(task, true);
        }
    };

    const toggleTaskComplete = async (task, forceState = null) => {
        const nextState = forceState !== null ? forceState : !task.is_completed;
        await fetch(`${API}/tasks/${task.id}/toggle`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ groupId: activeGroup.id, isCompleted: nextState })
        });
    };

    const deleteTask = async (taskId) => {
        await fetch(`${API}/tasks/${taskId}?groupId=${activeGroup.id}`, {
            method: 'DELETE',
            headers: authHeaders
        });
    };

    const addComment = async (taskId, comment) => {
        await fetch(`${API}/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ groupId: activeGroup.id, comment })
        });
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => {
            if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            if (statusFilter === 'active' && t.is_completed) return false;
            if (statusFilter === 'completed' && !t.is_completed) return false;
            if (statusFilter === 'mine' && t.assigned_to !== user?.id) return false;
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
            return true;
        });
    }, [tasks, searchQuery, statusFilter, priorityFilter, user]);

    if (!user) {
        return <AuthForm apiUrl={API} onAuthSuccess={handleAuthSuccess} />;
    }

    return (
        <div className="container">
            <div className="header">
                <div className="row">
                    <div className="avatar" style={{ background: user.avatar_color }}>
                        {user.username[0].toUpperCase()}
                    </div>
                    <div>
                        <strong>{user.username}</strong>
                        <div className="meta">
                            {activeGroup ? `Workspace: ${activeGroup.name}` : 'Select a group'}
                        </div>
                    </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={logout}>
                    Logout
                </button>
            </div>

            <div className="grid">
                <GroupSidebar
                    groups={groups}
                    activeGroup={activeGroup}
                    members={members}
                    onSelectGroup={(g) => {
                        setActiveGroup(g);
                        setMobileTab('tasks');
                    }}
                    onCreateGroup={createGroup}
                    onJoinGroup={joinGroup}
                    isHiddenMobile={mobileTab !== 'groups'}
                />

                <div className={mobileTab !== 'tasks' ? 'hide-mobile' : ''}>
                    {!activeGroup ? (
                        <div className="card">Create or join a group to start collaborating.</div>
                    ) : (
                        <>
                            <div className="card">
                                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                                    <h3 style={{ margin: 0 }}>{activeGroup.name} Tasks</h3>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => setShowCreateForm(!showCreateForm)}
                                    >
                                        {showCreateForm ? 'Close Form' : '+ New Task'}
                                    </button>
                                </div>

                                {showCreateForm && (
                                    <TaskForm
                                        members={members}
                                        onCreateTask={createTask}
                                        onClose={() => setShowCreateForm(false)}
                                    />
                                )}

                                <input
                                    placeholder="Search tasks..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ marginTop: 8 }}
                                />
                                <div className="row">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="active">Active Only</option>
                                        <option value="completed">Completed</option>
                                        <option value="mine">Assigned to Me</option>
                                    </select>
                                    <select
                                        value={priorityFilter}
                                        onChange={(e) => setPriorityFilter(e.target.value)}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <option value="all">All Priorities</option>
                                        <option value="urgent">Urgent</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                            </div>

                            {filteredTasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    members={members}
                                    comments={comments.filter((c) => c.task_id === task.id)}
                                    onToggleComplete={toggleTaskComplete}
                                    onToggleChecklistItem={toggleChecklistItem}
                                    onSaveEdit={saveTaskEdit}
                                    onDelete={deleteTask}
                                    onAddComment={addComment}
                                />
                            ))}
                        </>
                    )}
                </div>

                <ActivityLog logs={logs} isHiddenMobile={mobileTab !== 'logs'} />
            </div>
        </div>
    );
}
