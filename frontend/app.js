const API = 'https://YOUR_API_GATEWAY_ID.execute-api.YOUR_REGION.amazonaws.com/prod/todos';

let allTodos = [];
let currentFilter = 'all';

async function loadTodos() {
    const res = await fetch(API);
    allTodos = await res.json();
    renderTodos();
}

function renderTodos() {
    const list = document.getElementById('todos-list');
    const filtered = currentFilter === 'all' ? allTodos : allTodos.filter(t => t.status === currentFilter);

    if (!filtered.length) {
        list.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No todos found.</p>';
        return;
    }

    list.innerHTML = filtered.map(todo => `
        <div class="list-item ${todo.status === 'done' ? 'done' : ''}">
            <div>
                <h3>${todo.name}</h3>
                <p>Due: ${todo.date || 'No date'}</p>
            </div>
            <div class="item-actions">
                <span class="badge badge-${todo.status}">${todo.status}</span>
                <button class="btn-edit" onclick="editTodo('${todo.id}')">Edit</button>
                ${todo.status === 'pending'
                    ? `<button class="btn-primary" style="padding:8px 16px;font-size:12px;" onclick="markDone('${todo.id}')">✓ Done</button>`
                    : ''}
                <button class="btn-delete" onclick="deleteTodo('${todo.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function filterTodos(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderTodos();
}

function showForm() {
    document.getElementById('form-title').textContent = 'Add Todo';
    document.getElementById('todo-id').value = '';
    document.getElementById('todo-name').value = '';
    document.getElementById('todo-date').value = '';
    document.getElementById('todo-form').classList.remove('hidden');
}

function hideForm() {
    document.getElementById('todo-form').classList.add('hidden');
}

function editTodo(id) {
    const todo = allTodos.find(t => t.id === id);
    if (!todo) return;
    document.getElementById('form-title').textContent = 'Edit Todo';
    document.getElementById('todo-id').value = todo.id;
    document.getElementById('todo-name').value = todo.name;
    document.getElementById('todo-date').value = todo.date || '';
    document.getElementById('todo-form').classList.remove('hidden');
}

async function saveTodo() {
    const id = document.getElementById('todo-id').value;
    const name = document.getElementById('todo-name').value.trim();
    const date = document.getElementById('todo-date').value;
    if (!name) return alert('Name is required');

    if (id) {
        await fetch(`${API}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date })
        });
    } else {
        await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date, status: 'pending' })
        });
    }

    hideForm();
    loadTodos();
}

async function markDone(id) {
    await fetch(`${API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' })
    });
    loadTodos();
}

async function deleteTodo(id) {
    if (!confirm('Delete this todo?')) return;
    await fetch(`${API}/${id}`, { method: 'DELETE' });
    loadTodos();
}

loadTodos();
