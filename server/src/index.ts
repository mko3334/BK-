import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-256-bit-secret';

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// 指示書2: JWT + OAuth 2.0 形式の認証
app.post('/api/auth/login', (req, res) => {
  const { role } = req.body;
  
  // ダミーログインロジック
  const token = jwt.sign({ role }, JWT_SECRET, { expiresIn: '1h' });
  
  // セキュアなCookieの設定 (HttpOnly)
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1 hour
  });

  res.json({ success: true, role });
});

// 指示書2: BFF集約レイヤーの例 (送迎管理データ)
app.get('/api/bff/transportation', (req, res) => {
  // 本来はここで複数のマイクロサービスからデータを取得・整形
  const data = {
    status: 'success',
    routes: [
      { id: 1, name: 'ルートA', time: '15:00' },
      { id: 2, name: 'ルートB', time: '15:30' }
    ]
  };
  res.json(data);
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`BFF Server running on http://localhost:${PORT}`);
});
