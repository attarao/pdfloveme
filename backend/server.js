/**
 * PDFLoveMe - Backend (Express + Mongoose)
 * Features:
 * - Email/password signup (bcrypt) + JWT login
 * - Auto-generate API key at signup
 * - Free/Premium plan enforcement via simple daily counters (in-memory for demo; use Redis for production)
 * - API key middleware: x-api-key or Authorization: Bearer <token>
 * - PDF APIs: merge, split, compress, convert (LibreOffice required), sign (pdf-lib)
 *
 * Note: This is a starter implementation. For production, add persistent rate counters, monitoring, and robust error handling.
 */

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pdfloveme';
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_jwt_secret';
const FREE_LIMIT = parseInt(process.env.FREE_PLAN_LIMIT || '20', 10);

// ---- Mongoose models ----
mongoose.connect(MONGO_URI).then(()=>console.log('Mongo connected')).catch(err=>console.error(err));
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  apiKey: { type: String, unique: true, sparse: true },
  plan: { type: String, enum: ['free','premium'], default: 'free' },
  createdAt: { type: Date, default: Date.now },
  dailyCount: { type: Number, default: 0 },
  dailyReset: { type: Date, default: () => new Date() }
});
const User = mongoose.model('User', userSchema);

// Helper: generate API key
function genApiKey(){ return 'pk_' + uuidv4().replace(/-/g,''); }

// Middleware: authenticate via JWT or API key
async function authMiddleware(req, res, next){
  try {
    const apiKey = req.header('x-api-key');
    if(apiKey){
      const user = await User.findOne({ apiKey });
      if(!user) return res.status(401).json({ error: 'Invalid API key' });
      req.user = user;
      return next();
    }
    const auth = req.header('authorization');
    if(auth && auth.startsWith('Bearer ')){
      const token = auth.slice(7);
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(payload.id);
      if(!user) return res.status(401).json({ error: 'Invalid token' });
      req.user = user;
      return next();
    }
    return res.status(401).json({ error: 'No credentials' });
  } catch(err){ console.error(err); return res.status(401).json({ error: 'Auth error' }); }
}

// Simple per-user daily limit enforcement (demo; use Redis in prod)
async function enforceLimit(req, res, next){
  const user = req.user;
  const now = new Date();
  if(!user.dailyReset || (now - user.dailyReset) > 24*3600*1000){
    user.dailyCount = 0;
    user.dailyReset = now;
    await user.save();
  }
  const limit = user.plan === 'premium' ? 1000000 : FREE_LIMIT;
  if(user.dailyCount >= limit) return res.status(429).json({ error: 'Daily API limit reached' });
  user.dailyCount += 1;
  await user.save();
  next();
}

// Public: signup - create user, hash password, generate API key, return token & key
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, plan } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'email & password required' });
    const existing = await User.findOne({ email });
    if(existing) return res.status(400).json({ error: 'Email exists' });
    const hash = await bcrypt.hash(password, 10);
    const apiKey = genApiKey();
    const user = new User({ email, passwordHash: hash, apiKey, plan: plan === 'premium' ? 'premium' : 'free' });
    await user.save();
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, apiKey, user: { email: user.email, plan: user.plan } });
  } catch(err){ console.error(err); res.status(500).json({ error: 'Signup failed' }); }
});

// Public: login (email/password) -> returns JWT & apiKey
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if(!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, apiKey: user.apiKey, user: { email: user.email, plan: user.plan } });
  } catch(err){ console.error(err); res.status(500).json({ error: 'Login failed' }); }
});

// Protected: regenerate API key
app.post('/api/auth/regenerate', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    user.apiKey = genApiKey();
    await user.save();
    res.json({ apiKey: user.apiKey });
  } catch(err){ console.error(err); res.status(500).json({ error: 'Regenerate failed' }); }
});

// Protected: get profile
app.get('/api/me', authMiddleware, (req,res)=>{
  const user = req.user;
  res.json({ email: user.email, plan: user.plan, apiKey: user.apiKey });
});

// ---- PDF endpoints (protected + enforce limit) ----
app.post('/api/merge', authMiddleware, enforceLimit, upload.array('files'), async (req, res) => {
  try {
    if(!req.files || req.files.length === 0) return res.status(400).json({ error: 'no files' });
    const mergedPdf = await PDFDocument.create();
    for(const f of req.files){
      const data = fs.readFileSync(f.path);
      const pdf = await PDFDocument.load(data);
      const copied = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copied.forEach(p=>mergedPdf.addPage(p));
    }
    const out = await mergedPdf.save();
    req.files.forEach(f=>fs.unlinkSync(f.path));
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename=merged.pdf');
    res.send(Buffer.from(out));
  } catch(err){ console.error(err); res.status(500).json({ error: 'Merge failed' }); }
});

