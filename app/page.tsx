'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function Home() {
  const [view, setView] = useState('timeline');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '90px' }}>
        {view === 'timeline' && <TimelineView />}
        {view === 'map' && <MapView />}
        {view === 'profile' && <ProfileView />}
      </div>

      <nav style={{ height: '70px', display: 'flex', borderTop: '1px solid #eee', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', position: 'fixed', bottom: 0, width: '100%', alignItems: 'center', boxShadow: '0 -4px 12px rgba(0,0,0,0.03)' }}>
        <NavButton label="🏠 ホーム" active={view === 'timeline'} onClick={() => setView('timeline')} />
        <NavButton label="📍 マップ" active={view === 'map'} onClick={() => setView('map')} />
        <NavButton label="👤 プロフィール" active={view === 'profile'} onClick={() => setView('profile')} />
      </nav>
    </div>
  );
}

function NavButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ flex: 1, border: 'none', background: 'transparent', fontWeight: active ? '700' : '400', color: active ? '#3b82f6' : '#9ca3af', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
      {label}
    </button>
  );
}

function TimelineView() {
  const [posts, setPosts] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('posts').select('*').order('created_at', { ascending: false }).then(({ data }) => { if (data) setPosts(data); });
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);

    // 投稿時に位置情報を取得する
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const fileName = `${Date.now()}_${file.name}`;
      
      await supabase.storage.from('posts').upload(fileName, file);
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName);
      
      // 緯度・経度を含めて保存！
      await supabase.from('posts').insert([{ 
        photo_url: urlData.publicUrl, 
        comment: comment,
        latitude: latitude,
        longitude: longitude
      }]);
      window.location.reload();
    });
  };
  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '20px' }}>タイムライン</h2>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginBottom: '15px', width: '100%' }} />
        <textarea placeholder="今の気持ちをシェア..." onChange={(e) => setComment(e.target.value)} style={{ width: '100%', height: '80px', padding: '12px', borderRadius: '16px', border: '1px solid #f0f0f0', marginBottom: '15px', boxSizing: 'border-box' }} />
        <button onClick={handleUpload} disabled={loading} style={{ width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '16px' }}>
          {loading ? '投稿中...' : '投稿する'}
        </button>
      </div>
      {posts.map((post) => (
        <div key={post.id} style={{ marginBottom: '20px', backgroundColor: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          {post.photo_url && <img src={post.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />}
          <div style={{ padding: '20px' }}><p style={{ margin: 0, fontSize: '15px', color: '#374151' }}>{post.comment}</p></div>
        </div>
      ))}
    </div>
  );
}

function MapView() {
  const mapContainer = useRef(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    map.current = new maplibregl.Map({
      container: mapContainer.current!,
      style: {
        version: 8,
        sources: { gsi: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'], tileSize: 256, attribution: '国土地理院' } },
        layers: [{ id: 'gsi-layer', type: 'raster', source: 'gsi', minzoom: 0, maxzoom: 18 }]
      } as any,
      center: [139.7454, 35.6586], zoom: 14,
    });

    map.current.on('load', async () => {
      // 現在地のピン（青）
      navigator.geolocation.getCurrentPosition((pos) => {
        const { longitude, latitude } = pos.coords;
        map.current?.setCenter([longitude, latitude]);
        new maplibregl.Marker({ color: '#3b82f6' })
          .setLngLat([longitude, latitude])
          .addTo(map.current!);
      });

      // 予め登録されたスポットを取得（赤）
      const { data: spots } = await supabase.from('spots').select('name, latitude, longitude');
      
      if (spots) {
        spots.forEach((spot) => {
          const el = document.createElement('div');
          el.style.backgroundColor = '#ff4757';
          el.style.width = '20px';
          el.style.height = '20px';
          el.style.borderRadius = '50%';
          el.style.border = '2px solid white';
          
          new maplibregl.Marker(el)
            .setLngLat([spot.longitude, spot.latitude])
            .setPopup(new maplibregl.Popup().setText(spot.name))
            .addTo(map.current!);
        });
      }
    });

    return () => map.current?.remove();
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: 'calc(100vh - 70px)' }} />;
}

function ProfileView() {
  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '800' }}>👤 プロフィール</h2>
      <div style={{ marginTop: '20px', backgroundColor: 'white', padding: '24px', borderRadius: '24px' }}>
        <p style={{ color: '#666' }}>準備中です！</p>
      </div>
    </div>
  );
}