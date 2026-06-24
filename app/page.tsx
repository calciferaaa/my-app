'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// 距離計算関数（メートル単位）
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function Home() {
  const [view, setView] = useState('timeline');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f9fafb', fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '90px' }}>
        {view === 'timeline' && <TimelineView />}
        {view === 'map' && <MapView />}
        {view === 'profile' && <ProfileView />}
      </div>
      <nav style={{ height: '70px', display: 'flex', borderTop: '1px solid #eee', backgroundColor: 'white', position: 'fixed', bottom: 0, width: '100%', alignItems: 'center' }}>
        <NavButton label="🏠 ホーム" active={view === 'timeline'} onClick={() => setView('timeline')} />
        <NavButton label="📍 マップ" active={view === 'map'} onClick={() => setView('map')} />
        <NavButton label="👤 プロフィール" active={view === 'profile'} onClick={() => setView('profile')} />
      </nav>
    </div>
  );
}

function NavButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return <button onClick={onClick} style={{ flex: 1, border: 'none', background: 'transparent', fontWeight: active ? '700' : '400', color: active ? '#3b82f6' : '#9ca3af', fontSize: '12px', cursor: 'pointer' }}>{label}</button>;
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

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      
      // 1. スポット判定 (50m以内)
      const { data: spots } = await supabase.from('spots').select('*');
      const nearbySpot = spots?.find(s => getDistance(latitude, longitude, s.latitude, s.longitude) < 100);

      const fileName = `${Date.now()}_${file.name}`;
      await supabase.storage.from('posts').upload(fileName, file);
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName);
      
      // 2. 投稿を保存（nearbySpotがあればitem_nameを入れる）
      await supabase.from('posts').insert([{ 
        photo_url: urlData.publicUrl, 
        comment, 
        item_name: nearbySpot?.item_name || null 
      }]);

      // 3. アイテム所有リストに保存
      if (nearbySpot) {
        await supabase.from('user_items').insert([{ 
          spot_name: nearbySpot.name, 
          item_name: nearbySpot.item_name 
        }]);
        alert(`🎉「${nearbySpot.item_name}」をゲットしました！`);
      }
      window.location.reload();
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '800' }}>タイムライン</h2>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <textarea placeholder="コメント..." onChange={(e) => setComment(e.target.value)} style={{ width: '100%', margin: '10px 0', padding: '10px' }} />
      <button onClick={handleUpload} style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px' }}>{loading ? '投稿中...' : '写真を投稿してゲット！'}</button>
      {posts.map((post) => (
        <div key={post.id} style={{ marginTop: '20px', padding: '10px', background: 'white', borderRadius: '15px' }}>
          {post.photo_url && <img src={post.photo_url} style={{ width: '100%', borderRadius: '10px' }} />}
          <p>{post.comment}</p>
          {post.item_name && <small style={{ color: '#3b82f6' }}>✨ ゲットしたアイテム: {post.item_name}</small>}
        </div>
      ))}
    </div>
  );
}

function MapView() {
  const mapContainer = useRef(null);
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      style: { version: 8, sources: { gsi: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'], tileSize: 256, attribution: '国土地理院' } }, layers: [{ id: 'gsi-layer', type: 'raster', source: 'gsi', minzoom: 0, maxzoom: 18 }] } as any,
      center: [139.7454, 35.6586], zoom: 14,
    });
    map.on('load', async () => {
      const { data: spots } = await supabase.from('spots').select('*');
      spots?.forEach(spot => {
        new maplibregl.Marker({ color: '#ff4757' })
          .setLngLat([spot.longitude, spot.latitude])
          .setPopup(new maplibregl.Popup().setHTML(`<b>${spot.name}</b><br>報酬: ${spot.item_name}`))
          .addTo(map);
      });
    });
    return () => map.remove();
  }, []);
  return <div ref={mapContainer} style={{ width: '100%', height: 'calc(100vh - 70px)' }} />;
}

function ProfileView() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('user_items').select('*').then(({ data }) => { if (data) setItems(data); });
  }, []);
  return (
    <div style={{ padding: '20px' }}>
      <h2>👤 プロフィール</h2>
      <h3>コレクション</h3>
      {items.map((i, idx) => <div key={idx} style={{ padding: '10px', background: '#fff', margin: '5px 0', borderRadius: '8px' }}>{i.item_name}</div>)}
    </div>
  );
}