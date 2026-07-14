let _config = null;
const localKey = 'bathroom_board_posts';

async function loadConfig() {
  if (_config) return _config;
  let api = {}, file = {};
  try { const r = await fetch('/api/config'); if (r.ok) api = await r.json(); } catch(e) {}
  try { const r = await fetch('config/git_config.json'); if (r.ok) file = await r.json(); } catch(e) {}
  const apiTok = String(api.github_token || '').trim();
  const fileTok = String(file.github_token || '').trim();
  _config = {
    github_token: (apiTok && apiTok !== 'YOUR_GITHUB_TOKEN') ? apiTok : fileTok,
    github_owner: file.github_owner || '',
    github_repo: file.github_repo || '',
    data_file_path: file.data_file_path || 'data/posts.json',
    admin_password: api.admin_password || file.admin_password || 'admin1234'
  };
  return _config;
}

function isAdmin() { return sessionStorage.getItem('isAdmin') === 'true'; }
function requireAdmin() { if (!isAdmin()) { location.href = 'admin.html'; return false; } return true; }
function handleAgentLogin(event) { if (event) event.preventDefault(); location.href = 'admin.html'; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function inlineMarkdown(value) {
  let out = escapeHtml(value);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/~~([^~]+)~~/g, '<del>$1</del>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return out;
}

function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let html = '', paragraph = [], list = null, code = false, codeLines = [];
  const flushParagraph = () => { if (paragraph.length) { html += `<p>${inlineMarkdown(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`; paragraph = []; } };
  const flushList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of lines) {
    if (line.trim().startsWith('```')) { if (code) { html += `<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`; codeLines = []; code = false; } else { flushParagraph(); flushList(); code = true; } continue; }
    if (code) { codeLines.push(line); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); const level = heading[1].length; html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`; continue; }
    if (/^\s*---\s*$/.test(line)) { flushParagraph(); flushList(); html += '<hr>'; continue; }
    if (/^>\s?/.test(line)) { flushParagraph(); flushList(); html += `<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`; continue; }
    const unordered = line.match(/^\s*[-*]\s+(.+)$/), ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) { flushParagraph(); const tag = unordered ? 'ul' : 'ol'; if (list !== tag) { flushList(); html += `<${tag}>`; list = tag; } html += `<li>${inlineMarkdown((unordered || ordered)[1])}</li>`; continue; }
    flushList(); paragraph.push(line);
  }
  if (code) html += `<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`;
  flushParagraph(); flushList(); return html;
}

function markdownToText(src) { return String(src || '').replace(/```[\s\S]*?```/g, '').replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*]\s+/gm, '').replace(/^\s*\d+\.\s+/gm, '').replace(/^>\s?/gm, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[\*_~`]/g, '').replace(/\s+/g, ' ').trim(); }

function readLocalPosts() { try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch { return []; } }
async function getPosts() {
  try { const r = await fetch('data/posts.json', { cache: 'no-store' }); if (r.ok) { const posts = await r.json(); if (Array.isArray(posts)) return posts.sort((a,b) => String(b.date).localeCompare(String(a.date))); } } catch(e) {}
  return readLocalPosts().sort((a,b) => String(b.date).localeCompare(String(a.date)));
}
function saveLocalPosts(posts) { localStorage.setItem(localKey, JSON.stringify(posts)); }
async function githubRequest(posts) {
  const cfg = await loadConfig(); const token = String(cfg.github_token || '').replace(/\s+/g, '');
  if (!token || token === 'YOUR_GITHUB_TOKEN' || !cfg.github_owner || !cfg.github_repo) throw new Error('GitHub 설정이 완료되지 않았습니다.');
  const url = `https://api.github.com/repos/${encodeURIComponent(cfg.github_owner)}/${encodeURIComponent(cfg.github_repo)}/contents/${cfg.data_file_path}`;
  const headers = { Accept: 'application/vnd.github+json', Authorization: `token ${token}`, 'Content-Type': 'application/json' };
  const current = await fetch(url, { headers }); let sha = ''; if (current.ok) sha = (await current.json()).sha;
  const body = { message: `chore: update posts ${new Date().toISOString()}`, content: btoa(unescape(encodeURIComponent(JSON.stringify(posts, null, 2) + '\n'))) }; if (sha) body.sha = sha;
  const response = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) }); if (!response.ok) throw new Error(`저장 실패: ${await response.text()}`);
}
async function persistPosts(posts) { saveLocalPosts(posts); await githubRequest(posts); return posts; }
async function createPost(post) { const posts = await getPosts(); const created = { ...post, id: crypto.randomUUID(), date: post.date || new Date().toISOString().slice(0,10) }; await persistPosts([created, ...posts]); return created; }
async function updatePost(id, patch) { const posts = await getPosts(); const next = posts.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p); await persistPosts(next); return next.find(p => p.id === id); }
async function deletePost(id) { const posts = await getPosts(); await persistPosts(posts.filter(p => p.id !== id)); }

Object.assign(window, { loadConfig, isAdmin, requireAdmin, handleAgentLogin, escapeHtml, renderMarkdown, markdownToText, getPosts, createPost, updatePost, deletePost });
