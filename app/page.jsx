'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function SocialDashboard() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [publishingId, setPublishingId] = useState(null);
  
  // Campaign Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('Error loading posts:', error);
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  }

  // Create Campaign Action
  async function handleCreateCampaign(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    try {
      // Calls your campaign creation API endpoint
      const res = await fetch('/api/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });

      if (res.ok) {
        alert('Campaign created successfully!');
        setTopic('');
        setIsModalOpen(false);
        fetchPosts(); // Reload post list
      } else {
        alert('Failed to generate campaign. Check API keys.');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating campaign.');
    } finally {
      setIsGenerating(false);
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
        alert('Publishing failed.');
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
      
      {/* HEADER SECTION */}
      <header style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '800', margin: 0, color: '#38bdf8' }}>
            OmniSocial AI Command Center
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Automated Cross-Platform Publishing Hub (YouTube, Instagram, TikTok, LinkedIn, X)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* CREATE CAMPAIGN BUTTON */}
          <button
            onClick={() => setIsModalOpen(true)}
            style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
          >
            ✨ Create Campaign
          </button>

          <div style={{ backgroundColor: '#0f172a', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>TOTAL</span>
            <strong style={{ fontSize: '1.25rem', color: '#38bdf8' }}>{posts.length}</strong>
          </div>
          <div style={{ backgroundColor: '#0f172a', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>PENDING</span>
            <strong style={{ fontSize: '1.25rem', color: '#fbbf24' }}>{posts.filter(p => p.status === 'PENDING').length}</strong>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
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
            No posts found in this view. Click "✨ Create Campaign" to generate one!
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
                      {new Date(post.scheduled_for).toLocaleDateString()}
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

      {/* CREATE CAMPAIGN MODAL POPUP */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', padding: '2rem', borderRadius: '0.75rem', width: '100%', maxWidth: '480px' }}>
            <h2 style={{ margin: '0 0 1rem 0', color: '#38bdf8' }}>Create New Campaign</h2>
            <form onSubmit={handleCreateCampaign}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Campaign Niche / Topic:
              </label>
              <input
                type="text"
                placeholder="e.g. AI Technology Trends, Fitness Tips..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #334155', backgroundColor: '#020617', color: 'white', marginBottom: '1.5rem', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', backgroundColor: '#334155', color: 'white', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {isGenerating ? 'Generating...' : 'Start Generation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
