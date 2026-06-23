'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function Home() {
  const [view, setView] = useState('timeline');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fafafa' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>
        {view === 'timeline' && <TimelineView />}
        {view === 'map' && <MapView />}
        {view === 'profile' && <ProfileView />}
      </div>

      <div style={{ height: '70px', display: 'flex', borderTop: '1px solid #ddd', backgroundColor: 'white', position: 'fixed', bottom: 0, width: '100%', alignItems: 'center' }}>
        <button onClick={() => setView('timeline')} style={{ flex: 1, border: 'none', background: 'white', fontWeight: view === 'timeline' ? 'bold' : 'normal' }}>🏠 ホーム</button>
        <button onClick={() => setView('map')} style={{ flex: 1, border: 'none', background: 'white', fontWeight: view === 'map' ? 'bold' : 'normal' }}>📍 マップ</button>
        <button onClick={() => setView('profile')} style={{ flex: 1, border: 'none', background: 'white', fontWeight: view === 'profile' ? 'bold' : 'normal' }}>👤 プロフィール</button>
      </div>
    </div>
  );
}

// タイムライン画面
function TimelineView() {
  const [posts, setPosts] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    supabase.from('posts').select('*').order('created_at', { ascending: false }).then(({ data }) => { if (data) setPosts(data); });
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    const fileName = `${Date.now()}_${file.name}`;
    await supabase.storage.from('posts').upload(fileName, file);
    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName);
    await supabase.from('posts').insert([{ photo_url: urlData.publicUrl, comment: comment }]);
    window.location.reload();
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>タイムライン</h2>
      <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ddd', borderRadius: 10 }}>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <textarea placeholder="コメント..." onChange={(e) => setComment(e.target.value)} style={{ width: '100%', display: 'block', margin: '10px 0' }} />
        <button onClick={handleUpload} style={{ width: '100%', padding: 10, background: '#ff4757', color: 'white', border: 'none', borderRadius: 5 }}>投稿する</button>
      </div>
      {posts.map((post) => (
        <div key={post.id} style={{ marginBottom: 30, backgroundColor: 'white', padding: 15, borderRadius: 10 }}>
          {post.photo_url && <img src={post.photo_url} style={{ width: '100%', borderRadius: 10 }} />}
          <p>{post.comment}</p>
        </div>
      ))}
    </div>
  );
}

// マップ画面
function MapView() {
  const mapContainer = useRef(null);
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      style: { version: 8, sources: { gsi: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'], tileSize: 256, attribution: '国土地理院' } }, layers: [{ id: 'gsi-layer', type: 'raster', source: 'gsi', minzoom: 0, maxzoom: 18 }] } as any,
      center: [139.7454, 35.6586], zoom: 14,
    });
    return () => map.remove();
  }, []);
  return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
}

// プロフィール画面
function ProfileView() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('user_items').select('*').then(({ data }) => { if (data) setItems(data); });
  }, []);
  return (
    <div style={{ padding: 20 }}>
      <h2>👤 プロフィール</h2>
      <h3>ゲットしたアイテム</h3>
      {items.map((item, i) => (
        <div key={i} style={{ padding: 10, borderBottom: '1px solid #eee' }}>{item.item_name}</div>
      ))}
    </div>
  );
}