'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// --- 距離計算関数 ---
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 最初のセッション取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div>読み込み中...</div>;
  if (!session) return <AuthView />; // セッションがない時だけログイン画面

  return <MainApp />; // セッションがある時だけメイン画面
}

function AuthView() {
  useEffect(() => {
    supabase.auth.signOut();
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ログイン関数
  const doSignIn = async () => {
    console.log("ログインボタン押下"); // ターミナルかブラウザのコンソールに出るか確認！
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  // 新規登録関数
  const doSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>ログイン / 新規登録</h2>
      <input
        type="email"
        placeholder="メールアドレス"
        value={email} // valueをバインドする
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: '100%', marginBottom: '10px', padding: '10px', display: 'block' }}
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password} // valueをバインドする
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', marginBottom: '20px', padding: '10px', display: 'block' }}
      />
      <button
        onClick={doSignIn}
        style={{ width: '100%', padding: '10px', background: '#3b82f6', color: 'white', border: 'none', marginBottom: '10px', cursor: 'pointer' }}
      >
        ログイン
      </button>
      <button
        onClick={doSignUp}
        style={{ width: '100%', padding: '10px', background: '#e5e7eb', border: 'none', cursor: 'pointer' }}
      >
        新規登録
      </button>
    </div>
  );
}

// --- メイン画面 (これまでの全機能) ---
function MainApp() {
  const [view, setView] = useState('timeline');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '90px' }}>
        {view === 'timeline' && <TimelineView />}
        {view === 'map' && <MapView />}
        {view === 'profile' && <ProfileView />}
      </div>
      <nav style={{
        height: '60px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderTop: '1px solid #dbdbdb',
        backgroundColor: 'white',
        position: 'fixed',
        bottom: 0,
        width: '100%'
      }}>
        <button onClick={() => setView('timeline')} style={navBtnStyle}>🏠</button>
        <button onClick={() => setView('map')} style={navBtnStyle}>🔍</button>
        <button onClick={() => setView('profile')} style={navBtnStyle}>👤</button>
      </nav>
    </div>
  );
}
const navBtnStyle = { border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' };


function TimelineView() {
  const [posts, setPosts] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    supabase.from('posts').select('*').order('created_at', { ascending: false }).then(({ data }) => { if (data) setPosts(data); });
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const { data: spots } = await supabase.from('spots').select('*');
      const nearbySpot = spots?.find(s => getDistance(latitude, longitude, s.latitude, s.longitude) < 50);

      const fileName = `${Date.now()}_${file.name}`;
      await supabase.storage.from('posts').upload(fileName, file);
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName);
      await supabase.from('posts').insert([{ photo_url: urlData.publicUrl, comment, item_name: nearbySpot?.item_name || null }]);

      if (nearbySpot) await supabase.from('user_items').insert([{ spot_name: nearbySpot.name, item_name: nearbySpot.item_name }]);
      window.location.reload();
    });
  };

return (
    <div style={{ padding: '0', backgroundColor: 'white', maxWidth: '600px', margin: '0 auto' }}>
      {posts.map(p => (
        <div key={p.id} style={{ marginBottom: '40px' }}>
          {/* 写真 */}
          <div style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#efefef' }}>
            <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          
          {/* アクションボタン */}
          <div style={{ padding: '12px 16px', display: 'flex', gap: '15px' }}>
            <span style={{ fontSize: '24px' }}>🤍</span>
            <span style={{ fontSize: '24px' }}>💬</span>
          </div>

          {/* キャプション */}
          <div style={{ padding: '0 16px' }}>
            <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.4' }}>
              <span style={{ fontWeight: 'bold', marginRight: '8px' }}>user_name</span>
              {p.comment}
            </p>
            {p.item_name && (
              <p style={{ color: '#0095f6', fontSize: '13px', marginTop: '8px', fontWeight: '600' }}>
                📍 {p.item_name} を発見！
              </p>
            )}
          </div>
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
      style: { 
        version: 8, 
        sources: { 
          gsi: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'], tileSize: 256, attribution: '国土地理院' } 
        }, 
        layers: [{ id: 'gsi-layer', type: 'raster', source: 'gsi', minzoom: 0, maxzoom: 18 }] 
      } as any,
      center: [139.7454, 35.6586], 
      zoom: 14,
    });

    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true
    });
    map.addControl(geolocate);

    // ロード完了後にすべてを実行
    map.on('load', async () => {
      // 1. 現在地の取得
      geolocate.trigger();

      // 2. スポットデータの取得とピンの設置
      const { data: spots, error } = await supabase.from('spots').select('*');
      
      if (error) {
        console.error("スポット取得エラー:", error);
        return;
      }

      if (spots) {
        spots.forEach(spot => {
          // ピン（マーカー）を作成
          new maplibregl.Marker({ color: '#ff4757' })
            .setLngLat([spot.longitude, spot.latitude])
            .setPopup(new maplibregl.Popup().setHTML(`<h3>${spot.name}</h3>`))
            .addTo(map);
        });
      }
    });

    return () => map.remove();
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: 'calc(100vh - 70px)' }} />;
}

function ProfileView() {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('posts').select('*').then(({ data }) => {
      if (data) setPosts(data);
    });
  }, []);

  // ログアウト処理
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload(); // ログアウト後に画面をリロードしてログイン画面へ
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      {/* ヘッダー：ここにログアウトボタンを配置 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#eee' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>User Profile</h2>
            <p style={{ margin: '5px 0', color: '#666' }}>{posts.length} 投稿</p>
          </div>
        </div>
        {/* ログアウトボタン */}
        <button 
          onClick={handleSignOut}
          style={{ 
            padding: '8px 16px', 
            borderRadius: '8px', 
            border: '1px solid #dbdbdb', 
            background: 'white', 
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ログアウト
        </button>
      </div>

      {/* 投稿グリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
        {posts.map((p) => (
          <div key={p.id} style={{ aspectRatio: '1/1', backgroundColor: '#efefef' }}>
            <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
      </div>
    </div>
  );
}