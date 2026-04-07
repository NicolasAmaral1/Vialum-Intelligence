const fs   = require('fs');
const path = require('path');

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

async function uploadAttachment(task_id, filePath) {
  const filename = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('attachment', new Blob([fileBuffer]), filename);

  const res = await fetch(`${BASE}/task/${task_id}/attachment`, {
    method: 'POST',
    headers: { 'Authorization': API_KEY },
    body: formData,
  });
  if (!res.ok) throw new Error(`ClickUp uploadAttachment failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  console.log(`📎 Anexado no ClickUp: ${filename}`);
  return data;
}

module.exports = { getTask, postComment, updateStatus, uploadAttachment };
