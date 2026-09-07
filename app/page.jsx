'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import VideoStudioClient from './components/VideoStudioClient';

// Defensive Supabase init (only create client if public envs present)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing — Supabase disabled on client.');
}

export default function SocialDashboard() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [publishingId, setPublishingId] = useState(null);

  // Schedule modal state
  const [showSchedule, setShowSchedule] = useState(false);
  const [pendingBlob, setPendingBlob] = useState(null);
  const [platformsSelected, setPlatformsSelected] = useState([]);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
  });
  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [saving, setSaving] = useState(false);

  const AVAILABLE_PLATFORMS = ['YouTube', 'TikTok', 'Instagram', 'X'];

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPosts() {
    setLoading(true);
    if (!supabase) {
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.from('scheduled_posts').select('*').order('scheduled_for', { ascending: true });
      if (error) {
        console.error('Error loading posts:', error);
        setPosts([]);
      } else {
        setPosts(data || []);
      }
    } catch (err) {
      console.error('Unexpected fetchPosts error:', err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  async function triggerImmediatePublish(postId) {
    setPublishingId(postId);
    try {
      const res = await fetch('/api/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      });

      if (res.ok) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'PUBLISHED' } : p));
      } else {
        const body = await res.json().catch(() => null);
        console.error('Publish-now failed', res.status, body);
        alert('Publishing failed. Check server logs.');
      }
    } catch (err) {
      console.error('triggerImmediatePublish error', err);
      alert('Error triggering publish.');
    } finally {
      setPublishingId(null);
    }
  }

  // Called by VideoStudioClient when recording finishes
  function handleRecordingComplete(blob) {
    setPendingBlob(blob);
    setShowSchedule(true);
  }

  function togglePlatform(p) {
    setPlatformsSelected(prev => (prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]));
  }

  function validateScheduledAtIso(isoString) {
    try {
      const d = new Date(isoString);
      return !isNaN(d.getTime());
    } catch {
      return false;
    }
  }

  async function saveAndSchedule() {
    if (!pendingBlob) return alert('No recorded video available. Record first.');
    if (!validateScheduledAtIso(scheduledAt)) return alert('Invalid scheduled datetime.');
    if (!supabase) return alert('Supabase is not configured on the client. Scheduling is disabled.');

    setSaving(true);

    try {
      const ext = pendingBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `recordings/clip_${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage.from('recordings').upload(fileName, pendingBlob, {
        contentType: pendingBlob.type,
        upsert: false
      });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        alert('Failed to upload video to storage. See console.');
        setSaving(false);
        return;
      }

      const getPublic = supabase.storage.from('recordings').getPublicUrl(fileName);
      const media_url = (getPublic && getPublic.data && (getPublic.data.publicUrl || getPublic.data.publicURL)) || null;

      const scheduled_for = new Date(scheduledAt).toISOString();
      const payload = {
        topic: topic || 'AI Generated Video',
        caption_text: caption || '',
        hashtags: hashtags || '',
        media_url,
        status: 'PENDING',
        scheduled_for,
        platforms: platformsSelected.join(',')
      };

      const { data: insertData, error: insertError } = await supabase.from('scheduled_posts').insert([payload]).select();

      if (insertError) {
        console.error('scheduled_posts insert error:', insertError);
        alert('Failed to create scheduled post. See console for details.');
        setSaving(false);
        return;
      }

      setShowSchedule(false);
      setPendingBlob(null);
      setPlatformsSelected([]);
      setTopic('');
      setCaption('');
      setHashtags('');

      await fetchPosts();
      alert('Post scheduled successfully.');
    } catch (err) {
      console.error('saveAndSchedule unexpected error:', err);
      alert('Unexpected error while scheduling. See console.');
    } finally {
      setSaving(false);
    }
  }

  const filteredPosts = posts.filter(p => filter === 'ALL' || p.status === filter);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-sky-400">OmniSocial AI Command Center</h1>
          <p className="text-sm text-slate-400 mt-1">Automated Cross-Platform Publishing Hub (YouTube, Instagram, TikTok, X)</p>
        </div>

        <div className="flex gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-slate-400">TOTAL</div>
            <div className="text-xl font-bold text-sky-400">{posts.length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-slate-400">PENDING</div>
            <div className="text-xl font-bold text-amber-400">{posts.filter(p => p.status === 'PENDING').length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-slate-400">PUBLISHED</div>
            <div className="text-xl font-bold text-emerald-400">{posts.filter(p => p.status === 'PUBLISHED').length}</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-3">Video Studio</h2>
          <VideoStudioClient onRecordingComplete={handleRecordingComplete} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {['ALL', 'PENDING', 'PUBLISHED', 'FAILED'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1 rounded-md text-sm font-semibold ${filter === status ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-300'}`}
                >
                  {status}
                </button>
              ))}
            </div>
            <button onClick={fetchPosts} className="px-3 py-1 rounded-md bg-slate-800 text-slate-200">🔄 Refresh</button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500">Loading scheduled posts...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16 rounded-lg bg-slate-900 text-slate-400">No posts found in this view.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map(post => (
                <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                  {post.media_url && <img src={post.media_url} alt={post.topic} className="w-full h-44 object-cover" />}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">{post.topic}</h3>
                      <p className="text-sm text-slate-400 line-clamp-3 mt-1">{post.caption_text}</p>
                      <p className="text-xs text-sky-400 mt-2">{post.hashtags}</p>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
                      <span className="text-xs text-slate-400">{post.scheduled_for ? new Date(post.scheduled_for).toLocaleString() : '—'}</span>
                      {post.status === 'PENDING' && (
                        <button
                          onClick={() => triggerImmediatePublish(post.id)}
                          disabled={publishingId === post.id}
                          className="px-3 py-1 bg-sky-600 text-white rounded-md text-sm font-semibold disabled:opacity-60"
                        >
                          {publishingId === post.id ? 'Publishing...' : '🚀 Publish Now'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Schedule modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 rounded-lg max-w-xl w-full p-6">
            <h3 className="text-lg font-semibold mb-3">Schedule Post</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300">Platforms</label>
                <div className="flex gap-2 mt-2">
                  {AVAILABLE_PLATFORMS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`px-3 py-1 rounded-md text-sm ${platformsSelected.includes(p) ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300">Scheduled at (local)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="mt-2 w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300">Topic / Title</label>
                <input value={topic} onChange={e => setTopic(e.target.value)} className="mt-2 w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100" />
              </div>

              <div>
                <label className="block text-sm text-slate-300">Caption</label>
                <textarea value={caption} onChange={e => setCaption(e.target.value)} className="mt-2 w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100" rows={3} />
              </div>

              <div>
                <label className="block text-sm text-slate-300">Hashtags (space-separated)</label>
                <input value={hashtags} onChange={e => setHashtags(e.target.value)} className="mt-2 w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100" />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button onClick={() => { setShowSchedule(false); setPendingBlob(null); }} className="px-4 py-2 rounded-md bg-slate-700 text-white">Cancel</button>
                <button onClick={saveAndSchedule} disabled={saving} className="px-4 py-2 rounded-md bg-emerald-500 text-slate-900">
                  {saving ? 'Saving...' : 'Schedule Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
