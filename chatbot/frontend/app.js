// Replace with your API Gateway WebSocket URL after deployment
const WS_URL = 'wss://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod';

const messages = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');

let ws = null;
let currentBubble = null;

function connect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => console.log('WebSocket connected');

  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);

    if (msg.type === 'token') {
      currentBubble.classList.remove('typing');
      currentBubble.querySelector('.bubble').textContent += msg.text;
      scrollToBottom();
    }

    if (msg.type === 'done') {
      currentBubble.classList.remove('typing');
      if (msg.citations?.length) {
        const cite = document.createElement('div');
        cite.className = 'citations';
        cite.innerHTML = 'Sources: ' + msg.citations.map(c => `<span>${fileName(c)}</span>`).join('');
        currentBubble.appendChild(cite);
      }
      setLoading(false);
      currentBubble = null;
    }

    if (msg.type === 'error') {
      currentBubble.querySelector('.bubble').textContent = 'Error: ' + msg.message;
      currentBubble.classList.remove('typing');
      setLoading(false);
      currentBubble = null;
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed — reconnecting in 2s');
    setTimeout(connect, 2000);
  };

  ws.onerror = (err) => console.error('WebSocket error', err);
}

function appendMessage(role, text = '') {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function setLoading(loading) {
  sendBtn.disabled = loading;
  input.disabled = loading;
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function fileName(uri) {
  return uri ? uri.split('/').pop() : 'source';
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

  appendMessage('user', text);
  input.value = '';
  setLoading(true);

  currentBubble = appendMessage('assistant');
  currentBubble.classList.add('typing');

  ws.send(JSON.stringify({ message: text }));
});

connect();
