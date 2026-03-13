const API_KEY = process.env.CLICKUP_API_KEY;
const BASE = 'https://api.clickup.com/api/v2';

const headers = {
  'Authorization': API_KEY,
  'Content-Type': 'application/json',
};

async function getTask(task_id) {
  const res = await fetch(`${BASE}/task/${task_id}`, { headers });
  if (!res.ok) throw new Error(`ClickUp getTask failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function postComment(task_id, comment_text) {
  const res = await fetch(`${BASE}/task/${task_id}/comment`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ comment_text }),
  });
  if (!res.ok) throw new Error(`ClickUp postComment failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function updateStatus(task_id, status) {
  const res = await fetch(`${BASE}/task/${task_id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`ClickUp updateStatus failed: ${res.status} ${await res.text()}`);
  return res.json();
}

module.exports = { getTask, postComment, updateStatus };
