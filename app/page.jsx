'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  // defensive: do not throw at import time if env is missing
  console.warn('NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Supabase queries will be skipped.');
}

export default function SocialDashboard() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [publishingId, setPublishingId] = useState(null);

  const platforms = [
    { name: 'Instagram', color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
    { name: 'TikTok', color: 'bg-black text-white border border-gray-700' },
    { name: 'YouTube', color: 'bg-red-600 text-white' },
    { name: 'LinkedIn', color: 'bg-blue-600 text-white' },
    { name: 'X / Twitter', color: 'bg-gray-900 text-white' },
  ];

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPosts() {
    setLoading(true);

    if (!supabase) {
      console.warn('Skipping fetchPosts: Supabase client not configured.');
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .order('scheduled_for', { ascending: true });

      if (error) {
        console.error('Error loading posts:', error);
        setPosts([]);
      } else {
        setPosts(data || []);
      }
    } catch (err) {
      console.error('Unexpected error loading posts:', err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  async function triggerImmediatePublish(postId) {
    setPublishingId(postId);
    try {
      const response = await fetch('/api/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      });

      if (response.ok) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'PUBLISHED' } : p));
      } else {
        console.error('Publishing failed, server returned non-OK status');
        alert('Publishing failed. Check server log.');
      }
    } catch (err) {
      console.error(err);
      alert('Error triggering publish.');
    } finally {
      setPublishingId(null);
    }
  }

  const filteredPosts = posts.filter(p => filter === 'ALL' || p.status === filter);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', color: '#f8fafc', padding: '2rem', fontFamily: 'sans-serif' }}>
      <header style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '800', margin: 0, color: '#38bdf8' }}>
            OmniSocial AI Command Center
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Automated Cross-Platform Publishing Hub (YouTube, Instagram, TikTok, LinkedIn, X)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>TOTAL</span>
            <strong style={{ fontSize: '1.25rem', color: '#38bdf8' }}>{posts.length}</strong>
          </div>
          <div style={{ backgroundColor: '#0f172a', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>PENDING</span>
            <strong style={{ fontSize: '1.25rem', color: '#fbbf24' }}>{posts.filter(p => p.status === 'PENDING').length}</strong>
          </div>
          <div style={{ backgroundColor: '#0f172a', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>PUBLISHED</span>
            <strong style={{ fontSize: '1.25rem', color: '#34d399' }}>{posts.filter(p => p.status === 'PUBLISHED').length}</strong>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '2rem auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['ALL', 'PENDING', 'PUBLISHED', 'FAILED'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: filter === status ? '#0284c7' : '#0f172a',
                  color: filter === status ? '#ffffff' : '#94a3b8'
                }}
              >
                {status}
              </button>
            ))}
          </div>
          <button
            onClick={fetchPosts}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.75rem', backgroundColor: '#1e293b', color: '#f8fafc', border: 'none', cursor: 'pointer' }}
          >
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading scheduled posts...</div>
        ) : filteredPosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: '#0f172a', borderRadius: '0.75rem', color: '#64748b' }}>
            No posts found in this view.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {filteredPosts.map(post => (
              <div key={post.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.75rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {post.media_url && (
                  <img src={post.media_url} alt={post.topic} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                )}
                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#f8fafc' }}>{post.topic}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0 0 0.5rem 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.caption_text}
                    </p>
                    <p style={{ color: '#38bdf8', fontSize: '0.75rem', margin: '0 0 1rem 0' }}>{post.hashtags}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #1e293b' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {post.scheduled_for ? new Date(post.scheduled_for).toLocaleDateString() : '—'}
                    </span>
                    {post.status === 'PENDING' && (
                      <button
                        onClick={() => triggerImmediatePublish(post.id)}
                        disabled={publishingId === post.id}
                        style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
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
      </main>
    </div>
  );
}