app.post('/api/split', authMiddleware, enforceLimit, upload.single('file'), async (req, res) => {
  try {
    if(!req.file) return res.status(400).json({ error: 'no file' });
    const pagesQuery = req.body.pages || req.query.pages;
    const data = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(data);
    const total = pdf.getPageCount();
    let pagesToKeep = [];
    if(!pagesQuery){
      // default return first page
      pagesToKeep = [0];
    } else {
      const parts = pagesQuery.split(',');
      parts.forEach(p=>{
        if(p.includes('-')){
          const [a,b] = p.split('-').map(x=>parseInt(x.trim(),10));
          for(let i=a;i<=b;i++) pagesToKeep.push(i-1);
        } else {
          pagesToKeep.push(parseInt(p.trim(),10)-1);
        }
      });
    }
    const outPdf = await PDFDocument.create();
    const copied = await outPdf.copyPages(pdf, pagesToKeep.filter(i=>i>=0&&i<total));
    copied.forEach(p=>outPdf.addPage(p));
    const out = await outPdf.save();
    fs.unlinkSync(req.file.path);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename=split.pdf');
    res.send(Buffer.from(out));
  } catch(err){ console.error(err); res.status(500).json({ error: 'Split failed' }); }
});

app.post('/api/compress', authMiddleware, enforceLimit, upload.single('file'), async (req,res)=>{
  try {
    if(!req.file) return res.status(400).json({ error: 'no file' });
    const data = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(data);
    const outPdf = await PDFDocument.create();
    const copied = await outPdf.copyPages(pdf, pdf.getPageIndices());
    copied.forEach(p=>outPdf.addPage(p));
    const out = await outPdf.save({ useObjectStreams: false });
    fs.unlinkSync(req.file.path);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename=compressed.pdf');
    res.send(Buffer.from(out));
  } catch(err){ console.error(err); res.status(500).json({ error: 'Compress failed' }); }
});

// Convert using LibreOffice - requires libreoffice present in container
const { execFile } = require('child_process');
app.post('/api/convert', authMiddleware, enforceLimit, upload.single('file'), async (req,res)=>{
  try {
    if(!req.file) return res.status(400).json({ error: 'no file' });
    const target = req.body.target || req.query.target || 'docx';
    const inPath = path.resolve(req.file.path);
    const outDir = path.resolve('uploads','converted');
    fs.mkdirSync(outDir, { recursive: true });
    const cmd = 'libreoffice';
    const args = ['--headless','--convert-to', target, '--outdir', outDir, inPath];
    execFile(cmd, args, (err, stdout, stderr) => {
      try{ fs.unlinkSync(inPath); }catch(e){}
      if(err){ console.error(err); return res.status(500).json({ error: 'Conversion failed. Ensure libreoffice installed.'}); }
      const base = path.basename(req.file.originalname, path.extname(req.file.originalname));
      const files = fs.readdirSync(outDir).filter(f=>f.startsWith(base));
      if(files.length === 0) return res.status(500).json({ error: 'No converted file' });
      const outFile = path.join(outDir, files[0]);
      res.download(outFile, files[0], (err2)=>{ try{ fs.unlinkSync(outFile);}catch(e){} });
    });
  } catch(err){ console.error(err); res.status(500).json({ error: 'Convert failed' }); }
});

app.post('/api/sign', authMiddleware, enforceLimit, upload.single('file'), async (req,res)=>{
  try {
    if(!req.file) return res.status(400).json({ error: 'no file' });
    const name = req.body.name || 'Signed';
    const data = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(data);
    const pages = pdf.getPages();
    const first = pages[0];
    const { width, height } = first.getSize();
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    first.drawText(name, { x: width - 150, y: 40, size: 12, font, color: rgb(0.2,0.2,0.7) });
    const out = await pdf.save();
    fs.unlinkSync(req.file.path);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename=signed.pdf');
    res.send(Buffer.from(out));
  } catch(err){ console.error(err); res.status(500).json({ error: 'Sign failed' }); }
});

// Admin: promote user to premium (simple endpoint - in prod protect this)
app.post('/api/admin/promote', async (req,res)=>{
  try {
    const { email } = req.body;
    // In production secure this endpoint
    const user = await User.findOne({ email });
    if(!user) return res.status(404).json({ error: 'No user' });
    user.plan = 'premium';
    await user.save();
    res.json({ ok: true });
  } catch(err){ console.error(err); res.status(500).json({ error: 'Promote failed' }); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log('Backend listening on', PORT));
